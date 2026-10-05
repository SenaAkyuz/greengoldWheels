import Link from 'next/link';
import type { Metadata } from 'next';
import { publicApiBaseUrl } from '@/lib/api';
import { CustomerPreviewWidget, type PreviewVehicle } from '../components/CustomerPreviewWidget';

export const metadata: Metadata = {
  title: 'Widget Demo · Green Gold Wheels',
  description: 'Green Gold Wheels araç kiralama karbon katkı widget’ının canlı önizlemesi.',
};

// PUBLIC sayfa: oturum YOK, token YOK. Tek veri kaynağı widget'ın kendi public
// GET /widget/config çağrısıdır. Demo anahtarı tasarımı gereği public (embed
// kodunda zaten görünür) ve DEMO şirketine aittir.
export const dynamic = 'force-dynamic';

async function loadDemoVehicles(key: string): Promise<PreviewVehicle[]> {
  // Sunucudan (Origin'siz) public config — araç seçicisini doldurmak için.
  // Başarısız olursa önizleme yine çalışır; yalnızca seçici gizlenir.
  const api = (process.env.API_BASE_URL ?? publicApiBaseUrl()).replace(/\/+$/, '');
  try {
    const res = await fetch(`${api}/widget/config?key=${encodeURIComponent(key)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data?: { vehicle_classes?: { class_code: string; label_tr: string; co2e_per_km_kg: number }[] };
    };
    return (body.data?.vehicle_classes ?? []).map((v) => ({
      class_code: v.class_code,
      label_tr: v.label_tr,
      co2e_per_km_kg: String(v.co2e_per_km_kg),
    }));
  } catch {
    return [];
  }
}

export default async function DemoPage() {
  // Bu sayfa sunucuda çizilir (force-dynamic), anahtar prop olarak istemciye
  // geçer; bu yüzden NEXT_PUBLIC_ önekine gerek yok. Vercel, adında KEY geçen
  // NEXT_PUBLIC_ değişkenleri eklerken uyarı verdiği için sade ad (DEMO_WIDGET_KEY)
  // öncelikli; eski ad geriye uyumluluk için duruyor.
  const demoKey =
    process.env.DEMO_WIDGET_KEY || process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY;
  const vehicles = demoKey ? await loadDemoVehicles(demoKey) : [];

  return (
    <main className="min-h-full flex-1 bg-[#f5f7f3]">
      <header className="border-b border-[#dce4dc] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#064b3d] font-[Georgia] text-[#c9eb47]">
              G
            </span>
            <div className="leading-tight">
              <div className="text-[13px] font-bold tracking-[0.14em] text-[#12372c]">GREEN GOLD</div>
              <div className="text-[11px] text-neutral-500">Wheels · Widget Demo</div>
            </div>
          </div>
          <Link href="/login" className="gg-btn rounded-full">
            Paneli görüntüle
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="max-w-2xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#347866]">
            Müşteri deneyimi önizlemesi
          </div>
          <h1 className="mt-3 font-[Georgia] text-4xl font-medium tracking-tight text-[#102b22] sm:text-5xl">
            Kiralama müşterisinin gördüğü sürdürülebilirlik adımı
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#5e716a] sm:text-base">
            Green Gold Wheels widget’ı, kiralama şirketinin rezervasyon
            akışına küçük bir adım ekler: müşteri yolculuğunun tahmini karbon
            etkisini aracına ve mesafesine göre görür, dilerse bir katkı
            seçer. Aşağıdaki önizleme canlıdır — mesafeyi ve aracı değiştirip
            deneyin.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#dbe4dd] bg-white px-3.5 py-1.5 text-xs font-medium text-[#42605a]">
            Giriş yapmadan inceleyebilirsiniz — hesap gerekmez.
          </p>
        </div>

        <p className="gg-notice mt-7 px-5 py-3 text-xs leading-relaxed">
          Bu bir önizlemedir: ödeme alınmaz ve etkileşimler raporlara yansımaz.
        </p>

        {demoKey ? (
          <CustomerPreviewWidget publicKey={demoKey} apiBase={publicApiBaseUrl()} vehicles={vehicles} />
        ) : (
          <div className="mt-8 rounded-2xl border border-[#dbe4dd] bg-white p-8 text-center">
            <div className="font-[Georgia] text-xl text-[#102b22]">Demo şu an kullanılamıyor</div>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
              Widget önizlemesi geçici olarak devre dışı. Lütfen daha sonra
              tekrar deneyin ya da paneli görüntüleyin.
            </p>
          </div>
        )}

        <section aria-labelledby="nasil" className="mt-12">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#347866]">Üç adım</div>
          <h2 id="nasil" className="mt-2 font-[Georgia] text-3xl font-medium tracking-tight text-[#102b22]">
            Nasıl çalışır?
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                t: 'Müşteri tahmini etkiyi görür',
                d: 'Kiralanan aracın sınıfı ve tahmini mesafeyle yolculuğun karbon etkisi rezervasyon akışında gösterilir.',
              },
              {
                t: 'İsterse katkıyı seçer',
                d: 'Katkı tamamen isteğe bağlıdır; müşteri seçmeden de rezervasyona devam edebilir.',
              },
              {
                t: 'Şirket sonuçları panelden izler',
                d: 'Görüntülenme, seçim, dönüşüm ve tahmini CO₂ özeti kiralama şirketinin panelinde toplanır.',
              },
            ].map((s, i) => (
              <li key={s.t} className="gg-card p-5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#edf5ef] font-semibold tabular-nums text-[#1c6b58]">
                  {i + 1}
                </span>
                <div className="mt-3 text-sm font-semibold text-[#102b22]">{s.t}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-[#68766f]">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10 rounded-2xl border border-[#dbe4dd] bg-white px-6 py-6 sm:flex sm:items-center sm:justify-between">
          <div>
            <div className="font-[Georgia] text-lg text-[#102b22]">Şirket panelini görmek ister misiniz?</div>
            <p className="mt-1 text-sm text-neutral-500">
              Etkileşim, dönüşüm ve tahmini karbon özetini salt okunur demo
              hesabıyla inceleyin.
            </p>
          </div>
          <Link href="/login" className="gg-btn mt-4 rounded-full sm:mt-0">
            Paneli görüntüle
          </Link>
        </div>
      </div>
    </main>
  );
}
