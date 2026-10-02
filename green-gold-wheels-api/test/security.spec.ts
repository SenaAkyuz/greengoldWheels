/**
 * GÜVENLİK MODELİNİN KANITI — gerçek Postgres (PGlite), üretim migration'ları.
 *
 * Bu dosyadaki testler "kod doğru filtreliyor mu" sorusunu DEĞİL, "kod YANLIŞ
 * filtreleseydi ne olurdu" sorusunu test eder: sorgular bilinçli olarak
 * company_id filtresi OLMADAN yazılır. Geçmeleri, izolasyonun uygulama
 * koduna değil veritabanına dayandığını gösterir.
 */
import {
  asQueryable,
  AUTH_IDS,
  createTestDatabase,
  IDS,
  seedCompany,
  seedEvent,
  seedMember,
  seedVehicle,
  type PgliteDatabase,
} from './pglite-db';
import { assertRlsBinding, RlsBindingError } from '../src/database/rls-guard';

let db: PgliteDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  await seedCompany(db, {
    id: IDS.co1,
    public_widget_key: 'key-1',
    allowed_origins: ['https://firma1.example'],
  });
  await seedCompany(db, {
    id: IDS.co2,
    public_widget_key: 'key-2',
    allowed_origins: ['https://firma2.example'],
  });
  await seedCompany(db, {
    id: IDS.co3,
    public_widget_key: 'key-3',
    status: 'suspended',
    allowed_origins: ['https://askida.example'],
  });
  await seedVehicle(db, {
    company_id: IDS.co1,
    class_code: 'c1-arac',
    co2e_per_km_kg: 0.1,
  });
  await seedVehicle(db, {
    company_id: IDS.co2,
    class_code: 'c2-arac',
    co2e_per_km_kg: 0.2,
  });
  await seedEvent(db, {
    company_id: IDS.co1,
    event_type: 'widget_goruntulendi',
    session_ref: 's1',
  });
  await seedEvent(db, {
    company_id: IDS.co2,
    event_type: 'widget_goruntulendi',
    session_ref: 's2',
  });
  await seedEvent(db, {
    company_id: IDS.co2,
    event_type: 'widget_goruntulendi',
    session_ref: 's3',
  });
  await seedMember(db, {
    company_id: IDS.co1,
    auth_user_id: AUTH_IDS.co1Manager,
    email: 'a@firma1.example',
  });
  await seedMember(db, {
    company_id: IDS.co2,
    auth_user_id: AUTH_IDS.co2Manager,
    email: 'b@firma2.example',
  });
});

const count = (rows: { n: number }[]) => rows[0]?.n;

describe('negatif kontrol — test anlamli mi?', () => {
  it('sahip TUM satirlari gorur (tablolar gercekten dolu)', async () => {
    const n = await db.asOwner(async (q) =>
      count(
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM widget_events',
          )
        ).rows,
      ),
    );
    // Bu 3 değilse, aşağıdaki "0 satır" sonuçları RLS'i değil boş tabloyu
    // kanıtlardı.
    expect(n).toBe(3);
  });
});

