'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Widget'ın kiralama müşterisine nasıl göründüğünün CANLI önizlemesi.
 *
 * Gerçek widget bundle'ı yüklenir ve `data-preview="true"` ile çizilir:
 * etkileşim çalışır ama HİÇBİR analitik event gönderilmez (widget kuralı) ve
 * API panel origin'inden gelen POST'u zaten reddeder (sunucu kuralı). Yani bu
 * ekrandaki tıklamalar raporlara yansımaz.
 *
 * Sayılar widget'ın kendi `/widget/config` çağrısından gelir — panelde
 * değiştirdiğiniz faktör/fiyat burada (ve canlı sitede) bir sonraki
 * yüklemede otomatik görünür.
 */

// Panel bundle'ı kendi public/ klasöründen servis eder (npm run sync-widget).
const WIDGET_SRC =
  process.env.NEXT_PUBLIC_PREVIEW_WIDGET_SRC ?? '/green-gold-wheels-widget.v1.js';
const TAG = 'green-gold-wheels-widget';
const DEFINE_TIMEOUT_MS = 8000;

type LoadState = 'loading' | 'ready' | 'error';

export interface PreviewVehicle {
  class_code: string;
  label_tr: string;
  co2e_per_km_kg: string;
}

export function CustomerPreviewWidget({
  publicKey,
  apiBase,
  vehicles,
  pricing,
}: {
  publicKey: string;
  apiBase: string;
  vehicles: PreviewVehicle[];
  pricing?: { pricePerKg: string; minAmount: string; currency: string };
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<HTMLElement | null>(null);
  const [distanceKm, setDistanceKm] = useState(350);
  const [vehicle, setVehicle] = useState(vehicles[0]?.class_code ?? '');
  const [lang, setLang] = useState<'tr' | 'en'>('tr');
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);

  // Script'i yükle (zaten varsa tekrar ekleme; yalnızca tanımlanmasını bekle).
  useEffect(() => {
    let cancelled = false;
    const onFail = () => {
      if (!cancelled) setLoadState('error');
    };
    customElements
      .whenDefined(TAG)
      .then(() => {
        if (!cancelled) setLoadState('ready');
      })
      .catch(onFail);
    const timer = setTimeout(() => {
      if (!cancelled && !customElements.get(TAG)) onFail();
    }, DEFINE_TIMEOUT_MS);

    const existing = document.querySelector<HTMLScriptElement>('script[data-ggw-preview]');
    if (existing) {
      existing.addEventListener('error', onFail);
    } else if (!customElements.get(TAG)) {
      const s = document.createElement('script');
      s.src =
        attempt === 0
          ? WIDGET_SRC
          : `${WIDGET_SRC}${WIDGET_SRC.includes('?') ? '&' : '?'}retry=${attempt}`;
      s.async = true;
      s.dataset.ggwPreview = 'true';
      s.addEventListener('error', onFail);
      document.body.appendChild(s);
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
      existing?.removeEventListener('error', onFail);
    };
  }, [attempt]);

  const retry = useCallback(() => {
    document.querySelectorAll('script[data-ggw-preview]').forEach((el) => el.remove());
    setLoadState('loading');
    setAttempt((a) => a + 1);
  }, []);

  // Öğeyi bir kez oluştur; seçiciler attribute'ları CANLI günceller.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const el = document.createElement(TAG);
    el.setAttribute('data-key', publicKey);
    el.setAttribute('data-api', apiBase);
    el.setAttribute('data-preview', 'true');
    el.setAttribute('data-distance-km', String(distanceKm));
    if (vehicle) el.setAttribute('data-vehicle-class', vehicle);
    el.setAttribute('data-lang', lang);
    host.appendChild(el);
    elRef.current = el;
    return () => {
      el.remove();
      elRef.current = null;
    };
    // distance/vehicle/lang bilerek dışarıda: aşağıda setAttribute ile canlı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, apiBase, loadState]);

  useEffect(() => {
    elRef.current?.setAttribute('data-distance-km', String(distanceKm));
  }, [distanceKm]);
  useEffect(() => {
    if (vehicle) elRef.current?.setAttribute('data-vehicle-class', vehicle);
  }, [vehicle]);
  useEffect(() => {
    elRef.current?.setAttribute('data-lang', lang);
  }, [lang]);

  const selected = vehicles.find((v) => v.class_code === vehicle);

  return (
    <div className="mt-7 grid gap-6 xl:grid-cols-[250px_1fr]">
      <div className="space-y-4">
        <div className="gg-card h-fit p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#347866]">
            Önizleme kontrolleri
          </div>
          <h2 className="mt-2 font-[Georgia] text-xl font-medium text-[#102b22]">
            Yolculuk ayarları
          </h2>

          <label htmlFor="pv-distance" className="mb-1.5 mt-4 block text-sm font-medium text-neutral-700">
            Tahmini mesafe (km)
          </label>
          <input
            id="pv-distance"
            type="number"
            min={1}
            max={20000}
            value={distanceKm}
            onChange={(e) =>
              setDistanceKm(
                Math.min(20000, Math.max(1, Math.round(Number(e.currentTarget.value) || 1))),
              )
            }
            className="gg-input"
          />

          {vehicles.length > 0 && (
            <>
              <label htmlFor="pv-vehicle" className="mb-1.5 mt-4 block text-sm font-medium text-neutral-700">
                Rezervasyondaki araç
              </label>
              <select
                id="pv-vehicle"
                value={vehicle}
                onChange={(e) => setVehicle(e.currentTarget.value)}
                className="gg-input"
              >
                {vehicles.map((v) => (
                  <option key={v.class_code} value={v.class_code}>
                    {v.label_tr}
                  </option>
                ))}
              </select>
            </>
          )}

          <span className="mb-1.5 mt-4 block text-sm font-medium text-neutral-700">Dil</span>
          <div className="inline-flex rounded-lg border border-neutral-300 p-0.5">
            {(['tr', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={
                  'min-h-[44px] rounded-md px-4 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#5c9f80]/40 ' +
                  (lang === l ? 'bg-[#075442] text-white' : 'text-neutral-600 hover:bg-neutral-50')
                }
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {selected && pricing && (
          <div className="gg-card p-5 text-xs leading-relaxed text-[#3d4a45]">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#347866]">
              Hesap nereden geliyor?
            </div>
            <p className="mt-2">
              <strong>{distanceKm.toLocaleString('tr-TR')} km</strong> ×{' '}
              <strong>{Number(selected.co2e_per_km_kg).toLocaleString('tr-TR')} kg CO₂e/km</strong>{' '}
              ({selected.label_tr})
            </p>
            <p className="mt-1.5">
              Katkı = max({pricing.minAmount} {pricing.currency}, CO₂e ×{' '}
              {pricing.pricePerKg} {pricing.currency})
            </p>
            <p className="mt-2 text-[#68766f]">
              Faktörler <em>Araç Sınıfları</em>, fiyat <em>Ayarlar</em>{' '}
              ekranından gelir; değiştirdiğinizde widget otomatik günceller.
            </p>
          </div>
        )}
      </div>

      {/* Temsili kiralama checkout çerçevesi — TAMAMI GÖRSEL KABUKTUR.
          İşlevsel olan tek parça, içindeki gerçek widget önizlemesidir. */}
      <div className="gg-card overflow-hidden">
        <div className="flex h-11 items-center gap-2 border-b border-[#dde4de] bg-[#eef1ee] px-3 sm:px-4">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#ef9c88]" />
          <span className="hidden h-2.5 w-2.5 shrink-0 rounded-full bg-[#e4c16f] sm:block" />
          <span className="hidden h-2.5 w-2.5 shrink-0 rounded-full bg-[#83c59f] sm:block" />
          <span className="ml-1 min-w-0 flex-1 truncate rounded-md bg-white px-3 py-1.5 text-center text-[9px] text-[#7f8a84] shadow-sm sm:ml-3">
            rezervasyon.kiralamasirketiniz.com
          </span>
        </div>
        <div className="border-b border-[#e7ebe7] px-5 py-5 sm:px-7">
          <div className="font-[Georgia] text-lg tracking-[0.18em] text-[#17372d] sm:text-xl">
            KİRALAMA ŞİRKETİNİZ
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[#84918b]">
            Araç kiralama · Güvenli ödeme
          </div>
        </div>

        <CheckoutSteps />

        <div className="bg-white p-5 sm:p-10">
          <div className="mb-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#347866]">
              Kiralama özeti
            </div>
            <h3 className="mt-2 font-[Georgia] text-2xl font-medium text-[#102b22]">
              Rezervasyonunuzu tamamlayın
            </h3>
            <p className="mt-1 text-xs text-[#77847e]">
              {selected?.label_tr ?? 'Araç'} · 3 gün · tahmini{' '}
              {distanceKm.toLocaleString('tr-TR')} km
            </p>
          </div>

          <div className="max-w-2xl rounded-xl border-2 border-dashed border-[#a8cbb6] bg-[#fbfcfb] p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#347866]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#347866]">
                Green Gold adımı
              </span>
            </div>

            {loadState === 'error' ? (
              <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                <p className="text-sm font-semibold text-amber-900">Önizleme yüklenemedi</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-amber-800">
                  Widget dosyasına ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.
                </p>
                <button type="button" onClick={retry} className="gg-btn mt-4">
                  Yeniden dene
                </button>
              </div>
            ) : (
              <>
                {loadState === 'loading' && (
                  <p className="px-1 py-2 text-xs text-[#77847e]" role="status">
                    Önizleme yükleniyor…
                  </p>
                )}
                <div ref={hostRef} />
              </>
            )}
          </div>

          {/* Temsili ödeme alanları — gerçek ödeme alanı DEĞİLDİR. */}
          <div className="mt-5 max-w-2xl" aria-hidden="true">
            <div className="grid gap-3 sm:grid-cols-2">
              <FakeField label="Kart bilgileri" />
              <FakeField label="Fatura adresi" />
            </div>
            <div className="mt-3 h-11 rounded-lg bg-[#dfe6e0]" />
          </div>
          <p className="mt-2 max-w-2xl text-[11px] text-[#8b968f]">
            Bu sayfada ödeme alınmaz.
          </p>
        </div>
      </div>
    </div>
  );
}

const STEPS = ['Araç', 'Tarih & Yer', 'Green Gold', 'Ödeme', 'Onay'] as const;
const ACTIVE_STEP = 2;

function CheckoutSteps() {
  return (
    <nav aria-label="Kiralama adımları" className="border-b border-[#e7ebe7] bg-[#f7f9f7] px-3 py-3 sm:px-7">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {STEPS.map((label, i) => {
          const isActive = i === ACTIVE_STEP;
          const isDone = i < ACTIVE_STEP;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
                  (isActive
                    ? 'bg-[#075442] text-white'
                    : isDone
                      ? 'bg-[#e2efe6] text-[#2f6b58]'
                      : 'bg-white text-[#8b968f] ring-1 ring-[#e1e6e2]')
                }
              >
                <span className="tabular-nums">{i + 1}</span>
                {label}
                {isActive && <span className="sr-only">(bulunduğunuz adım)</span>}
                {isDone && <span className="sr-only">(tamamlandı)</span>}
              </span>
              {i < STEPS.length - 1 && (
                <span aria-hidden="true" className="text-[#c3cec7]">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function FakeField({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-[#e1e6e2] bg-white px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.14em] text-[#a3ada7]">{label}</div>
      <div className="mt-1.5 h-3 w-2/3 rounded bg-[#eef1ee]" />
    </div>
  );
}
