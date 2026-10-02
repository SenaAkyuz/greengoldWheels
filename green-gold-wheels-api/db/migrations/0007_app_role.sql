-- UYGULAMA ROLÜ ve tenant sınırını geçmenin TEK yolları.
--
-- İki rol vardır, ve bu ayrım güvenlik modelinin temelidir:
--
--   SAHİP (Neon'da neondb_owner) — tabloların sahibi. Migration'ları ve
--     operatör script'lerini çalıştırır. Bağlantı adresi (DATABASE_URL_OWNER)
--     YALNIZCA operatörün makinesinde durur; Vercel'e/sunucuya ASLA konmaz.
--
--   wheels_app — API'nin çalışma zamanında bağlandığı rol. RLS'e TABİDİR,
--     tablo sahibi DEĞİLDİR, BYPASSRLS'i YOKTUR. Yetkisi en az olandır:
--     4 tabloda SELECT, yalnızca widget_events'te INSERT. UPDATE/DELETE yok.
--
-- ⚠️ wheels_app MUTLAKA SQL ile oluşturulmalıdır (bu dosya yapar), Neon
-- konsolundan/CLI'dan/API'den DEĞİL: oradan oluşturulan roller otomatik olarak
-- `neon_superuser` üyeliği alır ve bu üyelik BYPASSRLS içerir — RLS sessizce
-- devre dışı kalırdı. Şifre bu dosyada YOKTUR; rol NOLOGIN doğar ve giriş
-- yetkisi + güçlü şifre ayrı bir operatör adımıyla verilir
-- (scripts/setup-app-role.ts). Böylece şifre asla git'e girmez.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wheels_app') THEN
    CREATE ROLE wheels_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- En az yetki: önce her şeyi geri al, sonra yalnızca gerekeni ver.
REVOKE ALL ON rental_companies, vehicle_classes, users, widget_events FROM wheels_app;

GRANT USAGE ON SCHEMA public TO wheels_app;
GRANT SELECT ON rental_companies, vehicle_classes, users, widget_events TO wheels_app;
GRANT INSERT ON widget_events TO wheels_app;
GRANT EXECUTE ON FUNCTION app_company_id() TO wheels_app;

-- ============================================================================
-- TENANT SINIRINI GEÇEN FONKSİYONLAR
--
-- Bazı işlemler şirket HENÜZ bilinmeden yapılmak zorundadır: widget anahtarını
-- şirkete çözmek, auth kullanıcısını şirkete çözmek, CORS için izinli
-- origin'leri okumak. RLS altında bunlar imkânsızdır (şirket ayarlı değil ->
-- hiçbir satır görünmez). Çözüm: SAHİBİN yetkisiyle çalışan (SECURITY
-- DEFINER), DAR ve DENETLENEBİLİR fonksiyonlar.
--
-- Her biri için kurallar:
--   * Yalnızca İŞİN GEREKTİRDİĞİ en az sütunu döndürür (tam satır ASLA).
--   * `SET search_path = public, pg_temp` — çağıranın search_path'ine güvenmez;
--     pg_temp SONDA: geçici şemaya konmuş sahte bir tabloyla ele geçirilemez.
--   * PUBLIC'ten EXECUTE geri alınır, yalnızca wheels_app'e verilir.
--   * Parametreler SQL'e değer olarak girer (dinamik SQL YOK) — enjeksiyon yok.
-- ============================================================================

-- Widget anahtarı -> şirket kimliği + durumu. Yapılandırmanın geri kalanı,
-- şirket ayarlandıktan SONRA RLS altında okunur. Durum burada döner çünkü
-- "bulunamadı" (404/403) ile "aktif değil" (403) ayrımını servis yapar.
CREATE OR REPLACE FUNCTION wheels_resolve_widget_key(p_key text)
RETURNS TABLE (company_id uuid, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT c.id, c.status
      FROM rental_companies c
     WHERE c.public_widget_key = p_key
$$;

-- Neon Auth kullanıcı kimliği (JWT'deki sub claim'i, bir UUID) -> şirket + rol.
-- YALNIZCA auth_user_id ile eşler (e-posta ile ASLA — bkz. 0003).
-- Bağlanmamış (NULL) satırlar eşleşmez.
-- Şirket aktif değilse de döner; karar servisin (askıya alınmış şirketin
-- yöneticisinin panele girip giremeyeceği bir ürün kararıdır, gizlenmemeli).
CREATE OR REPLACE FUNCTION wheels_resolve_member(p_auth_user_id uuid)
RETURNS TABLE (company_id uuid, role text, company_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT u.company_id, u.role, c.status
      FROM users u
      JOIN rental_companies c ON c.id = u.company_id
     WHERE u.auth_user_id = p_auth_user_id
$$;

-- CORS: tek şirketin izinli origin'leri (gerçek istekte, anahtar biliniyor).
-- YALNIZCA aktif şirketler: askıya alınmış bir şirketin domain'i CORS'u
-- geçememeli.
CREATE OR REPLACE FUNCTION wheels_widget_origins(p_key text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT c.allowed_origins
      FROM rental_companies c
     WHERE c.public_widget_key = p_key
       AND c.status = 'active'
$$;

-- CORS preflight: anahtar taşımaz, şirket çözülemez -> TÜM AKTİF şirketlerin
-- origin birleşimi. Asıl yetki kontrolü gerçek istekte (yukarıdaki fonksiyon)
-- yapılır; preflight yalnızca tarayıcının isteği göndermesine izin verir.
-- Stay'den iyileştirme: orada pending/suspended otellerin origin'leri de
-- birleşime giriyordu.
CREATE OR REPLACE FUNCTION wheels_all_widget_origins()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(array_agg(DISTINCT o), '{}')
      FROM rental_companies c, unnest(c.allowed_origins) AS o
     WHERE c.status = 'active'
$$;

REVOKE EXECUTE ON FUNCTION
    wheels_resolve_widget_key(text),
    wheels_resolve_member(uuid),
    wheels_widget_origins(text),
    wheels_all_widget_origins()
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    wheels_resolve_widget_key(text),
    wheels_resolve_member(uuid),
    wheels_widget_origins(text),
    wheels_all_widget_origins()
  TO wheels_app;