describe('RLS — filtresiz sorgu bile baska sirketi gormez', () => {
  it('sirket 1 baglaminda WHERE yazmadan yalnizca kendi event ini gorur', async () => {
    const rows = await db.withTenant(
      IDS.co1,
      async (q) =>
        (
          await q.query<{ company_id: string }>(
            'SELECT company_id FROM widget_events',
          )
        ).rows,
    );
    expect(rows).toHaveLength(1);
    expect(rows.every((r) => r.company_id === IDS.co1)).toBe(true);
  });

  it('sirket 2 baglaminda kendi 2 event ini gorur', async () => {
    const n = await db.withTenant(IDS.co2, async (q) =>
      count(
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM widget_events',
          )
        ).rows,
      ),
    );
    expect(n).toBe(2);
  });

  it('baska sirketin satirini ACIKCA istese bile alamaz', async () => {
    const rows = await db.withTenant(
      IDS.co1,
      async (q) =>
        (
          await q.query('SELECT * FROM widget_events WHERE company_id = $1', [
            IDS.co2,
          ])
        ).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it('dort tablonun hicbirinde baska sirket sizmaz', async () => {
    const seen = await db.withTenant(IDS.co1, async (q) => ({
      companies: (
        await q.query<{ id: string }>('SELECT id FROM rental_companies')
      ).rows.map((r) => r.id),
      vehicles: (
        await q.query<{ class_code: string }>(
          'SELECT class_code FROM vehicle_classes',
        )
      ).rows.map((r) => r.class_code),
      users: (
        await q.query<{ email: string }>('SELECT email FROM users')
      ).rows.map((r) => r.email),
    }));
    expect(seen.companies).toEqual([IDS.co1]);
    expect(seen.vehicles).toEqual(['c1-arac']);
    expect(seen.users).toEqual(['a@firma1.example']);
  });
});

describe('RLS — fail-closed', () => {
  it('sirket ayarlanmamissa HICBIR tabloda satir gorunmez', async () => {
    const seen = await db.withoutTenant(async (q) => ({
      companies: count(
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM rental_companies',
          )
        ).rows,
      ),
      vehicles: count(
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM vehicle_classes',
          )
        ).rows,
      ),
      users: count(
        (await q.query<{ n: number }>('SELECT count(*)::int n FROM users'))
          .rows,
      ),
      events: count(
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM widget_events',
          )
        ).rows,
      ),
    }));
    expect(seen).toEqual({ companies: 0, vehicles: 0, users: 0, events: 0 });
  });

  it('bos string tenant hata vermez, hicbir sey gostermez', async () => {
    const n = await db.pg.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE wheels_app');
      await tx.query("SELECT set_config('app.current_company_id', '', true)");
      return (
        await tx.query<{ n: number }>(
          'SELECT count(*)::int n FROM widget_events',
        )
      ).rows[0].n;
    });
    expect(n).toBe(0);
  });

  it('tenant ayari transaction bitince sizmaz', async () => {
    await db.withTenant(IDS.co1, (q) => q.query('SELECT 1'));
    const n = await db.withoutTenant(async (q) =>
      count(
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM widget_events',
          )
        ).rows,
      ),
    );
    expect(n).toBe(0);
  });

  it('gecersiz company_id ile tenant transaction i ACILMAZ', async () => {
    await expect(
      db.withTenant("x' OR '1'='1", (q) => q.query('SELECT 1')),
    ).rejects.toThrow('Geçersiz company_id');
  });
});

