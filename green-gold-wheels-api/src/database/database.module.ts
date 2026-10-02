import { Global, Module } from '@nestjs/common';
import { Database } from './database';
import { PgDatabase } from './pg-database';

/**
 * Servisler soyut `Database`'e bağlanır; burada üretim implementasyonu
 * (PgDatabase) bağlanır. Testler aynı token'a PgliteDatabase verir.
 */
@Global()
@Module({
  providers: [{ provide: Database, useClass: PgDatabase }],
  exports: [Database],
})
export class DatabaseModule {}
