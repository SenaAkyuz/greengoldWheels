import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Database, type Queryable } from '../database/database';
import {
  resolveRange,
  type RangeParams,
  type ResolvedRange,
} from './date-range.util';
import {
  distinctSessionCount,
  distinctSessionStages,
  funnelRates,
  type FunnelEventRow,
  type FunnelRates,
  type FunnelStages,
} from './interaction-funnel';
import { treeEquivalent } from '../common/carbon-estimate';
import type {
  CreateVehicleClassDto,
  UpdateCompanyDto,
  UpdateVehicleClassDto,
} from './dto/update-company.dto';

export interface Period {
  from: string;
  to: string;
}

export interface WidgetEventsSummary {
  period: Period;
  /** Ham event sayaçları (dedup YOK) — teşhis amaçlı. */
  raw_counts: Record<(typeof ALL_EVENT_TYPES)[number], number>;
  /** Session bazlı sıralı cohort huni (monoton). */
  stages: FunnelStages;
  /** Huni aşaması OLMAYAN yan sinyal (bkz. interaction-funnel.ts). */
  vehicle_selected_sessions: number;
  /** funnel.view_to_button_pct ile BİREBİR aynı — ortak helper. */
  conversion_rate_pct: number;
}

export interface CarbonSummary {
  period: Period;
  /**
   * Katkı NİYETİ bildiren tekil session'ların tahmini toplam CO₂e'si.
   * Doğrulanmış offset DEĞİL; buton tıklaması ödeme/rezervasyon onayı değildir.
   */
  estimated_co2e_kg: number;
  /** TEMSİLİ ağaç-yılı eşdeğeri (bkz. carbon-estimate.ts). */
  tree_equivalent: number;
  /** Katkı niyeti bildiren tekil session sayısı. */
  contributions_count: number;
  /** Toplam tahmini mesafe (km) — metodoloji denetimi için. */
  total_distance_km: number;
  /**
   * Mesafe/araç girdisi eksik olduğu için CO₂'si HESAPLANAMAYAN session
   * sayısı. Sıfırdan farklıysa toplam, gerçek etkiyi OLDUĞUNDAN AZ gösterir.
   */
  missing_estimate_count: number;
  is_estimated: boolean;
}

export interface FunnelReport {
  period: Period;
  stages: FunnelStages;
  rates: FunnelRates;
}

interface EventRow extends FunnelEventRow {
  metadata: Record<string, unknown> | null;
}

const ALL_EVENT_TYPES = [
  'widget_goruntulendi',
  'arac_secildi',
  'checkbox_secildi',
  'katki_ekle_butonuna_basildi',
  'rezervasyona_devam_edildi',
] as const;

