# green-gold-wheels-api

Wheels'ın backend'i: **NestJS 11 + Neon Postgres + Neon Auth**. ORM yok — `pg`
(node-postgres) ile parametreli SQL. Şema, `db/migrations/` altındaki ham SQL
dosyalarıdır.

Ürün kararları ve genel akış için kök [`../README.md`](../README.md). Bu dosya
güvenlik modelinin ve kod tarafının haritasıdır.

---

## Güvenlik modeli — önce bunu okuyun

Araç kiralama şirketleri bu sisteme bağlanacak. Bir şirketin verisinin başka
bir şirkete görünmesi, bu ürünün yapabileceği en kötü hatadır. Bu yüzden
izolasyon **iki katlıdır** ve ikinci kat uygulama koduna güvenmez.

### İki rol

| Rol | Kim kullanır | Yetki | Nerede durur |
|---|---|---|---|
| **sahip** (`neondb_owner`) | `migrate` + operatör script'leri | Tabloların sahibi, RLS'i atlar | **Yalnızca senin makinende** (`DATABASE_URL_OWNER`) |
| **`wheels_app`** | Çalışan API | 4 tabloda `SELECT`, yalnızca `widget_events`'te `INSERT`. RLS'e **tabi**. `UPDATE`/`DELETE` yok | Vercel (`DATABASE_URL`) |

### İki kat

1. **Kod:** her sorguda `WHERE company_id = $1` açıkça yazılı.
2. **Veritabanı (RLS):** her istek bir transaction'da çalışır ve şirketi
   `set_config('app.current_company_id', …, true)` ile ayarlar. Policy'ler
   yalnızca o şirketin satırlarını gösterir ve yalnızca o şirket adına
   yazmaya izin verir. **Birinci kat bir hatayla atlansa bile ikinci kat
   başka şirketin satırını döndürmez** — `test/security.spec.ts` bunu
   sorguları bilinçli olarak filtresiz yazarak kanıtlar.

Şirket ayarlanmamışsa hiçbir satır görünmez (**fail-closed**): ayarı unutmak
"her şeyi göster"e değil "hiçbir şeyi gösterme"ye düşer.

### Tenant sınırını geçen tek yollar

Bazı işlemler şirket henüz bilinmeden yapılmak zorunda: widget anahtarını
çözmek, auth kullanıcısını çözmek, CORS origin'lerini okumak. Bunlar için
dört **dar `SECURITY DEFINER` fonksiyon** var (`0007_app_role.sql`). Her biri
yalnızca gereken en az sütunu döndürür, `search_path`'i sabitler, `PUBLIC`'ten
geri alınıp yalnızca `wheels_app`'e verilir. Başka yol yoktur.

### Uygulama yanlış rolle AÇILMAZ

Neon'un RLS rehberindeki bir numaralı tuzak: *uygulama yanlış rolle bağlanırsa
RLS sessizce atlanır* — hata yok, uyarı yok, sadece herkes her şeyi görür.
`PgDatabase` açılışta `row_security_active()` ile RLS'in bu rol için **gerçekten**
uygulandığını denetler; değilse uygulama başlamaz. Bu kontrol dört bypass
yolunun dördünü de yakalar (superuser, `BYPASSRLS`, tablo sahibi, sahibin
üyesi) — her biri testte doğrulandı.

### Deneyle bulunan iki tuzak

Bu model kod yazılmadan önce gerçek Postgres üzerinde denendi. İki bulgu
tasarımı değiştirdi:

- **`FORCE ROW LEVEL SECURITY` kullanılmıyor.** Neon'da tablo sahibi superuser
  değildir. `FORCE` açıkken `SECURITY DEFINER` fonksiyonları (sahibin
  yetkisiyle çalışırlar) hiçbir satır göremez ve widget anahtarı çözülemez —
  widget canlıda **tamamen** ölür. Testler superuser'la koşsaydı bu gizlenirdi.
  Sahibin bypass etmesi sorun değil, çünkü uygulama asla sahip olarak
  bağlanmaz (yukarıdaki açılış kontrolü).
