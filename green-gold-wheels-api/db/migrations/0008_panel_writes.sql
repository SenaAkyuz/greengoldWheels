-- PANEL YAZMA YETKİLERİ — Adım 3 (yönetim ekranları).
--
-- Adım 1'de uygulama rolü bilinçli olarak SALT-OKUNURDU (yalnızca
-- widget_events INSERT). Panel araç faktörlerini ve izinli origin'leri
-- düzenleyecek; bu migration o kapıyı AÇAR ama olabildiğince DAR açar.
--
-- ÜÇ KATLI DARALTMA:
--
--   1. KOLON BAZLI GRANT. Postgres `GRANT UPDATE (kolon, ...)` destekler.
--      Uygulama rolü yalnızca listelenen kolonları yazabilir; `status`,
--      `public_widget_key`, `commission_rate`, `company_id`, `class_code`
--      yetkisi HİÇ VERİLMEZ. Panel kodunda bir hata olsa bile bir şirket
--      kendini `active` yapamaz ya da widget anahtarını değiştiremez —
--      veritabanı reddeder.
--
--   2. RLS POLICY. USING + WITH CHECK ile hem "hangi satırı görebilir" hem
--      "yazdıktan sonra hangi satır kalabilir" kendi şirketine kilitlenir.
--      Başka şirketin satırını güncellemek ya da satırı başka şirkete
--      taşımak imkânsızdır.
--
--   3. DELETE YOK. Araç sınıfı silinmez, `is_active = false` yapılır.
--      Geçmiş event'ler sınıfa referans verdiği için silme, panelin karbon
--      geçmişini anlamsızlaştırırdı. (DELETE yetkisi de policy'si de yok.)
--
-- Faktör değiştirmek bir METODOLOJİ iddiasıdır: `factor_source`'u
-- 'placeholder' olmaktan çıkarmak "bu sayı onaylı bir kaynaktan geliyor"
-- demektir. Bu yüzden kaynak/ülke/yıl/kapsam kolonları da yazılabilir
-- olmalıdır — ama API katmanı bunların hepsini birlikte ve dolu ister
-- (bkz. dashboard DTO'ları).

-- ---------------------------------------------------------------------------
-- rental_companies: yalnızca şirketin kendi ayarları
-- ---------------------------------------------------------------------------
CREATE POLICY rental_companies_tenant_update ON rental_companies
    FOR UPDATE
    USING (id = app_company_id())
    WITH CHECK (id = app_company_id());

GRANT UPDATE (
    name,
    city,
    timezone,
    allowed_origins,
    price_per_kg_co2e,
    min_contribution_amount,
    logo_url,
    brand_color,
    widget_settings,
    updated_at
) ON rental_companies TO wheels_app;

-- ---------------------------------------------------------------------------
-- vehicle_classes: faktör yönetimi (düzenleme + yeni sınıf)
-- ---------------------------------------------------------------------------
CREATE POLICY vehicle_classes_tenant_update ON vehicle_classes
    FOR UPDATE
    USING (company_id = app_company_id())
    WITH CHECK (company_id = app_company_id());

CREATE POLICY vehicle_classes_tenant_insert ON vehicle_classes
    FOR INSERT
    WITH CHECK (company_id = app_company_id());

GRANT UPDATE (
    label_tr,
    label_en,
    fuel_type,
    co2e_per_km_kg,
    factor_source,
    factor_country,
    factor_year,
    factor_scope,
    sort_order,
    is_active,
    updated_at
) ON vehicle_classes TO wheels_app;

-- INSERT'te kolon kısıtı: `company_id` ve `class_code` yazılabilmeli (yeni
-- satır), ama sonradan DEĞİŞTİRİLEMEZ (yukarıdaki UPDATE listesinde yoklar).
-- Yani bir sınıf doğduğu şirkette ve doğduğu kodla kalır.
GRANT INSERT (
    company_id,
    class_code,
    label_tr,
    label_en,
    fuel_type,
    co2e_per_km_kg,
    factor_source,
    factor_country,
    factor_year,
    factor_scope,
    sort_order,
    is_active
) ON vehicle_classes TO wheels_app;

-- ---------------------------------------------------------------------------
-- users / widget_events: DEĞİŞMEDİ — yazma yok.
--
-- users: üyelik eşlemesi erişimin ASIL kapısıdır; panelden yazılabilseydi bir
--   şirket kendine kullanıcı ekleyebilirdi. Operatör işi olarak kalır
--   (scripts/link-member.ts).
-- widget_events: analitik kayıt yalnızca eklenir, değiştirilmez/silinmez —
--   şirketin kendi dönüşüm sayılarını düzeltebilmesi veriyi anlamsızlaştırırdı.
-- ---------------------------------------------------------------------------
