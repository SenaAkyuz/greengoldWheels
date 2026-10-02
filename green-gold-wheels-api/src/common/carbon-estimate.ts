/**
 * WHEELS'IN ÇEKİRDEĞİ — mesafe bazlı tahmini karbon hesabı.
 *
 *   tahmini CO₂e (kg) = mesafe (km) × araç faktörü (kg CO₂e/km)
 *   katkı tutarı      = max(min_contribution_amount, CO₂e × price_per_kg_co2e)
 *
 * Stay'den temel fark: Stay "oda × gece × gece-başı katsayı" ile çalışır ve
 * katsayı otel satırındadır. Wheels'ta katsayı ARAÇ SINIFINA aittir
 * (vehicle_classes) ve mesafe her yolculukta değişir.
 *
 * ⚠️ İKİ DÜRÜSTLÜK KURALI — bu modülün var oluş sebebi:
 *
 * 1. HESAP HER ZAMAN SUNUCUDA YAPILIR. Widget ekranda bir sayı gösterir ama o
 *    sayı DB'ye yazılmaz; event geldiğinde API faktörü kendi tablosundan okuyup
 *    yeniden hesaplar. İstemciden gelen tutar/CO₂ alanları DTO tarafından
 *    reddedilir (forbidNonWhitelisted). Böylece panelde görünen her sayının
 *    kaynağı API'dir — manipüle edilemez.
 *
 * 2. FAKTÖR PROVENANCE'I HESABIN PARÇASIDIR. Her sonuç, kullanılan faktörün
 *    kaynağını/ülkesini/yılını/kapsamını birlikte taşır. `factor_source`
 *    'placeholder' ise sonuç `is_estimated: true` olur ve "tahmini" ibaresi
 *    zorunludur. Kaynağı olmayan bir faktör DB'ye bile yazılamaz (0002 migration
 *    NOT NULL + CHECK kısıtları).
 */

export type FactorScope = 'tank_to_wheel' | 'well_to_wheel';

/** Kaynağı onaylanmamış faktörleri işaretleyen özel değer. */
export const PLACEHOLDER_FACTOR_SOURCE = 'placeholder';

/**
 * Mesafe sınırları. Üst sınır veri girişi/spoof savunmasıdır: 20.000 km'lik
 * bir kiralama yolculuğu gerçek değildir, ama sınırsız kabul etmek tek bir
 * event'le aylık karbon toplamını anlamsız hale getirebilirdi.
 */
export const MIN_DISTANCE_KM = 1;
export const MAX_DISTANCE_KM = 20_000;

/** Faktör akla yatkınlık bandı — 0002 migration'daki CHECK ile aynı (savunma katmanı). */
export const MIN_FACTOR_PER_KM = 0;
export const MAX_FACTOR_PER_KM = 2;

export interface VehicleFactor {
  class_code: string;
  co2e_per_km_kg: number;
  factor_source: string;
  factor_country: string;
  factor_year: number;
  factor_scope: FactorScope;
}

export interface ContributionPricing {
  price_per_kg_co2e: number;
  min_contribution_amount: number;
  currency: string;
}

/** Hesabın tam sonucu — event metadata'sına birebir bu yazılır. */
export interface CarbonEstimate {
  distance_km: number;
  vehicle_class_code: string;
  co2e_per_km_kg: number;
  estimated_co2e_kg: number;
  amount: number;
  currency: string;
  factor_source: string;
  factor_country: string;
  factor_year: number;
  factor_scope: FactorScope;
  /** Faktör onaylı bir kaynaktan gelmiyorsa true -> "tahmini" ibaresi zorunlu. */
  is_estimated: boolean;
  /** Sabit 'server': bu satırın sayılarını API hesapladı, istemci değil. */
  computed_by: 'server';
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round5 = (n: number) => Math.round(n * 100000) / 100000;

/**
 * Mesafeyi güvenli banda çeker. Fırlatmaz, çünkü bu yol fire-and-forget event
 * hattında çalışır ve tek bozuk event'in host sayfayı ya da analitiği
 * patlatması istenmez. DTO katmanı zaten bandın dışını 400 ile reddeder; bu
 * son savunmadır.
 *
 * Sonlu OLMAYAN girdi (NaN, ±Infinity, sayıya çevrilemeyen metin) MAX'a değil
 * MIN'e düşer: bilinçli güvenlik tercihi. Anlamsız bir girdinin mümkün olan en
 * YÜKSEK karbonu ve en yüksek katkı tutarını üretmesi, en düşüğünü
 * üretmesinden çok daha kötü bir hata olurdu. Yalnızca GEÇERLİ ama bandın
 * üstünde kalan bir sayı MAX'a çekilir.
 */
export function clampDistanceKm(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return MIN_DISTANCE_KM;
  if (n < MIN_DISTANCE_KM) return MIN_DISTANCE_KM;
  if (n > MAX_DISTANCE_KM) return MAX_DISTANCE_KM;
  // Mesafe tam km olarak kaydedilir: 350.7 km'lik bir "tahmin" sahte hassasiyettir.
  return Math.round(n);
}

/** Faktörü akla yatkın banda çeker (0 ve üstü sınır dışı -> güvenli sınır). */
export function clampFactorPerKm(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= MIN_FACTOR_PER_KM) return 0;
  return n > MAX_FACTOR_PER_KM ? MAX_FACTOR_PER_KM : round5(n);
}

