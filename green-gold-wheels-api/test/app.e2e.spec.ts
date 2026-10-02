/**
 * UÇTAN UCA HTTP — gerçek Nest uygulaması (tüm modüller, global guard,
 * ValidationPipe, CORS middleware, zarf, exception filter), gerçek Postgres
 * (PGlite), üretim migration'ları. Yalnızca iki şey değiştirilir:
 *   - Database  -> PgliteDatabase (Neon yerine)
 *   - TokenVerifier -> sahte doğrulayıcı (Neon Auth'a ağ çağrısı yerine)
 *
 * Bu, birim testlerinin göremediği şeyi kanıtlar: parçalar BİRBİRİNE doğru
 * bağlı mı? Örn. istemcinin `amount` göndererek fiyatı manipüle edememesi,
 * servis testinde değil burada (ValidationPipe katmanında) doğrulanır.
 */
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { Database } from '../src/database/database';
import { TokenVerifier } from '../src/auth/token-verifier';
import {
  AUTH_IDS,
  createTestDatabase,
  IDS,
  seedCompany,
  seedMember,
  seedVehicle,
  type PgliteDatabase,
} from './pglite-db';

/** Sahte Neon Auth: "valid:<uuid>" biçimindeki token'ı kabul eder. */
class FakeVerifier extends TokenVerifier {
  verify(token: string): Promise<string> {
    if (token.startsWith('valid:')) return Promise.resolve(token.slice(6));
    return Promise.reject(new Error('imza gecersiz'));
  }
}

let db: PgliteDatabase;
let app: INestApplication;

const ORIGIN_1 = 'https://firma1.example';
const PREVIEW_ORIGIN = 'https://panel.greengold.example';

beforeAll(async () => {
  // Panel origin'i — CORS middleware uygulama kurulurken okur.
  process.env.WIDGET_PREVIEW_ORIGINS = PREVIEW_ORIGIN;
  db = await createTestDatabase();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Database)
    .useValue(db)
    .overrideProvider(TokenVerifier)
    .useValue(new FakeVerifier())
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
});

afterAll(async () => {
  await app.close();
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  await seedCompany(db, {
    id: IDS.co1,
    name: 'Firma Bir',
    public_widget_key: 'key-1',
    allowed_origins: [ORIGIN_1],
  });
  await seedCompany(db, {
    id: IDS.co2,
    name: 'Firma Iki',
    public_widget_key: 'key-2',
    allowed_origins: ['https://firma2.example'],
  });
  await seedCompany(db, {
    id: IDS.co3,
    public_widget_key: 'key-3',
    status: 'suspended',
  });
  await seedVehicle(db, {
    company_id: IDS.co1,
    class_code: 'ekonomi-benzin',
    co2e_per_km_kg: 0.171,
  });
  await seedMember(db, {
    company_id: IDS.co1,
    auth_user_id: AUTH_IDS.co1Manager,
    email: 'y@firma1.example',
  });
  await seedMember(db, {
    company_id: IDS.co3,
    auth_user_id: AUTH_IDS.co3Manager,
    email: 'y@askida.example',
  });
});

const server = () => app.getHttpServer() as Parameters<typeof request>[0];

/** Ortak yanıt zarfı — supertest gövdeyi `any` döndürür; tip'li okumak için. */
interface Envelope {
  success: boolean;
  data: Record<string, unknown> & {
    vehicle_classes?: { class_code: string }[];
  };
  error: { code: string; message: string } | null;
}
const body = (res: { body: unknown }) => res.body as Envelope;

describe('GET /internal/health', () => {
  it('auth olmadan 200 ve zarf', async () => {
    const res = await request(server()).get('/internal/health').expect(200);
    expect(res.body).toEqual({
      success: true,
      data: { status: 'ok' },
      error: null,
    });
  });
});

