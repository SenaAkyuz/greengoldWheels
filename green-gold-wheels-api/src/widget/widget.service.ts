import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Database, type Queryable } from '../database/database';
import {
  CreateWidgetEventDto,
  WIDGET_EVENT_TYPES,
} from './dto/create-widget-event.dto';
import {
  estimateContribution,
  isPlaceholderFactor,
  type CarbonEstimate,
  type FactorScope,
  type VehicleFactor,
} from '../common/carbon-estimate';
import {
  resolveWidgetSettings,
  type ContentOverrides,
} from '../common/widget-settings';
import { DashboardService } from '../dashboard/dashboard.service';

/** Widget'ın araç seçicisinde gösterdiği tek sınıf (public — hassas alan yok). */
export interface WidgetVehicleClass {
  class_code: string;
  label_tr: string;
  label_en: string;
  fuel_type: string;
  co2e_per_km_kg: number;
  factor_source: string;
  factor_country: string;
  factor_year: number;
  factor_scope: FactorScope;
  /** Faktör onaylı bir kaynaktan gelmiyorsa true. */
  is_placeholder_factor: boolean;
}

export interface WidgetConfig {
  company_name: string;
  city: string | null;
  currency: string;
  /** kg CO₂e başına katkı fiyatı. */
  price_per_kg_co2e: number;
  /** Katkı tutarının alt sınırı. */
  min_contribution_amount: number;
  /** Araç seçicisi — sıralı, yalnızca aktif sınıflar. */
  vehicle_classes: WidgetVehicleClass[];
  /** Faz 1'de her zaman true (pazarlama dürüstlüğü). */
  is_estimated: boolean;
  logo_url: string | null;
  brand_color: string | null;
  /** Şirket bazlı görünürlük. false iken widget CO₂/etki satırlarını HİÇ çizmez. */
  show_estimated_impact: boolean;
  content_overrides: ContentOverrides;
}

/**
 * Kullanıcıya gösterilen PUBLIC aylık tahmini etki — SADECE toplu (aggregate).
 * Kişisel veri yok. Sayılar dashboard carbon-summary ile birebir tutarlıdır
 * (aynı servis çağrılır).
 */
export interface WidgetImpact {
  month: string; // YYYY-MM
  estimated_co2e_kg: number;
  tree_equivalent: number;
  contributions_count: number;
  is_estimated: boolean;
}

/** Şirket satırının widget'a dönük alanları (RLS altında okunur). */
interface CompanyRow {
  id: string;
  name: string;
  city: string | null;
  default_currency: string | null;
  price_per_kg_co2e: string | number;
  min_contribution_amount: string | number;
  logo_url: string | null;
  brand_color: string | null;
  widget_settings: unknown;
}

interface VehicleClassRow {
  class_code: string;
  label_tr: string;
  label_en: string;
  fuel_type: string;
  co2e_per_km_kg: string | number;
  factor_source: string;
  factor_country: string;
  factor_year: number;
  factor_scope: FactorScope;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

const COMPANY_COLUMNS = `id, name, city, default_currency, price_per_kg_co2e,
  min_contribution_amount, logo_url, brand_color, widget_settings`;

const VEHICLE_COLUMNS = `class_code, label_tr, label_en, fuel_type, co2e_per_km_kg,
  factor_source, factor_country, factor_year, factor_scope`;

type NotFoundLike = typeof NotFoundException | typeof ForbiddenException;

@Injectable()
export class WidgetService {
  constructor(
    private readonly db: Database,
    private readonly dashboard: DashboardService,
  ) {}

  /**
   * Widget'ın gösterebileceği PUBLIC konfigürasyon. Hassas hiçbir alan dönmez.
   *   - key yok/bulunamazsa -> 404
   *   - şirket aktif değilse -> 403
   */
  async getConfig(key: string | undefined): Promise<WidgetConfig> {
    const companyId = await this.resolveActiveCompany(key, NotFoundException);

    return this.db.withTenant(companyId, async (q) => {
      const company = await this.readCompany(q, companyId);
      const settings = resolveWidgetSettings(company.widget_settings);

      const { rows: classes } = await q.query<VehicleClassRow>(
        `SELECT ${VEHICLE_COLUMNS}
           FROM vehicle_classes
          WHERE company_id = $1 AND is_active = true
          ORDER BY sort_order ASC, class_code ASC`,
        [companyId],
      );

      return {
        company_name: company.name,
        city: company.city ?? null,
        currency: company.default_currency ?? 'TRY',
        price_per_kg_co2e: Number(company.price_per_kg_co2e),
        min_contribution_amount: Number(company.min_contribution_amount),
        vehicle_classes: classes.map((c) => ({
          class_code: c.class_code,
          label_tr: c.label_tr,
          label_en: c.label_en,
          fuel_type: c.fuel_type,
          co2e_per_km_kg: Number(c.co2e_per_km_kg),
          factor_source: c.factor_source,
          factor_country: c.factor_country,
          factor_year: Number(c.factor_year),
          factor_scope: c.factor_scope,
          is_placeholder_factor: isPlaceholderFactor(c.factor_source),
        })),
        is_estimated: true,
        logo_url: company.logo_url ?? null,
        // Defans: yalnızca katı hex geçir (ham string asla style'a gitmez).
        brand_color: HEX6.test(company.brand_color ?? '')
          ? company.brand_color
          : null,
        show_estimated_impact: settings.showEstimatedImpact,
        content_overrides: settings.contentOverrides,
      };
    });
  }

