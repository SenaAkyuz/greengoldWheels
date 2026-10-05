/**
 * NeonAuthTokenVerifier — GERÇEK imza doğrulaması.
 *
 * Neon Auth'taki akışın aynısı: EdDSA (Ed25519) ile imzalı JWT, açık anahtar
 * `<AuthURL>/.well-known/jwks.json` adresinden çekilir. Burada JWKS'i yerel bir
 * HTTP sunucusu yayınlar; ağdaki Neon'a ihtiyaç yoktur.
 *
 * Bu test ayrıca `jose` sürümünü sabitler: jose 6 yalnızca ESM'dir ve
 * CommonJS derlenen bu API'de Node < 22.12'de (ör. Vercel'in bazı
 * çalışma zamanları) `ERR_REQUIRE_ESM` ile açılışta çöker. 5.x iki biçimi de sunar.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type JWK,
  type KeyLike,
} from 'jose';
import { NeonAuthTokenVerifier } from './token-verifier';

const USER = '7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';

let server: Server;
let baseUrl: string;
let privateKey: KeyLike;
let publicJwk: JWK;

async function signer(key: KeyLike, claims: { sub?: string } = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test-1' })
    .setSubject(claims.sub ?? USER)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key);
}

const verifier = () =>
  new NeonAuthTokenVerifier(new ConfigService({ NEON_AUTH_BASE_URL: baseUrl }));

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  privateKey = pair.privateKey;
  publicJwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: 'test-1',
    alg: 'EdDSA',
  };

  server = createServer((req, res) => {
    // JWKS, Auth URL'in YOLUNUN altındadır (origin'de değil).
    if (req.url === '/neondb/auth/.well-known/jwks.json') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/neondb/auth`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe('NeonAuthTokenVerifier — gerçek JWT doğrulaması', () => {
  it('geçerli imzalı token kullanıcı kimliğini (sub) döndürür', async () => {
    await expect(verifier().verify(await signer(privateKey))).resolves.toBe(
      USER,
    );
  });

  it("BAŞKA anahtarla imzalı token REDDEDİLİR (başka projenin token'ı)", async () => {
    const other = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    await expect(
      verifier().verify(await signer(other.privateKey)),
    ).rejects.toThrow();
  });

  it('içeriği değiştirilmiş token REDDEDİLİR', async () => {
    const token = await signer(privateKey);
    const [h, , s] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: '00000000-0000-4000-8000-000000000001' }),
    ).toString('base64url');
    await expect(
      verifier().verify(`${h}.${forgedPayload}.${s}`),
    ).rejects.toThrow();
  });

  it('süresi dolmuş token REDDEDİLİR', async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'EdDSA', kid: 'test-1' })
      .setSubject(USER)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(privateKey);
    await expect(verifier().verify(expired)).rejects.toThrow();
  });

  it('UUID olmayan sub REDDEDİLİR (veritabanına bozuk değer gitmesin)', async () => {
    await expect(
      verifier().verify(await signer(privateKey, { sub: 'admin' })),
    ).rejects.toThrow(/UUID/);
  });

  it('imzasız (alg: none) token REDDEDİLİR', async () => {
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: USER })}.`;
    await expect(verifier().verify(none)).rejects.toThrow();
  });
});

describe('jose CommonJS uyumu (Vercel)', () => {
  it('jose, require() ile yüklenebilen (CJS) bir sürüm', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('jose/package.json') as {
      version: string;
      exports: Record<string, Record<string, string>>;
    };
    expect(Number(pkg.version.split('.')[0])).toBeLessThan(6);
    expect(pkg.exports['.'].require).toBeDefined();
  });
});
