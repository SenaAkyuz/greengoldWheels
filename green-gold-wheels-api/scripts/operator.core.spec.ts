/**
 * Operatör SQL çekirdekleri — gerçek Postgres (PGlite), üretim migration'ları,
 * SAHİP rolü (üretimde script'lerin çalıştığı rol). Bu SQL senin Neon
 * veritabanında çalışacak; hatası burada yakalanmalı, canlıda değil.
 */
import { validateInput, planCreateCompany } from './create-company.core';
import {
  activateCompany,
  ensureMember,
  assertAppRoleIsRestricted,
  buildAppUrl,
  enableAppRoleLogin,
  insertCompany,
  linkMember,
  OperatorError,
  seedMissingVehicleClasses,
  toPooledHost,
} from './operator.core';
import {
  asQueryable,
  createTestDatabase,
  seedAuthUser,
  type PgliteDatabase,
} from '../test/pglite-db';

let db: PgliteDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.reset();
});

const plan = (over: Record<string, string> = {}) =>
  planCreateCompany(
    validateInput({
      name: 'Pilot Arac',
      email: 'Yonetici@Pilot.com',
      code: 'RNT-PILOT',
      factorYear: '2026',
      ...over,
    }),
  );

const create = (over: Record<string, string> = {}) =>
  db.asOwner((q) => insertCompany(q, plan(over)));

const setOrigins = (code: string, origins: string[]) =>
  db.asOwner((q) =>
    q.query(
      'UPDATE rental_companies SET allowed_origins = $1 WHERE company_code = $2',
      [origins, code],
    ),
  );

describe('insertCompany', () => {
  it('sirketi PENDING, origin listesi BOS ve widget anahtariyla olusturur', async () => {
    const c = await create();
    expect(c.status).toBe('pending');
    expect(c.company_code).toBe('RNT-PILOT');
    expect(c.public_widget_key).toMatch(/^[0-9a-f-]{36}$/);

    const origins = await db.asOwner(
      async (q) =>
        (
          await q.query<{ o: string[] }>(
            'SELECT allowed_origins o FROM rental_companies WHERE id = $1',
            [c.id],
          )
        ).rows[0].o,
    );
    expect(origins).toEqual([]);
  });

  it('4 placeholder sinifi provenance ile yazar (DB kisitlarindan gecer)', async () => {
    const c = await create();
    const rows = await db.asOwner(
      async (q) =>
        (
          await q.query<{
            class_code: string;
            factor_source: string;
            factor_year: number;
            factor_scope: string;
          }>(
            `SELECT class_code, factor_source, factor_year, factor_scope
               FROM vehicle_classes WHERE company_id = $1 ORDER BY sort_order`,
            [c.id],
          )
        ).rows,
    );
    expect(rows.map((r) => r.class_code)).toEqual([
      'ekonomi-benzin',
      'ekonomi-dizel',
      'hibrit',
      'elektrik',
    ]);
    expect(rows.every((r) => r.factor_source === 'placeholder')).toBe(true);
    expect(rows.every((r) => r.factor_year === 2026)).toBe(true);
    expect(rows.find((r) => r.class_code === 'elektrik')?.factor_scope).toBe(
      'well_to_wheel',
    );
  });

  it('yoneticiyi BAGLANMAMIS (auth_user_id NULL) ve kucuk harf e-postayla yazar', async () => {
    const c = await create();
    const u = await db.asOwner(
      async (q) =>
        (
          await q.query<{ email: string; auth_user_id: string | null }>(
            'SELECT email, auth_user_id FROM users WHERE company_id = $1',
            [c.id],
          )
        ).rows[0],
    );
    expect(u).toEqual({ email: 'yonetici@pilot.com', auth_user_id: null });
  });

  it('ayni kod ikinci kez -> hata ve HICBIR SEY yazilmaz (atomik)', async () => {
    await create();
    await expect(create({ email: 'baska@pilot.com' })).rejects.toThrow();
    const n = await db.asOwner(
      async (q) =>
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM rental_companies',
          )
        ).rows[0].n,
    );
    expect(n).toBe(1);
  });

  it('gecersiz auth kimligi DB kisitina ulasmadan reddedilir', () => {
    expect(() => plan({ authUserId: 'yonetici@pilot.com' })).toThrow(
      '--authUserId',
    );
  });
});