- **`wheels_app` Neon konsolundan oluşturulmaz.** Konsoldan oluşturulan roller
  otomatik `neon_superuser` üyeliği alır ve bu `BYPASSRLS` içerir. Rol SQL ile
  oluşturulur (`0007`); `setup-app-role` bunu ayrıca denetler.

### Kimlik (Neon Auth = Managed Better Auth)

- `AuthGuard` global'dir (`APP_GUARD`) — `@Public()` olmayan her uç korunur.
- Token Neon Auth'un JWKS ucuyla doğrulanır (EdDSA/Ed25519; anahtarlar
  önbelleğe alınır, her istekte ağ çağrısı yok). `issuer` denetlenir;
  `audience` yapılandırılmışsa ayrıca denetlenir.
- `company_id` **yalnızca** doğrulanmış kullanıcı kimliğinin (`sub`) `users`
  tablosundaki eşlemesinden gelir. İstemciden (header, query, token claim)
  asla alınmaz. Neon Auth'un *organizations/roles* özellikleri bilinçli olarak
  kullanılmıyor: şirket üyeliğinin tek doğruluk kaynağı bizim tablomuz.
- Eşleme **yalnızca `auth_user_id` ile** yapılır, e-postayla **asla** —
  e-posta eşlemesi, aynı adresle kayıt olan birine başka şirketin panelini
  açabilirdi. Bağlama, operatörün bilinçli adımıdır (`link-member`).
- Doğrulama hatasının ayrıntısı (süresi doldu / imza / issuer) istemciye
  sızdırılmaz.

#### ⚠️ Neon Auth şu an açık kayıt alıyor — ve neden sorun değil

Neon'un dokümanı: *"Anyone can sign up for your application by default.
Support for restricted signups is coming soon."* Yani kayıt henüz
kapatılamıyor.

**Erişimin kapısı kayıt ekranı değil, `users` tablosundaki eşlemedir** — ve ona
yalnızca operatör (sahip rolü) yazabilir. Kendi kendine kayıt olan biri:

1. geçerli bir token alır,
2. `wheels_resolve_member()` boş döner,
3. **401 alır ve hiçbir veri görmez.**

Test: `app.e2e.spec.ts` → *"gecerli ama sirkete BAGLI OLMAYAN kullanici 401"*.

Pratikte kontrol üç katmandır: panelde **kayıt ekranı hiç yapılmaz**, erişim
yalnızca `link-member` ile verilir, ve guard bağlanmamış kullanıcıyı reddeder.
Açık kayıt bir veri sızıntısı değil; maliyeti `neon_auth.user` tablosunda çöp
hesaplar. Kayıt kapatma geldiğinde bu **fazladan** bir kat olacak, tek kat değil.

Ayrıca: **MFA henüz desteklenmiyor** (Neon Auth yol haritasında).

### Karbon hesabı sunucuda

İstemci yalnızca `distance_km` + `vehicle_class_code` gönderir. `amount`,
`estimated_co2e_kg` gibi sonuç alanları DTO'da **yoktur**; gönderilirse
`forbidNonWhitelisted` ile **400** döner ve hiçbir şey yazılmaz
(`test/app.e2e.spec.ts`).

---

## Kurulum

Ön koşul: Node.js (LTS) ve bir **Neon** projesi, içinde **Neon Auth
etkinleştirilmiş** (Console → proje → Auth → Enable).

> Neon Auth'u migration'lardan **önce** açın: 0003'teki foreign key
> `neon_auth.user` tablosunu arar. Kapalıysa migration patlamaz ama FK atlanır
> (bkz. `test/migrations.spec.ts`), ve sonradan eklemek için yeni bir
> migration yazmanız gerekir.

```bash
npm install
cp .env.example .env
```

`.env` içinde şimdilik yalnızca şu ikisini doldurun:

- **`DATABASE_URL_OWNER`** — Neon Console → Connect → rol `neondb_owner`,
  "Connection pooling" **kapalı**.
