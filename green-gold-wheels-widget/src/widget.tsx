import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { estimateContribution, type VehicleFactor } from '@wheels/carbon';
import type { Lang, WidgetConfig, WidgetImpact } from './types';
import { resolveStrings } from './i18n';

interface Props {
  config: WidgetConfig;
  /** Host sayfanın verdiği başlangıç mesafesi (rezervasyondan). */
  initialDistanceKm: number;
  /** Host sayfanın ön seçtiği araç sınıfı kodu (varsa). */
  initialVehicleCode?: string;
  lang: Lang;
  /** Araç sınıfı seçildiğinde/değiştiğinde. */
  onVehicleChange: (classCode: string) => void;
  /** Katkı kutusu İLK kez açıldığında. */
  onSelect: (input: EstimateInput) => void;
  /** "Katkıyı ekle" butonuna basılınca. */
  onAdd: (input: EstimateInput) => void;
  preview?: boolean;
  impact?: WidgetImpact | null;
}

/** Event'e giden GİRDİLER — sonuç alanları değil (API yeniden hesaplar). */
export interface EstimateInput {
  distance_km: number;
  vehicle_class_code: string;
}

const MIN_KM = 1;
const MAX_KM = 20_000;

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg class="leaf" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20c0-8 6-14 16-14 0 10-6 14-14 14"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M8 16c3-3 6-4.5 9-5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;
/** Yalnızca katı hex CSS değişkenine yazılır — ham string style'a ASLA girmez. */
function accentStyle(color: string | null | undefined): string | undefined {
  return color && HEX6.test(color) ? `--gg-accent:${color}` : undefined;
}
function safeHttpsLogo(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function formatMoney(value: number, currency: string, lang: Lang): string {
  const locale = lang === 'tr' ? 'tr-TR' : 'en-GB';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function Widget({
  config,
  initialDistanceKm,
  initialVehicleCode,
  lang,
  onVehicleChange,
  onSelect,
  onAdd,
  preview,
  impact,
}: Props) {
  const t = resolveStrings(lang, config.content_overrides);
  const locale = lang === 'tr' ? 'tr-TR' : 'en-GB';
  const classes = config.vehicle_classes;

  const [vehicleCode, setVehicleCode] = useState(
    () =>
      classes.find((c) => c.class_code === initialVehicleCode)?.class_code ??
      classes[0]?.class_code ??
      '',
  );
  // Mesafe metin olarak tutulur: kullanıcı alanı temizlediğinde kutu "1"e
  // zıplamaz. Hesap için sayıya çevrilir ve banda sıkıştırılır.
  const [distanceText, setDistanceText] = useState(() =>
    String(clampKm(initialDistanceKm)),
  );
  const [checked, setChecked] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  /**
   * Host sayfa girdiyi SONRADAN değiştirirse (müşteri rezervasyon formunda
   * aracı ya da güzergâhı değiştirdi) kart onu izler — host'un verdiği değer
   * en güncel gerçektir. İlk render'daki değer zaten state'te olduğu için
   * yalnızca DEĞİŞİMDE çalışır.
   *
   * Önceki onay sıfırlanır: müşteri eski mesafe/araçla onayladığı tutarı yeni
   * yolculuk için onaylamış sayılmasın. Yeniden onaylarsa host yeni
   * `greengold:contribution-selected` event'ini alır (analitik event'i
   * session başına yine tek kalır).
   */
  const lastHostInput = useRef({ km: initialDistanceKm, code: initialVehicleCode });
  useEffect(() => {
    const prev = lastHostInput.current;
    if (prev.km === initialDistanceKm && prev.code === initialVehicleCode) return;
    lastHostInput.current = { km: initialDistanceKm, code: initialVehicleCode };

    if (prev.km !== initialDistanceKm) {
      setDistanceText(String(clampKm(initialDistanceKm)));
    }
    if (prev.code !== initialVehicleCode) {
      const match = classes.find((c) => c.class_code === initialVehicleCode);
      if (match) setVehicleCode(match.class_code);
    }
    setConfirmed(false);
  }, [initialDistanceKm, initialVehicleCode, classes]);

  const vehicle = classes.find((c) => c.class_code === vehicleCode);
  const distanceKm = clampKm(Number(distanceText));

  /**
   * ★ Hesap, API'nin kullandığı FONKSİYONUN AYNISI (`@wheels/carbon` alias'ı
   * doğrudan API kaynağını gösterir). Widget'ta gösterilen sayı ile sunucunun
   * veritabanına yazdığı sayı bu yüzden ayrışamaz.
   *
   * Yine de burada gösterilen değer veritabanına YAZILMAZ: event yalnızca
   * mesafe + araç kodu taşır, sunucu kendi faktör tablosundan yeniden
   * hesaplar. Bu ekran bir önizlemedir, fiyatın kaynağı değil.
   */
  const estimate = useMemo(() => {
    if (!vehicle) return null;
    const factor: VehicleFactor = {
      class_code: vehicle.class_code,
      co2e_per_km_kg: vehicle.co2e_per_km_kg,
      factor_source: vehicle.factor_source,
      factor_country: vehicle.factor_country,
      factor_year: vehicle.factor_year,
      factor_scope: vehicle.factor_scope,
    };
    return estimateContribution(distanceKm, factor, {
      price_per_kg_co2e: config.price_per_kg_co2e,
      min_contribution_amount: config.min_contribution_amount,
      currency: config.currency,
    });
  }, [vehicle, distanceKm, config]);

  if (!vehicle || !estimate) {
    // Araç sınıfı yoksa hesap yapılamaz -> hiç render etme (host sayfada
    // anlamsız boş bir kart bırakmaktansa görünmemek doğrudur).
    return null;
  }

  const money = (v: number) => formatMoney(v, config.currency, lang);
  const fmt = (n: number, digits = 0) =>
    n.toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  const input: EstimateInput = {
    distance_km: distanceKm,
    vehicle_class_code: vehicle.class_code,
  };

  // Alt sınır devreye girdi mi? (ham tutar < taban)
  const rawAmount = estimate.estimated_co2e_kg * config.price_per_kg_co2e;
  const minApplied =
    estimate.amount > 0 && rawAmount < config.min_contribution_amount;

  const handleVehicle = (e: Event) => {
    const code = (e.currentTarget as HTMLSelectElement).value;
    setVehicleCode(code);
    onVehicleChange(code);
  };

  const handleToggle = (e: Event) => {
    const next = (e.currentTarget as HTMLInputElement).checked;
    setChecked(next);
    if (next) onSelect(input);
  };

  const handleAdd = () => {
    if (!checked || confirmed) return;
    onAdd(input);
    setConfirmed(true);
  };

  const showImpact =
    !!config.show_estimated_impact && !!impact && impact.estimated_co2e_kg > 0;

  return (
    <div class="card" part="card" style={accentStyle(config.brand_color)}>
      {preview && <span class="preview-badge">{t.previewBadge}</span>}

      <p class="kicker">
        {safeHttpsLogo(config.logo_url) ? (
          <img class="logo" src={safeHttpsLogo(config.logo_url)!} alt="" />
        ) : (
          <LeafIcon />
        )}
        <span>{config.company_name}</span>
      </p>
      <h2 class="heading">{t.heading}</h2>
      <p class="copy">{t.subheading(config.company_name)}</p>

      <div class="orbit" role="group" aria-label={t.impactLabel}>
        <span class="orbit-label">{t.impactLabel}</span>
        <strong class="orbit-value" aria-live="polite">
          {fmt(estimate.estimated_co2e_kg, 1)}
        </strong>
        <small class="orbit-unit">kg CO₂e</small>
      </div>

      <div class="calculation">
        <p class="formula">
          {t.formula(fmt(distanceKm), fmt(vehicle.co2e_per_km_kg, 3))}
        </p>

        <div class="fields">
          <label class="field">
            <span>{t.vehicleLabel}</span>
            <select
              value={vehicleCode}
              disabled={confirmed}
              onChange={handleVehicle}
            >
              {classes.map((c) => (
                <option key={c.class_code} value={c.class_code}>
                  {lang === 'tr' ? c.label_tr : c.label_en}
                </option>
              ))}
            </select>
          </label>

          <label class="field distance">
            <span>{t.distanceLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_KM}
              max={MAX_KM}
              step="1"
              value={distanceText}
              disabled={confirmed}
              onInput={(e) =>
                setDistanceText((e.currentTarget as HTMLInputElement).value)
              }
            />
            <span class="unit">{t.distanceUnit}</span>
          </label>
        </div>
      </div>

      {!confirmed && (
        <label class="contribution">
          <span>
            <b>{t.checkboxLabel}</b>
            <span class="amount">+ {money(estimate.amount)}</span>
          </span>
          <input type="checkbox" checked={checked} onChange={handleToggle} />
          <i class="switch" aria-hidden="true" />
        </label>
      )}

      {minApplied && !confirmed && (
        <p class="note">{t.minApplied(money(config.min_contribution_amount))}</p>
      )}

      {!confirmed && (
        <button
          type="button"
          class="primary"
          disabled={!checked}
          onClick={handleAdd}
        >
          <span>{t.addButton}</span>
          <span class="arrow" aria-hidden="true">
            →
          </span>
        </button>
      )}

      {confirmed && (
        <div class="confirm" role="status" aria-live="polite">
          <span class="check">
            <CheckIcon />
          </span>
          <span>{t.confirmation}</span>
        </div>
      )}

      {/* Kartta ayrı bir metodoloji bloğu YOK (Sena'nın kararı, 2026-10-02):
          kullanıcı sadeleştirme istedi. "Tahmini" bilgisi kaybolmuyor —
          orbit etiketi zaten "TAHMİNİ KARBON ETKİSİ" diyor ve onay mesajı
          ücret eklenmediğini açıkça söylüyor.

          Faktörün kaynağı/yılı/kapsamı ve "onaylanmamış" durumu API'de ve
          panelde (Adım 3) duruyor; activate-company hâlâ placeholder faktörlü
          bir şirketi --force olmadan canlıya almıyor. */}

      {showImpact && impact && (
        <p class="impact-line">
          {t.impactLine(
            fmt(impact.estimated_co2e_kg, 1),
            fmt(impact.tree_equivalent, 1),
          )}
        </p>
      )}
    </div>
  );
}

/** Mesafeyi UI bandına çeker (sunucu da aynısını yapar — orası son söz). */
function clampKm(raw: number): number {
  if (!Number.isFinite(raw)) return MIN_KM;
  return Math.min(MAX_KM, Math.max(MIN_KM, Math.round(raw)));
}
