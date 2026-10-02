/**
 * ÜRETİM SINIFI (PgDatabase) — GERÇEK `pg` sürücüsü, GERÇEK TCP bağlantısı.
 *
 * Diğer testler PgliteDatabase'i (süreç içi) kullanır. Bu dosya ise Neon'a
 * gidecek kodun KENDİSİNİ — Pool, transaction, açılış kontrolü — gerçek
 * Postgres ağ protokolü üzerinden çalıştırır: PGlite bir TCP soketinde
 * sunulur ve PgDatabase ona `postgresql://` adresiyle bağlanır.
 *
 * Sınır: PGlite soketi bağlantıyı her zaman superuser olarak açar (başlangıç
 * rolü parametresini uygulamaz — denendi). Bu yüzden burada "doğru rolle
 * açılır" yolu değil, EN KRİTİK güvenlik özelliği test edilir: üretim sınıfı
 * ayrıcalıklı bir rolle bağlandığında AÇILMAYI REDDEDER. Doğru rol yolu
 * (wheels_app + RLS) PgliteDatabase testlerinde ve kurulumda
 * `setup-app-role` tarafından SENİN Neon veritabanında doğrulanır.
 */
import { ConfigService } from '@nestjs/config';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PgDatabase } from './pg-database';
import { RlsBindingError } from './rls-guard';
import { createTestDatabase, type PgliteDatabase } from '../../test/pglite-db';

const PORT = 55000 + Math.floor(Math.random() * 4000);
const URL = `postgresql://postgres@127.0.0.1:${PORT}/postgres`;

let db: PgliteDatabase;
let server: PGLiteSocketServer;

beforeAll(async () => {
  db = await createTestDatabase();
  // Varsayılan maxConnections=1; gerçek bir sunucu gibi davransın (havuz
  // birden fazla bağlantı açabilir, testler arası kapanış çakışmasın).
  server = new PGLiteSocketServer({
    db: db.pg,
    port: PORT,
    host: '127.0.0.1',
    maxConnections: 10,
  });
  await server.start();
});

afterAll(async () => {
  await server.stop();
  await db.close();
});

const make = (values: Record<string, string>) =>
  new PgDatabase(new ConfigService(values));

describe('PgDatabase acilis guvenlik kontrolu (gercek pg + TCP)', () => {
  it('SUPERUSER ile baglaninca ACILMAYI REDDEDER', async () => {
    const pgdb = make({ DATABASE_URL: URL });
    try {
      await expect(pgdb.onModuleInit()).rejects.toThrow(RlsBindingError);
    } finally {
      await pgdb.onModuleDestroy();
    }
  });

  it('red mesaji sorunu ve cozumu soyler (operatore yol gosterir)', async () => {
    const pgdb = make({ DATABASE_URL: URL });
    try {
      await expect(pgdb.onModuleInit()).rejects.toThrow(
        /'postgres' rolü için RLS.*UYGULANMIYOR[\s\S]*wheels_app/,
      );
    } finally {
      await pgdb.onModuleDestroy();
    }
  });

  it('DATABASE_URL yoksa acilmaz', async () => {
    await expect(make({}).onModuleInit()).rejects.toThrow(/DATABASE_URL/);
  });

  it('red sonrasi baglanti havuzu temiz kapanir (sizinti yok)', async () => {
    const pgdb = make({ DATABASE_URL: URL });
    await pgdb.onModuleInit().catch(() => undefined);
    await expect(pgdb.onModuleDestroy()).resolves.toBeUndefined();
  });
});
