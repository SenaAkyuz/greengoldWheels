/**
 * Açılış yapılandırma korumaları — yanlış yapılandırılmış bir üretim ortamı
 * sessizce çalışmak yerine AÇILMAMALI.
 */
import { ConfigService } from '@nestjs/config';
import { assertTlsInProduction } from './database/pg-database';
import { NeonAuthTokenVerifier } from './auth/token-verifier';

const ORIGINAL_ENV = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
});

const config = (values: Record<string, string>) => new ConfigService(values);

describe('assertTlsInProduction', () => {
  const base = 'postgresql://wheels_app:x@ep-a-pooler.eu.aws.neon.tech/neondb';

  it('uretimde sslmode YOKSA acilmaz', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertTlsInProduction(base)).toThrow(/sslmode/);
  });

  it('uretimde sslmode=disable ile acilmaz', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertTlsInProduction(`${base}?sslmode=disable`)).toThrow();
  });

  it('uretimde sslmode=require ve verify-full kabul edilir', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      assertTlsInProduction(`${base}?sslmode=require`),
    ).not.toThrow();
    expect(() =>
      assertTlsInProduction(`${base}?sslmode=verify-full`),
    ).not.toThrow();
  });

  it('gelistirmede (yerel Postgres) zorunlu degil', () => {
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertTlsInProduction('postgresql://u:p@localhost/db'),
    ).not.toThrow();
  });

  it('uretimde gecersiz adres net hata verir', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertTlsInProduction('bu bir adres degil')).toThrow(
      /geçerli/,
    );
  });
});

describe('NeonAuthTokenVerifier yapilandirmasi', () => {
  const BASE = 'https://ep-ornek-123.eu-central-1.aws.neon.tech';

  it('NEON_AUTH_BASE_URL yoksa acilmaz', () => {
    expect(() => new NeonAuthTokenVerifier(config({}))).toThrow(
      /NEON_AUTH_BASE_URL/,
    );
  });

  it('gecersiz URL ile acilmaz', () => {
    expect(
      () =>
        new NeonAuthTokenVerifier(
          config({ NEON_AUTH_BASE_URL: 'bu-url-degil' }),
        ),
    ).toThrow(/geçerli bir URL/);
  });

  it('uretimde http (TLS siz) adres ile acilmaz', () => {
    process.env.NODE_ENV = 'production';
    expect(
      () =>
        new NeonAuthTokenVerifier(
          config({ NEON_AUTH_BASE_URL: 'http://ep-x.neon.tech' }),
        ),
    ).toThrow(/https/);
  });

  it('gecerli https adresle acilir', () => {
    process.env.NODE_ENV = 'production';
    expect(
      () => new NeonAuthTokenVerifier(config({ NEON_AUTH_BASE_URL: BASE })),
    ).not.toThrow();
  });

  it('Auth URL in YOLUNU korur — JWKS origin de DEGIL, yolun altinda', () => {
    // Neon konsolu JWKS'i <AuthURL>/.well-known/jwks.json olarak veriyor.
    // Origin kullanmak 404 verir ve dogrulama hic calismaz.
    const v = new NeonAuthTokenVerifier(
      config({ NEON_AUTH_BASE_URL: `${BASE}/neondb/auth` }),
    );
    expect(v.jwksUrl).toBe(`${BASE}/neondb/auth/.well-known/jwks.json`);
  });

  it('sondaki / temizlenir (cift slash olusmaz)', () => {
    const v = new NeonAuthTokenVerifier(
      config({ NEON_AUTH_BASE_URL: `${BASE}/neondb/auth/` }),
    );
    expect(v.jwksUrl).toBe(`${BASE}/neondb/auth/.well-known/jwks.json`);
  });

  it('sahte/bozuk token u reddeder (imza dogrulanamaz, aga CIKMAZ)', async () => {
    // jose JWKS'i ancak gerçek bir JWT yapısı görünce çeker; bu token zaten
    // ayrıştırılamadığı için ağ çağrısı olmaz.
    const v = new NeonAuthTokenVerifier(config({ NEON_AUTH_BASE_URL: BASE }));
    await expect(v.verify('bu.bir.token-degil')).rejects.toThrow();
    await expect(v.verify('')).rejects.toThrow();
  });
});