- **`NEON_AUTH_BASE_URL`** — Neon Console → proje → Auth. Yol kısmı
  (`/neondb/auth`) olsa da sorun değil; kod yalnızca origin'i kullanır.

`DATABASE_URL`'i elle yazmayın — aşağıda üretilecek.

```bash
npm run migrate          # şemayı uygular (sahip rolüyle)
npm run setup-app-role   # wheels_app'e giriş + güçlü şifre; RLS'i SENİN DB'nde
                         # doğrular ve DATABASE_URL'i basar
```

`setup-app-role`'ün bastığı adresi `.env`'deki `DATABASE_URL`'e yapıştırın.

```bash
npm test                 # 179 test, gerçek Postgres (PGlite), ağ gerekmez
npm run start:dev        # http://localhost:3000
```

Sağlık kontrolü: `GET http://localhost:3000/internal/health`

### Vercel'e

Vercel ortam değişkenlerine **yalnızca** şunlar gider: `DATABASE_URL`,
`NEON_AUTH_BASE_URL`, `NEON_AUTH_AUDIENCE` (opsiyonel),
`UPSTASH_REDIS_REST_URL`/`TOKEN`. **`DATABASE_URL_OWNER` asla.**

---

## Operatör script'leri

Hepsi sahip rolüyle, **yalnızca senin makinende** çalışır. SQL'leri
`scripts/operator.core.ts`'tedir ve gerçek Postgres'e karşı testlidir
(`operator.core.spec.ts`) — senin veritabanında ilk kez çalışmazlar.

