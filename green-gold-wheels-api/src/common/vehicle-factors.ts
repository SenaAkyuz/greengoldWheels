/**
 * GEÇİCİ PLACEHOLDER araç faktörleri — Green Gold metodoloji onayı olmadan
 * gerçek bir kiralama şirketine sunulmamalı.
 *
 * Bu sayılar Wheels MVP maketinin (`greengold-wheels-mvp/index.html`) araç
 * seçicisinden alınmıştır ve orada da prototip olarak işaretliydi. Kaynak,
 * ölçüm yılı ve kapsam BİLİNMİYOR — bu yüzden hepsi `factor_source:
 * 'placeholder'` ile yazılır ve API bunları `is_estimated: true` ile servis eder.
 *
 * Bu tablo YALNIZCA seed script'i tarafından kullanılır (yeni bir şirkete
 * başlangıç araç sınıfları kurarken). Çalışma zamanında API her zaman
 * `vehicle_classes` tablosundan okur — buradan DEĞİL. Yani bir şirketin
 * faktörleri onaylı değerlerle güncellendiğinde bu dosya devre dışı kalır.
 *
 * Metodoloji netleşince yapılacak: her satıra gerçek kaynak (ör. "DEFRA 2024"),
 * ülke, yıl ve kapsam yazılıp `factor_source` 'placeholder' olmaktan çıkarılır.
 */

import type { FactorScope } from './carbon-estimate';
import { PLACEHOLDER_FACTOR_SOURCE } from './carbon-estimate';

export interface SeedVehicleClass {
  class_code: string;
  label_tr: string;
  label_en: string;
  fuel_type:
    'benzin' | 'dizel' | 'hibrit' | 'plugin_hibrit' | 'elektrik' | 'lpg';
  co2e_per_km_kg: number;
  factor_scope: FactorScope;
  sort_order: number;
}

/** MVP maketindeki dört sınıf, aynı sırayla. */
export const PLACEHOLDER_VEHICLE_CLASSES: readonly SeedVehicleClass[] = [
  {
    class_code: 'ekonomi-benzin',
    label_tr: 'Ekonomi · Benzinli',
    label_en: 'Economy · Petrol',
    fuel_type: 'benzin',
    co2e_per_km_kg: 0.171,
    factor_scope: 'tank_to_wheel',
    sort_order: 10,
  },
  {
    class_code: 'ekonomi-dizel',
    label_tr: 'Ekonomi · Dizel',
    label_en: 'Economy · Diesel',
    fuel_type: 'dizel',
    co2e_per_km_kg: 0.161,
    factor_scope: 'tank_to_wheel',
    sort_order: 20,
  },
  {
    class_code: 'hibrit',
    label_tr: 'Hibrit',
    label_en: 'Hybrid',
    fuel_type: 'hibrit',
    co2e_per_km_kg: 0.109,
    factor_scope: 'tank_to_wheel',
    sort_order: 30,
  },
  {
    // ÖNEMLİ: elektrikli araçta egzoz emisyonu ~0'dır; bu sayı şebeke
    // karışımından gelen DOLAYLI emisyondur, dolayısıyla kapsamı zorunlu
    // olarak well_to_wheel'dir. tank_to_wheel yazmak "sıfır emisyon" iddiası
    // üretirdi ve bu yanıltıcı olur.
    class_code: 'elektrik',
    label_tr: 'Elektrikli · şebeke tahmini',
    label_en: 'Electric · grid estimate',
    fuel_type: 'elektrik',
    co2e_per_km_kg: 0.047,
    factor_scope: 'well_to_wheel',
    sort_order: 40,
  },
] as const;

/** Seed satırlarını DB'ye yazılacak şekle çevirir (provenance eklenir). */
export function toSeedRows(
  companyId: string,
  factorYear: number,
  factorCountry = 'TR',
): Record<string, unknown>[] {
  return PLACEHOLDER_VEHICLE_CLASSES.map((v) => ({
    company_id: companyId,
    class_code: v.class_code,
    label_tr: v.label_tr,
    label_en: v.label_en,
    fuel_type: v.fuel_type,
    co2e_per_km_kg: v.co2e_per_km_kg,
    factor_source: PLACEHOLDER_FACTOR_SOURCE,
    factor_country: factorCountry,
    factor_year: factorYear,
    factor_scope: v.factor_scope,
    sort_order: v.sort_order,
    is_active: true,
  }));
}
