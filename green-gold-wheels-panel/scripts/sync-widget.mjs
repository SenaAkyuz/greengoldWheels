// Widget bundle'ını panelin public/ klasörüne kopyalar — Müşteri Önizleme ve
// /demo sayfaları widget'ı panelin kendi domain'inden yükler.
//
// Kaynak (../green-gold-wheels-widget/dist) yoksa HATA VERMEZ: canlı build
// ortamında (ör. yalnızca panel klasörü deploy edildiğinde) mevcut kopya
// kullanılır. Kopya da yoksa uyarır.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = 'green-gold-wheels-widget.v1.js';
const src = resolve(here, '../../green-gold-wheels-widget/dist', FILE);
const dest = resolve(here, '../public', FILE);

if (existsSync(src)) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`[sync-widget] ${FILE} -> public/`);
} else if (existsSync(dest)) {
  console.log('[sync-widget] widget dist yok; public/ içindeki mevcut kopya kullanılıyor.');
} else {
  console.warn(
    '[sync-widget] UYARI: widget bundle bulunamadı. Önce green-gold-wheels-widget içinde "npm run build" çalıştırın.',
  );
}
