/**
 * Operatör script'lerinin SQL ÇEKİRDEKLERİ — I/O'suz, `Queryable` alır.
 *
 * NEDEN ayrı: bu fonksiyonlar senin GERÇEK Neon veritabanında, sahip rolüyle
 * çalışır. Bir SQL hatasını canlıda keşfetmek yerine, aynı fonksiyonlar
 * testte gerçek Postgres'e (PGlite, üretim migration'ları) karşı koşar
 * (operator.core.spec.ts). CLI dosyaları yalnızca argüman ayrıştırıp bunları
 * çağıran ince sarmalayıcılardır.
 *
 * Hepsi hata durumunda `OperatorError` FIRLATIR (process.exit etmez) — çağıran
 * transaction'ı geri alır, CLI mesajı basar.
 */
import type { Queryable } from '../src/database/database';
import { PLACEHOLDER_FACTOR_SOURCE } from '../src/common/carbon-estimate';
import { toSeedRows } from '../src/common/vehicle-factors';
import { AUTH_USER_ID_RE, type planCreateCompany } from './create-company.core';

export class OperatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperatorError';
  }
}

const VEHICLE_INSERT = `
  INSERT INTO vehicle_classes
    (company_id, class_code, label_tr, label_en, fuel_type, co2e_per_km_kg,
     factor_source, factor_country, factor_year, factor_scope, sort_order, is_active)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`;

function vehicleParams(v: Record<string, unknown>): unknown[] {
  return [
    v.company_id,
    v.class_code,
    v.label_tr,
    v.label_en,
    v.fuel_type,
    v.co2e_per_km_kg,
    v.factor_source,
    v.factor_country,
    v.factor_year,
    v.factor_scope,
    v.sort_order,
    v.is_active,
  ];
}

// ---------------------------------------------------------------------------
// create-company
// ---------------------------------------------------------------------------

export interface CreatedCompany {
  id: string;
  company_code: string;
  public_widget_key: string;
  status: string;
}

/** Şirket + araç sınıfları + yönetici — çağıranın transaction'ında. */
export async function insertCompany(
  q: Queryable,
  plan: ReturnType<typeof planCreateCompany>,
): Promise<CreatedCompany> {
  const c = plan.company;
  const { rows } = await q.query<CreatedCompany>(
    `INSERT INTO rental_companies
       (name, company_code, city, country, timezone, default_currency,
        price_per_kg_co2e, min_contribution_amount, status, allowed_origins)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, company_code, public_widget_key, status`,
    [
      c.name,
      c.company_code,
      c.city,
      c.country,
      c.timezone,
      c.default_currency,
      c.price_per_kg_co2e,
      c.min_contribution_amount,
      c.status,
      c.allowed_origins,
    ],
  );
  const company = rows[0];

  for (const v of plan.vehicleClasses(company.id)) {
    await q.query(VEHICLE_INSERT, vehicleParams(v));
  }

  const u = plan.user(company.id);
  await q.query(
    `INSERT INTO users (company_id, full_name, email, auth_user_id, role)
     VALUES ($1,$2,$3,$4,$5)`,
    [u.company_id, u.full_name, u.email, u.auth_user_id, u.role],
  );

  return company;
}

// ---------------------------------------------------------------------------
// link-member
// ---------------------------------------------------------------------------

export type LinkResult = 'linked' | 'already-linked';
export type EnsureMemberResult = LinkResult | 'created';

