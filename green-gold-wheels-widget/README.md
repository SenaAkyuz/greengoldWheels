# green-gold-wheels-widget

Kiralama şirketinin rezervasyon/ödeme sayfasına gömülen
`<green-gold-wheels-widget>` custom element'i. Vite + Preact + **Shadow DOM**;
tek IIFE dosyası (`~31 kB`, gzip `~12 kB`), host sayfanın hiçbir
bağımlılığına güvenmez.

Genel mimari için kök [`../README.md`](../README.md), API sözleşmesi için
[`../green-gold-wheels-api/README.md`](../green-gold-wheels-api/README.md).

---

## Gömme

```html
<script src="https://cdn.ornek.com/green-gold-wheels-widget.v1.js"></script>

<green-gold-wheels-widget
  data-key="<public_widget_key>"
  data-api="https://api.ornek.com"
  data-distance-km="350"
  data-vehicle-class="ekonomi-benzin"
  data-lang="tr"
></green-gold-wheels-widget>
```

| Nitelik | Zorunlu | İş |
|---|---|---|
| `data-key` | ✔ | Şirketin public widget anahtarı. Yoksa/geçersizse widget **hiç render etmez** ve host sayfayı bozmaz. |
| `data-api` | ✔ | API taban adresi. |
| `data-distance-km` | — | Rezervasyondan gelen tahmini mesafe (varsayılan 100). Kullanıcı değiştirebilir. |
| `data-vehicle-class` | — | Ön seçili araç sınıfı kodu. Verilmezse ilk sınıf seçilir. |
| `data-lang` | — | `tr` (varsayılan) \| `en` |
| `data-journey-id` | — | Host'un kendi ürettiği, **kişisel veri içermeyen** yolculuk kimliği. |
| `data-preview` | — | `"true"`: etkileşim çalışır, **hiçbir analitik event gitmez** (panel önizlemesi). |
| `data-tracker-only` | — | `"true"`: kart çizilmez, config çekilmez, görüntülenme gönderilmez; yalnızca `trackBookingContinue()` çalışır. |

`data-distance-km`, `data-vehicle-class` ve `data-lang` host tarafından
sonradan değiştirilirse widget kendini yeniden çizer.

---

## Tasarım: tanıtım maketinden devralınan görsel dil

Görsel dil `greengold-wheels-mvp` maketinden alındı — limon aksan (`#b9df38`),
koyu yeşil zemin/buton (`#06261d`), dairesel **impact orbit**, toggle switch,
Georgia başlıklar, tam genişlik koyu buton.

**Maketten bilinçli olarak AYRILAN iki yer:**

1. **Ölçü sistemi.** Makette her şey sabit 390px telefon çerçevesine göreydi.
   Widget gerçek bir rezervasyon sayfasına gömüldüğü için akışkan; dar
   kapsayıcıda (`@container`) tek sütuna düşer.
