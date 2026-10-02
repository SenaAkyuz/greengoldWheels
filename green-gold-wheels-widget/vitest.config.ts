import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';

// Testler üretim bundle'ıyla AYNI alias'ı kullanır: karbon formülü API
// kaynağından gelir, kopyadan değil. Böylece "widget ile sunucu aynı sayıyı
// üretiyor mu" testi gerçek bir şey kanıtlar.
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@wheels/carbon': resolve(
        import.meta.dirname,
        '../green-gold-wheels-api/src/common/carbon-estimate.ts',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
});