/** tahmini CO₂e (kg) = km × faktör. 2 ondalığa yuvarlanır. */
export function estimateCo2eKg(
  distanceKm: number,
  factorPerKm: number,
): number {
  return round2(clampDistanceKm(distanceKm) * clampFactorPerKm(factorPerKm));
}

/**
 * Katkı tutarı = max(alt sınır, CO₂e × kg-başı fiyat).
 *
 * Alt sınır CO₂e = 0 olduğunda da uygulanır mı? HAYIR — faktörü/mesafesi
 * çözülemeyen bir yolculuk için kullanıcıdan taban ücret istemek yanlış olur.
 * Sıfır emisyon tahmini -> sıfır katkı.
 */
export function contributionAmount(
  co2eKg: number,
  pricePerKg: number,
  minAmount: number,
): number {
  if (!(co2eKg > 0)) return 0;
  const price = Number(pricePerKg);
  const min = Number(minAmount);
  const raw = co2eKg * (Number.isFinite(price) && price > 0 ? price : 0);
  const floor = Number.isFinite(min) && min > 0 ? min : 0;
  return round2(Math.max(floor, raw));
}

/** Faktör onaylı bir kaynaktan mı geliyor? */
export function isPlaceholderFactor(factorSource: string): boolean {
  return factorSource.trim().toLowerCase() === PLACEHOLDER_FACTOR_SOURCE;
}

/**
 * Tam hesap. Event metadata'sına ve /widget/config yanıtına aynı kaynaktan
 * beslenen tek fonksiyon — widget ile panelin sayıları bu yüzden birebir
 * tutarlıdır.
 */
export function estimateContribution(
  distanceKm: unknown,
  factor: VehicleFactor,
  pricing: ContributionPricing,
): CarbonEstimate {
  const km = clampDistanceKm(distanceKm);
  const perKm = clampFactorPerKm(factor.co2e_per_km_kg);
  const co2e = estimateCo2eKg(km, perKm);
  return {
    distance_km: km,
    vehicle_class_code: factor.class_code,
    co2e_per_km_kg: perKm,
    estimated_co2e_kg: co2e,
    amount: contributionAmount(
      co2e,
      pricing.price_per_kg_co2e,
      pricing.min_contribution_amount,
    ),
    currency: pricing.currency,
    factor_source: factor.factor_source,
    factor_country: factor.factor_country,
    factor_year: factor.factor_year,
    factor_scope: factor.factor_scope,
    // Faz 1'de her zaman true (pazarlama dürüstlüğü — Stay ile aynı duruş).
    // Placeholder faktör bunu ayrıca gözle görülür kılar.
    is_estimated: true,
    computed_by: 'server',
  };
}

/**
 * Ağaç-yılı eşdeğeri (panel/widget'ta "X ağacın bir yıllık emilimi" satırı).
 * TEMSİLİ bir çevirim katsayısıdır — olgun bir ağacın yıllık ~21 kg CO₂
 * emdiği yaygın varsayımına dayanır. Doğrulanmış bir offset DEĞİLDİR.
 */
export const KG_CO2_PER_TREE_YEAR = 21;

export function treeEquivalent(co2eKg: number): number {
  if (!(co2eKg > 0)) return 0;
  return Math.round((co2eKg / KG_CO2_PER_TREE_YEAR) * 10) / 10;
}
