# Green Gold Wheels — Yapılacaklar ve hatırlatmalar

Bu dosya, kodda çözülemeyen (sizin yapmanız gereken) adımların tek listesidir.
Her yeni değişiklikte güncellenir. Tamamlananlar `[x]`.

## Tamamlananlar

- [x] Migration 0009 (`demo_viewer` rolü) — `npm run migrate`
- [x] `npm run setup-demo` + `NEXT_PUBLIC_DEMO_WIDGET_KEY` panele yazıldı
- [x] Proje GitHub'a aktarıldı: https://github.com/SenaAkyuz/greengoldWheels (`main`)

## Şimdi (lokal test sırasında)

- [ ] Neon Console → Auth → **"Sign-up with Email"i tekrar KAPATIN**
      (demo hesabı açıldı; yeni hesaplar yalnızca operatör betiğiyle açılır).
- [ ] Paneli demo hesabıyla gezip ekranları kontrol edin (giriş ekranındaki
      "Demo panelini görüntüle").

---

# CANLIYA ALMA — adım adım

Sıra önemli: **API → Panel → API'ye panel adresini yaz → Neon → tanıtım sitesi.**
Panelin adresi API'ye, API'nin adresi panele gerektiği için ikisi birbirini bekler.

## Adım 0 · Upstash (rate limit deposu)

Vercel aynı anda birden çok sunucu örneği çalıştırır; paylaşımlı sayaç olmazsa
widget hız sınırı her örnekte ayrı sayılır.

1. https://upstash.com → ücretsiz hesap → **Create Database** (Redis).
2. Bölge olarak Neon projenize yakın olanı seçin (eu-west / eu-central).
3. Veritabanı sayfasında **REST API** bölümünden iki değeri kopyalayın:
   `UPSTASH_REDIS_REST_URL` ve `UPSTASH_REDIS_REST_TOKEN`.

## Adım 1 · API'yi Vercel'e alın

1. Vercel → **Add New → Project** → GitHub'dan `SenaAkyuz/greengoldWheels`.
2. **Root Directory**: `green-gold-wheels-api` (Edit deyip klasörü seçin).
3. **Environment Variables** (Production):
   | Ad | Değer |
   |---|---|
   | `DATABASE_URL` | `wheels_app` bağlantı adresi (`npm run setup-app-role` çıktısı) |
   | `NEON_AUTH_BASE_URL` | Neon Console → Settings → Auth → Auth URL |
   | `UPSTASH_REDIS_REST_URL` | Adım 0 |
   | `UPSTASH_REDIS_REST_TOKEN` | Adım 0 |
   > ⚠️ `DATABASE_URL_OWNER` **ASLA** Vercel'e konmaz. O adres yalnızca sizin
   > bilgisayarınızdaki operatör betikleri içindir; RLS'i atlar.
4. **Deploy** → biten adresi not edin (ör. `https://wheels-api.vercel.app`).
5. Kontrol: tarayıcıda `<API_ADRESİ>/internal/health` → `{"success":true,...}`.

## Adım 2 · Paneli Vercel'e alın

1. Vercel → **Add New → Project** → aynı repo.
2. **Root Directory**: `green-gold-wheels-panel`.
3. **Environment Variables** (Production):
   | Ad | Değer |
   |---|---|
   | `NEON_AUTH_BASE_URL` | Lokaldekiyle aynı Auth URL |
   | `NEXT_PUBLIC_NEON_AUTH_URL` | Aynı Auth URL |
   | `NEON_AUTH_COOKIE_SECRET` | **YENİ üretin** (lokaldekini kullanmayın): `openssl rand -base64 32` |
   | `API_BASE_URL` | Adım 1'deki API adresi |
   | `NEXT_PUBLIC_API_BASE_URL` | Aynı API adresi |
   | `NEXT_PUBLIC_SITE_URL` | Panelin kendi adresi (ilk deploy'dan sonra yazıp yeniden deploy edin) |
   | `DEMO_LOGIN_ENABLED` | `true` |
   | `DEMO_LOGIN_EMAIL` | `demo@greengold-wheels.test` |
   | `DEMO_LOGIN_PASSWORD` | Lokalde belirlediğiniz demo şifresi |
   | `NEXT_PUBLIC_DEMO_WIDGET_KEY` | `setup-demo` çıktısındaki anahtar |
4. **Deploy** → panel adresini not edin (ör. `https://wheels-panel.vercel.app`).
5. `NEXT_PUBLIC_SITE_URL`'i bu adresle doldurup **Redeploy** edin
   (Entegrasyon ekranındaki embed kodu bu adresi kullanır).

## Adım 3 · API'ye panelin adresini tanıtın

1. Vercel → API projesi → Settings → Environment Variables.
2. `WIDGET_PREVIEW_ORIGINS` = panelin adresi, **yolsuz ve sonda `/` olmadan**.
   Birden fazlaysa virgülle: `https://panel.sirketiniz.com,https://wheels-panel.vercel.app`
3. **Redeploy**.
   > Bu olmadan canlıda **Müşteri Önizleme** ve **/demo** sayfalarında widget görünmez.
   > Yalnızca okuma izni verir; bu adreslerden rapora event yazılamaz.

## Adım 4 · Neon Console

1. Settings → Auth → **Domains**: panelin canlı adresini ekleyin.
2. **Allow Localhost**: canlıda kapatın.
3. **Sign-up with Email**: kapalı kalsın.

## Adım 5 · Tanıtım sitesi (greengold-wheels-mvp)

`index.html` içinde **iki** bağlantı var; ikisini de panelin adresiyle değiştirin:

- Üst sağdaki buton: `href="http://localhost:3001/login"` → `https://<panel>/login`
- Alt bağlantı: `href="http://localhost:3001/demo"` → `https://<panel>/demo`

Değiştirip push edin; Vercel tanıtım sitesini otomatik yeniden yayınlar.

## Adım 6 · İlk gerçek şirket için

- [ ] Şirketin izinli adresini gerçek `https://` domain'i yapın (panel → Ayarlar).
      `RNT-GREENG` şu an `http://localhost:5174` ile duruyor (yalnızca test).
- [ ] Emisyon faktörlerini onaylı bir kaynakla güncelleyin (panel → Araç Sınıfları).
      Şu an hepsi Green Gold ön değeri; kaynak/ülke/yıl/kapsam birlikte girilmeli.
- [ ] Yöneticinin hesabını açın: `npm run create-auth-user -- --email ... --name ... --code ...`

---

## Bilinen eksikler (karar sizin)

- **"Şifremi unuttum" akışı yok.** Neon Auth'un e-posta gönderimi doğrulanınca
  eklenebilir; şu an panelde "Green Gold ile iletişime geçin" yazıyor.
- **Demo butonunun deneme sınırı** tek sunucuda çalışıyor; canlıda Upstash'e
  taşınmalı (API'deki rate limit zaten taşınıyor, bu ayrı bir yer).
- `public.users` içinde bağlantısız eski satır: `greengoldwheels@pilot.com`
  (zararsız; isterseniz silinir).
