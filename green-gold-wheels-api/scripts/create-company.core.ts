/**
 * create-company'nin SAF (I/O'suz) çekirdeği — girdi doğrulaması ve yazılacak
 * satırların planı. Ayrı tutulmasının sebebi: bu mantık gerçek DB'ye
 * dokunmadan test edilebilsin (bkz. create-company.core.spec.ts).
 */
import { toSeedRows } from '../src/common/vehicle-factors';

export interface RawInput {
  name?: string;
  email?: string;
  code?: string;
  city?: string;
  tz?: string;
  currency?: string;
  pricePerKg?: string;
  minAmount?: string;
  factorYear?: string;
  country?: string;
  /** Opsiyonel: yönetici Neon Auth'ta zaten varsa doğrudan bağla. */
  authUserId?: string;
}

export interface ValidInput {
  name: string;
  email: string;
  companyCode: string;
  city: string | null;
  timezone: string;
  currency: string;
  pricePerKgCo2e: number;
  minContributionAmount: number;
  factorYear: number;
  country: string;
  authUserId: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,29}$/;
/** Neon Auth kullanıcı kimliği: neon_auth.user.id bir UUID'dir. */
export const AUTH_USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** IANA timezone gerçekten var mı (Intl ile doğrulanır). */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Türkçe harfleri ASCII karşılığına çevirir.
 *
 * NEDEN gerekli: `toLocaleUpperCase('tr-TR')` `i` harfini `İ` yapar ve ardından
 * `[^A-Z0-9]` filtresi onu SİLER — "Pilot" → "PLOT" gibi harf kaybeden kodlar
 * üretiliyordu. Harfleri atmak yerine önce çevirip sonra büyütüyoruz.
 */
const TR_TO_ASCII: Record<string, string> = {
  ç: 'c',
  Ç: 'C',
  ğ: 'g',
  Ğ: 'G',
  ı: 'i',
  I: 'I',
  İ: 'I',
  i: 'i',
  ö: 'o',
  Ö: 'O',
  ş: 's',
  Ş: 'S',
  ü: 'u',
  Ü: 'U',
};

export function asciiFold(value: string): string {
  return value.replace(/[çÇğĞıIİiöÖşŞüÜ]/g, (ch) => TR_TO_ASCII[ch] ?? ch);
}

/** Ada göre okunur bir şirket kodu önerir. */
export function suggestCompanyCode(name: string): string {
  const slug = asciiFold(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  const base = slug.length >= 3 ? slug : 'RENTAL';
  return `RNT-${base}`;
}

export function validateInput(raw: RawInput): ValidInput {
  const name = (raw.name ?? '').trim();
  if (!name) throw new Error('--name zorunlu.');

  const email = (raw.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email))
    throw new Error('--email gecerli bir e-posta olmali.');

  const companyCode = (raw.code ?? suggestCompanyCode(name))
    .trim()
    .toUpperCase();
  if (!CODE_RE.test(companyCode)) {
    throw new Error(
      '--code buyuk harf/rakam/tire olmali ve 3-30 karakter arasinda bulunmali.',
    );
  }

  const timezone = (raw.tz ?? 'Europe/Istanbul').trim();
  if (!isValidTimezone(timezone)) {
    throw new Error(
      `--tz gecerli bir IANA timezone olmali (verilen: ${timezone}).`,
    );
  }

  const currency = (raw.currency ?? 'TRY').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('--currency 3 harfli ISO kodu olmali (orn. TRY, EUR).');
  }

  const pricePerKgCo2e =
    raw.pricePerKg === undefined ? 1 : Number(raw.pricePerKg);
  if (!Number.isFinite(pricePerKgCo2e) || pricePerKgCo2e < 0) {
    throw new Error('--pricePerKg negatif olmayan bir sayi olmali.');
  }

  const minContributionAmount =
    raw.minAmount === undefined ? 19 : Number(raw.minAmount);
  if (!Number.isFinite(minContributionAmount) || minContributionAmount < 0) {
    throw new Error('--minAmount negatif olmayan bir sayi olmali.');
  }

  const factorYear =
    raw.factorYear === undefined
      ? new Date().getUTCFullYear()
      : Number(raw.factorYear);
  if (!Number.isInteger(factorYear) || factorYear < 2000 || factorYear > 2100) {
    throw new Error('--factorYear 2000-2100 arasinda bir yil olmali.');
  }

  const authUserId = raw.authUserId?.trim() || null;
  if (authUserId !== null && !AUTH_USER_ID_RE.test(authUserId)) {
    throw new Error(
      '--authUserId Neon Auth kullanici kimligi (UUID) olmali. E-posta veya oturum kimligi DEGIL.',
    );
  }

  const country = (raw.country ?? 'TR').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error('--country 2 harfli ulke kodu olmali (orn. TR).');
  }

  return {
    name,
    email,
    companyCode,
    city: (raw.city ?? '').trim() || null,
    timezone,
    currency,
    pricePerKgCo2e,
    minContributionAmount,
    factorYear,
    country,
    authUserId,
  };
}

/**
 * Yazılacak satırların planı. Şirket 'pending' DOĞAR — aktivasyon ayrı bir
 * adımdır (activate-company), çünkü canlıya alma öncesi allowed_origins ve
 * faktör onayı kontrol edilmelidir.
 */
export function planCreateCompany(input: ValidInput) {
  return {
    company: {
      name: input.name,
      company_code: input.companyCode,
      city: input.city,
      country: input.country,
      timezone: input.timezone,
      default_currency: input.currency,
      price_per_kg_co2e: input.pricePerKgCo2e,
      min_contribution_amount: input.minContributionAmount,
      // Deny-by-default: aktivasyona kadar pending, origin listesi boş.
      status: 'pending' as const,
      allowed_origins: [] as string[],
    },
    /** company_id, şirket satırı yazıldıktan sonra verilir. */
    vehicleClasses: (companyId: string) =>
      toSeedRows(companyId, input.factorYear, input.country),
    user: (companyId: string) => ({
      company_id: companyId,
      full_name: input.name,
      email: input.email,
      // NULL olabilir: yönetici Neon Auth'ta hesap açınca link-member bağlar.
      // Bağlanmamış satır hiçbir token ile eşleşmez (fail-closed).
      auth_user_id: input.authUserId,
      role: 'filo_yoneticisi' as const,
    }),
  };
}