/** users.role değerleri (0009_demo_viewer.sql ile birebir). */
export const MEMBER_ROLES = ['filo_yoneticisi', 'demo_viewer'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/**
 * Şirkete yönetici EKLER ya da mevcut yöneticiyi auth hesabına bağlar.
 *
 * `linkMember`'dan farkı: `users` satırı YOKSA oluşturur. Panelde kayıt ekranı
 * olmadığı için "şirkete yeni yönetici ekleme" tek yol budur — `create-company`
 * yalnızca ilk yöneticiyi açar, sonrakiler buradan gelir.
 *
 * `linkMember` ise bilinçli olarak daha dar kaldı: var olan bir satırı bağlar,
 * yoksa hata verir. İki ayrı niyet: "bu kişiyi ekle" ile "şu bilinen kişiyi
 * kimliğine bağla" aynı şey değil; ikincisinde yazım hatasının sessizce yeni
 * bir yönetici yaratması istenmez.
 */
export async function ensureMember(
  q: Queryable,
  input: {
    code: string;
    email: string;
    fullName: string;
    authUserId: string;
    force?: boolean;
    /** Varsayılan filo_yoneticisi. demo_viewer yalnızca demo şirketine. */
    role?: MemberRole;
  },
): Promise<EnsureMemberResult> {
  const code = input.code.trim().toUpperCase();
  const role: MemberRole = input.role ?? 'filo_yoneticisi';
  if (!(MEMBER_ROLES as readonly string[]).includes(role)) {
    throw new OperatorError(`Geçersiz rol: ${String(role)}`);
  }
  const email = input.email.trim().toLowerCase();
  const authUserId = input.authUserId.trim();

  if (!AUTH_USER_ID_RE.test(authUserId)) {
    throw new OperatorError(
      '--authUserId Neon Auth kullanıcı kimliği (UUID) olmalı.',
    );
  }

  const { rows: companies } = await q.query<{ id: string }>(
    'SELECT id FROM rental_companies WHERE company_code = $1',
    [code],
  );
  if (!companies[0]) {
    throw new OperatorError(`Şirket bulunamadı: ${code}`);
  }

  const { rows: existing } = await q.query<{ id: string; role: string }>(
    'SELECT id, role FROM users WHERE company_id = $1 AND lower(email) = $2',
    [companies[0].id, email],
  );
  if (existing[0]) {
    // Rol SESSİZCE değiştirilmez: demo hesabını yanlışlıkla tam yetkili
    // yönetici yapmak (ya da tersi) bilinçli bir operatör kararı olmalı.
    if (existing[0].role !== role) {
      throw new OperatorError(
        `${email} bu şirkette zaten '${existing[0].role}' rolüyle kayıtlı; ` +
          `istenen rol '${role}'. Rol değişikliği bu script ile yapılmaz.`,
      );
    }
    // Satır var -> normal bağlama kuralları geçerli (çifte bağlama, --force).
    return linkMember(q, { code, email, authUserId, force: input.force });
  }

  // Kimlik başka bir şirkete bağlıysa yeni satır açmak YANLIŞ olur:
  // users.auth_user_id UNIQUE, ve bir kişi tek şirkete aittir.
  const { rows: taken } = await q.query<{ company_code: string }>(
    `SELECT c.company_code FROM users u
       JOIN rental_companies c ON c.id = u.company_id
      WHERE u.auth_user_id = $1`,
    [authUserId],
  );
  if (taken[0]) {
    throw new OperatorError(
      `${authUserId} zaten ${taken[0].company_code} şirketine bağlı. ` +
        'Bir auth kullanıcısı yalnızca bir şirkete bağlanabilir.',
    );
  }

  const fullName = input.fullName.trim();
  if (!fullName) {
    throw new OperatorError('Yönetici adı boş olamaz.');
  }

  await q.query(
    `INSERT INTO users (company_id, auth_user_id, full_name, email, role)
     VALUES ($1, $2, $3, $4, $5)`,
    [companies[0].id, authUserId, fullName, email, role],
  );
  return 'created';
}

export async function linkMember(
  q: Queryable,
  input: { code: string; email: string; authUserId: string; force?: boolean },
): Promise<LinkResult> {
  const code = input.code.trim().toUpperCase();
  const email = input.email.trim().toLowerCase();
  const authUserId = input.authUserId.trim();

  if (!AUTH_USER_ID_RE.test(authUserId)) {
    throw new OperatorError(
      '--authUserId Neon Auth kullanıcı kimliği (UUID) olmalı. ' +
        'Neon Console -> Auth -> Users, ya da SQL: SELECT id, email FROM neon_auth."user";',
    );
  }

  const { rows } = await q.query<{ id: string; auth_user_id: string | null }>(
    `SELECT u.id, u.auth_user_id
       FROM users u
       JOIN rental_companies c ON c.id = u.company_id
      WHERE c.company_code = $1 AND lower(u.email) = $2
      FOR UPDATE OF u`,
    [code, email],
  );
  const member = rows[0];
  if (!member) {
    throw new OperatorError(`${code} şirketinde ${email} adlı yönetici yok.`);
  }
  if (member.auth_user_id === authUserId) return 'already-linked';
  if (member.auth_user_id && !input.force) {
    throw new OperatorError(
      `Bu yönetici zaten ${member.auth_user_id} kimliğine bağlı. ` +
        'Değiştirmek bilinçli bir karar olmalı: --force ekleyin.',
    );
  }

  const { rows: taken } = await q.query<{ company_code: string }>(
    `SELECT c.company_code FROM users u
       JOIN rental_companies c ON c.id = u.company_id
      WHERE u.auth_user_id = $1`,
    [authUserId],
  );
  if (taken[0]) {
    throw new OperatorError(
      `${authUserId} zaten ${taken[0].company_code} şirketine bağlı. ` +
        'Bir auth kullanıcısı yalnızca bir şirkete bağlanabilir.',
    );
  }

  try {
    await q.query('UPDATE users SET auth_user_id = $1 WHERE id = $2', [
      authUserId,
      member.id,
    ]);
  } catch (e) {
    // 23503 = foreign key violation. 0003'teki FK kuruluysa, var olmayan bir
    // auth kullanıcısına bağlamak buraya düşer — yazım hatası yüzünden
    // "bağlandı ama kimse giremiyor" durumunu önler. Postgres'in ham mesajı
    // anlaşılmaz olduğu için net bir açıklamaya çeviriyoruz.
    //
    // NOT: hata transaction'ı abort eder; burada devam ETMİYORUZ, fırlatıyoruz
    // ve çağıran (withOwnerTransaction) geri alıyor — hiçbir şey bağlanmaz.
    if ((e as { code?: string }).code === '23503') {
      throw new OperatorError(
        `${authUserId} Neon Auth'ta bulunamadı (neon_auth.user). ` +
          'Kimliği kontrol edin: Neon Console -> Auth -> Users, ya da SQL: ' +
          'SELECT id, email FROM neon_auth."user" ORDER BY "createdAt" DESC;',
      );
    }
    throw e;
  }
  return 'linked';
}

// ---------------------------------------------------------------------------
// activate-company
// ---------------------------------------------------------------------------

export interface ActivationResult {
  status: 'activated' | 'already-active';
  name: string;
  origins: string[];
  activeClasses: number;
  /** --force ile geçilen placeholder sınıflar (uyarı için). */
  placeholderClasses: string[];
  linkedMembers: number;
}

export async function activateCompany(
  q: Queryable,
  input: { code: string; force?: boolean },
): Promise<ActivationResult> {
  const code = input.code.trim().toUpperCase();
  const { rows } = await q.query<{
    id: string;
    name: string;
    status: string;
    allowed_origins: string[];
  }>(
    `SELECT id, name, status, allowed_origins
       FROM rental_companies WHERE company_code = $1
       FOR UPDATE`,
    [code],
  );
  const company = rows[0];
  if (!company) throw new OperatorError(`Şirket bulunamadı: ${code}`);

  const origins = company.allowed_origins ?? [];

  const { rows: classes } = await q.query<{
    class_code: string;
    factor_source: string;
  }>(
    `SELECT class_code, factor_source FROM vehicle_classes
      WHERE company_id = $1 AND is_active = true
      ORDER BY sort_order, class_code`,
    [company.id],
  );
  const placeholders = classes
    .filter(
      (c) => c.factor_source.trim().toLowerCase() === PLACEHOLDER_FACTOR_SOURCE,
    )
    .map((c) => c.class_code);

  const { rows: linked } = await q.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM users
      WHERE company_id = $1 AND auth_user_id IS NOT NULL`,
    [company.id],
  );

  const result: ActivationResult = {
    status: company.status === 'active' ? 'already-active' : 'activated',
    name: company.name,
    origins,
    activeClasses: classes.length,
    placeholderClasses: placeholders,
    linkedMembers: linked[0]?.n ?? 0,
  };
  if (result.status === 'already-active') return result;

  // KAPI 1
  if (origins.length === 0) {
    throw new OperatorError(
      `${code} için allowed_origins BOŞ. Aktivasyon reddedildi — widget ` +
        'hiçbir tarayıcı origin inden çalışmaz. Önce izinli domain leri ekleyin.',
    );
  }
  // KAPI 2
  if (classes.length === 0) {
    throw new OperatorError(
      `${code} için AKTİF araç sınıfı yok. Aktivasyon reddedildi — widget ` +
        'araç seçtiremez ve hiçbir hesap yapamaz.',
    );
  }
  // KAPI 3
  if (placeholders.length > 0 && !input.force) {
    throw new OperatorError(
      `${code}: ${placeholders.length} araç sınıfında faktör kaynağı ` +
        `'placeholder' (${placeholders.join(', ')}).\n` +
        'Aktivasyon reddedildi — onaylanmamış karbon sayılarıyla canlıya ' +
        'çıkılmaz. Faktörleri onaylı kaynakla güncelleyin, ya da bunun ' +
        'bilinçli bir pilot kararı olduğunu --force ile belirtin.',
    );
  }

  await q.query(
    "UPDATE rental_companies SET status = 'active', updated_at = now() WHERE id = $1",
    [company.id],
  );
  return result;
}

// ---------------------------------------------------------------------------
// seed-vehicle-classes
// ---------------------------------------------------------------------------

/** Eksik placeholder sınıfları ekler; mevcutları EZMEZ. Eklenen kodları döner. */
export async function seedMissingVehicleClasses(
  q: Queryable,
  input: { code: string; factorYear: number; country: string },
): Promise<string[]> {
  const code = input.code.trim().toUpperCase();
  const { rows } = await q.query<{ id: string }>(
    'SELECT id FROM rental_companies WHERE company_code = $1',
    [code],
  );
  if (!rows[0]) throw new OperatorError(`Şirket bulunamadı: ${code}`);

  const added: string[] = [];
  for (const v of toSeedRows(rows[0].id, input.factorYear, input.country)) {
    const { rows: ins } = await q.query<{ class_code: string }>(
      `${VEHICLE_INSERT}
       ON CONFLICT (company_id, class_code) DO NOTHING
       RETURNING class_code`,
      vehicleParams(v),
    );
    if (ins[0]) added.push(ins[0].class_code);
  }
  return added;
}

// ---------------------------------------------------------------------------
// setup-app-role
// ---------------------------------------------------------------------------

export const APP_ROLE = 'wheels_app';

/**
 * wheels_app'in RLS'i ATLAYAMADIĞINI denetler. Rol yoksa (migration
 * çalışmamış) veya superuser / BYPASSRLS / neon_superuser üyesiyse fırlatır.
 * neon_superuser yalnızca Neon'da vardır; başka bir Postgres'te kontrol
 * zararsızca false döner.
 */
export async function assertAppRoleIsRestricted(q: Queryable): Promise<void> {
  const { rows } = await q.query<{
    rolsuper: boolean;
    rolbypassrls: boolean;
    in_neon_superuser: boolean;
  }>(
    `SELECT r.rolsuper,
            r.rolbypassrls,
            COALESCE(
              (SELECT pg_has_role(r.oid, n.oid, 'MEMBER')
                 FROM pg_roles n WHERE n.rolname = 'neon_superuser'),
              false
            ) AS in_neon_superuser
       FROM pg_roles r
      WHERE r.rolname = $1`,
    [APP_ROLE],
  );
  const role = rows[0];
  if (!role) {
    throw new OperatorError(
      `${APP_ROLE} rolü yok. Önce migration ları uygulayın: npm run migrate`,
    );
  }
  if (role.rolsuper || role.rolbypassrls || role.in_neon_superuser) {
    throw new OperatorError(
      `${APP_ROLE} rolü RLS'i ATLAYABİLİYOR ` +
        `(superuser=${role.rolsuper}, bypassrls=${role.rolbypassrls}, ` +
        `neon_superuser üyesi=${role.in_neon_superuser}).\n` +
        'Büyük ihtimalle Neon konsolundan oluşturuldu. Konsoldan silin, sonra ' +
        'npm run migrate ile SQL üzerinden yeniden oluşturulsun.',
    );
  }
}

