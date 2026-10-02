import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { WidgetService } from './widget.service';
import { DashboardService } from '../dashboard/dashboard.service';
import type { WidgetEventType } from './dto/create-widget-event.dto';
import {
  createTestDatabase,
  IDS,
  seedCompany,
  seedVehicle,
  type PgliteDatabase,
} from '../../test/pglite-db';

const ACTIVE_KEY = 'key-active';
const PENDING_KEY = 'key-pending';
const OTHER_KEY = 'key-other';

let db: PgliteDatabase;
let service: WidgetService;
let dashboard: DashboardService;

beforeAll(async () => {
  db = await createTestDatabase();
  dashboard = new DashboardService(db);
  service = new WidgetService(db, dashboard);
});

afterAll(async () => {
  await db.close();
});

/** Varsayılan tohum. `overrides` ile şirket 1'in alanları değiştirilebilir. */
async function seed(overrides: Record<string, unknown> = {}) {
  await db.reset();
  await seedCompany(db, {
    id: IDS.co1,
    name: 'Pilot Araç Kiralama',
    public_widget_key: ACTIVE_KEY,
    price_per_kg_co2e: 1,
    min_contribution_amount: 19,
    brand_color: '#315d36',
    ...overrides,
  });
  await seedCompany(db, {
    id: IDS.co2,
    public_widget_key: PENDING_KEY,
    status: 'pending',
  });
  await seedCompany(db, {
    id: IDS.co3,
    public_widget_key: OTHER_KEY,
    price_per_kg_co2e: 5,
    min_contribution_amount: 0,
  });
  await seedVehicle(db, {
    company_id: IDS.co1,
    class_code: 'ekonomi-benzin',
    co2e_per_km_kg: 0.171,
    sort_order: 10,
  });
  await seedVehicle(db, {
    company_id: IDS.co1,
    class_code: 'pasif-sinif',
    co2e_per_km_kg: 0.2,
    sort_order: 20,
    is_active: false,
  });
  // BAŞKA şirketin sınıfı — co1 bunu kullanamamalı (tenant izolasyonu).
  await seedVehicle(db, {
    company_id: IDS.co3,
    class_code: 'sadece-co3',
    co2e_per_km_kg: 1.5,
  });
}

/** Yazılan event satırları — sahip olarak, doğrulama amaçlı okunur. */
async function events(companyId: string = IDS.co1) {
  return db.asOwner(
    async (q) =>
      (
        await q.query<{
          id: string;
          event_type: string;
          metadata: Record<string, unknown> | null;
        }>(
          'SELECT id, event_type, metadata FROM widget_events WHERE company_id = $1 ORDER BY created_at, id',
          [companyId],
        )
      ).rows,
  );
}

