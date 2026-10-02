import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Token doğrulama PORT'u. Guard buna bağlıdır, Neon Auth'a değil — testler
 * ağa çıkmadan guard'ın tüm dallarını doğrulayabilsin. Aynı zamanda sağlayıcı
 * değiştirmeyi tek dosyaya indirir (Clerk -> Neon Auth geçişi böyle yapıldı).
 */
export abstract class TokenVerifier {
  /**
   * Token geçerliyse doğrulanmış kullanıcı kimliğini (`sub`) döner, değilse
   * FIRLATIR. Dönen değer imzası doğrulanmış payload'dan gelir — istemcinin
   * iddia ettiği hiçbir alan değildir.
   */
  abstract verify(token: string): Promise<string>;
}

/** Neon Auth kullanıcı kimlikleri UUID'dir (neon_auth.user.id). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Neon Auth (Managed Better Auth) oturum JWT'si doğrulayıcı.
 *
 * - İmza **EdDSA (Ed25519)**. Açık anahtarlar JWKS ucundan çekilir ve `jose`
 *   tarafından önbelleğe alınır (her istekte ağ çağrısı yok). İmza kontrolü
 *   ZORUNLUDUR ve tek başına kimliği garanti eder.
 * - `issuer` ve `audience` YALNIZCA yapılandırılmışsa doğrulanır
 *   (NEON_AUTH_ISSUER / NEON_AUTH_AUDIENCE) — fazladan katlar.
 * - Token ömrü 15 dakikadır; `exp`/`iat` jose tarafından denetlenir. Küçük bir
 *   saat toleransı, sunucu saatleri arasındaki kaymada geçerli token'ın
 *   reddedilmesini önler.
 *
 * ÖNEMLİ: Bu sınıf yalnızca "bu token gerçekten Neon Auth tarafından mı
 * imzalandı" sorusunu cevaplar. "Bu kullanıcı hangi şirkete ait" sorusu
 * AuthGuard'da, veritabanındaki `users` eşlemesiyle cevaplanır — token'daki
 * hiçbir claim yetki belirlemez.
 */
@Injectable()
export class NeonAuthTokenVerifier extends TokenVerifier {
  private readonly logger = new Logger(NeonAuthTokenVerifier.name);
  /** Auth URL (yol dahil, sondaki / temizlenmiş). JWKS bunun altındadır. */
  private readonly baseUrl: string;
  /** Gerçekten kullanılan JWKS adresi — kurulum doğrulaması ve test için. */
  readonly jwksUrl: string;
  private readonly issuer?: string;
  private readonly audience?: string;
  private readonly jwks: JWTVerifyGetKey;

  constructor(config: ConfigService) {
    super();
    const raw = (config.get<string>('NEON_AUTH_BASE_URL') ?? '').trim();
    if (!raw) {
      throw new Error(
        'NEON_AUTH_BASE_URL zorunludur (Neon Console -> Settings -> Auth -> "Auth URL").',
      );
    }

    let base: URL;
    try {
      base = new URL(raw);
    } catch {
      throw new Error('NEON_AUTH_BASE_URL geçerli bir URL değil.');
    }
    if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') {
      throw new Error('Üretimde NEON_AUTH_BASE_URL https olmalıdır.');
    }

    // Sondaki '/' temizlenir, YOL KORUNUR.
    //
    // ⚠️ JWKS ucu Auth URL'in YOLUNUN ALTINDADIR, origin'in değil:
    //   Auth URL : https://ep-xxx.neonauth...neon.tech/neondb/auth
    //   JWKS     : https://ep-xxx.neonauth...neon.tech/neondb/auth/.well-known/jwks.json
    // Neon dokümanındaki örnek bunun aksini ima ediyor (origin + /.well-known)
    // ama GERÇEK konsolun verdiği adres yukarıdaki gibi. Origin kullanmak
    // 404 verir ve token doğrulama hiç çalışmaz.
    this.baseUrl = raw.replace(/\/+$/, '');
    this.jwksUrl = `${this.baseUrl}/.well-known/jwks.json`;
    this.jwks = createRemoteJWKSet(new URL(this.jwksUrl));

    // `iss` claim'inin ne olduğu (origin mi, tam auth URL mi) sağlayıcıya
    // bağlı ve dokümandan güvenle çıkarılamadı. Bu yüzden issuer kontrolü
    // OPSİYONEL: NEON_AUTH_ISSUER verilirse doğrulanır.
    //
    // Issuer olmadan da güvenlik korunur: token YALNIZCA bu projenin JWKS
    // ucundaki açık anahtarla doğrulanır. Başka bir Neon projesinin ya da
    // başka bir sağlayıcının token'ı farklı anahtarla imzalı olduğu için
    // imza doğrulamasında reddedilir. Issuer fazladan bir kattır.
    this.issuer = config.get<string>('NEON_AUTH_ISSUER') || undefined;
    this.audience = config.get<string>('NEON_AUTH_AUDIENCE') || undefined;

    if (!this.issuer) {
      this.logger.log(
        `Token doğrulama: JWKS ${this.jwksUrl} ` +
          '(imza zorunlu). issuer/audience yapılandırılmadı — opsiyonel ek katlar.',
      );
    }
  }

  async verify(token: string): Promise<string> {
    const { payload } = await jwtVerify(token, this.jwks, {
      ...(this.issuer ? { issuer: this.issuer } : {}),
      ...(this.audience ? { audience: this.audience } : {}),
      // Saat kayması toleransı; token ömrü 15 dk olduğu için 60 sn güvenli.
      clockTolerance: 60,
    });

    const sub = payload.sub;
    if (typeof sub !== 'string' || !UUID_RE.test(sub)) {
      // Beklenen biçimde değilse reddet: aşağıdaki katman bunu UUID olarak
      // veritabanına geçiriyor, bozuk bir değerin oraya ulaşmasına izin verme.
      throw new Error('Token kullanıcı kimliği (sub) geçerli bir UUID değil.');
    }
    return sub;
  }
}
