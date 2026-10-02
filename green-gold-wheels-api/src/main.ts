import { createApp } from './bootstrap';

// Lokal/uzun-süreli çalıştırma. Serverless (Vercel) girişi ayrı: api/index.js.
async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
