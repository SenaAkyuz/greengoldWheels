-- Widget etkileşim event'leri (analitik). Faz 1'de ödeme/rezervasyon KAYDI DEĞİL.
--
-- Event tipleri Wheels akışına göre (Stay'in 3+1'inin karşılığı):
--   widget_goruntulendi          — kart kullanıcıya göründü
--   arac_secildi                 — araç sınıfı seçildi/değiştirildi
--   checkbox_secildi             — katkı kutusu işaretlendi
--   katki_ekle_butonuna_basildi  — "Katkıyı onayla"ya basıldı (NİYET, ödeme değil)
--   rezervasyona_devam_edildi    — kiralama şirketinin ödeme/rezervasyon adımına
--                                  geçildi. REZERVASYON TAMAMLANDI ANLAMINA GELMEZ;
--                                  şirket bazlı feature flag ile korunur (varsayılan
--                                  kapalı) — bkz. widget-settings.ts.
--
-- `metadata` SUNUCU TARAFINDA yazılır (istemciden gelen tutar/CO₂ kabul edilmez):
--   { distance_km, vehicle_class_code, co2e_per_km_kg, estimated_co2e_kg,
--     amount, currency, factor_source, factor_country, factor_year,
--     factor_scope, computed_by: 'server' }
-- Böylece panelin okuduğu her sayının kaynağı API'dir — spoof edilemez.

CREATE TABLE widget_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES rental_companies(id) ON DELETE CASCADE,
    event_type   TEXT NOT NULL CHECK (event_type IN (
                     'widget_goruntulendi',
                     'arac_secildi',
                     'checkbox_secildi',
                     'katki_ekle_butonuna_basildi',
                     'rezervasyona_devam_edildi'
                 )),
    session_ref  TEXT,           -- anonim yolculuk kimliği (kişisel veri YOK)
    metadata     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_widget_events_company_created ON widget_events (company_id, created_at);
CREATE INDEX idx_widget_events_session ON widget_events (session_ref);
