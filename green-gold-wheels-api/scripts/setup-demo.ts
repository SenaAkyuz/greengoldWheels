/**
 * Demo girişini TEK KOMUTLA hazırlar (Stay'deki "Demo panelini görüntüle").
 *
 *   npm run setup-demo
 *   npm run setup-demo -- --panel-env ../green-gold-wheels-panel/.env.local \
 *     [--code RNT-DEMO] [--no-refresh] [--origin http://localhost:3000]
 *
 * Yaptıkları (hepsi idempotent — tekrar çalıştırmak güvenli):
 *   1. Demo şirketini oluşturur/aktifleştirir (RNT-DEMO, placeholder faktörler).
 *   2. Neon Auth'ta demo hesabını açar (zaten varsa kimliğini kullanır).
 *   3. Hesabı demo şirketine `demo_viewer` (SALT OKUNUR) rolüyle bağlar.
 *   4. Son 60 güne yayılmış TEMSİLİ widget etkileşimleri yazar. Varsayılan
 *      olarak eski demo event'lerini silip bugünden geriye yeniden üretir.
 *
 * Demo e-posta/şifresi PANELİN .env.local dosyasından okunur
 * (DEMO_LOGIN_EMAIL / DEMO_LOGIN_PASSWORD) — panel aynı bilgilerle sunucu
 * tarafında giriş yapar; iki yerde ayrı ayrı yazılıp birbirinden kaymasın.
 * Şifre ASLA terminale yazılmaz.
 *
 * ⚠️ Neon Console -> Auth -> "Sign-up with Email" KAPALIYSA 2. adım başarısız
 * olur: hesabı açmak için geçici olarak açın, sonra tekrar kapatın.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fail, loadEnv, parseArgs, withOwnerTransaction } from './env';
import { ensureMember } from './operator.core';
import { signUpOrReuse } from './neon-auth-signup';
import {
  DEMO_CODE_PREFIX,
  ensureDemoCompany,
  seedDemoEvents,
} from './demo-data.core';

function readEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const panelEnvPath = resolve(
    __dirname,
    '..',
    typeof args['panel-env'] === 'string'
      ? args['panel-env']
      : '../green-gold-wheels-panel/.env.local',
  );
  const panelEnv = readEnvFile(panelEnvPath);

  const email = (
    process.env.DEMO_LOGIN_EMAIL ??
    panelEnv.DEMO_LOGIN_EMAIL ??
    ''
  )
    .trim()
    .toLowerCase();
  const password =
    process.env.DEMO_LOGIN_PASSWORD ?? panelEnv.DEMO_LOGIN_PASSWORD ?? '';
  const code = typeof args.code === 'string' ? args.code : DEMO_CODE_PREFIX;
  const refresh = args['no-refresh'] !== true;
  const origin = typeof args.origin === 'string' ? args.origin : undefined;

  if (!email || !password) {
    fail(
      `DEMO_LOGIN_EMAIL ve DEMO_LOGIN_PASSWORD bulunamadı.\n` +
        `Panelin env dosyasına yazın: ${panelEnvPath}\n` +
        '  DEMO_LOGIN_ENABLED=true\n' +
        '  DEMO_LOGIN_EMAIL=demo@...\n' +
        '  DEMO_LOGIN_PASSWORD=<en az 12 karakter, sizin belirlediğiniz>',
    );
  }
  if (password.length < 12) {
    fail(
      'DEMO_LOGIN_PASSWORD en az 12 karakter olmalı (hesap herkese açık bir butonun arkasında).',
    );
  }

  console.log('\n1/4  Demo şirketi hazırlanıyor…');
  const company = await withOwnerTransaction((q) =>
    ensureDemoCompany(q, {
      code,
      name: 'Green Gold Demo Rent a Car',
      city: 'İstanbul',
      // .example alan adı rezervedir — kimse kaydedemez; demo anahtarı
      // gerçek bir sitede kullanılamaz. Panel önizlemesi CORS'ta ayrıca
      // WIDGET_PREVIEW_ORIGINS ile (yalnızca GET) açılır.
      origins: ['https://demo.greengold-wheels.example'],
      factorYear: new Date().getFullYear(),
    }),
  ).catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
  console.log(
    `     ${company.company_code} ${company.created ? 'oluşturuldu' : 'zaten vardı'} · aktif`,
  );

  console.log('2/4  Neon Auth demo hesabı…');
  const { userId, reused } = await signUpOrReuse({
    email,
    password,
    name: 'Demo Kullanıcı',
    origin,
  }).catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
  console.log(`     ${email} ${reused ? '(zaten vardı)' : 'açıldı'}`);
  if (reused) {
    console.log(
      '     NOT: hesap zaten vardı; şifresi DEĞİŞMEDİ. .env.local içindeki\n' +
        '     DEMO_LOGIN_PASSWORD hesabın gerçek şifresiyle aynı olmalı.',
    );
  }

  console.log('3/4  Salt okunur (demo_viewer) üyelik…');
  const member = await withOwnerTransaction((q) =>
    ensureMember(q, {
      code: company.company_code,
      email,
      fullName: 'Demo Kullanıcı',
      authUserId: userId,
      role: 'demo_viewer',
    }),
  ).catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
  console.log(`     ${member}`);

  console.log('4/4  Temsili etkileşim verisi…');
  const seeded = await withOwnerTransaction((q) =>
    seedDemoEvents(q, { code: company.company_code, now: new Date(), refresh }),
  ).catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
  console.log(
    `     ${seeded.inserted} event yazıldı${refresh ? `, ${seeded.deleted} eski demo event silindi` : ''}.`,
  );

  const line = '='.repeat(72);
  console.log(`\n${line}`);
  console.log(
    'TAMAM. Panelin .env.local dosyasında şu satır olmalı (public /demo sayfası için):\n',
  );
  console.log(`  NEXT_PUBLIC_DEMO_WIDGET_KEY=${company.public_widget_key}`);
  console.log(`${line}\n`);
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