  /**
   * Şirketin BU AYKİ (şirket tz) tahmini toplu etkisi. Panel carbon-summary'nin
   * public hali — aynı DashboardService çağrılır ki sayılar birebir tutsun.
   */
  async getImpact(key: string | undefined): Promise<WidgetImpact> {
    const companyId = await this.resolveActiveCompany(key, NotFoundException);

    const settings = await this.db.withTenant(companyId, async (q) => {
      const company = await this.readCompany(q, companyId);
      return resolveWidgetSettings(company.widget_settings);
    });

    // Görünürlük kapalıysa hesaplamaya bile gerek yok — istemciye her zaman
    // sıfırlanmış (yanıltmayan) sayılar dön.
    if (!settings.showEstimatedImpact) {
      return {
        month: new Date().toISOString().slice(0, 7),
        estimated_co2e_kg: 0,
        tree_equivalent: 0,
        contributions_count: 0,
        is_estimated: true,
      };
    }

    const carbon = await this.dashboard.getCarbonSummary(companyId, {
      range: 'month',
    });

    return {
      month: carbon.period.from.slice(0, 7),
      estimated_co2e_kg: carbon.estimated_co2e_kg,
      tree_equivalent: carbon.tree_equivalent,
      contributions_count: carbon.contributions_count,
      is_estimated: true,
    };
  }

  /**
   * Event kaydeder. Hesap SUNUCUDA yapılır: istemci yalnızca mesafe ve araç
   * kodu gönderir, CO₂/tutar buradaki faktör tablosundan hesaplanıp
   * metadata'ya yazılır.
   */
  async recordEvent(
    widgetKey: string | undefined,
    dto: CreateWidgetEventDto,
  ): Promise<{ id: string }> {
    // 1. X-Widget-Key yoksa -> 401
    if (!widgetKey) {
      throw new UnauthorizedException('X-Widget-Key header gerekli.');
    }

    // 2. Şirketi çöz; bulunamazsa veya aktif değilse -> 403.
    const companyId = await this.resolveActiveCompany(
      widgetKey,
      ForbiddenException,
    );

    // 3. event_type izinli mi (ValidationPipe zaten reddeder; servis-içi savunma).
    if (!WIDGET_EVENT_TYPES.includes(dto?.event_type)) {
      throw new BadRequestException(
        `event_type şunlardan biri olmalı: ${WIDGET_EVENT_TYPES.join(', ')}`,
      );
    }

    return this.db.withTenant(companyId, async (q) => {
      const company = await this.readCompany(q, companyId);

      // 3b. rezervasyona_devam_edildi: şirket bayrağı kapalıysa 400 ve HİÇ
      //     kayıt yazılmaz.
      if (dto.event_type === 'rezervasyona_devam_edildi') {
        const settings = resolveWidgetSettings(company.widget_settings);
        if (!settings.enableBookingClickTracking) {
          throw new BadRequestException(
            'rezervasyona_devam_edildi bu şirket için etkin değil.',
          );
        }
      }

      // 4. Metadata'yı SUNUCUDA üret.
      const metadata = await this.buildServerMetadata(q, company, dto);

      // 5. Idempotent insert. Transaction içinde 23505'i yakalamak işe
      //    yaramazdı: Postgres'te hata veren bir ifade transaction'ı
      //    "aborted" durumuna sokar ve ardından gelen her sorgu reddedilir.
      //    Bu yüzden çakışma ON CONFLICT ile ifadenin İÇİNDE çözülür.
      //    Hedef, 0005'teki kısmi unique index'tir (WHERE session_ref IS NOT NULL).
      const sessionRef = dto.session_ref ?? null;
      const { rows: inserted } = await q.query<{ id: string }>(
        `INSERT INTO widget_events (company_id, event_type, session_ref, metadata)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (company_id, session_ref, event_type)
           WHERE session_ref IS NOT NULL
           DO NOTHING
         RETURNING id`,
        [
          companyId,
          dto.event_type,
          sessionRef,
          metadata === null ? null : JSON.stringify(metadata),
        ],
      );

      if (inserted[0]) return { id: inserted[0].id };

      // Çakışma: aynı session + tip zaten kayıtlı -> mevcut kaydı dön (başarı).
      const { rows: existing } = await q.query<{ id: string }>(
        `SELECT id FROM widget_events
          WHERE company_id = $1 AND session_ref = $2 AND event_type = $3`,
        [companyId, sessionRef, dto.event_type],
      );
      if (!existing[0]) {
        throw new BadRequestException('Event kaydedilemedi.');
      }
      return { id: existing[0].id };
    });
  }

