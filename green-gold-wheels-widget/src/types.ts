/**
 * API'nin `/widget/config` ve `/widget/impact` yanıtlarının widget tarafındaki
 * karşılıkları. Sunucudaki `WidgetConfig`/`WidgetImpact` ile birebir uyumlu
 * tutulmalı (bkz. green-gold-wheels-api/src/widget/widget.service.ts).
 */
import type { FactorScope } from '@wheels/carbon';

export type { FactorScope };

export interface WidgetVehicleClass {
  class_code: string;
  label_tr: string;
  label_en: string;
  fuel_type: string;
  co2e_per_km_kg: number;
  factor_source: string;
  factor_country: string;
  factor_year: number;
  factor_scope: FactorScope;
  /** Faktör onaylı bir kaynaktan gelmiyorsa true -> "tahmini" vurgusu şart. */
  is_placeholder_factor: boolean;
}

export interface ContentOverrideStrings {
  heading?: string;
  checkboxLabel?: string;
  addButton?: string;
  confirmation?: string;
}

export interface ContentOverrides {
  tr?: ContentOverrideStrings;
  en?: ContentOverrideStrings;
}

export interface WidgetConfig {
  company_name: string;
  city: string | null;
  currency: string;
  price_per_kg_co2e: number;
  min_contribution_amount: number;
  vehicle_classes: WidgetVehicleClass[];
  is_estimated: boolean;
  logo_url: string | null;
  brand_color: string | null;
  show_estimated_impact: boolean;
  content_overrides?: ContentOverrides;
}

export interface WidgetImpact {
  month: string; // YYYY-MM
  estimated_co2e_kg: number;
  tree_equivalent: number;
  contributions_count: number;
  is_estimated: boolean;
}

export type Lang = 'tr' | 'en';

export type WidgetEventType =
  | 'widget_goruntulendi'
  | 'arac_secildi'
  | 'checkbox_secildi'
  | 'katki_ekle_butonuna_basildi'
  // Kiralama şirketinin ödeme/rezervasyon adımına geçiş tıklaması.
  // REZERVASYON TAMAMLANDI ANLAMINA GELMEZ; şirket bazlı flag ile korunur
  // (varsayılan kapalı) — kapalıyken API 400 döner.
  | 'rezervasyona_devam_edildi';

/**
 * Event ile gönderilen metadata — YALNIZCA HESABIN GİRDİLERİ.
 *
 * ⚠️ `amount` / `estimated_co2e_kg` gibi SONUÇ alanları BİLİNÇLİ OLARAK YOK.
 * API bunları reddeder (400) ve kendi faktör tablosundan yeniden hesaplar.
 * Widget ekranda bir sayı gösterir ama o sayı veritabanına ASLA yazılmaz —
 * fiyat istemciden manipüle edilemez.
 */
export interface WidgetEventMetadata {
  distance_km?: number;
  vehicle_class_code?: string;
}