| Komut | İş |
|---|---|
| `npm run migrate` | Bekleyen migration'ları uygular. Her biri kendi transaction'ında; checksum ile **uygulanmış dosyanın sonradan değiştirilmesini** yakalar. `--status` yalnızca durumu gösterir. |
| `npm run setup-app-role` | `wheels_app`'i girişe açar, ~256 bit şifre üretir, sorgu zaman aşımı sigortalarını kurar, **RLS'i doğrular**, `DATABASE_URL`'i basar. Tekrar çalıştırmak = **şifre rotasyonu**. |
| `npm run create-company` | Şirket + yönetici + 4 placeholder araç sınıfı, **tek transaction** (yarım kurulum olmaz). `pending` doğar, origin listesi boş. `--dry-run` destekler. |
| `npm run create-auth-user` | **Neon Auth hesabı açar** (panelde kayıt ekranı yok). `--code` verilirse şirkete de bağlar. Geçici şifreyi basar. |
| `npm run list-auth-users` | Hesapları ve şirket eşlemelerini listeler; bağlanmamış olanları işaretler. |
| `npm run link-member` | Yöneticiyi Neon Auth kullanıcı kimliğine (UUID) bağlar. Bir auth kimliği yalnızca bir şirkete bağlanabilir; başka kimliğe taşımak `--force` ister. Var olmayan bir kimliğe bağlamaz (FK) ve net hata verir. |
| `npm run activate-company` | Şirketi canlıya alır — **üç kapı**: boş origin listesi, aktif araç sınıfı yokluğu, ve (`--force` olmadan) placeholder faktör → reddedilir. |
| `npm run seed-vehicle-classes` | Eksik placeholder sınıfları ekler, mevcutları ezmez. |
| `npm run setup-demo` | **Demo girişini tek komutla hazırlar** (Stay'deki "Demo panelini görüntüle"): `RNT-DEMO` şirketini oluşturur/aktifleştirir, panelin `.env.local`'indeki `DEMO_LOGIN_EMAIL`/`DEMO_LOGIN_PASSWORD` ile Neon Auth hesabını açar, hesabı **`demo_viewer` (salt okunur)** rolüyle bağlar ve son 60 güne yayılmış **temsili** etkileşim yazar. İdempotent; her çalıştırmada demo verisini bugünden geriye tazeler (`--no-refresh` ile kapatılır). Gerçek şirket koduna veri yazmayı reddeder. |

### Demo girişi (salt okunur)

```bash
# 1) Panelin .env.local dosyasına demo şifresini yazın (en az 12 karakter):
#      DEMO_LOGIN_PASSWORD=...
# 2) Migration 0009 (demo_viewer rolü) uygulanmış olmalı:
npm run migrate
# 3) Kurulum (Neon Console -> Auth -> "Sign-up with Email" açık olmalı):
npm run setup-demo
# 4) Çıktıdaki NEXT_PUBLIC_DEMO_WIDGET_KEY satırını panelin .env.local'ine yazın.
```

Salt okunurluk **sunucuda** uygulanır: global `DemoReadOnlyGuard`,
`demo_viewer` rolü için tüm POST/PATCH/PUT/DELETE isteklerini
`403 demo_read_only` ile reddeder (endpoint listesi değil, metot kuralı —
yeni bir yazma ucu otomatik kapalı doğar). Panel ayrıca demo girişinden sonra
rolü API'den doğrular; rol `demo_viewer` değilse oturumu kapatır.

### İlk şirket

```bash
npm run create-company -- --name "Pilot Araç Kiralama" --email yonetici@pilot.com --city Antalya --dry-run
npm run create-company -- --name "Pilot Araç Kiralama" --email yonetici@pilot.com --city Antalya
# Yönetici panelin giriş ekranından hesabını açsın, sonra kimliğini al:
#   SELECT id, email FROM neon_auth."user" ORDER BY "createdAt" DESC;
npm run link-member -- --code RNT-PILOTA --email yonetici@pilot.com --authUserId <uuid>
# allowed_origins'i doldur (Neon SQL Editor, sahip olarak):
#   UPDATE rental_companies SET allowed_origins = ARRAY['https://pilot.example'] WHERE company_code = 'RNT-PILOTA';
npm run activate-company -- --code RNT-PILOTA --force   # --force: faktörler hâlâ placeholder
```

---

## Testler

```bash
npm test
```

Testler sahte bir istemciye değil, **gerçek Postgres**'e karşı koşar: PGlite,
Postgres'in WASM derlemesidir ve süreç içinde çalışır (Docker/ağ gerekmez).
Üretimin **aynı** migration'ları uygulanır.

Test ortamı Neon'u birebir taklit eder (`test/pglite-db.ts`):
- Migration'lar **superuser olmayan** bir sahiple uygulanır (Neon'daki gibi).
- Uygulama sorguları her transaction'da `wheels_app` rolüyle çalışır ve
  harness bunu **her seferinde doğrular** — PGlite varsayılan olarak superuser
  bağlanır ve superuser RLS'i atlar; doğrulama olmasaydı testler RLS bozukken
  de yeşil yanardı.

| Dosya | Kanıtladığı |
|---|---|
| `test/security.spec.ts` | Filtresiz sorgularla RLS izolasyonu, fail-closed, yazma yasakları, definer fonksiyonlarının darlığı, açılış kontrolünün 4 bypass yolu |
| `test/app.e2e.spec.ts` | Gerçek HTTP: DI, ValidationPipe (fiyat manipülasyonu → 400), CORS, auth, zarf, widget→panel uçtan uca akış |
| `src/widget/widget.service.spec.ts` | Config/event/impact, sunucu-taraflı hesap, gerçek unique index üzerinde idempotency |
| `src/dashboard/dashboard.service.spec.ts` | Huni monotonluğu, karbon dedup, gerçek `timestamptz` ile timezone |
| `scripts/operator.core.spec.ts` | Operatör SQL'i, aktivasyon kapıları, auth bağlama kuralları (olmayan kimliğe bağlanmaz), şifre enjeksiyonu reddi |
| `src/common/carbon-estimate.spec.ts` | Karbon/tutar hesabı, clamp'ler, provenance |
| `src/config-guards.spec.ts` | Üretimde TLS ve https zorunluluğu, Neon Auth URL doğrulaması |
| `test/migrations.spec.ts` | Şema, Neon Auth açık VE kapalıyken kurulabiliyor; FK'in iki dalı ve ON DELETE SET NULL |
| `src/database/pg-database.spec.ts` | **Üretim sınıfının kendisi**, gerçek `pg` sürücüsü ve TCP üzerinden: ayrıcalıklı rolle bağlanınca açılmayı reddeder |

