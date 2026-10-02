import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';

// Library mode: tek IIFE dosyası. Host sayfaya <script> ile girer, custom
// element'i kendisi kaydeder. Preact bundle'a gömülür (external DEĞİL) —
// host sayfanın hiçbir bağımlılığına güvenmez.
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      // ★ TEK HESAP KAYNAĞI: karbon formülü API ile PAYLAŞILIR, kopyalanmaz.
      // `carbon-estimate.ts` saf TypeScript'tir (hiçbir NestJS/Node importu
      // yok), bu yüzden tarayıcı bundle'ına güvenle girer. Kopyalasaydık
      // widget'ın gösterdiği sayı ile sunucunun yazdığı sayı zamanla
      // ayrışabilirdi — bu alias o riski mimari olarak kaldırır.
      '@wheels/carbon': resolve(
        import.meta.dirname,
        '../green-gold-wheels-api/src/common/carbon-estimate.ts',
      ),
    },
  },
  server: {
    // Dev sunucusunun proje kökü dışındaki (API'deki) dosyayı okumasına izin.
    fs: { allow: ['..'] },
  },
  build: {
    lib: {
      entry: 'src/main.tsx',
      name: 'GreenGoldWheelsWidget',
      formats: ['iife'],
      fileName: () => 'green-gold-wheels-widget.v1.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    // CSS Shadow DOM içine JS'ten enjekte edilir; ayrı .css çıktısı yok.
    cssCodeSplit: false,
  },
});
