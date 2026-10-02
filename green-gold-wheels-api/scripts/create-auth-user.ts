/**
 * Operatör script'i — Neon Auth'ta hesap açar ve (istenirse) şirkete bağlar.
 *
 *   npm run create-auth-user -- --email yonetici@sirket.com --name "Ad Soyad" \
 *     [--code RNT-XXXX] [--password "..."] [--role filo_yoneticisi|demo_viewer] \
 *     [--origin http://localhost:3000]
 *
 * NEDEN BU SCRIPT VAR:
 * Panelde **kayıt ekranı olmayacak** (erişim davet usulü). Yöneticinin hesabını
 * operatör açar. Hesap Neon Auth'un kendi ucundan açılır (bkz.
 * neon-auth-signup.ts) — `neon_auth."user"` tablosuna elle INSERT edilmez.
 *
 * İKİ AYRI TABLOYU KARIŞTIRMAYIN:
 *   neon_auth."user" -> gerçek hesap (bu script açar)
 *   public.users     -> hangi hesap hangi şirkete ait (--code ile bağlanır)
 *
 * ⚠️ Üretilen şifre GEÇİCİDİR ve terminalde görünür. Yöneticiye güvenli bir
 * kanaldan iletin.
 */
import { randomBytes } from 'node:crypto';
import { fail, loadEnv, parseArgs, withOwnerTransaction } from './env';
import { ensureMember, MEMBER_ROLES, type MemberRole } from './operator.core';
import { signUpOrReuse } from './neon-auth-signup';

/** URL-güvenli, okunabilir geçici şifre (24 bayt ≈ 192 bit). */
function generatePassword(): string {
  return randomBytes(24).toString('base64url');
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const email =
    typeof args.email === 'string' ? args.email.trim().toLowerCase() : '';
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  const code = typeof args.code === 'string' ? args.code : '';
  const password =
    typeof args.password === 'string' ? args.password : generatePassword();
  const role = (
    typeof args.role === 'string' ? args.role : 'filo_yoneticisi'
  ) as MemberRole;
  const origin = typeof args.origin === 'string' ? args.origin : undefined;

  if (!email) fail('--email zorunlu.');
  if (!name) fail('--name zorunlu (Neon Auth isim ister).');
  if (password.length < 8) fail('--password en az 8 karakter olmalı.');
  if (!(MEMBER_ROLES as readonly string[]).includes(role)) {
    fail(`--role şunlardan biri olmalı: ${MEMBER_ROLES.join(', ')}`);
  }

  console.log(`\nHesap açılıyor: ${email}\n`);

  const { userId, reused } = await signUpOrReuse({
    email,
    password,
    name,
    origin,
  }).catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));

  const line = '='.repeat(72);
  console.log(
    reused
      ? 'Hesap zaten vardı — mevcut kimlik kullanılıyor.'
      : 'TAMAM — hesap açıldı.',
  );
  console.log(`  auth_user_id : ${userId}`);
  console.log(`  e-posta      : ${email}`);
  if (!reused && typeof args.password !== 'string') {
    console.log(`\n${line}`);
    console.log(
      `GEÇİCİ ŞİFRE (bir SIR — güvenli kanaldan iletin):\n\n  ${password}`,
    );
    console.log(line);
  } else if (reused) {
    console.log('  (şifre değişmedi — mevcut hesabın şifresi geçerli)');
  }
  console.log('');

  if (!code) {
    console.log(
      'Şirkete bağlamak için:\n' +
        `  npm run create-auth-user -- --email ${email} --name "${name}" --code <ŞİRKET_KODU>\n`,
    );
    return;
  }

  const result = await withOwnerTransaction((q) =>
    ensureMember(q, { code, email, fullName: name, authUserId: userId, role }),
  ).catch((e: unknown) => {
    fail(
      `Hesap hazır (${userId}) ama şirkete bağlanamadı: ` +
        `${e instanceof Error ? e.message : String(e)}`,
    );
  });

  const what =
    result === 'created'
      ? 'Üye oluşturuldu ve bağlandı'
      : result === 'already-linked'
        ? 'Zaten bağlıydı'
        : 'Mevcut üye kimliğine bağlandı';
  console.log(`${what}: ${code.toUpperCase()} (rol: ${role})\n`);
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
