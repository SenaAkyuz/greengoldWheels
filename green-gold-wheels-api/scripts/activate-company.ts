/**
 * Şirketi 'active' yapar (widget'ı canlıya alır).
 *
 *   npm run activate-company -- --code RNT-PILOT [--force]
 *
 * ⚠️ YALNIZCA LOKAL/OPERATÖR (sahip rolü).
 *
 * GÜVENLİK KAPILARI (operator.core.ts::activateCompany, testli):
 *   1. allowed_origins boş olamaz.
 *   2. En az bir AKTİF araç sınıfı olmalı.
 *   3. Placeholder faktör varsa --force olmadan REDDEDİLİR.
 * UYARI (kapı değil): bağlı yönetici yoksa kimse paneli göremez.
 */
import { fail, parseArgs, withOwnerTransaction } from './env';
import { activateCompany } from './operator.core';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const code = typeof args.code === 'string' ? args.code : '';
  if (!code) fail('--code zorunlu (ör. --code RNT-PILOT).');

  const r = await withOwnerTransaction((q) =>
    activateCompany(q, { code, force: args.force === true }),
  );

  if (r.status === 'already-active') {
    console.log(`\n${code.toUpperCase()} zaten aktif. Değişiklik yapılmadı.\n`);
    return;
  }
  if (r.placeholderClasses.length > 0) {
    console.warn(
      `\nUYARI: --force ile aktive edildi. Placeholder faktörlü sınıflar: ` +
        `${r.placeholderClasses.join(', ')}.\n` +
        'Bu şirkette gösterilen karbon sayıları ONAYLANMAMIŞ tahminlerdir.',
    );
  }
  if (r.linkedMembers === 0) {
    console.warn(
      'UYARI: auth hesabına bağlı yönetici yok — widget çalışır ama panele ' +
        'kimse giremez. Bkz. npm run link-member',
    );
  }
  console.log(`\nTAMAM — ${code.toUpperCase()} (${r.name}) artık AKTİF.`);
  console.log(`  izinli origin ler : ${r.origins.join(', ')}`);
  console.log(`  aktif araç sınıfı : ${r.activeClasses}\n`);
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
