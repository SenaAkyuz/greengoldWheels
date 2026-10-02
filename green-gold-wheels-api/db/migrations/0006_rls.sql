-- ROW LEVEL SECURITY — tenant izolasyonunun VERİTABANI katmanı.
--
-- Supabase sürümünden temel fark: orada API `service_role` ile bağlanıyor ve
-- RLS'i TAMAMEN bypass ediyordu; izolasyonun tek garantisi her sorgudaki
-- kod-içi `company_id` filtresiydi — tek bir unutulmuş WHERE, şirketler arası
-- veri sızıntısı demekti. Burada uygulama RLS'e TABİ bir rolle (wheels_app,
-- bkz. 0007) bağlanır. Kod yine `company_id` ile filtreler (birinci kat), ama
-- filtre unutulsa bile veritabanı başka şirketin satırını DÖNDÜRMEZ (ikinci kat).
--
-- MEKANİZMA: her istek bir transaction içinde çalışır ve şirketi
--   SELECT set_config('app.current_company_id', '<uuid>', true)
-- ile ayarlar. Üçüncü parametre `true` = transaction'a YEREL: transaction
-- bitince ayar düşer, havuzdaki bağlantıyı alan bir sonraki istek önceki
-- şirketi DEVRALAMAZ. (Neon'un pooler'ı transaction modunda çalışır; ayarın
-- transaction içinde yapılması bu yüzden zorunludur.)
--
-- FAIL-CLOSED: şirket ayarlanmamışsa app_company_id() NULL döner ve
-- `company_id = NULL` hiçbir satırla eşleşmez -> HİÇBİR şey görünmez.
-- Ayarı unutmak "her şeyi göster"e değil "hiçbir şeyi gösterme"ye düşer.
--
-- NEDEN `FORCE ROW LEVEL SECURITY` YOK (bilinçli):
-- FORCE, tablo sahibini de RLS'e tabi kılar. Neon'da sahip (neondb_owner)
-- superuser DEĞİLDİR; FORCE açıkken 0007'deki SECURITY DEFINER fonksiyonları
-- (sahibin yetkisiyle çalışırlar) hiçbir satır göremez ve widget anahtarı
-- çözülemez -> widget canlıda TAMAMEN çalışmaz. Bu, PGlite üzerinde
-- superuser-olmayan bir sahiple doğrulandı. Sahibin bypass etmesi sorun
-- değildir çünkü uygulama ASLA sahip olarak bağlanmaz — DatabaseService
-- açılışta bunu `row_security_active()` ile denetler ve aksi halde
-- AÇILMAYI REDDEDER.

-- Mevcut isteğin şirketi. missing_ok = true: ayar yoksa hata değil NULL.
-- NULLIF: boş string '' uuid'e çevrilemez (hata verirdi) -> NULL'a indir.
CREATE OR REPLACE FUNCTION app_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.current_company_id', true), '')::uuid
$$;

ALTER TABLE rental_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_classes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_events    ENABLE ROW LEVEL SECURITY;

-- Okuma: yalnızca kendi şirketin.
CREATE POLICY rental_companies_tenant_select ON rental_companies
    FOR SELECT USING (id = app_company_id());

CREATE POLICY vehicle_classes_tenant_select ON vehicle_classes
    FOR SELECT USING (company_id = app_company_id());

CREATE POLICY users_tenant_select ON users
    FOR SELECT USING (company_id = app_company_id());

CREATE POLICY widget_events_tenant_select ON widget_events
    FOR SELECT USING (company_id = app_company_id());

-- Yazma: uygulama YALNIZCA event ekler ve YALNIZCA kendi şirketi adına.
-- WITH CHECK, A şirketi bağlamındayken B adına satır yazmayı reddeder.
CREATE POLICY widget_events_tenant_insert ON widget_events
    FOR INSERT WITH CHECK (company_id = app_company_id());

-- UPDATE/DELETE için policy YOK ve 0007'de bu yetkiler VERİLMEZ: uygulama
-- rolü event'leri değiştiremez/silemez. Analitik kayıt yalnızca eklenir.
-- Şirket/araç sınıfı/kullanıcı yazımı operatör script'leriyle (sahip rolü)
-- yapılır; panelin düzenleme ekranları geldiğinde dar UPDATE policy'leri
-- o adımda eklenecek.
