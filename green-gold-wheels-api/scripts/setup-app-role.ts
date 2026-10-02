/**
 * Çalışma zamanı rolünü (wheels_app) girişe açar, güçlü bir şifre üretir ve
 * RLS'in GERÇEKTEN bağladığını SENİN veritabanında doğrular. Çıktısı,
 * Vercel'e konacak DATABASE_URL'dir.
 *
 *   npm run setup-app-role
 *
 * Ne zaman: `npm run migrate`'ten sonra, ilk kurulumda bir kez. Tekrar
 * çalıştırmak YENİ şifre üretir, eskisini geçersiz kılar — bu aynı zamanda
 * ŞİFRE ROTASYONU prosedürüdür (sonra Vercel'deki DATABASE_URL'i güncelle).
 *
 * NEDEN bir script (Neon konsolu değil): konsoldan oluşturulan roller
 * `neon_superuser` üyeliği alır ve bu BYPASSRLS içerir — RLS sessizce kapanır.
 * Bu script rolün öyle OLMADIĞINI denetler, şifreyi insana seçtirmez ve sonucu
 * kanıtlamadan adres vermez.
 *
 * ⚠️ Çıktıdaki adres bir SIRDIR. Yalnızca .env (gitignore'lu) ve Vercel ortam
 * değişkenine yapıştır. Sohbete, issue'ya, commit'e, ekran görüntüsüne koyma.
 */
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { fail, ownerUrl, withOwnerTransaction } from './env';
import {
  assertAppRoleIsRestricted,
  buildAppUrl,
  enableAppRoleLogin,
} from './operator.core';
import { assertRlsBinding } from '../src/database/rls-guard';

async function verifyAsApp(url: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await assertRlsBinding(client);
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
}

async function main() {
  const owner = ownerUrl();
  // 32 bayt ≈ 256 bit; base64url alfabesi SQL literal'ine güvenle girer.
  const password = randomBytes(32).toString('base64url');

  await withOwnerTransaction(async (q) => {
    await assertAppRoleIsRestricted(q);
    await enableAppRoleLogin(q, password);
  }, owner);

  const appUrl = buildAppUrl(owner, password);

  process.stdout.write('\nwheels_app ile bağlanıp RLS doğrulanıyor ... ');
  try {
    await verifyAsApp(appUrl);
    console.log('TAMAM — RLS çalışma zamanı rolünü bağlıyor.');
  } catch (e) {
    console.log('BAŞARISIZ');
    fail(
      `Doğrulama geçmedi: ${e instanceof Error ? e.message : String(e)}\n` +
        'Şifre ayarlandı ama bu adresi KULLANMAYIN; sorunu çözüp script i tekrar çalıştırın.',
    );
  }

  const line = '='.repeat(72);
  console.log(
    `\n${line}\nDATABASE_URL (bir SIR — yalnızca .env ve Vercel ortam değişkenine):\n\n` +
      `${appUrl}\n\n${line}\n` +
      'Bu adres bir daha GÖSTERİLMEZ. Kaybederseniz script i tekrar çalıştırın\n' +
      '(yeni şifre üretir, eskisi geçersiz olur).\n',
  );
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
