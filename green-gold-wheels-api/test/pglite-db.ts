/**
 * TEST VERİTABANI — gerçek Postgres (PGlite: Postgres'in WASM derlemesi,
 * süreç içinde, Docker/ağ gerektirmez) üzerinde, ÜRETİMİN AYNISI migration'lar.
 *
 * NEON'U BİREBİR TAKLİT EDER. Bu, testlerin değerinin tamamıdır; iki tuzak
 * PGlite üzerinde deneyle bulundu ve burada bilinçli olarak önleniyor:
 *
 *  1. PGlite varsayılan olarak SUPERUSER bağlanır. Superuser RLS'i HER ZAMAN
 *     atlar — testler RLS bozukken bile yeşil yanardı. Bu yüzden uygulama
 *     sorguları HER transaction'da `SET LOCAL ROLE wheels_app` ile çalışır ve
 *     harness bunu her seferinde DOĞRULAR (assertAppRole). Doğrulama
 *     başarısızsa test patlar; sessizce superuser sonucu dönmez.
 *
 *  2. Neon'da tablo sahibi (neondb_owner) superuser DEĞİLDİR. Sahip superuser
 *     olsaydı SECURITY DEFINER fonksiyonları her koşulda çalışır ve
 *     FORCE RLS gibi canlıda widget'ı tamamen bozan bir hata gizlenirdi.
 *     Bu yüzden migration'lar superuser-olmayan `wheels_owner` ile çalışır ve
 *     veritabanının sahibi yapılır (Neon'daki gibi public şemayı yönetebilsin).
 */
import { PGlite } from '@electric-sql/pglite';
import {
  assertCompanyId,
  Database,
  type Queryable,
} from '../src/database/database';
import { listMigrationFiles } from '../scripts/migrations';

export type PgliteTx = Parameters<Parameters<PGlite['transaction']>[0]>[0];

/** PGlite transaction'ını Queryable portuna uyarlar. */
export function asQueryable(tx: PgliteTx): Queryable {
  return {
    async query<R>(sql: string, params?: unknown[]) {
      const res = await tx.query<R>(sql, params as any[]);
      return { rows: res.rows };
    },
  };
}

/**
 * Harness'in kendini denetlemesi: bu transaction GERÇEKTEN kısıtlı rolde mi
 * ve RLS GERÇEKTEN uygulanıyor mu? Değilse test patlar.
 */
async function assertAppRole(tx: PgliteTx): Promise<void> {
  const { rows } = await tx.query<{ role: string; rls: boolean }>(
    `SELECT current_user AS role,
            row_security_active('public.widget_events'::regclass) AS rls`,
  );
  if (rows[0]?.role !== 'wheels_app' || rows[0]?.rls !== true) {
    throw new Error(
      `TEST HARNESS HATASI: sorgu wheels_app/RLS altında çalışmıyor ` +
        `(role=${rows[0]?.role}, rls=${String(rows[0]?.rls)}). ` +
        'Sonuçlar güvenilmez olurdu.',
    );
  }
}

/** Üretimdeki PgDatabase'in test karşılığı — aynı port, gerçek Postgres. */
export class PgliteDatabase extends Database {
  constructor(readonly pg: PGlite) {
    super();
  }

  async withTenant<T>(
    companyId: string,
    fn: (q: Queryable) => Promise<T>,
  ): Promise<T> {
    assertCompanyId(companyId);
    return this.pg.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE wheels_app');
      await tx.query("SELECT set_config('app.current_company_id', $1, true)", [
        companyId,
      ]);
      await assertAppRole(tx);
      return fn(asQueryable(tx));
    });
  }

  async withoutTenant<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
    return this.pg.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE wheels_app');
      await assertAppRole(tx);
      return fn(asQueryable(tx));
    });
  }

  /**
   * SAHİP olarak çalıştır — yalnızca test kurulumu (tohum veri, temizlik)
   * içindir. Sahip RLS'i atlar (FORCE yok); operatör script'lerinin
   * üretimdeki davranışının aynısı.
   */
  async asOwner<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
    return this.pg.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE wheels_owner');
      return fn(asQueryable(tx));
    });
  }

  /** Testler arası temizlik (sahip olarak). */
  async reset(): Promise<void> {
    await this.asOwner(async (q) => {
      // Kendi tablolarımız: TRUNCATE (hızlı, sahibi biziz).
      await q.query(
        'TRUNCATE widget_events, users, vehicle_classes, rental_companies CASCADE',
      );
      // neon_auth."user" YÖNETİLEN bir tablo — sahibi biz değiliz ve TRUNCATE
      // yetkimiz olmayabilir (gerçek Neon'da da öyle). Sahip olmadığımız bir
      // tabloda ayrıcalık varsaymak yerine DELETE kullanıyoruz.
      // Artık auth kullanıcısı bırakmak e-posta unique çakışması yaratırdı.
      await q.query('DELETE FROM neon_auth."user"');
    });
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}

