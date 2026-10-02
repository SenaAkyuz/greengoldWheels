/**
 * Var olan bir şirkete eksik başlangıç (placeholder) araç sınıflarını ekler.
 * MEVCUT sınıfları EZMEZ.
 *
 *   npm run seed-vehicle-classes -- --code RNT-PILOT [--factorYear 2026] [--country TR]
 *
 * ⚠️ YALNIZCA LOKAL/OPERATÖR (sahip rolü).
 * SQL: operator.core.ts::seedMissingVehicleClasses (testli).
 */
import { fail, parseArgs, withOwnerTransaction } from './env';
import { seedMissingVehicleClasses } from './operator.core';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const code = typeof args.code === 'string' ? args.code : '';
  const factorYear =
    typeof args.factorYear === 'string'
      ? Number(args.factorYear)
      : new Date().getUTCFullYear();
  const country =
    typeof args.country === 'string' ? args.country.toUpperCase() : 'TR';

  if (!code) fail('--code zorunlu (ör. --code RNT-PILOT).');
  if (!Number.isInteger(factorYear) || factorYear < 2000 || factorYear > 2100) {
    fail('--factorYear 2000-2100 arasında bir yıl olmalı.');
  }
  if (!/^[A-Z]{2}$/.test(country)) fail('--country 2 harfli ülke kodu olmalı.');

  const added = await withOwnerTransaction((q) =>
    seedMissingVehicleClasses(q, { code, factorYear, country }),
  );
  console.log(
    added.length === 0
      ? `\n${code.toUpperCase()} için eklenecek yeni sınıf yok.\n`
      : `\nTAMAM — eklendi: ${added.join(', ')}\n` +
          "HEPSİ factor_source='placeholder': onaylı kaynakla güncellenmeden canlıya çıkarmayın.\n",
  );
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
