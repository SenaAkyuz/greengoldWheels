-- Araç sınıfı + emisyon faktörü. Wheels'ın mesafe bazlı modelinin ÇEKİRDEĞİ.
--
-- ⚠️ METODOLOJİ DÜRÜSTLÜĞÜ — bu tablonun en önemli tasarım kararı:
-- Wheels MVP maketinin README'si şunu söylüyordu: "Canlı kullanımda faktörün
-- kaynağı, ülkesi, yılı, araç/yakıt sınıfı ve kapsamı kayıt altına alınmalıdır."
-- Bu yüzden provenance alanları (factor_source / factor_country / factor_year /
-- factor_scope) **NOT NULL**'dır: kaynağı belirtilmemiş bir faktör bu tabloya
-- fiziksel olarak YAZILAMAZ. Sayıyı sessizce uydurmak mümkün değil.
--
-- `factor_source = 'placeholder'` özel bir değerdir: faktör henüz onaylı bir
-- kaynaktan gelmiyor demektir. API bu satırları `is_estimated = true` ile
-- servis eder ve widget "tahmini" rozetini gösterir. Green Gold metodolojisi
-- netleşince placeholder satırlar gerçek faktörlerle değiştirilir.
--
-- factor_scope:
--   tank_to_wheel — yalnızca araç egzozundan çıkan (yakma) emisyonu.
--   well_to_wheel — yakıtın üretim/dağıtım zincirini de kapsar (daha yüksek).
-- Elektrikli araçta tank_to_wheel ≈ 0 olduğundan şebeke karışımını kapsayan
-- bir faktör zorunlu olarak well_to_wheel'dir; bu ayrımı kaydetmezsek elektrik
-- "sıfır emisyon" gibi görünür ve bu yanıltıcı olur.

CREATE TABLE vehicle_classes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES rental_companies(id) ON DELETE CASCADE,

    class_code        TEXT NOT NULL,              -- "ekonomi-benzin" (widget'ın gönderdiği anahtar)
    label_tr          TEXT NOT NULL,              -- "Ekonomi · Benzinli"
    label_en          TEXT NOT NULL,              -- "Economy · Petrol"
    fuel_type         TEXT NOT NULL,

    -- TAHMİNİ emisyon faktörü (kg CO₂e / km). 5 ondalık: elektrikli araç
    -- faktörleri 0.04-0.05 bandında, 2 ondalık ayrımı taşıyamaz.
    co2e_per_km_kg    NUMERIC(8,5) NOT NULL,

    -- Provenance — ZORUNLU (yukarıdaki nota bakın).
    factor_source     TEXT NOT NULL,              -- "DEFRA 2024" | "placeholder" | ...
    factor_country    TEXT NOT NULL DEFAULT 'TR',
    factor_year       INT  NOT NULL,
    factor_scope      TEXT NOT NULL DEFAULT 'tank_to_wheel',

    sort_order        INT  NOT NULL DEFAULT 0,    -- widget'taki görünüm sırası
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT vehicle_classes_company_code_unique UNIQUE (company_id, class_code),
    CONSTRAINT vehicle_classes_fuel_type_valid
      CHECK (fuel_type IN ('benzin', 'dizel', 'hibrit', 'plugin_hibrit', 'elektrik', 'lpg')),
    CONSTRAINT vehicle_classes_scope_valid
      CHECK (factor_scope IN ('tank_to_wheel', 'well_to_wheel')),
    -- Faktör pozitif olmalı: 0 "sıfır emisyon" iddiası demektir ve hiçbir
    -- araç sınıfı için doğru değildir (elektrikli dahil — şebeke karışımı var).
    CONSTRAINT vehicle_classes_factor_positive
      CHECK (co2e_per_km_kg > 0),
    -- Üst sınır savunması: 2 kg/km'nin üstü veri girişi hatasıdır (ağır ticari
    -- araç bile bu bandın altındadır).
    CONSTRAINT vehicle_classes_factor_plausible
      CHECK (co2e_per_km_kg <= 2),
    CONSTRAINT vehicle_classes_year_plausible
      CHECK (factor_year BETWEEN 2000 AND 2100),
    -- Boş string provenance'ı atlatmanın yolu olmasın.
    CONSTRAINT vehicle_classes_source_not_blank
      CHECK (length(btrim(factor_source)) > 0),
    CONSTRAINT vehicle_classes_country_not_blank
      CHECK (length(btrim(factor_country)) > 0)
);

CREATE INDEX idx_vehicle_classes_company_active
  ON vehicle_classes (company_id, is_active, sort_order);