/**
 * Panel verisi. Her metot `companyId`'yi YALNIZCA çağırandan alır (guard'ın
 * doğruladığı req.auth.companyId ya da widget anahtarının çözümü) ve tüm
 * sorguları o şirketin tenant transaction'ında çalıştırır.
 *
 * İKİ KATLI İZOLASYON: her sorguda `company_id = $1` açıkça yazılı (birinci
 * kat) VE transaction RLS'e tabi rolle şirkete bağlı (ikinci kat). Birinci
 * katta bir hata olsa bile ikinci kat başka şirketin satırını döndürmez —
 * bu, security.spec.ts'te filtresiz sorguyla ayrıca kanıtlanır.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly db: Database) {}

  async getWidgetEventsSummary(
    companyId: string,
    params: RangeParams,
  ): Promise<WidgetEventsSummary> {
    return this.db.withTenant(companyId, async (q) => {
      const range = await this.resolve(q, companyId, params);
      const rows = await this.fetchEvents(q, companyId, range);

      const raw_counts = Object.fromEntries(
        ALL_EVENT_TYPES.map((t) => [t, 0]),
      ) as WidgetEventsSummary['raw_counts'];
      for (const row of rows) {
        if ((ALL_EVENT_TYPES as readonly string[]).includes(row.event_type)) {
          raw_counts[row.event_type as (typeof ALL_EVENT_TYPES)[number]] += 1;
        }
      }

      const stages = distinctSessionStages(rows);
      return {
        period: { from: range.fromLabel, to: range.toLabel },
        raw_counts,
        stages,
        vehicle_selected_sessions: distinctSessionCount(rows, 'arac_secildi'),
        conversion_rate_pct: funnelRates(stages).view_to_button_pct,
      };
    });
  }

  /**
   * Tahmini karbon özeti.
   *
   * SESSION BAŞINA TEK KATKI: 0005'teki unique index (company_id, session_ref,
   * event_type) aynı oturumda ikinci bir `katki_ekle_butonuna_basildi`
   * kaydını zaten engeller — recordEvent ON CONFLICT DO NOTHING ile İLK onayı
   * korur. Widget de onaydan sonra kilitlenir, yani normal akışta oturum
   * başına tek onay vardır.
   *
   * Aşağıdaki dedup bu yüzden bir SAVUNMA katmanıdır: index'ten önce yazılmış
   * ya da elle taşınmış veride aynı oturumun birden fazla onayı bulunursa,
   * toplam şişmesin diye yalnızca biri sayılır — deterministik olarak en
   * yenisi (`created_at DESC, id DESC`; aynı milisaniyede bile sabit sonuç).
   */
  async getCarbonSummary(
    companyId: string,
    params: RangeParams,
  ): Promise<CarbonSummary> {
    return this.db.withTenant(companyId, async (q) => {
      const range = await this.resolve(q, companyId, params);
      const rows = await this.fetchEvents(q, companyId, range);

      const latestBySession = new Map<string, EventRow>();
      for (const row of rows) {
        if (row.event_type !== 'katki_ekle_butonuna_basildi') continue;
        const key = row.session_ref ?? row.id;
        if (!latestBySession.has(key)) latestBySession.set(key, row);
      }

      let co2eTotal = 0;
      let distanceTotal = 0;
      let missing = 0;
      for (const row of latestBySession.values()) {
        const md = row.metadata ?? {};
        const co2e = Number(md.estimated_co2e_kg);
        const km = Number(md.distance_km);
        // Yalnızca SUNUCUNUN hesapladığı ve tam olduğunu işaretlediği satırlar
        // toplama girer. Eski/bozuk/eksik bir kayıt sayı içerse bile sayılmaz.
        if (md.estimate_available === true && Number.isFinite(co2e)) {
          co2eTotal += co2e;
          if (Number.isFinite(km)) distanceTotal += km;
        } else {
          missing += 1;
        }
      }

      const estimated = Math.round(co2eTotal * 100) / 100;
      return {
        period: { from: range.fromLabel, to: range.toLabel },
        estimated_co2e_kg: estimated,
        tree_equivalent: treeEquivalent(estimated),
        contributions_count: latestBySession.size,
        total_distance_km: Math.round(distanceTotal),
        missing_estimate_count: missing,
        is_estimated: true,
      };
    });
  }

  async getFunnel(
    companyId: string,
    params: RangeParams,
  ): Promise<FunnelReport> {
    return this.db.withTenant(companyId, async (q) => {
      const range = await this.resolve(q, companyId, params);
      const rows = await this.fetchEvents(q, companyId, range);
      const stages = distinctSessionStages(rows);
      return {
        period: { from: range.fromLabel, to: range.toLabel },
        stages,
        rates: funnelRates(stages),
      };
    });
  }

  /** Panelin şirket bilgi ekranı — temel alanlar + embed anahtarı. */
  async getCompany(companyId: string) {
    return this.db.withTenant(companyId, async (q) => {
      const { rows } = await q.query(
        `SELECT name, company_code, city, country, timezone, default_currency,
                commission_rate, price_per_kg_co2e, min_contribution_amount,
                public_widget_key, allowed_origins, status
           FROM rental_companies
          WHERE id = $1`,
        [companyId],
      );
      if (!rows[0]) throw new BadRequestException('Şirket bulunamadı.');
      return rows[0];
    });
  }

  /** Şirketin araç sınıfları — faktör provenance'ı DAHİL (metodoloji denetimi). */
  async getVehicleClasses(companyId: string) {
    return this.db.withTenant(companyId, async (q) => {
      const { rows } = await q.query(
        `SELECT class_code, label_tr, label_en, fuel_type, co2e_per_km_kg,
                factor_source, factor_country, factor_year, factor_scope,
                sort_order, is_active
           FROM vehicle_classes
          WHERE company_id = $1
          ORDER BY sort_order ASC, class_code ASC`,
        [companyId],
      );
      return rows;
    });
  }

  /**
   * Günlük rapor (CSV) — Raporlar ekranındaki "CSV indir".
   *
   * Gün sınırları ŞİRKETİN timezone'unda çizilir (panel sayılarıyla aynı
   * mantık). Her sütun o gün o aşamaya ulaşan TEKİL oturumu sayar. CO₂ ve
   * mesafe yalnızca sunucunun hesapladığı (`estimate_available = true`)
   * katkı onaylarından toplanır — carbon-summary ile aynı kural.
   *
   * Hücrelerde yalnızca tarih ve sayı vardır (serbest metin YOK) — bu yüzden
   * CSV formül enjeksiyonu (=, +, -, @ ile başlayan hücre) mümkün değildir.
   */
  async exportCsv(
    companyId: string,
    params: RangeParams,
  ): Promise<{ filename: string; csv: string }> {
    return this.db.withTenant(companyId, async (q) => {
      const { rows: companyRows } = await q.query<{
        company_code: string;
        timezone: string;
      }>('SELECT company_code, timezone FROM rental_companies WHERE id = $1', [
        companyId,
      ]);
      const company = companyRows[0];
      if (!company) throw new BadRequestException('Şirket bulunamadı.');

      let range: ResolvedRange;
      try {
        range = resolveRange(params, company.timezone);
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error ? e.message : 'Geçersiz tarih aralığı.',
        );
      }

      const { rows } = await q.query<{
        day: string;
        viewed: number;
        vehicle: number;
        selected: number;
        clicked: number;
        co2e: string | null;
        km: string | null;
      }>(
        `SELECT to_char((created_at AT TIME ZONE $4)::date, 'YYYY-MM-DD') AS day,
                count(DISTINCT COALESCE(session_ref, id::text))
                  FILTER (WHERE event_type = 'widget_goruntulendi')::int AS viewed,
                count(DISTINCT COALESCE(session_ref, id::text))
                  FILTER (WHERE event_type = 'arac_secildi')::int AS vehicle,
                count(DISTINCT COALESCE(session_ref, id::text))
                  FILTER (WHERE event_type = 'checkbox_secildi')::int AS selected,
                count(DISTINCT COALESCE(session_ref, id::text))
                  FILTER (WHERE event_type = 'katki_ekle_butonuna_basildi')::int AS clicked,
                sum((metadata->>'estimated_co2e_kg')::numeric)
                  FILTER (WHERE event_type = 'katki_ekle_butonuna_basildi'
                            AND metadata->>'estimate_available' = 'true') AS co2e,
                sum((metadata->>'distance_km')::numeric)
                  FILTER (WHERE event_type = 'katki_ekle_butonuna_basildi'
                            AND metadata->>'estimate_available' = 'true') AS km
           FROM widget_events
          WHERE company_id = $1
            AND created_at >= $2
            AND created_at <  $3
          GROUP BY 1
          ORDER BY 1`,
        [companyId, range.startUtc, range.endUtcExclusive, company.timezone],
      );

      const header = [
        'tarih',
        'goruntulenme_oturum',
        'arac_secimi_oturum',
        'katki_secimi_oturum',
        'katki_onayi_oturum',
        'tahmini_co2e_kg',
        'toplam_mesafe_km',
      ];
      const lines = [header.join(',')];
      for (const r of rows) {
        lines.push(
          [
            r.day,
            r.viewed,
            r.vehicle,
            r.selected,
            r.clicked,
            (Math.round(Number(r.co2e ?? 0) * 100) / 100).toFixed(2),
            Math.round(Number(r.km ?? 0)),
          ].join(','),
        );
      }

      const code = company.company_code.replace(/[^A-Za-z0-9-]/g, '');
      return {
        filename: `green-gold-wheels_${code}_${range.fromLabel}_${range.toLabel}.csv`,
        csv: lines.join('\r\n') + '\r\n',
      };
    });
  }

  /**
   * Aralığı şirketin timezone'unda çözer; geçersiz tarih/aralık -> 400
   * (sessizce düzeltme YOK). Panel tarih hesaplamaz, yalnızca range geçer.
   */
  private async resolve(
    q: Queryable,
    companyId: string,
    params: RangeParams,
  ): Promise<ResolvedRange> {
    const { rows } = await q.query<{ timezone: string }>(
      'SELECT timezone FROM rental_companies WHERE id = $1',
      [companyId],
    );
    const tz = rows[0]?.timezone ?? 'Europe/Istanbul';
    try {
      return resolveRange(params, tz);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Geçersiz tarih aralığı.',
      );
    }
  }

  private async fetchEvents(
    q: Queryable,
    companyId: string,
    range: ResolvedRange,
  ): Promise<EventRow[]> {
    const { rows } = await q.query<EventRow>(
      `SELECT id, event_type, session_ref, metadata
         FROM widget_events
        WHERE company_id = $1
          AND created_at >= $2
          AND created_at <  $3
        ORDER BY created_at DESC, id DESC`,
      [companyId, range.startUtc, range.endUtcExclusive],
    );
    return rows;
  }

  // =========================================================================
  // YAZMA (Adım 3 — panel yönetim ekranları)
  //
  // Hepsi tenant transaction'ında çalışır: RLS yalnızca kendi satırını
  // gösterir ve WITH CHECK başka şirkete taşımayı engeller. Ayrıca
  // 0008_panel_writes.sql kolon bazlı GRANT ile `status`,
  // `public_widget_key`, `commission_rate`, `company_id`, `class_code`
  // yazılmasını veritabanı seviyesinde imkânsız kılar.
  //
  // Dinamik SQL kuralı: kolon adları SABİT bir listeden gelir, asla
  // istemciden. Değerler her zaman parametredir ($1, $2, ...).
  // =========================================================================

  /** Şirket ayarlarını günceller. Boş gövde -> 400 (sessiz no-op yok). */
  async updateCompany(companyId: string, dto: UpdateCompanyDto) {
    const allowed = [
      'name',
      'city',
      'timezone',
      'allowed_origins',
      'price_per_kg_co2e',
      'min_contribution_amount',
      'logo_url',
      'brand_color',
    ] as const;

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      const value = dto[key];
      if (value === undefined) continue;
      values.push(value);
      sets.push(`${key} = $${values.length}`);
    }
    if (sets.length === 0) {
      throw new BadRequestException('Güncellenecek alan verilmedi.');
    }

    return this.db.withTenant(companyId, async (q) => {
      values.push(companyId);
      const { rows } = await q.query(
        `UPDATE rental_companies
            SET ${sets.join(', ')}, updated_at = now()
          WHERE id = $${values.length}
        RETURNING name, company_code, city, country, timezone, default_currency,
                  commission_rate, price_per_kg_co2e, min_contribution_amount,
                  public_widget_key, allowed_origins, status`,
        values,
      );
      if (!rows[0]) {
        // RLS satırı gizlemiş olamaz (kendi şirketiyiz) -> gerçek tutarsızlık.
        throw new BadRequestException('Şirket bulunamadı.');
      }
      return rows[0];
    });
  }

  /**
   * Araç sınıfını günceller.
   *
   * ⚠️ METODOLOJİ KURALI: faktör (`co2e_per_km_kg`) değiştiriliyorsa
   * provenance'ın TAMAMI (kaynak + ülke + yıl + kapsam) birlikte gelmelidir.
   * Aksi halde "sayı yeni, kaynak eski" gibi sessizce yanlış bir kayıt
   * oluşurdu — ve o kayıt panelde "onaylı" görünürdü.
   */
  async updateVehicleClass(
    companyId: string,
    classCode: string,
    dto: UpdateVehicleClassDto,
  ) {
    if (dto.co2e_per_km_kg !== undefined) {
      const missing = (
        [
          'factor_source',
          'factor_country',
          'factor_year',
          'factor_scope',
        ] as const
      ).filter((k) => dto[k] === undefined);
      if (missing.length > 0) {
        throw new BadRequestException(
          `Faktör değiştiriliyorsa kaynağı da verilmelidir. Eksik: ${missing.join(', ')}.`,
        );
      }
    }

    const allowed = [
      'label_tr',
      'label_en',
      'fuel_type',
      'co2e_per_km_kg',
      'factor_source',
      'factor_country',
      'factor_year',
      'factor_scope',
      'sort_order',
      'is_active',
    ] as const;

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      const value = dto[key];
      if (value === undefined) continue;
      values.push(value);
      sets.push(`${key} = $${values.length}`);
    }
    if (sets.length === 0) {
      throw new BadRequestException('Güncellenecek alan verilmedi.');
    }

    return this.db.withTenant(companyId, async (q) => {
      values.push(companyId, classCode);
      const { rows } = await q.query(
        `UPDATE vehicle_classes
            SET ${sets.join(', ')}, updated_at = now()
          WHERE company_id = $${values.length - 1} AND class_code = $${values.length}
        RETURNING class_code, label_tr, label_en, fuel_type, co2e_per_km_kg,
                  factor_source, factor_country, factor_year, factor_scope,
                  sort_order, is_active`,
        values,
      );
      if (!rows[0]) {
        throw new NotFoundException(`Araç sınıfı bulunamadı: ${classCode}`);
      }
      return rows[0];
    });
  }

  /** Yeni araç sınıfı. Aynı kod varsa 409 (sessizce üzerine yazmaz). */
  async createVehicleClass(companyId: string, dto: CreateVehicleClassDto) {
    return this.db.withTenant(companyId, async (q) => {
      const { rows } = await q.query(
        `INSERT INTO vehicle_classes
           (company_id, class_code, label_tr, label_en, fuel_type, co2e_per_km_kg,
            factor_source, factor_country, factor_year, factor_scope, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
         ON CONFLICT (company_id, class_code) DO NOTHING
         RETURNING class_code, label_tr, label_en, fuel_type, co2e_per_km_kg,
                   factor_source, factor_country, factor_year, factor_scope,
                   sort_order, is_active`,
        [
          companyId,
          dto.class_code,
          dto.label_tr,
          dto.label_en,
          dto.fuel_type,
          dto.co2e_per_km_kg,
          dto.factor_source,
          dto.factor_country,
          dto.factor_year,
          dto.factor_scope,
          dto.sort_order ?? 0,
        ],
      );
      if (!rows[0]) {
        throw new ConflictException(
          `Bu kodla bir araç sınıfı zaten var: ${dto.class_code}`,
        );
      }
      return rows[0];
    });
  }
}
