# Green Gold Wheels — Yapılacaklar ve hatırlatmalar

Bu dosya, kodda çözülemeyen (sizin yapmanız gereken) adımların tek listesidir.
Her yeni değişiklikte güncellenir. Tamamlananlar `[x]`.

## Şimdi (lokal demo)

- [x] Migration 0009 (`demo_viewer` rolü) — `npm run migrate`
- [ ] `npm run setup-demo`'yu bitene kadar çalıştırın; en sonda basılan
      `NEXT_PUBLIC_DEMO_WIDGET_KEY=...` satırını **panelin** `.env.local`
      dosyasına yapıştırın (paneli yeniden başlatmanıza gerek yok).
- [ ] Neon Console → Auth → **"Sign-up with Email"i tekrar KAPATIN**
      (demo hesabı açıldı; yeni hesaplar yalnızca operatör betiğiyle açılmalı).

## Canlıya alırken (Vercel)

### API projesi (green-gold-wheels-api) ortam değişkenleri
- [ ] `DATABASE_URL` — yalnızca `wheels_app` adresi. **`DATABASE_URL_OWNER` Vercel'e ASLA konmaz.**
- [ ] `NEON_AUTH_BASE_URL` — Neon Console'daki Auth URL (lokaldekiyle aynı).
- [ ] `WIDGET_PREVIEW_ORIGINS` — **panelin herkese açık adresi**, yolsuz ve sonda `/` olmadan.
      Panele özel domain bağlarsanız o domain (`https://panel.sirketiniz.com`);
      `*.vercel.app` adresiyle de açılacaksa ikisini virgülle yazın:
      `https://panel.sirketiniz.com,https://green-gold-wheels-panel.vercel.app`.
      Eksikse canlıda **Müşteri Önizleme** ve **/demo** sayfasında widget görünmez.
      (Vercel'in her deploy'a verdiği önizleme linklerini eklemeye gerek yok.)
- [ ] `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Vercel aynı anda
      birden çok sunucu örneği çalıştırır; bu olmadan widget hız sınırı her
      örnekte ayrı sayılır (kötüye kullanıma karşı zayıf). Upstash'in ücretsiz
      planı yeterli. Lokal geliştirmede **gerekmez**.
- [ ] `NEON_AUTH_ISSUER` / `NEON_AUTH_AUDIENCE` — opsiyonel, ek token sıkılaştırması.

### Panel projesi (green-gold-wheels-panel) ortam değişkenleri
- [ ] `NEON_AUTH_BASE_URL`, `NEXT_PUBLIC_NEON_AUTH_URL`, `NEON_AUTH_COOKIE_SECRET` (canlı için YENİ üretin)
- [ ] `API_BASE_URL` ve `NEXT_PUBLIC_API_BASE_URL` — API'nin canlı adresi
- [ ] `NEXT_PUBLIC_SITE_URL` — panelin canlı adresi (embed kodundaki widget script adresi buradan üretilir)
- [ ] `DEMO_LOGIN_ENABLED`, `DEMO_LOGIN_EMAIL`, `DEMO_LOGIN_PASSWORD`, `NEXT_PUBLIC_DEMO_WIDGET_KEY`
- [ ] Demo butonunun deneme sınırı şu an bellek içi — canlıda paylaşımlı store'a (Upstash) taşınmalı.

### Neon Console
- [ ] Auth → Domains: panelin canlı domain'ini ekleyin; canlıda "Allow Localhost"u kapatın.

## Gerçek bir kiralama şirketini bağlamadan önce
- [ ] Araç emisyon faktörleri hâlâ `placeholder` — onaylı kaynakla (ör. DEFRA) güncellenmeli.
- [ ] `RNT-GREENG`'in izinli adresi `http://localhost:5174` (yalnızca test) — gerçek `https://` domain ile değiştirin.
- [ ] "Şifremi unuttum" akışı yok (Neon Auth'un e-posta gönderimi doğrulanınca eklenecek).

## Temizlik / kararınızı bekleyen
- [ ] `public.users` içinde bağlantısız eski satır: `greengoldwheels@pilot.com` (zararsız; silinebilir).
- [ ] Hiçbir şey commit edilmedi — onayınızı bekliyor.
