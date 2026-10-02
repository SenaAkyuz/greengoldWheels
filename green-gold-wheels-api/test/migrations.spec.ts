/**
 * MIGRATION DAYANIKLILIĞI — şema, Neon Auth'un durumuna göre iki farklı
 * ortamda da kurulabilmeli.
 *
 * 0003'teki `auth_user_id -> neon_auth."user"(id)` foreign key'i KOŞULLUDUR:
 * `neon_auth` şeması Neon tarafından yönetilir ve Neon Auth etkinleştirilince
 * oluşur. Koşulsuz bir FK, Auth henüz açılmamış bir projede migration'ı komple
 * patlatır ve kurulumu bloke ederdi.
 *
 * Bu dosya iki dalı da gerçek Postgres üzerinde çalıştırır:
 *   1. neon_auth VARKEN   -> FK kurulur, bütünlük zorlanır.
 *   2. neon_auth YOKKEN   -> FK atlanır, şema yine çalışır, izolasyon bozulmaz.
 */
import {
  createTestDatabase,
  IDS,
  seedCompany,
  type PgliteDatabase,
} from './pglite-db';

const FK_NAME = 'users_auth_user_fk';
const SOME_UUID = '30000000-0000-4000-8000-000000000001';

async function fkExists(db: PgliteDatabase): Promise<boolean> {
  return db.asOwner(
    async (q) =>
      (
        await q.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM pg_constraint
            WHERE conname = $1 AND conrelid = 'public.users'::regclass`,
          [FK_NAME],
        )
      ).rows[0].n > 0,
  );
}

/** Şemanın asıl işini yapıyor mu: şirket + yönetici yazılabiliyor mu? */
async function canSeedMemberWithoutAuthId(db: PgliteDatabase): Promise<void> {
  await seedCompany(db, { id: IDS.co1, public_widget_key: 'k-mig' });
  await db.asOwner((q) =>
    q.query(
      `INSERT INTO users (company_id, auth_user_id, full_name, email)
       VALUES ($1, NULL, 'Bağlanmamış Yönetici', 'y@x.example')`,
      [IDS.co1],
    ),
  );
}

describe('neon_auth VARKEN (Neon Auth etkin)', () => {
  let db: PgliteDatabase;
  beforeAll(async () => {
    db = await createTestDatabase({ withNeonAuth: true });
  });
  afterAll(async () => {
    await db.close();
  });

  it('foreign key KURULUR', async () => {
    expect(await fkExists(db)).toBe(true);
  });

  it('var olmayan bir auth kimligine baglamaya izin VERMEZ', async () => {
    await db.reset();
    await canSeedMemberWithoutAuthId(db);
    await expect(
      db.asOwner((q) =>
        q.query('UPDATE users SET auth_user_id = $1', [SOME_UUID]),
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('auth kullanicisi SILINIRSE baglanti duser, yonetici satiri KALIR', async () => {
    await db.reset();
    await canSeedMemberWithoutAuthId(db);
    await db.asOwner(async (q) => {
      await q.query(
        `INSERT INTO neon_auth."user" (id, name, email)
         VALUES ($1, 'X', 'silinecek@x.example')`,
        [SOME_UUID],
      );
      await q.query('UPDATE users SET auth_user_id = $1', [SOME_UUID]);
      await q.query('DELETE FROM neon_auth."user" WHERE id = $1', [SOME_UUID]);
    });

    // ON DELETE SET NULL: satır korunur ama artık kimse giremez (fail-closed).
    const row = await db.asOwner(
      async (q) =>
        (
          await q.query<{ email: string; auth_user_id: string | null }>(
            'SELECT email, auth_user_id FROM users',
          )
        ).rows[0],
    );
    expect(row).toEqual({ email: 'y@x.example', auth_user_id: null });
  });
});

describe('neon_auth YOKKEN (Neon Auth henuz acilmamis)', () => {
  let db: PgliteDatabase;
  beforeAll(async () => {
    // Migration'lar patlamadan geçmeli — createTestDatabase başarısız olursa
    // zaten fırlatır, yani bu beforeAll'ın kendisi testin yarısıdır.
    db = await createTestDatabase({ withNeonAuth: false });
  });
  afterAll(async () => {
    await db.close();
  });

  it('migration lar PATLAMAZ ve foreign key ATLANIR', async () => {
    expect(await fkExists(db)).toBe(false);
  });

  it('sema yine calisir: sirket ve yonetici yazilabilir', async () => {
    await canSeedMemberWithoutAuthId(db);
    const n = await db.asOwner(
      async (q) =>
        (await q.query<{ n: number }>('SELECT count(*)::int n FROM users'))
          .rows[0].n,
    );
    expect(n).toBe(1);
  });

  it('FK olmasa da RLS izolasyonu BOZULMAZ', async () => {
    await seedCompany(db, { id: IDS.co2, public_widget_key: 'k-mig-2' });
    await db.asOwner((q) =>
      q.query(
        `INSERT INTO widget_events (company_id, event_type, session_ref)
         VALUES ($1, 'widget_goruntulendi', 's-mig')`,
        [IDS.co2],
      ),
    );
    // co1 bağlamında co2'nin event'i görünmemeli (filtre YAZMADAN).
    const rows = await db.withTenant(
      IDS.co1,
      async (q) => (await q.query('SELECT * FROM widget_events')).rows,
    );
    expect(rows).toHaveLength(0);
  });
});