**Testlerin testi:** güvenlik testleri, RLS bilinçli olarak bozularak
doğrulandı (policy `USING (true)` + `UPDATE` yetkisi) — 7 test kırmızıya döndü.
Yani bu testler güvenliği gerçekten ölçüyor.

**Testlerin kanıtlayamadığı:** Neon'a özgü davranış (havuzlu bağlantı,
`neon_superuser`, gerçek şifreyle giriş). Bunu `setup-app-role` kurulum anında
**senin veritabanında** doğrular, ve uygulama her açılışta tekrar denetler.

---

## Dizin haritası

```
db/migrations/              0001-0007 ham SQL (sahip rolüyle uygulanır)
src/
  bootstrap.ts              createApp + configureApp (CORS, ValidationPipe, zarf, filter)
  app.module.ts             modul grafigi + global AuthGuard + throttler
  database/
    database.ts             PORT: withTenant / withoutTenant (servisler buna baglidir)
    pg-database.ts          uretim: node-postgres -> Neon, acilis guvenlik kontrolu
    rls-guard.ts            row_security_active() ile rol denetimi
  auth/
    token-verifier.ts       PORT + Neon Auth (jose/JWKS) implementasyonu
    auth.guard.ts           Bearer -> Neon Auth -> users eslemesi -> req.auth
  common/
    carbon-estimate.ts      ★ km x faktor -> CO2e -> tutar (tek hesap kaynagi)
    vehicle-factors.ts      placeholder faktorler (YALNIZCA seed icin)
    widget-cors.ts          sirket bazli origin allow-list (definer fonksiyonlariyla)
    rate-limit.store.ts     Upstash / bellek-ici paylasimli sayac
    ...
  widget/                   public yuzey (config / impact / events)
  dashboard/                kimlikli yuzey (ozet / karbon / huni / sirket / araclar)
scripts/                    operator CLI'lari (ince) + operator.core.ts (testli SQL)
test/
  pglite-db.ts              Neon'u taklit eden gercek-Postgres test ortami
api/index.js                Vercel serverless girisi
```

---

## Deploy notları

- Vercel girişi `api/index.js` **düz JS**'tir: esbuild `emitDecoratorMetadata`
  desteklemez, NestJS DI ona dayanır. TS önce `nest build` ile derlenir.
- `tsBuildInfoFile` `dist`'in içindedir — dışarıda kalırsa bayat cache
  `nest build`'in dist'i BOŞ bırakmasına yol açabilir.
- Üretimde `DATABASE_URL` `sslmode=require` içermezse uygulama açılmaz.
- Rate limit çok-instance ortamda bellek-içi sayaçla çalışmaz; Upstash gerekir.
- Testler `--experimental-vm-modules` ile koşar (PGlite'ın Node yerleşik
  modülleri için dinamik import'u). `npm test` bunu zaten ayarlar.

## Bilinçli olarak henüz yok

- **`PATCH`/yazma uçları yok** — Adım 1 salt-okunur. Panelde düzenleme
  ekranları geldiğinde dar `UPDATE` policy'leri ve yetkileri o adımda eklenecek.
- **Tahsilat/ödeme yok.** Faz 1 yalnızca etkileşim analitiğidir.
- **`widget_settings` için UI yok** — operatör SQL ile düzenler.
- **Oturum başına tek katkı.** Kullanıcı mesafeyi değiştirip tekrar onaylarsa
  ilk onay korunur (idempotency). Widget onaydan sonra kilitlendiği için normal
  akışta oluşmaz; "son onay kazansın" istenirse Adım 2'de `ON CONFLICT DO
  UPDATE` ile değiştirilebilir.
