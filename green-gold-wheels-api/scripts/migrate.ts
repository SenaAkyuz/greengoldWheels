/**
 * Operatör script'i — bekleyen migration'ları uygular.
 *
 *   npm run migrate              # bekleyenleri uygula
 *   npm run migrate -- --status  # yalnızca durumu göster, hiçbir şey yazma
 *
 * ⚠️ SAHİP rolüyle (DATABASE_URL_OWNER) çalışır. Tablolar bu rolün olur —
 * bu, RLS modelinin varsayımıdır (sahip bypass eder, wheels_app etmez).
 *
 * Her migration KENDİ transaction'ında uygulanır ve `schema_migrations`
 * tablosuna işlenir: biri patlarsa o dosyanın hiçbir parçası kalmaz, öncekiler
 * korunur, script durur. Aynı dosya iki kez uygulanmaz. Uygulanmış bir dosyanın
 * içeriği sonradan DEĞİŞTİRİLİRSE script bunu checksum ile fark eder ve durur —
 * uygulanmış migration düzenlenmez, yeni bir migration yazılır.
 */
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { fail, ownerUrl, parseArgs, redactUrl } from './env';
import { listMigrationFiles, type MigrationFile } from './migrations';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const statusOnly = args.status === true;

  const url = ownerUrl();
  const client = new Client({ connectionString: url });
  await client.connect();
  console.log(`\nVeritabanı: ${redactUrl(url)}`);

  try {
    const { rows: who } = await client.query<{ role: string }>(
      'SELECT current_user AS role',
    );
    console.log(`Rol        : ${who[0].role}`);
    if (who[0].role === 'wheels_app') {
      fail(
        'Migration wheels_app rolüyle çalıştırılamaz. DATABASE_URL_OWNER tablo sahibinin (neondb_owner) adresi olmalı.',
      );
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        checksum    TEXT NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows: applied } = await client.query<{
      name: string;
      checksum: string;
    }>('SELECT name, checksum FROM schema_migrations');
    const appliedMap = new Map(applied.map((r) => [r.name, r.checksum]));

    const files = listMigrationFiles();
    const pending: MigrationFile[] = [];
    for (const f of files) {
      const prev = appliedMap.get(f.name);
      if (prev === undefined) {
        pending.push(f);
      } else if (prev !== sha256(f.sql)) {
        fail(
          `${f.name} uygulandıktan sonra DEĞİŞTİRİLMİŞ (checksum uyuşmuyor). ` +
            'Uygulanmış migration düzenlenmez — değişikliği yeni bir NNNN_*.sql dosyasıyla yapın.',
        );
      }
    }

    console.log(
      `\nUygulanmış: ${appliedMap.size}  Bekleyen: ${pending.length}`,
    );
    for (const f of pending) console.log(`  - ${f.name}`);

    if (statusOnly || pending.length === 0) {
      console.log(pending.length === 0 ? '\nŞema güncel.\n' : '');
      return;
    }

    for (const f of pending) {
      process.stdout.write(`\nUygulanıyor: ${f.name} ... `);
      try {
        await client.query('BEGIN');
        await client.query(f.sql);
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
          [f.name, sha256(f.sql)],
        );
        await client.query('COMMIT');
        console.log('tamam');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        console.log('BAŞARISIZ');
        fail(
          `${f.name}: ${e instanceof Error ? e.message : String(e)}\n` +
            'Bu dosyanın hiçbir parçası uygulanmadı; öncekiler korundu.',
        );
      }
    }

    // `setup-app-role` yalnızca İLK kurulumda gerekir: tekrar çalıştırmak YENİ
    // bir şifre üretip çalışan DATABASE_URL'i geçersiz kılar. Bu yüzden öneriyi
    // sadece şema sıfırdan kurulduğunda göster — her migrate'te değil.
    const firstInstall = appliedMap.size === 0;
    console.log(
      '\nTüm migration lar uygulandı.' +
        (firstInstall ? '\nSıradaki adım: npm run setup-app-role\n' : '\n'),
    );
  } finally {
    await client.end();
  }
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
