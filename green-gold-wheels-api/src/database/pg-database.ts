import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';
import { assertCompanyId, Database, type Queryable } from './database';
import { assertRlsBinding } from './rls-guard';

/**
 * Üretim veritabanı: node-postgres -> Neon (havuzlu bağlantı adresi).
 *
 * NEDEN node-postgres (Neon'un kendi sürücüsü değil): standart Postgres
 * protokolü konuşur, Neon'a kilitlemez. Bu proje gelecekteki projelerin
 * şablonu; herhangi bir Postgres'e (Neon, RDS, kendi sunucun) değişmeden bağlanır.
 *
 * Bağlantı rolü `wheels_app` OLMALIDIR — açılışta doğrulanır (rls-guard.ts).
 */
@Injectable()
export class PgDatabase
  extends Database
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PgDatabase.name);
  private pool!: Pool;

  constructor(private readonly config: ConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('DATABASE_URL');
    if (!url) {
      throw new Error(
        'DATABASE_URL zorunludur (wheels_app rolünün Neon havuzlu bağlantı adresi).',
      );
    }
    assertTlsInProduction(url);

    this.pool = new Pool({
      connectionString: url,
      // Serverless'ta her instance kendi havuzunu kurar; küçük tut. Asıl
      // havuzlama Neon'un pooler'ında (PgBouncer, transaction modu) yapılır.
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });

    // Havuzdaki boşta bir bağlantı koparsa süreç çökmesin; logla, devam et.
    this.pool.on('error', (err) => {
      this.logger.error(`Boşta bağlantı hatası: ${err.message}`);
    });

    // AÇILIŞ GÜVENLİK KONTROLÜ — başarısızsa uygulama AÇILMAZ.
    await this.withoutTenant((q) => assertRlsBinding(q));
    this.logger.log('Veritabanı bağlandı; RLS çalışma zamanı rolünü bağlıyor.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  async withTenant<T>(
    companyId: string,
    fn: (q: Queryable) => Promise<T>,
  ): Promise<T> {
    assertCompanyId(companyId);
    return this.transaction(async (client) => {
      // true = transaction'a YEREL. Transaction bitince düşer; havuzdan bu
      // bağlantıyı alan sonraki istek bu şirketi DEVRALAMAZ.
      await client.query(
        "SELECT set_config('app.current_company_id', $1, true)",
        [companyId],
      );
      return fn(client);
    });
  }

  async withoutTenant<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
    return this.transaction((client) => fn(client));
  }

  private async transaction<T>(
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {
        /* bağlantı zaten kopmuşsa ROLLBACK da düşer; asıl hatayı koru */
      });
      throw err;
    } finally {
      client.release();
    }
  }
}

/**
 * Üretimde şifresiz bağlantıya izin verme. Neon zaten TLS ister; bu kontrol
 * yanlış kopyalanmış bir adresin (sslmode'suz) sessizce kabul edilmesini
 * engeller. Geliştirmede (yerel Postgres) zorunlu değildir.
 */
export function assertTlsInProduction(url: string): void {
  if (process.env.NODE_ENV !== 'production') return;
  let sslmode: string | null = null;
  try {
    sslmode = new URL(url).searchParams.get('sslmode');
  } catch {
    throw new Error('DATABASE_URL geçerli bir bağlantı adresi değil.');
  }
  if (!sslmode || !['require', 'verify-ca', 'verify-full'].includes(sslmode)) {
    throw new Error(
      "Üretimde DATABASE_URL 'sslmode=require' (veya verify-full) içermelidir.",
    );
  }
}
