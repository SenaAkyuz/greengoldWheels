/**
 * Migration dosyalarının TEK listesi — hem `npm run migrate` (gerçek Neon)
 * hem test ortamı (PGlite) bunu kullanır. Testler, üretime giden SQL'in
 * aynısını çalıştırır; ayrı bir "test şeması" yoktur.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const MIGRATIONS_DIR = resolve(__dirname, '..', 'db', 'migrations');

export interface MigrationFile {
  /** Dosya adı, ör. 0001_rental_companies.sql — aynı zamanda sürüm kimliği. */
  name: string;
  sql: string;
}

/** NNNN_ad.sql biçimindeki dosyaları sürüm sırasıyla döndürür. */
export function listMigrationFiles(dir = MIGRATIONS_DIR): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
}