describe('RLS — yazma sinirlari', () => {
  it('sirket 1, sirket 2 adina event YAZAMAZ (WITH CHECK)', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query(
          `INSERT INTO widget_events (company_id, event_type, session_ref)
           VALUES ($1, 'widget_goruntulendi', 'sizinti')`,
          [IDS.co2],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('uygulama rolu event GUNCELLEYEMEZ', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query("UPDATE widget_events SET event_type = 'checkbox_secildi'"),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('uygulama rolu event SILEMEZ', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) => q.query('DELETE FROM widget_events')),
    ).rejects.toThrow(/permission denied/i);
  });

  it('uygulama rolu sirket satirini DEGISTIREMEZ (fiyat/durum)', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query(
          "UPDATE rental_companies SET status = 'active', price_per_kg_co2e = 0",
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('uygulama rolu arac sinifinin KIMLIK kolonlarini degistiremez', async () => {
    // NOT: `co2e_per_km_kg` Adım 3'te (0008_panel_writes.sql) bilinçli olarak
    // YAZILABİLİR yapıldı — panelin faktör yönetimi buna dayanıyor; sınırları
    // test/panel-writes.spec.ts ölçüyor. Değişmeyen kural: bir araç sınıfı
    // doğduğu şirkette ve doğduğu kodla kalır (geçmiş event'ler ona bağlı).
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query("UPDATE vehicle_classes SET class_code = 'baska-kod'"),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('uygulama rolu kendine uye EKLEYEMEZ', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query(
          `INSERT INTO users (company_id, auth_user_id, full_name, email)
           VALUES ($1, '10000000-0000-4000-8000-00000000dead', 'X', 'x@x.x')`,
          [IDS.co1],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('uygulama rolu RLS i KAPATAMAZ', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query('ALTER TABLE widget_events DISABLE ROW LEVEL SECURITY'),
      ),
    ).rejects.toThrow(/must be owner/i);
  });
});

describe('SECURITY DEFINER fonksiyonlari — dar ve denetlenebilir', () => {
  it('widget anahtari yalnizca (company_id, status) dondurur — tam satir DEGIL', async () => {
    const cols = await db.withoutTenant(async (q) => {
      const { rows } = await q.query<Record<string, unknown>>(
        'SELECT * FROM wheels_resolve_widget_key($1)',
        ['key-1'],
      );
      return Object.keys(rows[0] ?? {}).sort();
    });
    expect(cols).toEqual(['company_id', 'status']);
  });

  it('SQL enjeksiyon denemesi hicbir sey dondurmez (parametrik)', async () => {
    const rows = await db.withoutTenant(
      async (q) =>
        (
          await q.query('SELECT * FROM wheels_resolve_widget_key($1)', [
            "key-1' OR '1'='1",
          ])
        ).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it('uye cozumu YALNIZCA auth_user_id ile eslesir, e-posta ile ASLA', async () => {
    // Fonksiyon parametresi uuid: e-posta ARTIK TİP SEVİYESİNDE reddedilir —
    // "0 satır döner"den daha güçlü bir garanti.
    await expect(
      db.withoutTenant((q) =>
        q.query('SELECT * FROM wheels_resolve_member($1)', [
          'a@firma1.example',
        ]),
      ),
    ).rejects.toThrow(/invalid input syntax for type uuid/i);

    const byAuthId = await db.withoutTenant(
      async (q) =>
        (
          await q.query<{ company_id: string }>(
            'SELECT company_id FROM wheels_resolve_member($1)',
            [AUTH_IDS.co1Manager],
          )
        ).rows,
    );
    expect(byAuthId).toEqual([{ company_id: IDS.co1 }]);
  });

  it('kayitli OLMAYAN gecerli bir uuid hicbir sey dondurmez', async () => {
    const rows = await db.withoutTenant(
      async (q) =>
        (
          await q.query('SELECT * FROM wheels_resolve_member($1)', [
            AUTH_IDS.stranger,
          ])
        ).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it('baglanmamis (auth_user_id NULL) uye hicbir kimlikle eslesmez', async () => {
    await seedMember(db, {
      company_id: IDS.co1,
      auth_user_id: null,
      email: 'davetli@firma1.example',
    });
    // NULL hiçbir şeye eşit değildir: bağlanmamış satır fail-closed.
    const rows = await db.withoutTenant(
      async (q) =>
        (
          await q.query('SELECT * FROM wheels_resolve_member($1)', [
            AUTH_IDS.stranger,
          ])
        ).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it('CORS birlesimi ASKIYA ALINMIS sirketin origin ini icermez', async () => {
    const origins = await db.withoutTenant(
      async (q) =>
        (
          await q.query<{ o: string[] }>(
            'SELECT wheels_all_widget_origins() AS o',
          )
        ).rows[0].o,
    );
    expect([...origins].sort()).toEqual([
      'https://firma1.example',
      'https://firma2.example',
    ]);
  });

  it('askiya alinmis sirketin anahtariyla origin alinamaz', async () => {
    const o = await db.withoutTenant(
      async (q) =>
        (
          await q.query<{ o: string[] | null }>(
            'SELECT wheels_widget_origins($1) AS o',
            ['key-3'],
          )
        ).rows[0].o,
    );
    expect(o).toBeNull();
  });

  it('PUBLIC rolu definer fonksiyonlarini CALISTIRAMAZ', async () => {
    const canExec = await db.asOwner(
      async (q) =>
        (
          await q.query<{ ok: boolean }>(
            `SELECT has_function_privilege('public', 'wheels_resolve_member(uuid)', 'EXECUTE') AS ok`,
          )
        ).rows[0].ok,
    );
    expect(canExec).toBe(false);
  });
});

describe('acilis guvenlik kontrolu (assertRlsBinding)', () => {
  it('dogru rolde (wheels_app) gecer', async () => {
    await expect(
      db.withoutTenant((q) => assertRlsBinding(q)),
    ).resolves.toBeUndefined();
  });

  it('tablo SAHIBI ile baglanilirsa uygulamayi DURDURUR', async () => {
    await expect(db.asOwner((q) => assertRlsBinding(q))).rejects.toThrow(
      RlsBindingError,
    );
  });

  it('SUPERUSER ile baglanilirsa uygulamayi DURDURUR', async () => {
    await expect(
      db.pg.transaction((tx) => assertRlsBinding(asQueryable(tx))),
    ).rejects.toThrow(RlsBindingError);
  });

  it('BYPASSRLS li rol (Neon konsol rolu taklidi) ile DURDURUR', async () => {
    await db.pg.exec(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'konsol_rolu') THEN
          CREATE ROLE konsol_rolu NOLOGIN BYPASSRLS;
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO konsol_rolu;
      GRANT SELECT ON rental_companies, vehicle_classes, users, widget_events TO konsol_rolu;
    `);
    await expect(
      db.pg.transaction(async (tx) => {
        await tx.query('SET LOCAL ROLE konsol_rolu');
        return assertRlsBinding(asQueryable(tx));
      }),
    ).rejects.toThrow(/konsol_rolu/);
  });
});