2. **"Güvenli ödeme · Doğrulanabilir iklim katkısı" satırı KALDIRILDI.** İki
   yönden de yanlış olurdu: widget **ödeme almaz** (Faz 1'de tercih kaydıdır)
   ve faktörler **henüz onaylanmamıştır**.

   Yerine önce bir metodoloji bloğu koymuştum (kaynak/yıl/kapsam + placeholder
   uyarısı); **Sena 2026-10-02'de bunun kaldırılmasını istedi** (sadeleştirme).
   Kartta kalan tek beyan: orbit etiketi **"TAHMİNİ KARBON ETKİSİ"** ve onay
   mesajındaki **"henüz herhangi bir ücret eklenmedi"**.

   Faktör provenance'ı kaybolmadı — `/widget/config` yanıtında, panelde
   (Adım 3) ve `activate-company` kapısında duruyor; placeholder faktörlü bir
   şirket hâlâ `--force` olmadan canlıya alınamıyor.

---

## Karbon hesabı: tek kaynak

```ts
import { estimateContribution } from '@wheels/carbon';
```

Bu alias **API'nin kaynak dosyasını doğrudan gösterir**
(`../green-gold-wheels-api/src/common/carbon-estimate.ts`) — kopya değil.
`carbon-estimate.ts` saf TypeScript olduğu için (NestJS/Node importu yok)
tarayıcı bundle'ına güvenle girer.

Neden önemli: kopyalasaydık widget'ın gösterdiği sayı ile sunucunun
veritabanına yazdığı sayı zamanla ayrışabilirdi. Bir test bunu kilitliyor —
*"gosterilen CO2 ve tutar, sunucunun hesabiyla BIREBIR ayni"*.

**Ama ekrandaki sayı veritabanına YAZILMAZ.** Event yalnızca girdileri taşır:

```json
{ "event_type": "...", "session_ref": "...",
  "metadata": { "distance_km": 350, "vehicle_class_code": "ekonomi-benzin" } }
```

Sunucu kendi faktör tablosundan yeniden hesaplar. `amount` veya
`estimated_co2e_kg` göndermek API tarafından **400** ile reddedilir. Bu ekran
bir önizlemedir, fiyatın kaynağı değil.

---

## Host callback sözleşmesi

Kullanıcı katkıyı onayladığında widget host sayfaya event yayınlar
(`bubbles: true, composed: true` — shadow sınırını geçer):

```js
document.addEventListener('greengold:contribution-selected', (e) => {
  const { session_ref, distance_km, vehicle_class_code, currency } = e.detail;
  // Kiralama şirketinin checkout'u devralır.
});
```

⚠️ **`detail` içinde TUTAR YOKTUR** ve bu bilinçlidir: istemcideki sayı
manipüle edilebilir. Tutarın tek doğru kaynağı API'dir — host sayfa onu kendi
backend'inden alır.

Widget "ödeme aldım / rezervasyon tamamlandı" **demez**; kontrolü şirkete devreder.

### Rezervasyona devam tıklaması

```js
document.querySelector('green-gold-wheels-widget')?.trackBookingContinue();
```

Rezervasyon onayı **değildir** — yalnızca tıklama sinyali. Şirket bazlı flag
kapalıysa API 400 döner; istek fire-and-forget gönderildiği için host sayfa
bunu görmez ve **navigasyon asla gecikmez**.

Butonun kartla aynı sayfada olmadığı durumlarda kartı `display:none` ile
saklamayın — o kart sahte görüntülenme üretip funnel'ı bozar. Bunun yerine
`data-tracker-only="true"` kullanın.

---

## Session davranışı

Her element örneği bir `session_ref` çözer: `data-journey-id` → first-party
`sessionStorage` → (engelliyse) rastgele. Üçüncü taraf çerez/izleme **yok**,
sekme kapanınca temizlenir. **Asla** e-posta/telefon/isim/rezervasyon numarası
içermez.

Her event tipi session başına **en fazla bir kez** gider (toggle'ı açıp
kapatmak sayaçları şişirmez). Element DOM'dan çıkıp tekrar eklenirse aynı
session sürer ve tek shadow root korunur.

---

## Geliştirme

```bash
npm install
npm run dev     # http://localhost:5174/demo/index.html
npm run build   # dist/green-gold-wheels-widget.v1.js
npm test        # 30 test, jsdom + gerçek Shadow DOM
```

`demo/index.html` hem dev sunucusunda (kaynaktan) hem dosyadan açıldığında
(build çıktısından) çalışır. İçinde API adresi + widget anahtarı girilebilen
bir panel, maketin telefon bağlamı ve host callback kaydı var.

### Testler neyi kanıtlıyor

Sahte bir bileşen değil, **gerçek custom element + gerçek Shadow DOM** (jsdom);
yalnızca `fetch` sahtelenir.

| Grup | Kanıt |
|---|---|
| Kurulum/izolasyon | Shadow root'ta render, host DOM'a sızmama, `data-key` yoksa no-op, geçersiz key'de sessizlik, yeniden bağlanmada tek shadow root |
| Hesap | Sunucuyla **birebir aynı** sayı, araç/mesafe değişiminde canlı güncelleme, alt sınır bildirimi, bant dışı mesafenin sıkıştırılması |
| Sadeleştirilmiş kart | Orbit etiketi tahmin diyor, metodoloji satırları **görünmüyor**, onayda "ücret eklenmedi", provenance akışta duruyor |
| Event | Session başına tek, **sonuç alanı taşımama**, preview'da hiç event, ağ hatasında host'un bozulmaması |
| Callback | Shadow sınırını geçme, **tutar taşımama** |
| Tracker-only | Kart/config/event yokluğu, yalnızca `trackBookingContinue()` |

---

## Bilinçli olarak yok

- **Ödeme yok.** Faz 1 yalnızca tercih + analitiktir.
- **Araç sınıfı yoksa render etmez** — hesap yapılamayan boş bir kart
  göstermektense görünmemek doğrudur.
- **Kart bir kez onaylanınca kilitlenir** (API de oturum başına tek onay
  kaydeder). "Son onay kazansın" davranışı istenirse hem widget hem API
  değişmeli.
