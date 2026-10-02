-- Public widget yüzeyinin güvenlik kapısı (Stay'de Adım 8 ile gelen koruma,
-- Wheels'ta BAŞTAN kurulur — sonradan eklemek migration borcu yaratıyordu).

-- 1) Şirket başına izin verilen origin'ler (widget hangi domain'lerden POST edebilir).
--    Boş dizi = hiçbir browser origin'i kabul edilmez (yalnızca server-side/
--    non-browser istekler geçer). Canlıya almadan önce DOLDURULMASI gerekir.
ALTER TABLE rental_companies
  ADD COLUMN IF NOT EXISTS allowed_origins TEXT[] NOT NULL DEFAULT '{}';

-- 2) Event idempotency: (company_id, session_ref, event_type) session_ref varken TEKİL.
--    Widget aynı event'i session başına bir kez gönderir; bu index ağ tekrarı /
--    yeniden deneme / bozuk istemci durumunda da çift kaydı DB seviyesinde
--    engeller. Partial index: session_ref NULL olan satırlar (anonim, oturumsuz)
--    kısıtlanmaz — Postgres'te NULL'lar birbirinden ayrı sayılır.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_widget_event_session_type
  ON widget_events (company_id, session_ref, event_type)
  WHERE session_ref IS NOT NULL;

-- 3) Şirket bazlı widget konfigürasyonu.
--    GÜVENLİ VARSAYILAN: etki sayıları ve rezervasyon-tıklama ölçümü KAPALI.
--    Yeni/gerçek bir şirket yanlışlıkla placeholder karbon sayıları ya da
--    beklenmeyen event üretmeye başlamaz. Değerler her zaman
--    `src/common/widget-settings.ts::resolveWidgetSettings` üzerinden okunur
--    (savunmacı: bozuk/eksik JSON -> güvenli varsayılan).
--
--    Beklenen şekil:
--      {
--        "version": 1,
--        "pilot_mode": false,
--        "show_estimated_impact": false,
--        "enable_booking_click_tracking": false,
--        "content_overrides": { "tr": {...}, "en": {...} }
--      }
ALTER TABLE rental_companies
  ADD COLUMN IF NOT EXISTS widget_settings JSONB NOT NULL DEFAULT '{
    "version": 1,
    "pilot_mode": false,
    "show_estimated_impact": false,
    "enable_booking_click_tracking": false,
    "content_overrides": {}
  }'::jsonb;

ALTER TABLE rental_companies
  DROP CONSTRAINT IF EXISTS rental_companies_widget_settings_is_object;
ALTER TABLE rental_companies
  ADD CONSTRAINT rental_companies_widget_settings_is_object
  CHECK (jsonb_typeof(widget_settings) = 'object');
