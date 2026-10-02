/**
 * Şirket yöneticisinin satırını Neon Auth kullanıcı kimliğine bağlar.
 * Bağlanana kadar o yönetici panele GİREMEZ.
 *
 *   npm run link-member -- --code RNT-PILOT --email yonetici@pilot.com \
 *     --authUserId 860dc360-609f-4b7d-9e70-ec93fe6414d3 [--force]
 *
 * Kimliği nereden bulurum:
 *   Neon Console -> Auth -> Users, ya da SQL:
 *     SELECT id, email FROM neon_auth."user" ORDER BY "createdAt" DESC;
 *
 * ⚠️ YALNIZCA LOKAL/OPERATÖR (sahip rolü).
 *
 * NEDEN elle (otomatik e-posta eşlemesi değil): "bu e-postayla giren kişi bu
 * şirketin yöneticisidir" kuralı, aynı e-postayla kayıt olan birine başka bir
 * şirketin panelini açabilirdi. Neon Auth şu an açık kayıt aldığı için bu risk
 * teorik değil — bağlama, kimliği görüp doğrulayan bir insanın bilinçli
 * adımıdır. Erişimin asıl kapısı bu komuttur.
 *
 * SQL: operator.core.ts::linkMember (testli).
 */
import { fail, parseArgs, withOwnerTransaction } from './env';
import { linkMember } from './operator.core';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const code = typeof args.code === 'string' ? args.code : '';
  const email = typeof args.email === 'string' ? args.email : '';
  const authUserId = typeof args.authUserId === 'string' ? args.authUserId : '';
  if (!code || !email) fail('--code ve --email zorunlu.');

  const result = await withOwnerTransaction((q) =>
    linkMember(q, { code, email, authUserId, force: args.force === true }),
  );
  console.log(
    result === 'already-linked'
      ? '\nZaten bu kimliğe bağlı. Değişiklik yapılmadı.\n'
      : `\nTAMAM — ${email} (${code.toUpperCase()}) -> ${authUserId}\n`,
  );
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
