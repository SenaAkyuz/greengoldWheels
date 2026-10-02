/**
 * Operatör script'leri için paylaşılan yardımcılar.
 *
 * ⚠️ Buradaki bağlantı TABLO SAHİBİ rolüyle (DATABASE_URL_OWNER) kurulur — RLS'i
 * atlar ve tam yetkilidir. YALNIZCA operatörün makinesinde çalışır. Bu adres
 * Vercel'e / sunucuya / CI'a ASLA konmaz; çalışma zamanı her zaman kısıtlı
 * wheels_app rolüyle (DATABASE_URL) bağlanır.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import type { Queryable } from '../src/database/database';

/** .env / .env.local dosyalarını process.env'e yükler (var olanı EZMEZ). */
export function loadEnv(): void {
  for (const name of ['.env', '.env.local']) {
    const p = resolve(__dirname, '..', name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || m[1] in process.env) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}

/** Sahip rolünün bağlantı adresi. Yoksa NET bir hatayla durur. */
export function ownerUrl(): string {
  loadEnv();
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) {
    throw new Error(
      'DATABASE_URL_OWNER gerekli (Neon konsolundaki neondb_owner bağlantı adresi). ' +
        '.env dosyasını .env.example a göre doldurun.',
    );
  }
  return url;
}

/**
 * Sahip olarak TEK bir transaction çalıştırır ve bağlantıyı kapatır.
 * Hata olursa her şey geri alınır — yarım kurulum kalmaz.
 */
export async function withOwnerTransaction<T>(
  fn: (q: Queryable) => Promise<T>,
  url = ownerUrl(),
): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await client.end();
  }
}

/** `--anahtar deger` ve `--bayrak` biçimli argümanları ayrıştırır. */
export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const name = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[name] = next;
      i += 1;
    } else {
      out[name] = true;
    }
  }
  return out;
}

/** Tek tip bitirme: mesajı yaz, exit 1. */
export function fail(message: string): never {
  console.error(`\nHATA: ${message}\n`);
  process.exit(1);
}

/** Bağlantı adresindeki şifreyi log'a yazmadan önce maskeler. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '****';
    return u.toString();
  } catch {
    return '<geçersiz adres>';
  }
}
