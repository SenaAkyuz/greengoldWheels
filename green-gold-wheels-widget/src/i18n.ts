import type { ContentOverrides, Lang } from './types';

interface Strings {
  heading: string;
  subheading: (company: string) => string;
  vehicleLabel: string;
  distanceLabel: string;
  distanceUnit: string;
  impactLabel: string;
  formula: (km: string, factor: string) => string;
  checkboxLabel: string;
  totalLabel: string;
  addButton: string;
  confirmation: string;
  previewBadge: string;
  impactLine: (co2: string, trees: string) => string;
  minApplied: (amount: string) => string;
}

/**
 * DÜRÜSTLÜK NOTU — bu metinlerin tasarım kuralı:
 * Widget karbon kredisi SATMAZ, offset ÜRETMEZ, ödeme ALMAZ. Yalnızca
 * kullanıcının bir tercihini kaydeder ve host sayfaya bildirir. "Karbon nötr",
 * "dengelendi", "sıfırlandı" gibi doğrulanmamış iddialar YOKTUR — ve araç
 * faktörleri henüz `placeholder` olduğu için tahmin vurgusu daha da güçlüdür.
 */
export const I18N: Record<Lang, Strings> = {
  tr: {
    heading: 'Yolculuğunun karbon etkisini dengele',
    subheading: (company) =>
      `${company} ile birlikte bir iklim katkısı tercihi.`,
    vehicleLabel: 'Araç tipi',
    distanceLabel: 'Tahmini yolculuk mesafesi',
    distanceUnit: 'km',
    impactLabel: 'Tahmini karbon etkisi',
    formula: (km, factor) => `${km} km × ${factor} kg CO₂e/km`,
    checkboxLabel: 'Bu katkıyı tercih ediyorum',
    totalLabel: 'Toplam katkı',
    addButton: 'Tercihimi kaydet',
    confirmation:
      'Tercihinizi kaydettik. Kiralamanıza henüz herhangi bir ücret eklenmedi.',
    previewBadge: 'Önizleme',
    impactLine: (co2, trees) =>
      `Bu ay bu şirkette tahmini ≈ ${co2} kg CO₂e (≈ ${trees} ağaç-yılı)`,
    minApplied: (amount) => `En düşük katkı tutarı uygulandı (${amount}).`,
  },
  en: {
    heading: 'Offset your trip’s carbon impact',
    subheading: (company) =>
      `A climate contribution preference with ${company}.`,
    vehicleLabel: 'Vehicle type',
    distanceLabel: 'Estimated trip distance',
    distanceUnit: 'km',
    impactLabel: 'Estimated carbon impact',
    formula: (km, factor) => `${km} km × ${factor} kg CO₂e/km`,
    checkboxLabel: 'I would like to make this contribution',
    totalLabel: 'Total contribution',
    addButton: 'Save my preference',
    confirmation:
      'Your preference has been recorded. No charge has been added to your rental.',
    previewBadge: 'Preview',
    impactLine: (co2, trees) =>
      `This month, estimated ≈ ${co2} kg CO₂e at this company (≈ ${trees} tree-years)`,
    minApplied: (amount) => `Minimum contribution amount applied (${amount}).`,
  },
};

/**
 * Yalnızca bu alanlar şirket bazlı override edilebilir (bkz. API
 * src/common/widget-settings.ts). Karbon/tahmin iddiası taşıyan metinler
 * (subheading, impactLabel, impactLine...) KASITLI OLARAK override edilemez — bir şirketin
 * yanıltıcı bir dürüstlük iddiası eklemesini mimari olarak imkânsız kılar.
 */
export type OverridableField =
  | 'heading'
  | 'checkboxLabel'
  | 'addButton'
  | 'confirmation';

/**
 * Metin çözümleme sırası: şirketin doğrulanmış override'ı -> güvenli platform
 * varsayılanı. Yalnızca BU dile ait override kullanılır (tenant-safe: config
 * zaten tek şirketten gelir).
 */
export function resolveStrings(
  lang: Lang,
  overrides?: ContentOverrides | null,
): Strings {
  const base = I18N[lang];
  const o = overrides?.[lang];
  if (!o) return base;
  return {
    ...base,
    heading: o.heading || base.heading,
    checkboxLabel: o.checkboxLabel || base.checkboxLabel,
    addButton: o.addButton || base.addButton,
    confirmation: o.confirmation || base.confirmation,
  };
}
