/**
 * Kiralama şirketi + yönetici satırı + başlangıç araç sınıfları.
 * TEK transaction: biri başarısız olursa HİÇBİRİ yazılmaz.
 *
 *   npm run create-company -- --name "Pilot Araç Kiralama" \
 *     --email yonetici@pilot.com --city Antalya [--code RNT-PILOT] \
 *     [--tz Europe/Istanbul] [--currency TRY] [--pricePerKg 1] \
 *     [--minAmount 19] [--factorYear 2026] [--country TR] \
 *     [--authUserId <uuid>] [--dry-run]
 *
 * ⚠️ YALNIZCA LOKAL/OPERATÖR (sahip rolü, RLS'i atlar). Self-servis kayıt DEĞİL.
 * Şirket 'pending' doğar, allowed_origins BOŞ — widget hiçbir yerden çalışmaz.
 * SQL: operator.core.ts::insertCompany (testli).
 */
import { fail, parseArgs, withOwnerTransaction } from './env';
import {
  planCreateCompany,
  validateInput,
  type RawInput,
} from './create-company.core';
import { insertCompany } from './operator.core';

const str = (v: string | true | undefined) =>
  typeof v === 'string' ? v : undefined;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const raw: RawInput = {
    name: str(args.name),
    email: str(args.email),
    code: str(args.code),
    city: str(args.city),
    tz: str(args.tz),
    currency: str(args.currency),
    pricePerKg: str(args.pricePerKg),
    minAmount: str(args.minAmount),
    factorYear: str(args.factorYear),
    country: str(args.country),
    authUserId: str(args.authUserId),
  };

  const plan = planCreateCompany(validateInput(raw));

  console.log('\nOluşturulacak şirket:');
  console.log(JSON.stringify(plan.company, null, 2));
  console.log(
    `\nBaşlangıç araç sınıfları: ${plan.vehicleClasses('x').length} adet ` +
      "(hepsi factor_source='placeholder')",
  );

  if (args['dry-run'] === true) {
    console.log('\n--dry-run: hiçbir şey yazılmadı.\n');
    return;
  }

  const created = await withOwnerTransaction((q) => insertCompany(q, plan));
  const email = plan.user('x').email;

  console.log('\nTAMAM.');
  console.log(`  company_code      : ${created.company_code}`);
  console.log(`  public_widget_key : ${created.public_widget_key}`);
  console.log(`  status            : ${created.status}`);
  console.log(
    '\nSonraki adımlar:\n' +
      '  1) Yöneticiye Neon Auth hesabını açtırın (panelin giriş ekranı).\n' +
      (raw.authUserId
        ? ''
        : `  2) Hesap açılınca kimliğini bağlayın:\n     npm run link-member -- --code ${created.company_code} --email ${email} --authUserId <uuid>\n`) +
      '  3) allowed_origins i doldurun (widget hangi domain lerden çalışacak).\n' +
      '  4) Araç faktörlerini gözden geçirin — hepsi placeholder.\n' +
      `  5) npm run activate-company -- --code ${created.company_code}\n`,
  );
}

main().catch((e: unknown) =>
  fail(
    `${e instanceof Error ? e.message : String(e)}\n(Hiçbir şey yazılmadı — transaction geri alındı.)`,
  ),
);