  /**
   * Event metadata'sı. Mesafe VE geçerli bir araç sınıfı varsa tam karbon
   * hesabı yazılır; biri eksikse yalnızca eldeki girdiler yazılır (uydurma
   * sayı YOK — panel "hesaplanamadı" durumunu ayırt edebilsin).
   */
  private async buildServerMetadata(
    q: Queryable,
    company: CompanyRow,
    dto: CreateWidgetEventDto,
  ): Promise<Record<string, unknown> | null> {
    const distanceKm = dto.metadata?.distance_km;
    const classCode = dto.metadata?.vehicle_class_code;

    if (distanceKm === undefined && classCode === undefined) return null;

    const factor = classCode
      ? await this.resolveFactor(q, company.id, classCode)
      : null;

    if (!factor || distanceKm === undefined) {
      return {
        ...(distanceKm !== undefined ? { distance_km: distanceKm } : {}),
        ...(classCode !== undefined ? { vehicle_class_code: classCode } : {}),
        estimate_available: false,
        computed_by: 'server',
      };
    }

    const estimate: CarbonEstimate = estimateContribution(distanceKm, factor, {
      price_per_kg_co2e: Number(company.price_per_kg_co2e),
      min_contribution_amount: Number(company.min_contribution_amount),
      currency: company.default_currency ?? 'TRY',
    });

    return { ...estimate, estimate_available: true };
  }

  /**
   * Araç sınıfını ŞİRKETE AİT ve AKTİF olacak şekilde çözer. company_id
   * filtresi açıkça yazılı (birinci kat); RLS ayrıca başka şirketin
   * sınıfını zaten göstermez (ikinci kat).
   */
  private async resolveFactor(
    q: Queryable,
    companyId: string,
    classCode: string,
  ): Promise<VehicleFactor | null> {
    const { rows } = await q.query<VehicleClassRow>(
      `SELECT ${VEHICLE_COLUMNS}
         FROM vehicle_classes
        WHERE company_id = $1 AND class_code = $2 AND is_active = true`,
      [companyId, classCode],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      class_code: r.class_code,
      co2e_per_km_kg: Number(r.co2e_per_km_kg),
      factor_source: r.factor_source,
      factor_country: r.factor_country,
      factor_year: Number(r.factor_year),
      factor_scope: r.factor_scope,
    };
  }

  /** Şirket satırı — tenant ayarlı transaction içinde, RLS altında. */
  private async readCompany(q: Queryable, companyId: string) {
    const { rows } = await q.query<CompanyRow>(
      `SELECT ${COMPANY_COLUMNS} FROM rental_companies WHERE id = $1`,
      [companyId],
    );
    if (!rows[0]) {
      // Anahtar çözüldü ama satır RLS altında görünmüyor -> tutarsızlık.
      // Asla "boş config" dönme; yüksek sesle başarısız ol.
      throw new NotFoundException('Widget bulunamadı.');
    }
    return rows[0];
  }

  /**
   * public_widget_key -> aktif şirketin kimliği. Tenant sınırını geçen tek
   * nokta: dar SECURITY DEFINER fonksiyonu yalnızca (id, status) döndürür.
   * Bulunamama için fırlatılacak tip çağırana bırakılır: config/impact için
   * 404, event için 403 (geçersiz anahtar varlık bilgisi sızdırmaz).
   */
  private async resolveActiveCompany(
    key: string | undefined,
    NotFoundLike: NotFoundLike,
  ): Promise<string> {
    if (!key) {
      throw new NotFoundLike('Widget anahtarı gerekli.');
    }

    const resolved = await this.db.withoutTenant(async (q) => {
      const { rows } = await q.query<{ company_id: string; status: string }>(
        'SELECT company_id, status FROM wheels_resolve_widget_key($1)',
        [key],
      );
      return rows[0] ?? null;
    });

    if (!resolved) {
      throw new NotFoundLike('Widget bulunamadı.');
    }
    if (resolved.status !== 'active') {
      throw new ForbiddenException('Widget aktif değil.');
    }
    return resolved.company_id;
  }
}
