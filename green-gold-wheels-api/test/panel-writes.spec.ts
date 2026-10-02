/**
 * PANEL YAZMA YETKİLERİNİN SINIRLARI — gerçek Postgres, üretim migration'ları.
 *
 * 0008 panel için yazma kapısını açtı. Bu dosya kapının ne kadar DAR
 * açıldığını kanıtlar: izin verilen kolonlar yazılabiliyor, verilmeyenler
 * veritabanı seviyesinde reddediliyor, ve hiçbir yazma şirket sınırını
 * geçemiyor.
 *
 * Buradaki testler uygulama kodunu değil YETKİ MODELİNİ ölçer: sorgular
 * doğrudan yazılır, çünkü asıl soru "panel kodu doğru mu" değil, "panel kodu
 * YANLIŞ olsaydı veritabanı durdurur muydu".
 */
import {
  createTestDatabase,
  IDS,
  seedCompany,
  seedVehicle,
  type PgliteDatabase,
} from './pglite-db';

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
    allowed_origins: ['https://eski.example'],
  });
  await seedCompany(db, { id: IDS.co2, public_widget_key: 'key-2' });
  await seedVehicle(db, {
    company_id: IDS.co1,
    class_code: 'benzin',
    co2e_per_km_kg: 0.171,
  });
  await seedVehicle(db, {
    company_id: IDS.co2,
    class_code: 'co2-arac',
    co2e_per_km_kg: 0.2,
  });
});

const readCompany = (field: string, id: string = IDS.co1) =>
  db.asOwner(
    async (q) =>
      (
        await q.query<Record<string, unknown>>(
          `SELECT ${field} AS v FROM rental_companies WHERE id = $1`,
          [id],
        )
      ).rows[0].v,
  );

describe('izin VERILEN yazmalar calisir', () => {
  it('allowed_origins guncellenebilir', async () => {
    await db.withTenant(IDS.co1, (q) =>
      q.query(
        'UPDATE rental_companies SET allowed_origins = $1 WHERE id = $2',
        [['https://yeni.example', 'https://ikinci.example'], IDS.co1],
      ),
    );
    expect(await readCompany('allowed_origins')).toEqual([
      'https://yeni.example',
      'https://ikinci.example',
    ]);
  });

  it('fiyatlandirma guncellenebilir', async () => {
    await db.withTenant(IDS.co1, (q) =>
      q.query(
        `UPDATE rental_companies
            SET price_per_kg_co2e = 2.5, min_contribution_amount = 29
          WHERE id = $1`,
        [IDS.co1],
      ),
    );
    expect(String(await readCompany('price_per_kg_co2e'))).toBe('2.5000');
  });

  it('arac faktoru ve provenance guncellenebilir', async () => {
    await db.withTenant(IDS.co1, (q) =>
      q.query(
        `UPDATE vehicle_classes
            SET co2e_per_km_kg = 0.182, factor_source = 'DEFRA 2024',
                factor_year = 2024, factor_scope = 'well_to_wheel'
          WHERE class_code = 'benzin'`,
      ),
    );
    const row = await db.asOwner(
      async (q) =>
        (
          await q.query<{ f: string; s: string; sc: string }>(
            `SELECT co2e_per_km_kg::text f, factor_source s, factor_scope sc
               FROM vehicle_classes WHERE company_id = $1`,
            [IDS.co1],
          )
        ).rows[0],
    );
    expect(row).toEqual({
      f: '0.18200',
      s: 'DEFRA 2024',
      sc: 'well_to_wheel',
    });
  });

  it('arac sinifi pasife alinabilir (silme YERINE)', async () => {
    await db.withTenant(IDS.co1, (q) =>
      q.query('UPDATE vehicle_classes SET is_active = false'),
    );
    const n = await db.asOwner(
      async (q) =>
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM vehicle_classes WHERE company_id = $1 AND is_active = false',
            [IDS.co1],
          )
        ).rows[0].n,
    );
    expect(n).toBe(1);
  });

  it('yeni arac sinifi eklenebilir', async () => {
    await db.withTenant(IDS.co1, (q) =>
      q.query(
        `INSERT INTO vehicle_classes
           (company_id, class_code, label_tr, label_en, fuel_type,
            co2e_per_km_kg, factor_source, factor_country, factor_year, factor_scope)
         VALUES ($1,'yeni','Yeni','New','dizel',0.16,'DEFRA 2024','TR',2024,'tank_to_wheel')`,
        [IDS.co1],
      ),
    );
    const n = await db.asOwner(
      async (q) =>
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM vehicle_classes WHERE company_id = $1',
            [IDS.co1],
          )
        ).rows[0].n,
    );
    expect(n).toBe(2);
  });
});

