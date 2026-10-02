# Green Gold Wheels

Araç kiralama rezervasyon/ödeme akışına eklenen bir **karbon katkısı widget'ı**
ve bunun etkileşimlerini kiralama şirketine gösteren **yönetim paneli**.

> **Dürüstlük notu:** Gösterilen karbon değerleri **tahminidir**; doğrulanmış
> bir karbon dengelemesi (offset) **değildir**. Araç emisyon faktörleri şu an
> `factor_source = 'placeholder'` ile işaretlidir ve Green Gold metodoloji onayı
> olmadan gerçek bir kiralama şirketine sunulmamalıdır. Widget'taki "katkıyı
> onayla" tıklaması bir ödeme veya rezervasyon onayı **değildir**.

---

## Yığın

| Katman | Seçim | Neden |
|---|---|---|
| Veritabanı | **Neon** (Postgres) | Free planda 100 izole proje — her yeni ürün kendi veritabanını alır, slot savaşı yok. Askıya alınan compute kendiliğinden geri gelir. |
| Kimlik | **Neon Auth** (Managed Better Auth) | Aynı sağlayıcı, ek hesap yok. Kullanıcılar **senin kendi Postgres'inde** (`neon_auth` şeması) → eşleme gerçek bir foreign key. Free planda 60.000 aylık kullanıcı. Standart Better Auth şeması olduğu için Neon'dan çıkarsan aynı tablolarla kendin barındırırsın. |
| API | NestJS 11 + `pg` | Standart Postgres protokolü — Neon'a kilitlemez; herhangi bir Postgres'e değişmeden bağlanır. |

Bu yığın **gelecekteki projelerin şablonudur**: yeni ürün = yeni Neon projesi
(Auth dahil) + bu repodaki güvenlik modeli.

> **Bilinen sınır:** Neon Auth henüz kayıt kapatmaya ve MFA'ya izin vermiyor.
> Erişimin kapısı kayıt ekranı değil `users` eşlemesi olduğu için bu bir veri
> sızıntısı değil — ayrıntı ve testi için API README'sindeki
> [Kimlik bölümü](green-gold-wheels-api/README.md#kimlik-neon-auth--managed-better-auth).

---

## Stay'den temel fark: mesafe bazlı model

Green Gold Stay (otel) "oda × gece × gece-başı katsayı" ile hesaplar. Wheels
**mesafe bazlı** çalışır:

```
tahmini CO₂e (kg) = mesafe (km) × araç faktörü (kg CO₂e/km)
katkı tutarı      = max(alt sınır, CO₂e × kg-başı fiyat)
```

- **Katsayı araç sınıfına ait** (`vehicle_classes`). Faktörün kaynağı, ülkesi,
  yılı ve kapsamı **NOT NULL** — kaynağı belirtilmemiş faktör veritabanına
  yazılamaz. Elektrikli araçlar zorunlu olarak `well_to_wheel` (şebeke
  karışımı); aksi halde "sıfır emisyon" gibi görünürdü.
- **Hesap sunucuda.** İstemci yalnızca mesafe + araç kodu gönderir; tutar veya
  CO₂ gönderirse **400**. Panelde görünen her sayının kaynağı API'dir.

---

## Güvenlik — kısa özet

Ayrıntı: [`green-gold-wheels-api/README.md`](green-gold-wheels-api/README.md).

- **İki katlı tenant izolasyonu:** kodda `company_id` filtresi + veritabanında
  Row Level Security. Kod hata yapsa bile veritabanı başka şirketin satırını
  döndürmez — filtresiz sorgularla test edildi.
- **Uygulama kısıtlı bir rolle** (`wheels_app`) bağlanır; yanlış rolle
  bağlanırsa **açılmaz**.
- **Kimlik Neon Auth'ta**, şirket üyeliği bizim tablomuzda; eşleme yalnızca
  auth kullanıcı kimliğiyle (UUID), e-postayla asla. Bağlanmamış kullanıcı 401
  alır — kendi kendine kayıt olan biri hiçbir veri göremez.
- **Tablo sahibinin adresi** (`DATABASE_URL_OWNER`) yalnızca operatörün
  makinesinde durur, Vercel'e gitmez.

Supabase sürümüne göre bu bir **iyileştirme**: orada API `service_role` ile
bağlanıp RLS'i tamamen atlıyordu — tek bir unutulmuş `WHERE` şirketler arası
sızıntı demekti.

---

## Parçalar

| Parça | Durum |
|---|---|
| `green-gold-wheels-api` | **Adım 1 tamam** — 179 test, gerçek Postgres üzerinde |
| `green-gold-wheels-widget` | Adım 2 — planlandı (Vite + Preact + Shadow DOM) |
| `green-gold-wheels-panel` | Adım 3 — planlandı (Next.js 16 + Neon Auth) |
| `greengold-wheels-mvp` | Tanıtım maketi — dokunulmuyor |

### `greengold-wheels-mvp` nedir, ne değildir

Bir **web sitesi**dir ve içine CSS ile bir **telefon çerçevesi** çizer —
*site*, ama *uygulama görüntüsü* gösteriyor. Satış malzemesi olarak iyi,
ürün mimarisi olarak yanıltıcı. Gerçek widget, şirketin **sitesindeki**
rezervasyon akışına gömülür (mobil tarayıcıda responsive); şirketin native
mobil uygulamasına bir web component olarak giremez. App desteği ayrı bir faz
kararıdır (WebView ya da REST + native arayüz).

---

## Kurulum

[`green-gold-wheels-api/README.md` → Kurulum](green-gold-wheels-api/README.md#kurulum)

Kısaca: Neon projesi aç → **Auth'u etkinleştir** → `.env` (yalnızca
`DATABASE_URL_OWNER` + `NEON_AUTH_BASE_URL`) → `npm run migrate` →
`npm run setup-app-role` → `npm test`.

---

## Kasıtlı tasarım kararları

- **Huni 3 aşamalı, `arac_secildi` dahil değil.** Araç host sayfada ön seçili
  gelebilir; aşama yapmak huniyi monotonluktan çıkarırdı. Yan sinyal olarak
  raporlanır.
- **Hesaplanamayan oturumlar sayı uydurmaz**, `missing_estimate_count` ile
  ayrıca raporlanır.
- **Sıfır emisyon tahmini → sıfır katkı** (alt sınır yalnızca CO₂ > 0 iken).
- **Anlamsız mesafe MIN'e düşer, MAX'a değil** — en yüksek ücreti üretmesin.
- **Askıya alınmış şirketin** origin'i CORS'u geçemez, yöneticisi panele
  giremez (403).

## Sıradaki adımlar

- **Adım 2 — widget:** araç seçici, mesafe girişi, canlı CO₂/tutar, katkı
  onayı, host callback event'i.
- **Adım 3 — panel:** Neon Auth girişi (kayıt ekranı YOK), genel bakış, huni, karbon, araç
  sınıfı/faktör yönetimi, origin listesi, embed kodu.
- **Metodoloji:** placeholder faktörlerin onaylı kaynakla değiştirilmesi —
  canlıya almanın ön koşulu.

## Git

Bu klasör kendi git repo'sudur (branch `master`). Üst dizindeki
`C:\Users\Monster` repo'su (`madlab.git`) **kullanılmaz**. `.env` ve `.vercel`
gitignore'ludur.
