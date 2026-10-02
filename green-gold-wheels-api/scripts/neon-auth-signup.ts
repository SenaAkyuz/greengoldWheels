/**
 * Neon Auth'ta e-posta/şifre hesabı açar — İDEMPOTENT.
 *
 * create-auth-user ve setup-demo ortak kullanır. Hesap tablosu
 * (`neon_auth."user"`) YÖNETİLEN bir şemadır; oraya elle INSERT edilmez —
 * şifre hash'i ve doğrulama akışı Neon Auth'un kendi ucundan geçmelidir.
 *
 * Hesap zaten varsa bu bir hata DEĞİLDİR: kimlik veritabanından okunur ve
 * akış kaldığı yerden devam eder (Neon Auth hesabını silemeyiz; script'i
 * tekrar çalıştırmak her zaman güvenli olmalı).
 */
import { withOwnerTransaction } from './env';

export class SignUpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignUpError';
  }
}

interface SignUpResponse {
  user?: { id?: string };
  message?: string;
}

export interface SignUpResult {
  userId: string;
  /** true: hesap zaten vardı; verilen şifre UYGULANMADI. */
  reused: boolean;
}

export function neonAuthBaseUrl(): string {
  const baseUrl = (process.env.NEON_AUTH_BASE_URL ?? '').replace(/\/+$/, '');
  if (!baseUrl) {
    throw new SignUpError(
      'NEON_AUTH_BASE_URL boş. Neon Console -> Settings -> Auth -> "Auth URL" ' +
        'değerini .env dosyasına yazın.',
    );
  }
  return baseUrl;
}

/**
 * @param origin Better Auth CSRF koruması `Origin` başlığı ister. Tarayıcı
 *   bunu kendisi ekler; Node'dan çağırdığımız için elle ekliyoruz. Varsayılan
 *   localhost — Neon Console'da "Allow Localhost" açıkken güvenilir sayılır.
 */
export async function signUpOrReuse(input: {
  email: string;
  password: string;
  name: string;
  origin?: string;
}): Promise<SignUpResult> {
  const email = input.email.trim().toLowerCase();
  const origin = input.origin ?? 'http://localhost:3000';
  const endpoint = `${neonAuthBaseUrl()}/sign-up/email`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({
        email,
        password: input.password,
        name: input.name,
      }),
    });
  } catch (e) {
    throw new SignUpError(
      `Neon Auth'a ulaşılamadı: ${e instanceof Error ? e.message : String(e)}\n` +
        'NEON_AUTH_BASE_URL doğru mu? Doğrulamak için: npm run check-auth',
    );
  }

  const raw = await res.text();
  let body: SignUpResponse = {};
  try {
    body = JSON.parse(raw) as SignUpResponse;
  } catch {
    /* JSON değilse ham metin hata mesajında kullanılır */
  }

  if (res.ok && body.user?.id) return { userId: body.user.id, reused: false };

  if (/exist|already|unique|duplicate/i.test(raw)) {
    const userId = await withOwnerTransaction(async (q) => {
      const { rows } = await q.query<{ id: string }>(
        'SELECT id::text AS id FROM neon_auth."user" WHERE lower(email) = $1',
        [email],
      );
      return rows[0]?.id;
    });
    if (!userId) {
      throw new SignUpError(
        `Neon Auth "hesap zaten var" dedi ama neon_auth."user" içinde ${email} yok. ` +
          'Durumu görmek için: npm run list-auth-users',
      );
    }
    return { userId, reused: true };
  }

  const hint = /origin/i.test(raw)
    ? `\nİpucu: Neon Auth '${origin}' adresini güvenilir saymıyor. Neon Console -> ` +
      'Settings -> Auth -> "Allow Localhost" açık mı? Değilse Domains listesine ' +
      'bir adres ekleyip --origin ile onu verin.'
    : res.status === 403 || /disabled|not allowed/i.test(raw)
      ? '\nİpucu: Neon Console -> Settings -> Auth -> "Sign-up with Email" kapalı olabilir. ' +
        'Hesabı açmak için geçici olarak açın, sonra tekrar kapatın.'
      : '';
  throw new SignUpError(
    `Hesap açılamadı (HTTP ${res.status}): ${body.message ?? raw.slice(0, 300)}${hint}`,
  );
}