describe('izin VERILMEYEN kolonlar — veritabani reddeder', () => {
  it('sirket kendini AKTIF yapamaz', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query("UPDATE rental_companies SET status = 'active' WHERE id = $1", [
          IDS.co1,
        ]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('widget anahtarini degistiremez', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query(
          "UPDATE rental_companies SET public_widget_key = 'calinti' WHERE id = $1",
          [IDS.co1],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('komisyon oranini degistiremez', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query('UPDATE rental_companies SET commission_rate = 0'),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('sirket kodunu degistiremez', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query("UPDATE rental_companies SET company_code = 'RNT-SAHTE'"),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('arac sinifinin KODUNU degistiremez (gecmis event ler ona bagli)', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query("UPDATE vehicle_classes SET class_code = 'baska'"),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('arac sinifini BASKA sirkete tasiyamaz', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query('UPDATE vehicle_classes SET company_id = $1', [IDS.co2]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('arac sinifi SILEMEZ', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) => q.query('DELETE FROM vehicle_classes')),
    ).rejects.toThrow(/permission denied/i);
  });

  it('sirket SILEMEZ', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) => q.query('DELETE FROM rental_companies')),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe('yazmalar sirket sinirini GECEMEZ', () => {
  it('baska sirketin origin listesini degistiremez', async () => {
    await db.withTenant(IDS.co1, (q) =>
      q.query('UPDATE rental_companies SET allowed_origins = $1', [
        ['https://saldirgan.example'],
      ]),
    );
    // Kendi satırı değişti, co2 DOKUNULMADI.
    expect(await readCompany('allowed_origins')).toEqual([
      'https://saldirgan.example',
    ]);
    expect(await readCompany('allowed_origins', IDS.co2)).toEqual([]);
  });

  it('baska sirketin arac faktorunu degistiremez (RLS satiri gizler)', async () => {
    await db.withTenant(IDS.co1, (q) =>
      q.query('UPDATE vehicle_classes SET co2e_per_km_kg = 0.001'),
    );
    const other = await db.asOwner(
      async (q) =>
        (
          await q.query<{ f: string }>(
            'SELECT co2e_per_km_kg::text f FROM vehicle_classes WHERE company_id = $1',
            [IDS.co2],
          )
        ).rows[0].f,
    );
    expect(other).toBe('0.20000');
  });

  it('BASKA sirket adina yeni arac sinifi EKLEYEMEZ (WITH CHECK)', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query(
          `INSERT INTO vehicle_classes
             (company_id, class_code, label_tr, label_en, fuel_type,
              co2e_per_km_kg, factor_source, factor_country, factor_year, factor_scope)
           VALUES ($1,'sizinti','X','X','benzin',0.1,'x','TR',2026,'tank_to_wheel')`,
          [IDS.co2],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('sirket ayari tenant BAGLAMI YOKKEN yazilamaz (fail-closed)', async () => {
    // withoutTenant: app.current_company_id ayarlı değil -> hiçbir satır
    // görünmez, güncelleme 0 satırı etkiler (sessizce hiçbir şey olmaz).
    await db.withoutTenant((q) =>
      q.query('UPDATE rental_companies SET allowed_origins = $1', [
        ['https://hic.example'],
      ]),
    );
    expect(await readCompany('allowed_origins')).toEqual([
      'https://eski.example',
    ]);
  });
});

describe('uye ve event tablolari HALA yazilamaz', () => {
  it('panel kendine uye EKLEYEMEZ (erisimin kapisi operatorde kalir)', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query(
          `INSERT INTO users (company_id, auth_user_id, full_name, email)
           VALUES ($1, NULL, 'Sahte', 'sahte@x.example')`,
          [IDS.co1],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('panel kendi donusum sayilarini DUZELTEMEZ', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) =>
        q.query(
          "UPDATE widget_events SET event_type = 'katki_ekle_butonuna_basildi'",
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('panel event SILEMEZ', async () => {
    await expect(
      db.withTenant(IDS.co1, (q) => q.query('DELETE FROM widget_events')),
    ).rejects.toThrow(/permission denied/i);
  });
});