describe('/widget/* — public yuzey', () => {
  it('config: izinli origin den 200 + CORS basligi + arac siniflari', async () => {
    const res = await request(server())
      .get('/widget/config?key=key-1')
      .set('Origin', ORIGIN_1)
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN_1);
    expect(body(res).data.company_name).toBe('Firma Bir');
    expect(body(res).data.vehicle_classes![0].class_code).toBe(
      'ekonomi-benzin',
    );
  });

  it('config: IZINSIZ origin 403 (baska sirketin domain i dahil)', async () => {
    const res = await request(server())
      .get('/widget/config?key=key-1')
      .set('Origin', 'https://firma2.example')
      .expect(403);
    expect(body(res).error!.code).toBe('forbidden');
  });

  it('config: bilinmeyen anahtar 404 zarfla', async () => {
    const res = await request(server())
      .get('/widget/config?key=yok')
      .expect(404);
    expect(res.body).toMatchObject({ success: false, data: null });
  });

  it('events: sunucu hesaplar ve DB ye yazar', async () => {
    await request(server())
      .post('/widget/events')
      .set('X-Widget-Key', 'key-1')
      .set('Origin', ORIGIN_1)
      .send({
        event_type: 'katki_ekle_butonuna_basildi',
        session_ref: 'e2e-1',
        metadata: { distance_km: 350, vehicle_class_code: 'ekonomi-benzin' },
      })
      .expect(201);

    const md = await db.asOwner(
      async (q) =>
        (
          await q.query<{ metadata: Record<string, unknown> }>(
            'SELECT metadata FROM widget_events WHERE session_ref = $1',
            ['e2e-1'],
          )
        ).rows[0].metadata,
    );
    expect(md).toMatchObject({ estimated_co2e_kg: 59.85, amount: 59.85 });
  });

  it('events: istemci TUTAR gonderirse 400 — fiyat manipule EDILEMEZ', async () => {
    const res = await request(server())
      .post('/widget/events')
      .set('X-Widget-Key', 'key-1')
      .send({
        event_type: 'katki_ekle_butonuna_basildi',
        session_ref: 'e2e-spoof',
        metadata: {
          distance_km: 350,
          vehicle_class_code: 'ekonomi-benzin',
          amount: 0.01,
        },
      })
      .expect(400);
    expect(body(res).error!.message).toMatch(/amount/);

    const n = await db.asOwner(
      async (q) =>
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM widget_events',
          )
        ).rows[0].n,
    );
    expect(n).toBe(0);
  });

  it('events: istemci CO2 gonderirse de 400', async () => {
    await request(server())
      .post('/widget/events')
      .set('X-Widget-Key', 'key-1')
      .send({
        event_type: 'katki_ekle_butonuna_basildi',
        metadata: { distance_km: 350, estimated_co2e_kg: 0 },
      })
      .expect(400);
  });

  it('events: bant disi mesafe 400', async () => {
    await request(server())
      .post('/widget/events')
      .set('X-Widget-Key', 'key-1')
      .send({
        event_type: 'widget_goruntulendi',
        metadata: { distance_km: 999999 },
      })
      .expect(400);
  });

  it('events: anahtar yoksa 401', async () => {
    await request(server())
      .post('/widget/events')
      .send({ event_type: 'widget_goruntulendi' })
      .expect(401);
  });

  it('preflight: aktif sirketin origin i icin CORS basligi verir', async () => {
    const res = await request(server())
      .options('/widget/events')
      .set('Origin', ORIGIN_1)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN_1);
  });

  it('preflight: bilinmeyen origin e CORS basligi VERMEZ', async () => {
    const res = await request(server())
      .options('/widget/events')
      .set('Origin', 'https://saldirgan.example')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('/dashboard yazma uclari', () => {
  const AUTH = 'Bearer valid:10000000-0000-4000-8000-000000000001';

  it('origin listesi guncellenebilir', async () => {
    const res = await request(server())
      .patch('/dashboard/company')
      .set('Authorization', AUTH)
      .send({ allowed_origins: ['https://yeni.example'] })
      .expect(200);
    expect(body(res).data.allowed_origins).toEqual(['https://yeni.example']);
  });

  it('http origin REDDEDILIR (widget anahtari acik agda tasinmasin)', async () => {
    await request(server())
      .patch('/dashboard/company')
      .set('Authorization', AUTH)
      .send({ allowed_origins: ['http://guvensiz.example'] })
      .expect(400);
  });

  it('yollu/jokerli origin REDDEDILIR (tarayici yol gondermez)', async () => {
    for (const bad of ['https://x.example/sayfa', 'https://*.x.example']) {
      await request(server())
        .patch('/dashboard/company')
        .set('Authorization', AUTH)
        .send({ allowed_origins: [bad] })
        .expect(400);
    }
  });

  it('status gondermek 400 (DTO whitelist) ve sirket AKTIFLESMEZ', async () => {
    await request(server())
      .patch('/dashboard/company')
      .set('Authorization', AUTH)
      .send({ status: 'active' })
      .expect(400);
  });

  it('public_widget_key gondermek 400', async () => {
    await request(server())
      .patch('/dashboard/company')
      .set('Authorization', AUTH)
      .send({ public_widget_key: 'calinti' })
      .expect(400);
  });

  it('bos govde 400 (sessiz no-op yok)', async () => {
    await request(server())
      .patch('/dashboard/company')
      .set('Authorization', AUTH)
      .send({})
      .expect(400);
  });

  it('gecersiz timezone REDDEDILIR (rapor tarihleri ona bagli)', async () => {
    await request(server())
      .patch('/dashboard/company')
      .set('Authorization', AUTH)
      .send({ timezone: 'Mars/Olympus' })
      .expect(400);
  });

  it('METODOLOJI KURALI: faktor degisiyorsa kaynak da ZORUNLU', async () => {
    const res = await request(server())
      .patch('/dashboard/vehicle-classes/ekonomi-benzin')
      .set('Authorization', AUTH)
      .send({ co2e_per_km_kg: 0.2 })
      .expect(400);
    expect(body(res).error!.message).toMatch(/kaynağı da verilmelidir/);
  });

  it('faktor + tam provenance ile guncellenebilir', async () => {
    const res = await request(server())
      .patch('/dashboard/vehicle-classes/ekonomi-benzin')
      .set('Authorization', AUTH)
      .send({
        co2e_per_km_kg: 0.182,
        factor_source: 'DEFRA 2024',
        factor_country: 'GB',
        factor_year: 2024,
        factor_scope: 'well_to_wheel',
      })
      .expect(200);
    expect(body(res).data).toMatchObject({
      factor_source: 'DEFRA 2024',
      factor_scope: 'well_to_wheel',
    });
  });

  it('guncellenen faktor widget config ine YANSIR (uctan uca)', async () => {
    await request(server())
      .patch('/dashboard/vehicle-classes/ekonomi-benzin')
      .set('Authorization', AUTH)
      .send({
        co2e_per_km_kg: 0.19,
        factor_source: 'DEFRA 2024',
        factor_country: 'GB',
        factor_year: 2024,
        factor_scope: 'tank_to_wheel',
      })
      .expect(200);

    const cfg = await request(server())
      .get('/widget/config?key=key-1')
      .expect(200);
    const v = body(cfg).data.vehicle_classes![0] as Record<string, unknown>;
    expect(v.co2e_per_km_kg).toBe(0.19);
    expect(v.is_placeholder_factor).toBe(false);
  });

  it('bilinmeyen arac sinifi 404', async () => {
    await request(server())
      .patch('/dashboard/vehicle-classes/yok-boyle')
      .set('Authorization', AUTH)
      .send({ label_tr: 'X' })
      .expect(404);
  });

  it('yeni arac sinifi eklenebilir, ayni kod ikinci kez 409', async () => {
    const payload = {
      class_code: 'suv-dizel',
      label_tr: 'SUV · Dizel',
      label_en: 'SUV · Diesel',
      fuel_type: 'dizel',
      co2e_per_km_kg: 0.21,
      factor_source: 'DEFRA 2024',
      factor_country: 'GB',
      factor_year: 2024,
      factor_scope: 'tank_to_wheel',
    };
    await request(server())
      .post('/dashboard/vehicle-classes')
      .set('Authorization', AUTH)
      .send(payload)
      .expect(201);
    await request(server())
      .post('/dashboard/vehicle-classes')
      .set('Authorization', AUTH)
      .send(payload)
      .expect(409);
  });

  it('kaynaksiz yeni sinif REDDEDILIR', async () => {
    await request(server())
      .post('/dashboard/vehicle-classes')
      .set('Authorization', AUTH)
      .send({
        class_code: 'kaynaksiz',
        label_tr: 'X',
        label_en: 'X',
        fuel_type: 'benzin',
        co2e_per_km_kg: 0.2,
      })
      .expect(400);
  });

  it('token YOKSA yazma 401', async () => {
    await request(server())
      .patch('/dashboard/company')
      .send({ allowed_origins: [] })
      .expect(401);
  });
});

describe('/dashboard/* — kimlikli yuzey', () => {
  it('token yoksa 401', async () => {
    await request(server()).get('/dashboard/company').expect(401);
  });

  it('gecersiz token 401 ve ayrinti SIZDIRMAZ', async () => {
    const res = await request(server())
      .get('/dashboard/company')
      .set('Authorization', 'Bearer sahte')
      .expect(401);
    expect(body(res).error!.message).toBe('Geçersiz veya süresi dolmuş token.');
    expect(JSON.stringify(res.body)).not.toMatch(/imza/);
  });

  it('gecerli ama sirkete BAGLI OLMAYAN kullanici 401', async () => {
    await request(server())
      .get('/dashboard/company')
      .set('Authorization', 'Bearer valid:10000000-0000-4000-8000-0000000000ff')
      .expect(401);
  });

  it('askiya alinmis sirketin yoneticisi 403', async () => {
    await request(server())
      .get('/dashboard/company')
      .set('Authorization', 'Bearer valid:10000000-0000-4000-8000-000000000003')
      .expect(403);
  });

  it('gecerli uye YALNIZCA kendi sirketini gorur', async () => {
    const res = await request(server())
      .get('/dashboard/company')
      .set('Authorization', 'Bearer valid:10000000-0000-4000-8000-000000000001')
      .expect(200);
    expect(body(res).data.public_widget_key).toBe('key-1');
  });

  it('query ile baska sirket kimligi gondermek ISE YARAMAZ', async () => {
    // Controller hiçbir şirket parametresi okumaz; whitelist'te olmayan query
    // alanı ya reddedilir ya yok sayılır — her iki durumda da sızıntı yok.
    const res = await request(server())
      .get(`/dashboard/company?company_id=${IDS.co2}`)
      .set(
        'Authorization',
        'Bearer valid:10000000-0000-4000-8000-000000000001',
      );
    if (res.status === 200) {
      expect(body(res).data.public_widget_key).toBe('key-1');
    } else {
      expect(res.status).toBe(400);
    }
  });

  it('karbon ozeti widget ile yazilan veriyi gosterir (uctan uca akis)', async () => {
    await request(server())
      .post('/widget/events')
      .set('X-Widget-Key', 'key-1')
      .send({
        event_type: 'katki_ekle_butonuna_basildi',
        session_ref: 'akis-1',
        metadata: { distance_km: 350, vehicle_class_code: 'ekonomi-benzin' },
      })
      .expect(201);

    const res = await request(server())
      .get('/dashboard/carbon-summary?range=month')
      .set('Authorization', 'Bearer valid:10000000-0000-4000-8000-000000000001')
      .expect(200);
    expect(body(res).data).toMatchObject({
      estimated_co2e_kg: 59.85,
      contributions_count: 1,
      total_distance_km: 350,
      missing_estimate_count: 0,
      is_estimated: true,
    });
  });
});

// ---------------------------------------------------------------------------
// DEMO (salt okunur) — Stay'deki demo_viewer akışının karşılığı.
// Demo kullanıcısı gerçek oturumla girer, kendi (demo) şirketini GÖRÜR ama
// hiçbir şeyi DEĞİŞTİREMEZ. Kural metot bazlıdır: endpoint listesi değil.
// ---------------------------------------------------------------------------
describe('demo_viewer — salt okunur', () => {
  const DEMO = `Bearer valid:${AUTH_IDS.co2Demo}`;

  beforeEach(async () => {
    await seedVehicle(db, {
      company_id: IDS.co2,
      class_code: 'hibrit',
      co2e_per_km_kg: 0.109,
    });
    await seedMember(db, {
      company_id: IDS.co2,
      auth_user_id: AUTH_IDS.co2Demo,
      email: 'demo@demo.example',
      role: 'demo_viewer',
    });
  });

  it('okuyabilir ve rolunu gorur (panel demo rozeti icin)', async () => {
    const res = await request(server())
      .get('/dashboard/company')
      .set('Authorization', DEMO)
      .expect(200);
    expect(body(res).data).toMatchObject({
      public_widget_key: 'key-2',
      role: 'demo_viewer',
    });
    await request(server())
      .get('/dashboard/funnel?range=30d')
      .set('Authorization', DEMO)
      .expect(200);
  });

  it('normal yoneticinin rolu filo_yoneticisi', async () => {
    const res = await request(server())
      .get('/dashboard/company')
      .set('Authorization', `Bearer valid:${AUTH_IDS.co1Manager}`)
      .expect(200);
    expect(body(res).data.role).toBe('filo_yoneticisi');
  });

  it('PATCH company 403 demo_read_only ve DB DEGISMEZ', async () => {
    const res = await request(server())
      .patch('/dashboard/company')
      .set('Authorization', DEMO)
      .send({ allowed_origins: ['https://saldirgan.example'] })
      .expect(403);
    expect(body(res).error).toEqual({
      code: 'demo_read_only',
      message: 'Demo hesabı salt okunurdur; değişiklik kaydedilmez.',
    });
    const origins = await db.asOwner(
      async (q) =>
        (
          await q.query<{ allowed_origins: string[] }>(
            'SELECT allowed_origins FROM rental_companies WHERE id = $1',
            [IDS.co2],
          )
        ).rows[0].allowed_origins,
    );
    expect(origins).toEqual(['https://firma2.example']);
  });

  it('arac sinifi ekleme ve guncelleme de 403', async () => {
    await request(server())
      .post('/dashboard/vehicle-classes')
      .set('Authorization', DEMO)
      .send({
        class_code: 'suv',
        label_tr: 'SUV',
        label_en: 'SUV',
        fuel_type: 'benzin',
        co2e_per_km_kg: 0.2,
        factor_source: 'placeholder',
        factor_country: 'TR',
        factor_year: 2026,
        factor_scope: 'tank_to_wheel',
      })
      .expect(403);
    await request(server())
      .patch('/dashboard/vehicle-classes/hibrit')
      .set('Authorization', DEMO)
      .send({ is_active: false })
      .expect(403);
    const active = await db.asOwner(
      async (q) =>
        (
          await q.query<{ is_active: boolean }>(
            "SELECT is_active FROM vehicle_classes WHERE company_id = $1 AND class_code = 'hibrit'",
            [IDS.co2],
          )
        ).rows[0].is_active,
    );
    expect(active).toBe(true);
  });

  it('demo kurali gecerli body den ONCE uygulanir (DTO hatasi sizdirmaz)', async () => {
    // Guard'lar pipe'lardan önce çalışır: bozuk gövde bile 403 alır, 400 değil.
    await request(server())
      .patch('/dashboard/company')
      .set('Authorization', DEMO)
      .send({ status: 'active' })
      .expect(403);
  });

  it('normal yonetici yazmaya devam edebilir (kural yalnizca demo rolu)', async () => {
    await request(server())
      .patch('/dashboard/company')
      .set('Authorization', `Bearer valid:${AUTH_IDS.co1Manager}`)
      .send({ allowed_origins: ['https://yeni.firma1.example'] })
      .expect(200);
  });
});

describe('GET /dashboard/export.csv', () => {
  const MANAGER = `Bearer valid:${AUTH_IDS.co1Manager}`;

  it('gunluk CSV: BOM, baslik, dosya adi; yalnizca KENDI sirketi', async () => {
    await request(server())
      .post('/widget/events')
      .set('X-Widget-Key', 'key-1')
      .send({
        event_type: 'widget_goruntulendi',
        session_ref: 'csv-1',
        metadata: { distance_km: 100, vehicle_class_code: 'ekonomi-benzin' },
      })
      .expect(201);
    await request(server())
      .post('/widget/events')
      .set('X-Widget-Key', 'key-1')
      .send({
        event_type: 'katki_ekle_butonuna_basildi',
        session_ref: 'csv-1',
        metadata: { distance_km: 100, vehicle_class_code: 'ekonomi-benzin' },
      })
      .expect(201);
    // Başka şirketin event'i CSV'ye GİRMEMELİ.
    await db.asOwner((q) =>
      q.query(
        `INSERT INTO widget_events (company_id, event_type, session_ref)
         VALUES ($1, 'widget_goruntulendi', 'baska-1')`,
        [IDS.co2],
      ),
    );

    const res = await request(server())
      .get('/dashboard/export.csv?range=month')
      .set('Authorization', MANAGER)
      .buffer(true)
      .parse((r, cb) => {
        let data = '';
        r.setEncoding('utf8');
        r.on('data', (c: string) => (data += c));
        r.on('end', () => cb(null, data));
      })
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="green-gold-wheels_RNT-T001_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const text = res.body as string;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe(
      'tarih,goruntulenme_oturum,arac_secimi_oturum,katki_secimi_oturum,katki_onayi_oturum,tahmini_co2e_kg,toplam_mesafe_km',
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2},1,0,0,1,17\.10,100$/);
  });

  it('token yoksa 401', async () => {
    await request(server()).get('/dashboard/export.csv').expect(401);
  });

  it('demo kullanicisi da indirebilir (GET = okuma)', async () => {
    await seedMember(db, {
      company_id: IDS.co2,
      auth_user_id: AUTH_IDS.co2Demo,
      email: 'demo@demo.example',
      role: 'demo_viewer',
    });
    await request(server())
      .get('/dashboard/export.csv?range=7d')
      .set('Authorization', `Bearer valid:${AUTH_IDS.co2Demo}`)
      .expect(200);
  });
});

describe('panel onizleme origin i (WIDGET_PREVIEW_ORIGINS)', () => {
  it('GET config e izin verir — sirketin allowed_origins inde olmasa bile', async () => {
    const res = await request(server())
      .get('/widget/config?key=key-1')
      .set('Origin', PREVIEW_ORIGIN)
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBe(PREVIEW_ORIGIN);
  });

  it('POST events e IZIN VERMEZ — onizlemeden rapora event yazilamaz', async () => {
    await request(server())
      .post('/widget/events')
      .set('X-Widget-Key', 'key-1')
      .set('Origin', PREVIEW_ORIGIN)
      .send({ event_type: 'widget_goruntulendi', session_ref: 'pv-1' })
      .expect(403);
    const n = await db.asOwner(
      async (q) =>
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM widget_events',
          )
        ).rows[0].n,
    );
    expect(n).toBe(0);
  });
});