export interface TestDbOptions {
  /**
   * `neon_auth` şemasını (Neon Auth etkinmiş gibi) oluştur. Varsayılan true.
   *
   * `false` vermek 0003'teki KOŞULLU foreign key'in "atla" dalını test eder —
   * yani Neon Auth henüz açılmamış bir projede migration'ların yine de
   * sorunsuz geçtiğini kanıtlar.
   */
  withNeonAuth?: boolean;
}

/**
 * Yeni, izole bir test veritabanı: rolleri ve `neon_auth` şemasını Neon'daki
 * gibi kurar, sonra tüm migration'ları superuser-OLMAYAN sahip olarak uygular.
 */
export async function createTestDatabase(
  options: TestDbOptions = {},
): Promise<PgliteDatabase> {
  const withNeonAuth = options.withNeonAuth !== false;
  const pg = new PGlite();

  // Rolleri superuser kurar (Neon'da bunu proje oluşturma yapar). wheels_app
  // burada oluşturulduğu için 0007'deki "yoksa oluştur" bloğu atlanır —
  // üretimde ise orada oluşturulur.
  await pg.exec(`
    CREATE ROLE wheels_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE wheels_app   NOLOGIN NOSUPERUSER NOBYPASSRLS;
  `);

  if (withNeonAuth) {
    // `neon_auth` şemasını Neon Auth (Managed Better Auth) YÖNETİR; burada
    // yalnızca `users.auth_user_id`'nin referans verdiği kadarını taklit
    // ediyoruz: tablo adı, `id` kolonu (UUID, primary key) ve `email`.
    // Taklit olduğu için Neon'un gerçek şemasıyla birebir aynı OLMAYABİLİR;
    // sözleşmenin test ettiğimiz kısmı yalnızca "neon_auth.user(id) bir
    // UUID primary key'dir" — foreign key'in dayandığı tek varsayım bu.
    // Sahibi wheels_owner YAPMIYORUZ: Neon'da da şema bize ait değil.
    await pg.exec(`
      CREATE SCHEMA neon_auth;
      CREATE TABLE neon_auth."user" (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT,
        email       TEXT UNIQUE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      GRANT USAGE ON SCHEMA neon_auth TO wheels_owner, wheels_app;
      GRANT SELECT, INSERT, DELETE ON neon_auth."user" TO wheels_owner;
      GRANT REFERENCES ON neon_auth."user" TO wheels_owner;
    `);
  }
  // Sahibi veritabanının sahibi yap: PG15+'da public şemayı
  // pg_database_owner yönetir; Neon'da neondb_owner tam olarak budur.
  await pg.exec(`
    DO $$ BEGIN
      EXECUTE format('ALTER DATABASE %I OWNER TO wheels_owner', current_database());
    END $$;
  `);

  const ownerCheck = await pg.query<{ su: boolean }>(
    "SELECT rolsuper AS su FROM pg_roles WHERE rolname = 'wheels_owner'",
  );
  if (ownerCheck.rows[0]?.su !== false) {
    throw new Error('TEST HARNESS HATASI: wheels_owner superuser olmamalı.');
  }

  for (const m of listMigrationFiles()) {
    await pg.exec('SET ROLE wheels_owner');
    try {
      await pg.exec(m.sql);
    } catch (e) {
      throw new Error(
        `Migration ${m.name} başarısız: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      await pg.exec('RESET ROLE');
    }
  }

  return new PgliteDatabase(pg);
}

// ---------------------------------------------------------------------------
// Tohum yardımcıları (sahip olarak yazar)
// ---------------------------------------------------------------------------

export const IDS = {
  co1: '00000000-0000-4000-8000-000000000001',
  co2: '00000000-0000-4000-8000-000000000002',
  co3: '00000000-0000-4000-8000-000000000003',
} as const;

export interface CompanySeed {
  id: string;
  name?: string;
  company_code?: string;
  status?: 'pending' | 'active' | 'suspended';
  public_widget_key: string;
  price_per_kg_co2e?: number;
  min_contribution_amount?: number;
  default_currency?: string;
  timezone?: string;
  brand_color?: string | null;
  allowed_origins?: string[];
  widget_settings?: Record<string, unknown>;
}

export async function seedCompany(
  db: PgliteDatabase,
  c: CompanySeed,
): Promise<void> {
  await db.asOwner((q) =>
    q.query(
      `INSERT INTO rental_companies
         (id, name, company_code, status, public_widget_key, price_per_kg_co2e,
          min_contribution_amount, default_currency, timezone, brand_color,
          allowed_origins, widget_settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [
        c.id,
        c.name ?? `Firma ${c.id.slice(-1)}`,
        c.company_code ?? `RNT-T${c.id.slice(-3)}`,
        c.status ?? 'active',
        c.public_widget_key,
        c.price_per_kg_co2e ?? 1,
        c.min_contribution_amount ?? 19,
        c.default_currency ?? 'TRY',
        c.timezone ?? 'Europe/Istanbul',
        c.brand_color ?? null,
        c.allowed_origins ?? [],
        JSON.stringify(
          c.widget_settings ?? {
            version: 1,
            pilot_mode: false,
            show_estimated_impact: false,
            enable_booking_click_tracking: false,
            content_overrides: {},
          },
        ),
      ],
    ),
  );
}

export interface VehicleSeed {
  company_id: string;
  class_code: string;
  co2e_per_km_kg: number;
  is_active?: boolean;
  sort_order?: number;
  factor_source?: string;
  factor_scope?: 'tank_to_wheel' | 'well_to_wheel';
}

export async function seedVehicle(
  db: PgliteDatabase,
  v: VehicleSeed,
): Promise<void> {
  await db.asOwner((q) =>
    q.query(
      `INSERT INTO vehicle_classes
         (company_id, class_code, label_tr, label_en, fuel_type, co2e_per_km_kg,
          factor_source, factor_country, factor_year, factor_scope, sort_order, is_active)
       VALUES ($1,$2,$3,$4,'benzin',$5,$6,'TR',2026,$7,$8,$9)`,
      [
        v.company_id,
        v.class_code,
        `TR ${v.class_code}`,
        `EN ${v.class_code}`,
        v.co2e_per_km_kg,
        v.factor_source ?? 'placeholder',
        v.factor_scope ?? 'tank_to_wheel',
        v.sort_order ?? 10,
        v.is_active ?? true,
      ],
    ),
  );
}

export interface EventSeed {
  company_id: string;
  event_type: string;
  session_ref: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

export async function seedEvent(
  db: PgliteDatabase,
  e: EventSeed,
): Promise<void> {
  await db.asOwner((q) =>
    q.query(
      `INSERT INTO widget_events (company_id, event_type, session_ref, metadata, created_at)
       VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, now()))`,
      [
        e.company_id,
        e.event_type,
        e.session_ref,
        e.metadata === undefined || e.metadata === null
          ? null
          : JSON.stringify(e.metadata),
        e.created_at ?? null,
      ],
    ),
  );
}

/**
 * Yönetici satırı ekler. `auth_user_id` verilirse önce `neon_auth.user`'a
 * karşılık gelen satırı yazar — foreign key kuruluysa aksi halde reddedilir,
 * yani bu yardımcı gerçek bütünlük kuralına uyar.
 */
export async function seedMember(
  db: PgliteDatabase,
  m: {
    company_id: string;
    auth_user_id: string | null;
    email: string;
    role?: 'filo_yoneticisi' | 'demo_viewer';
  },
): Promise<void> {
  await db.asOwner(async (q) => {
    if (m.auth_user_id !== null) {
      await q.query(
        `INSERT INTO neon_auth."user" (id, name, email)
         VALUES ($1, 'Test Yönetici', $2)
         ON CONFLICT (id) DO NOTHING`,
        [m.auth_user_id, m.email],
      );
    }
    await q.query(
      `INSERT INTO users (company_id, auth_user_id, full_name, email, role)
       VALUES ($1, $2, 'Test Yönetici', $3, $4)`,
      [m.company_id, m.auth_user_id, m.email, m.role ?? 'filo_yoneticisi'],
    );
  });
}

/**
 * `neon_auth.user` satırı ekler (Neon Auth'ta hesap açılmış gibi).
 * link-member testleri için: foreign key kuruluyken var olmayan bir kimliğe
 * bağlanamaz, o yüzden önce auth kullanıcısı var olmalı.
 */
export async function seedAuthUser(
  db: PgliteDatabase,
  u: { id: string; email: string },
): Promise<void> {
  await db.asOwner((q) =>
    q.query(
      `INSERT INTO neon_auth."user" (id, name, email)
       VALUES ($1, 'Test Kullanici', $2)
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.email],
    ),
  );
}

/** Test auth kullanıcı kimlikleri (neon_auth.user.id gibi UUID). */
export const AUTH_IDS = {
  co1Manager: '10000000-0000-4000-8000-000000000001',
  co2Manager: '10000000-0000-4000-8000-000000000002',
  co3Manager: '10000000-0000-4000-8000-000000000003',
  co2Demo: '10000000-0000-4000-8000-0000000000d2',
  stranger: '10000000-0000-4000-8000-0000000000ff',
} as const;
