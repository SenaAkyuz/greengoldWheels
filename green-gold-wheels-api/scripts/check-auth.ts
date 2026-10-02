/**
 * Kurulum doğrulaması — NEON_AUTH_BASE_URL gerçekten çalışıyor mu?
 *
 *   npm run check-auth
 *
 * Neden ayrı bir script: JWKS ucunun adresi Neon'un dokümanındaki örnekle
 * konsolun verdiği adres arasında FARKLIYDI (doküman origin diyor, konsol
 * Auth URL'in yolunun altını veriyor). Yanlış adres sessizce 404 verir ve
 * sorun ancak ilk gerçek giriş denemesinde, "geçersiz token" olarak görünür.
 * Bu script ağa çıkıp adresi KANITLAR — kurulumda bir kez çalıştırılır.
 *
 * Hiçbir şey yazmaz, sır basmaz; yalnızca okur ve rapor eder.
 */
import { fail, loadEnv } from './env';

interface Jwk {
  kty?: string;
  alg?: string;
  crv?: string;
  kid?: string;
}

async function probe(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const body: unknown = await res.json();
    const keys = (body as { keys?: Jwk[] })?.keys;
    if (!Array.isArray(keys) || keys.length === 0) {
      return { ok: false, detail: 'yanıt JWKS değil ("keys" dizisi yok)' };
    }
    const summary = keys
      .map((k) => `${k.kty ?? '?'}/${k.crv ?? k.alg ?? '?'}`)
      .join(', ');
    return { ok: true, detail: `${keys.length} anahtar: ${summary}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  loadEnv();
  const raw = (process.env.NEON_AUTH_BASE_URL ?? '').trim();
  if (!raw) {
    fail(
      'NEON_AUTH_BASE_URL boş. Neon Console -> Settings -> Auth -> "Auth URL" ' +
        'değerini .env dosyasına yazın.',
    );
  }

  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    fail(`NEON_AUTH_BASE_URL geçerli bir URL değil: ${raw}`);
  }

  const baseUrl = raw.replace(/\/+$/, '');
  const expected = `${baseUrl}/.well-known/jwks.json`;

  console.log(`\nAuth URL : ${baseUrl}`);
  console.log(`JWKS     : ${expected}\n`);

  const result = await probe(expected);
  if (result.ok) {
    console.log(`TAMAM — JWKS erişilebilir (${result.detail}).`);
    console.log('Token doğrulama bu anahtarlarla yapılacak.\n');
    return;
  }

  // Başarısızsa: yaygın yanlış adresi de dene ve operatöre NE yazması
  // gerektiğini söyle (doküman/konsol farkı tam olarak burada ortaya çıkar).
  console.log(`BAŞARISIZ — ${result.detail}`);

  const originGuess = `${base.origin}/.well-known/jwks.json`;
  if (originGuess !== expected) {
    const alt = await probe(originGuess);
    if (alt.ok) {
      fail(
        `JWKS aslında ŞURADA: ${originGuess} (${alt.detail}).\n` +
          `NEON_AUTH_BASE_URL değerini "${base.origin}" olarak düzeltin.`,
      );
    }
  }

  fail(
    'JWKS bulunamadı. Kontrol edin:\n' +
      '  1) Neon Console -> Settings -> Auth -> Auth URL değerini birebir kopyaladınız mı?\n' +
      '  2) Neon Auth etkin mi?\n' +
      '  3) Konsoldaki "JWKS URL" alanının sonu /.well-known/jwks.json ise, ondan\n' +
      '     ".well-known/jwks.json" kısmını ÇIKARIP kalanını NEON_AUTH_BASE_URL yapın.',
  );
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
