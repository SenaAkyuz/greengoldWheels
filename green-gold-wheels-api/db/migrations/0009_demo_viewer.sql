-- Demo (inceleme) rolü — Stay'deki "Demo panelini görüntüle" akışının karşılığı.
--
-- `demo_viewer` rolündeki kullanıcı panele GERÇEK bir oturumla girer ve bağlı
-- olduğu (demo) şirketin verisini görür, ama HİÇBİR ŞEY değiştiremez.
--
-- Yazma yasağı API'de, global DemoReadOnlyGuard ile METOT BAZLI uygulanır
-- (POST/PATCH/PUT/DELETE -> 403 `demo_read_only`). Endpoint listesi değil
-- genel kural olduğu için yeni eklenen bir yazma ucu demo'ya otomatik kapalı
-- kalır. Bu migration yalnızca rolün veritabanında var olabilmesini sağlar.
--
-- Tenant izolasyonu DEĞİŞMEZ: demo kullanıcısı da tek bir şirkete bağlıdır
-- (users.company_id) ve RLS onu yalnızca o şirkete kilitler. Demo hesabı
-- gerçek bir müşterinin şirketine BAĞLANMAMALIDIR — ayrı bir demo şirketi
-- kullanılır (scripts/setup-demo.ts).

ALTER TABLE users DROP CONSTRAINT users_role_valid;

ALTER TABLE users
  ADD CONSTRAINT users_role_valid
  CHECK (role IN ('filo_yoneticisi', 'demo_viewer'));