describe('WidgetService.getConfig', () => {
  beforeEach(() => seed());

  it('aktif sirketin public config ini dondurur', async () => {
    const cfg = await service.getConfig(ACTIVE_KEY);
    expect(cfg.company_name).toBe('Pilot Araç Kiralama');
    expect(cfg.currency).toBe('TRY');
    expect(cfg.price_per_kg_co2e).toBe(1);
    expect(cfg.min_contribution_amount).toBe(19);
    expect(cfg.is_estimated).toBe(true);
  });

  it('NUMERIC kolonlari sayiya cevrilir (pg string dondurur)', async () => {
    const cfg = await service.getConfig(ACTIVE_KEY);
    expect(typeof cfg.price_per_kg_co2e).toBe('number');
    expect(typeof cfg.vehicle_classes[0].co2e_per_km_kg).toBe('number');
  });

  it('yalnizca AKTIF arac siniflarini dondurur', async () => {
    const cfg = await service.getConfig(ACTIVE_KEY);
    expect(cfg.vehicle_classes.map((v) => v.class_code)).toEqual([
      'ekonomi-benzin',
    ]);
  });

  it('baska sirketin arac sinifini SIZDIRMAZ', async () => {
    const cfg = await service.getConfig(ACTIVE_KEY);
    expect(cfg.vehicle_classes.some((v) => v.class_code === 'sadece-co3')).toBe(
      false,
    );
  });

  it('faktor provenance ini ve placeholder isaretini tasir', async () => {
    const [v] = (await service.getConfig(ACTIVE_KEY)).vehicle_classes;
    expect(v).toMatchObject({
      co2e_per_km_kg: 0.171,
      factor_source: 'placeholder',
      factor_country: 'TR',
      factor_year: 2026,
      factor_scope: 'tank_to_wheel',
      is_placeholder_factor: true,
    });
  });

  it('key yoksa 404', async () => {
    await expect(service.getConfig(undefined)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('bilinmeyen key icin 404', async () => {
    await expect(service.getConfig('yok-boyle-key')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('aktif olmayan sirket icin 403', async () => {
    await expect(service.getConfig(PENDING_KEY)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('gecersiz brand_color u null a cevirir (ham string enjekte edilmez)', async () => {
    await seed({ brand_color: 'red; background:url(x)' });
    expect((await service.getConfig(ACTIVE_KEY)).brand_color).toBeNull();
  });
});

describe('WidgetService.recordEvent — yetki ve dogrulama', () => {
  beforeEach(() => seed());

  it('X-Widget-Key yoksa 401', async () => {
    await expect(
      service.recordEvent(undefined, { event_type: 'widget_goruntulendi' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('gecersiz key icin 403 (varlik bilgisi sizdirmaz)', async () => {
    await expect(
      service.recordEvent('yok', { event_type: 'widget_goruntulendi' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('aktif olmayan sirket event gonderemez (403)', async () => {
    await expect(
      service.recordEvent(PENDING_KEY, { event_type: 'widget_goruntulendi' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('bilinmeyen event_type 400', async () => {
    // Bilinçli olarak geçersiz: ValidationPipe atlanmış (servis doğrudan
    // çağrılıyor) senaryoda servis-içi savunmayı test eder.
    const invalid = 'uydurma' as unknown as WidgetEventType;
    await expect(
      service.recordEvent(ACTIVE_KEY, { event_type: invalid }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rezervasyona_devam_edildi flag KAPALIYKEN 400 ve HIC kayit yazmaz', async () => {
    await expect(
      service.recordEvent(ACTIVE_KEY, {
        event_type: 'rezervasyona_devam_edildi',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(await events()).toHaveLength(0);
  });

  it('rezervasyona_devam_edildi flag ACIKKEN kabul edilir', async () => {
    await seed({
      widget_settings: { version: 1, enable_booking_click_tracking: true },
    });
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'rezervasyona_devam_edildi',
    });
    expect(await events()).toHaveLength(1);
  });
});

describe('WidgetService.recordEvent — sunucu tarafli hesap', () => {
  beforeEach(() => seed());

  it('CO2 ve tutari KENDI faktor tablosundan hesaplayip yazar', async () => {
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'katki_ekle_butonuna_basildi',
      session_ref: 's1',
      metadata: { distance_km: 350, vehicle_class_code: 'ekonomi-benzin' },
    });
    const [row] = await events();
    expect(row.metadata).toMatchObject({
      distance_km: 350,
      vehicle_class_code: 'ekonomi-benzin',
      co2e_per_km_kg: 0.171,
      estimated_co2e_kg: 59.85,
      amount: 59.85,
      currency: 'TRY',
      estimate_available: true,
      computed_by: 'server',
    });
  });

  it('alt sinir sirket ayarindan uygulanir (kisa yolculuk)', async () => {
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'katki_ekle_butonuna_basildi',
      session_ref: 's-kisa',
      metadata: { distance_km: 10, vehicle_class_code: 'ekonomi-benzin' },
    });
    // 10 km x 0.171 = 1.71 kg -> 1.71 TL, ama taban 19 TL.
    expect((await events())[0].metadata).toMatchObject({
      estimated_co2e_kg: 1.71,
      amount: 19,
    });
  });

  it('BASKA sirketin arac kodu ile hesap yapmaz (tenant izolasyonu)', async () => {
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'katki_ekle_butonuna_basildi',
      session_ref: 's2',
      metadata: { distance_km: 100, vehicle_class_code: 'sadece-co3' },
    });
    const md = (await events())[0].metadata!;
    expect(md.estimate_available).toBe(false);
    expect(md.amount).toBeUndefined();
    expect(md.estimated_co2e_kg).toBeUndefined();
  });

  it('PASIF arac sinifi ile hesap yapmaz', async () => {
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'katki_ekle_butonuna_basildi',
      session_ref: 's3',
      metadata: { distance_km: 100, vehicle_class_code: 'pasif-sinif' },
    });
    expect((await events())[0].metadata!.estimate_available).toBe(false);
  });

  it('mesafe eksikse sayi UYDURMAZ, eksik olarak isaretler', async () => {
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'arac_secildi',
      session_ref: 's4',
      metadata: { vehicle_class_code: 'ekonomi-benzin' },
    });
    expect((await events())[0].metadata).toMatchObject({
      vehicle_class_code: 'ekonomi-benzin',
      estimate_available: false,
    });
  });

  it('metadata hic yoksa null yazar', async () => {
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'widget_goruntulendi',
      session_ref: 's5',
    });
    expect((await events())[0].metadata).toBeNull();
  });

  it('farkli sirket kendi fiyatlandirmasiyla hesaplanir', async () => {
    // co3: 5 TL/kg, taban 0. Kendi sınıfıyla hesaplanır.
    await service.recordEvent(OTHER_KEY, {
      event_type: 'katki_ekle_butonuna_basildi',
      session_ref: 's6',
      metadata: { distance_km: 100, vehicle_class_code: 'sadece-co3' },
    });
    // 100 x 1.5 = 150 kg -> 150 x 5 = 750
    expect((await events(IDS.co3))[0].metadata).toMatchObject({
      estimated_co2e_kg: 150,
      amount: 750,
    });
  });

  it('event DOGRU sirkete yazilir (anahtarin sirketi)', async () => {
    await service.recordEvent(OTHER_KEY, {
      event_type: 'widget_goruntulendi',
      session_ref: 'hangi-sirket',
    });
    expect(await events(IDS.co1)).toHaveLength(0);
    expect(await events(IDS.co3)).toHaveLength(1);
  });
});

describe('WidgetService.recordEvent — idempotency (gercek unique index)', () => {
  beforeEach(() => seed());

  it('ayni session+tip ikinci kez gelirse CIFT kayit yazmaz ve ayni id yi doner', async () => {
    const first = await service.recordEvent(ACTIVE_KEY, {
      event_type: 'widget_goruntulendi',
      session_ref: 'dup-1',
    });
    const second = await service.recordEvent(ACTIVE_KEY, {
      event_type: 'widget_goruntulendi',
      session_ref: 'dup-1',
    });
    expect(await events()).toHaveLength(1);
    expect(second.id).toBe(first.id);
  });

  it('cakisma transaction i BOZMAZ — sonraki event normal yazilir', async () => {
    // pg'de hata veren bir ifade transaction'ı "aborted" yapar; ON CONFLICT
    // bu yüzden seçildi. Çakışmadan sonra servis çalışmaya devam etmeli.
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'widget_goruntulendi',
      session_ref: 'dup-2',
    });
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'widget_goruntulendi',
      session_ref: 'dup-2',
    });
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'checkbox_secildi',
      session_ref: 'dup-2',
    });
    expect((await events()).map((e) => e.event_type)).toEqual([
      'widget_goruntulendi',
      'checkbox_secildi',
    ]);
  });

  it('session_ref null ise kisitlanmaz (anonim kayitlar ayri sayilir)', async () => {
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'widget_goruntulendi',
    });
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'widget_goruntulendi',
    });
    expect(await events()).toHaveLength(2);
  });

  it('ayni session farkli sirkette ayri sayilir', async () => {
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'widget_goruntulendi',
      session_ref: 'ortak',
    });
    await service.recordEvent(OTHER_KEY, {
      event_type: 'widget_goruntulendi',
      session_ref: 'ortak',
    });
    expect(await events(IDS.co1)).toHaveLength(1);
    expect(await events(IDS.co3)).toHaveLength(1);
  });
});

describe('WidgetService.getImpact', () => {
  beforeEach(() => seed());

  it('show_estimated_impact KAPALIYKEN sifirlanmis sayilar doner', async () => {
    expect(await service.getImpact(ACTIVE_KEY)).toMatchObject({
      estimated_co2e_kg: 0,
      tree_equivalent: 0,
      contributions_count: 0,
      is_estimated: true,
    });
  });

  it('show_estimated_impact ACIKKEN panel ile AYNI sayiyi doner', async () => {
    await seed({
      widget_settings: { version: 1, show_estimated_impact: true },
    });
    await service.recordEvent(ACTIVE_KEY, {
      event_type: 'katki_ekle_butonuna_basildi',
      session_ref: 'impact-1',
      metadata: { distance_km: 350, vehicle_class_code: 'ekonomi-benzin' },
    });

    const impact = await service.getImpact(ACTIVE_KEY);
    const panel = await dashboard.getCarbonSummary(IDS.co1, { range: 'month' });

    expect(impact.estimated_co2e_kg).toBe(59.85);
    expect(impact.estimated_co2e_kg).toBe(panel.estimated_co2e_kg);
    expect(impact.contributions_count).toBe(panel.contributions_count);
  });

  it('aktif olmayan sirket icin 403', async () => {
    await expect(service.getImpact(PENDING_KEY)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