describe('linkMember', () => {
  const ID_A = '20000000-0000-4000-8000-00000000000a';
  const ID_B = '20000000-0000-4000-8000-00000000000b';

  beforeEach(async () => {
    await create();
    // Neon Auth'ta hesaplar açılmış gibi (FK bunu zorunlu kılar).
    await seedAuthUser(db, { id: ID_A, email: 'a@auth.example' });
    await seedAuthUser(db, { id: ID_B, email: 'b@auth.example' });
  });

  it('baglar ve uygulamanin uye cozumu (RLS yolu) artik calisir', async () => {
    const r = await db.asOwner((q) =>
      linkMember(q, {
        code: 'rnt-pilot',
        email: 'YONETICI@pilot.com',
        authUserId: ID_A,
      }),
    );
    expect(r).toBe('linked');

    // Uçtan uca: AuthGuard'ın kullandığı fonksiyon, wheels_app olarak.
    const member = await db.withoutTenant(
      async (q) =>
        (
          await q.query<{ role: string; company_status: string }>(
            'SELECT role, company_status FROM wheels_resolve_member($1)',
            [ID_A],
          )
        ).rows[0],
    );
    expect(member).toEqual({
      role: 'filo_yoneticisi',
      company_status: 'pending',
    });
  });

  it('ayni kimlik tekrar -> already-linked', async () => {
    const args = {
      code: 'RNT-PILOT',
      email: 'yonetici@pilot.com',
      authUserId: ID_A,
    };
    await db.asOwner((q) => linkMember(q, args));
    expect(await db.asOwner((q) => linkMember(q, args))).toBe('already-linked');
  });

  it('baska kimlige TASIMAK --force ister', async () => {
    const base = { code: 'RNT-PILOT', email: 'yonetici@pilot.com' };
    await db.asOwner((q) => linkMember(q, { ...base, authUserId: ID_A }));
    await expect(
      db.asOwner((q) => linkMember(q, { ...base, authUserId: ID_B })),
    ).rejects.toThrow(/--force/);
    await expect(
      db.asOwner((q) =>
        linkMember(q, { ...base, authUserId: ID_B, force: true }),
      ),
    ).resolves.toBe('linked');
  });

  it('bir auth kimligi IKI sirkete baglanamaz', async () => {
    await create({ code: 'RNT-IKINCI', email: 'iki@ikinci.com' });
    await db.asOwner((q) =>
      linkMember(q, {
        code: 'RNT-PILOT',
        email: 'yonetici@pilot.com',
        authUserId: ID_A,
      }),
    );
    await expect(
      db.asOwner((q) =>
        linkMember(q, {
          code: 'RNT-IKINCI',
          email: 'iki@ikinci.com',
          authUserId: ID_A,
        }),
      ),
    ).rejects.toThrow(/RNT-PILOT/);
  });

  it('e-posta / oturum kimligi / Clerk bicimi UUID yerine kabul EDILMEZ', async () => {
    const bad = [
      'yonetici@pilot.com',
      'sess_123',
      '',
      'user_2NNEqL2nrIRdJ194', // eski Clerk biçimi
      '20000000-0000-4000-8000', // kesik UUID
    ];
    for (const value of bad) {
      await expect(
        db.asOwner((q) =>
          linkMember(q, {
            code: 'RNT-PILOT',
            email: 'yonetici@pilot.com',
            authUserId: value,
          }),
        ),
      ).rejects.toThrow(OperatorError);
    }
  });

  it('Neon Auth ta OLMAYAN kimlige baglamaz ve net hata verir (FK)', async () => {
    // Yazım hatası yüzünden "bağlandı ama kimse giremiyor" durumunu önler.
    await expect(
      db.asOwner((q) =>
        linkMember(q, {
          code: 'RNT-PILOT',
          email: 'yonetici@pilot.com',
          authUserId: '20000000-0000-4000-8000-0000000000ff',
        }),
      ),
    ).rejects.toThrow(/Neon Auth'ta bulunamadı/);
  });

  it('bilinmeyen yonetici -> net hata', async () => {
    await expect(
      db.asOwner((q) =>
        linkMember(q, {
          code: 'RNT-PILOT',
          email: 'yok@pilot.com',
          authUserId: ID_A,
        }),
      ),
    ).rejects.toThrow(/yönetici yok/);
  });
});

describe('ensureMember — yonetici ekleme/baglama', () => {
  const ID_C = '20000000-0000-4000-8000-00000000000c';
  const ID_D = '20000000-0000-4000-8000-00000000000d';

  beforeEach(async () => {
    await create();
    await seedAuthUser(db, { id: ID_C, email: 'c@auth.example' });
    await seedAuthUser(db, { id: ID_D, email: 'd@auth.example' });
  });

  it('users satiri YOKSA olusturur ve baglar', async () => {
    const r = await db.asOwner((q) =>
      ensureMember(q, {
        code: 'RNT-PILOT',
        email: 'Yeni@Pilot.com',
        fullName: 'Yeni Yonetici',
        authUserId: ID_C,
      }),
    );
    expect(r).toBe('created');

    // AuthGuard'in kullandigi yol artik calisiyor.
    const member = await db.withoutTenant(
      async (q) =>
        (
          await q.query<{ role: string }>(
            'SELECT role FROM wheels_resolve_member($1)',
            [ID_C],
          )
        ).rows[0],
    );
    expect(member).toEqual({ role: 'filo_yoneticisi' });
  });

  it('e-postayi kucuk harfe cevirir', async () => {
    await db.asOwner((q) =>
      ensureMember(q, {
        code: 'RNT-PILOT',
        email: 'BUYUK@Pilot.com',
        fullName: 'X',
        authUserId: ID_C,
      }),
    );
    const email = await db.asOwner(
      async (q) =>
        (
          await q.query<{ email: string }>(
            'SELECT email FROM users WHERE auth_user_id = $1',
            [ID_C],
          )
        ).rows[0].email,
    );
    expect(email).toBe('buyuk@pilot.com');
  });

  it('users satiri VARSA olusturmaz, baglar', async () => {
    const r = await db.asOwner((q) =>
      ensureMember(q, {
        code: 'RNT-PILOT',
        email: 'yonetici@pilot.com', // create() ile gelen mevcut satir
        fullName: 'Fark etmez',
        authUserId: ID_C,
      }),
    );
    expect(r).toBe('linked');
    const n = await db.asOwner(
      async (q) =>
        (await q.query<{ n: number }>('SELECT count(*)::int n FROM users'))
          .rows[0].n,
    );
    expect(n).toBe(1);
  });

  it('ayni cagri tekrar -> already-linked (idempotent)', async () => {
    const args = {
      code: 'RNT-PILOT',
      email: 'yeni@pilot.com',
      fullName: 'Y',
      authUserId: ID_C,
    };
    expect(await db.asOwner((q) => ensureMember(q, args))).toBe('created');
    expect(await db.asOwner((q) => ensureMember(q, args))).toBe(
      'already-linked',
    );
  });

  it('bir kimlik IKI sirkete baglanamaz (yeni satir acarken de)', async () => {
    await create({ code: 'RNT-IKINCI', email: 'iki@ikinci.com' });
    await db.asOwner((q) =>
      ensureMember(q, {
        code: 'RNT-PILOT',
        email: 'a@pilot.com',
        fullName: 'A',
        authUserId: ID_C,
      }),
    );
    await expect(
      db.asOwner((q) =>
        ensureMember(q, {
          code: 'RNT-IKINCI',
          email: 'b@ikinci.com',
          fullName: 'B',
          authUserId: ID_C,
        }),
      ),
    ).rejects.toThrow(/RNT-PILOT/);
  });

  it('bilinmeyen sirket -> net hata', async () => {
    await expect(
      db.asOwner((q) =>
        ensureMember(q, {
          code: 'RNT-YOK',
          email: 'x@x.com',
          fullName: 'X',
          authUserId: ID_C,
        }),
      ),
    ).rejects.toThrow(/Şirket bulunamadı/);
  });

  it('bos isim reddedilir', async () => {
    await expect(
      db.asOwner((q) =>
        ensureMember(q, {
          code: 'RNT-PILOT',
          email: 'bos@pilot.com',
          fullName: '   ',
          authUserId: ID_D,
        }),
      ),
    ).rejects.toThrow(/adı boş/);
  });

  it('ayni sirkete IKINCI yonetici eklenebilir', async () => {
    await db.asOwner((q) =>
      ensureMember(q, {
        code: 'RNT-PILOT',
        email: 'birinci@pilot.com',
        fullName: 'Birinci',
        authUserId: ID_C,
      }),
    );
    await db.asOwner((q) =>
      ensureMember(q, {
        code: 'RNT-PILOT',
        email: 'ikinci@pilot.com',
        fullName: 'Ikinci',
        authUserId: ID_D,
      }),
    );
    const n = await db.asOwner(
      async (q) =>
        (
          await q.query<{ n: number }>(
            'SELECT count(*)::int n FROM users WHERE auth_user_id IS NOT NULL',
          )
        ).rows[0].n,
    );
    expect(n).toBe(2);
  });
});

describe('activateCompany — guvenlik kapilari', () => {
  beforeEach(() => create());

  it('KAPI 1: origin listesi bossa reddeder', async () => {
    await expect(
      db.asOwner((q) => activateCompany(q, { code: 'RNT-PILOT', force: true })),
    ).rejects.toThrow(/allowed_origins BOŞ/);
  });

  it('KAPI 2: aktif arac sinifi yoksa reddeder', async () => {
    await setOrigins('RNT-PILOT', ['https://pilot.example']);
    await db.asOwner((q) =>
      q.query('UPDATE vehicle_classes SET is_active = false'),
    );
    await expect(
      db.asOwner((q) => activateCompany(q, { code: 'RNT-PILOT', force: true })),
    ).rejects.toThrow(/AKTİF araç sınıfı yok/);
  });

  it('KAPI 3: placeholder faktor varsa --force OLMADAN reddeder', async () => {
    await setOrigins('RNT-PILOT', ['https://pilot.example']);
    await expect(
      db.asOwner((q) => activateCompany(q, { code: 'RNT-PILOT' })),
    ).rejects.toThrow(/placeholder/);
  });

  it('reddedilen aktivasyon durumu DEGISTIRMEZ', async () => {
    await expect(
      db.asOwner((q) => activateCompany(q, { code: 'RNT-PILOT' })),
    ).rejects.toThrow();
    const s = await db.asOwner(
      async (q) =>
        (
          await q.query<{ status: string }>(
            "SELECT status FROM rental_companies WHERE company_code = 'RNT-PILOT'",
          )
        ).rows[0].status,
    );
    expect(s).toBe('pending');
  });

  it('--force ile aktive eder ve placeholder siniflari raporlar', async () => {
    await setOrigins('RNT-PILOT', ['https://pilot.example']);
    const r = await db.asOwner((q) =>
      activateCompany(q, { code: 'RNT-PILOT', force: true }),
    );
    expect(r.status).toBe('activated');
    expect(r.placeholderClasses).toHaveLength(4);
    expect(r.linkedMembers).toBe(0);
  });

  it('onayli faktorlerle --force GEREKMEZ', async () => {
    await setOrigins('RNT-PILOT', ['https://pilot.example']);
    await db.asOwner((q) =>
      q.query("UPDATE vehicle_classes SET factor_source = 'DEFRA 2024'"),
    );
    const r = await db.asOwner((q) =>
      activateCompany(q, { code: 'RNT-PILOT' }),
    );
    expect(r.status).toBe('activated');
    expect(r.placeholderClasses).toEqual([]);
  });

  it('aktive edilen sirketin widget i uygulama rolunden cozulur', async () => {
    await setOrigins('RNT-PILOT', ['https://pilot.example']);
    await db.asOwner((q) =>
      activateCompany(q, { code: 'RNT-PILOT', force: true }),
    );
    const origins = await db.withoutTenant(
      async (q) =>
        (
          await q.query<{ o: string[] }>(
            'SELECT wheels_all_widget_origins() AS o',
          )
        ).rows[0].o,
    );
    expect(origins).toEqual(['https://pilot.example']);
  });
});

describe('seedMissingVehicleClasses', () => {
  it('yalnizca EKSIK siniflari ekler, mevcutlari ezmez', async () => {
    const c = await create();
    await db.asOwner((q) =>
      q.query(
        `UPDATE vehicle_classes SET co2e_per_km_kg = 0.15, factor_source = 'DEFRA 2024'
          WHERE company_id = $1 AND class_code = 'hibrit'`,
        [c.id],
      ),
    );
    await db.asOwner((q) =>
      q.query(
        "DELETE FROM vehicle_classes WHERE company_id = $1 AND class_code = 'elektrik'",
        [c.id],
      ),
    );

    const added = await db.asOwner((q) =>
      seedMissingVehicleClasses(q, {
        code: 'RNT-PILOT',
        factorYear: 2026,
        country: 'TR',
      }),
    );
    expect(added).toEqual(['elektrik']);

    const hibrit = await db.asOwner(
      async (q) =>
        (
          await q.query<{ f: string; s: string }>(
            `SELECT co2e_per_km_kg::text f, factor_source s FROM vehicle_classes
              WHERE company_id = $1 AND class_code = 'hibrit'`,
            [c.id],
          )
        ).rows[0],
    );
    expect(hibrit).toEqual({ f: '0.15000', s: 'DEFRA 2024' });
  });
});

describe('setup-app-role cekirdekleri', () => {
  it('migration in olusturdugu wheels_app kisitli -> gecer', async () => {
    await expect(
      db.asOwner((q) => assertAppRoleIsRestricted(q)),
    ).resolves.toBeUndefined();
  });

  it('wheels_app BYPASSRLS alirsa (konsol taklidi) REDDEDER', async () => {
    await db.pg.exec('ALTER ROLE wheels_app BYPASSRLS');
    try {
      await expect(
        db.asOwner((q) => assertAppRoleIsRestricted(q)),
      ).rejects.toThrow(/ATLAYABİLİYOR/);
    } finally {
      await db.pg.exec('ALTER ROLE wheels_app NOBYPASSRLS');
    }
  });

  it('girisi acar, sifreyi ayarlar ve sigortalari kurar', async () => {
    // Neon'da neondb_owner (CREATEROLE + rolün yaratıcısı) yapar; testte
    // superuser taklit eder.
    await db.pg.transaction(async (tx) => {
      await enableAppRoleLogin(asQueryable(tx), 'A'.repeat(43));
    });
    const r = await db.pg.query<{ login: boolean; cfg: string[] }>(
      "SELECT rolcanlogin login, rolconfig cfg FROM pg_roles WHERE rolname = 'wheels_app'",
    );
    expect(r.rows[0].login).toBe(true);
    expect(r.rows[0].cfg).toEqual(
      expect.arrayContaining([
        'statement_timeout=15s',
        'idle_in_transaction_session_timeout=30s',
      ]),
    );
    await db.pg.exec('ALTER ROLE wheels_app NOLOGIN');
  });

  it('SQL enjeksiyonu iceren sifreyi CALISTIRMADAN reddeder', async () => {
    const calls: string[] = [];
    await expect(
      enableAppRoleLogin(
        {
          query: (s: string) => {
            calls.push(s);
            return Promise.resolve({ rows: [] });
          },
        },
        "x'; DROP ROLE wheels_app; --".padEnd(45, 'a'),
      ),
    ).rejects.toThrow(OperatorError);
    expect(calls).toEqual([]);
  });
});

describe('baglanti adresi turetme', () => {
  it('Neon adresini havuzlu host a cevirir', () => {
    expect(toPooledHost('ep-cool-123.eu-central-1.aws.neon.tech')).toBe(
      'ep-cool-123-pooler.eu-central-1.aws.neon.tech',
    );
  });

  it('zaten havuzlu ya da Neon disi host a dokunmaz', () => {
    expect(toPooledHost('ep-cool-123-pooler.eu-central-1.aws.neon.tech')).toBe(
      'ep-cool-123-pooler.eu-central-1.aws.neon.tech',
    );
    expect(toPooledHost('db.example.com')).toBe('db.example.com');
    expect(toPooledHost('evil-ep-x.neon.tech.attacker.com')).toBe(
      'evil-ep-x.neon.tech.attacker.com',
    );
  });

  it('sahip adresinden wheels_app adresi turetir: rol, sifre, havuz, TLS', () => {
    const url = buildAppUrl(
      'postgresql://neondb_owner:gizli@ep-x-1.eu-central-1.aws.neon.tech/neondb',
      'S'.repeat(43),
    );
    const u = new URL(url);
    expect(u.username).toBe('wheels_app');
    expect(u.password).toBe('S'.repeat(43));
    expect(u.hostname).toBe('ep-x-1-pooler.eu-central-1.aws.neon.tech');
    expect(u.pathname).toBe('/neondb');
    expect(u.searchParams.get('sslmode')).toBe('require');
    expect(url).not.toContain('gizli');
    expect(url).not.toContain('neondb_owner');
  });
});
