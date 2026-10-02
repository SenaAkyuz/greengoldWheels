-- Wheels tenant'ı: araç kiralama şirketi.
--
-- Stay'deki `hotels` tablosunun karşılığı, ama karbon modeli FARKLI:
-- Stay "oda × gece × gece-başı katsayı" ile hesaplar; Wheels **mesafe bazlı**
-- çalışır (km × araç faktörü). Bu yüzden burada gece-başı bir katsayı YOKTUR —
-- faktörler araç sınıfı bazında `vehicle_classes` tablosunda durur (0002).
--
-- Şirket seviyesinde tutulan şey FİYATLANDIRMA'dır: kg CO₂e başına katkı
-- fiyatı + alt sınır. Katkı tutarı = max(min_contribution_amount,
-- co2e_kg × price_per_kg_co2e) — hesap her zaman API'de yapılır, istemciden
-- gelen tutara ASLA güvenilmez (bkz. src/common/carbon-estimate.ts).

CREATE TABLE rental_companies (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     TEXT NOT NULL,
    company_code             TEXT UNIQUE NOT NULL,        -- "RNT-1024"
    city                     TEXT,
    country                  TEXT NOT NULL DEFAULT 'TR',
    timezone                 TEXT NOT NULL DEFAULT 'Europe/Istanbul', -- aylık/günlük gruplama için
    default_currency         TEXT NOT NULL DEFAULT 'TRY',
    commission_rate          NUMERIC(5,2) NOT NULL DEFAULT 20.00,

    -- Katkı fiyatlandırması (mesafe bazlı modelin para tarafı).
    contribution_model       TEXT NOT NULL DEFAULT 'kg_basi_fiyat',
    -- kg CO₂e başına katkı fiyatı. 1.0000 TEMSİLİ bir başlangıç değeridir
    -- (Wheels MVP maketindeki 1 TL/kg varsayımı) — gerçek fiyat Green Gold
    -- fiyatlandırma onayı ile belirlenir.
    price_per_kg_co2e        NUMERIC(10,4) NOT NULL DEFAULT 1.0000,
    -- Çok kısa yolculuklarda kuruşluk katkı çıkmasın diye alt sınır.
    min_contribution_amount  NUMERIC(10,2) NOT NULL DEFAULT 19.00,

    -- Widget'ın kendini tanıttığı düşük yetkili public anahtar (hassas değil).
    public_widget_key        TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,

    -- Marka görünümü (widget'ta accent/logo).
    logo_url                 TEXT,
    brand_color              TEXT,

    -- Şirketin rezervasyon sistemi (Stay'deki pms_provider karşılığı). Yalnızca
    -- TANIMLAYICI — Faz 1'de hiçbir entegrasyon davranışını tetiklemez.
    fleet_provider           TEXT,

    status                   TEXT NOT NULL DEFAULT 'pending',  -- pending / active / suspended
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rental_companies_status_valid
      CHECK (status IN ('pending', 'active', 'suspended')),
    CONSTRAINT rental_companies_price_non_negative
      CHECK (price_per_kg_co2e >= 0),
    CONSTRAINT rental_companies_min_contribution_non_negative
      CHECK (min_contribution_amount >= 0)
);

CREATE INDEX idx_rental_companies_widget_key ON rental_companies (public_widget_key);
