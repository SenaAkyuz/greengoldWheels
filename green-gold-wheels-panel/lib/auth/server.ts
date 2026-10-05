import 'server-only';
import { createNeonAuth } from '@neondatabase/auth/next/server';

/**
 * Neon Auth (Managed Better Auth) sunucu örneği.
 *
 * Oturum, panelin kendi alan adındaki HTTP-only çerezde tutulur; bu çerez
 * `NEON_AUTH_COOKIE_SECRET` ile imzalanır (min 32 karakter, yoksa paket
 * fırlatır). Panel tarayıcıya hiçbir token sızdırmaz — API'ye gidecek JWT de
 * yalnızca sunucu tarafında alınır (bkz. lib/api.ts).
 *
 * ⚠️ `@neondatabase/auth` şu an 0.5.0-beta. Servisin kendisi GA, SDK değil.
 * Bu yüzden auth'a dokunan her şey bu dosyada ve lib/api.ts'te toplandı —
 * paket değişirse düzeltilecek yer iki dosyadır.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} tanımlı değil. .env.local dosyasını .env.local.example'a göre doldurun.`,
    );
  }
  return value;
}

/**
 * Sondaki `/` ve boşluklar temizlenir.
 *
 * Neon Auth, `…/neondb/auth/` (sonda eğik çizgi) adresine istek gittiğinde
 * her yola BOŞ GÖVDELİ 404 döndürür; panel oturum açamaz ve hata mesajı da
 * yoktur (canlıda yaşandı). Adresi Vercel'e yapıştırırken sonda `/`
 * kalması çok kolay bir hatadır; API tarafı da aynı temizliği yapar.
 */
function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export const auth = createNeonAuth({
  baseUrl: normalizeBaseUrl(required('NEON_AUTH_BASE_URL')),
  cookies: {
    secret: required('NEON_AUTH_COOKIE_SECRET'),
  },
});