/** Şifre alfabesi — SQL literal'ine güvenle girebilmesi için KATI. */
export const SAFE_PASSWORD_RE = /^[A-Za-z0-9_-]{40,}$/;

/** Girişi aç, şifreyi ayarla, kaçak sorgu sigortalarını kur. */
export async function enableAppRoleLogin(
  q: Queryable,
  password: string,
): Promise<void> {
  // ALTER ROLE parametre ALMAZ; şifre literal olarak girmek zorunda. Bu
  // yüzden alfabe burada (çağırana güvenmeden) yeniden denetlenir.
  if (!SAFE_PASSWORD_RE.test(password)) {
    throw new OperatorError('Şifre güvenli alfabe dışında; işlem durduruldu.');
  }
  await q.query(`ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${password}'`);
  await q.query(`ALTER ROLE ${APP_ROLE} SET statement_timeout = '15s'`);
  await q.query(
    `ALTER ROLE ${APP_ROLE} SET idle_in_transaction_session_timeout = '30s'`,
  );
}

/**
 * Neon'da havuzlu (PgBouncer) adres: uç nokta kimliğinin sonuna `-pooler`.
 * ör. ep-cool-123.eu-central-1.aws.neon.tech
 *  -> ep-cool-123-pooler.eu-central-1.aws.neon.tech
 * Neon dışı bir host'ta adres olduğu gibi bırakılır.
 */
export function toPooledHost(host: string): string {
  const [first, ...rest] = host.split('.');
  if (!host.endsWith('.neon.tech') || !first.startsWith('ep-')) return host;
  if (first.endsWith('-pooler')) return host;
  return [`${first}-pooler`, ...rest].join('.');
}

/** Sahip adresinden çalışma zamanı adresini türetir (rol, şifre, havuz, TLS). */
export function buildAppUrl(ownerUrl: string, password: string): string {
  const u = new URL(ownerUrl);
  u.username = APP_ROLE;
  u.password = password;
  u.hostname = toPooledHost(u.hostname);
  if (!u.searchParams.get('sslmode')) u.searchParams.set('sslmode', 'require');
  return u.toString();
}
