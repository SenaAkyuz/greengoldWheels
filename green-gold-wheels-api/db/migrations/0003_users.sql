-- Şirket yöneticileri. Kimlik doğrulama **Neon Auth** (Managed Better Auth)
-- tarafındadır: şifre/hash burada YOK. Bu tablo yalnızca "hangi auth
-- kullanıcısı hangi şirkete ait" eşlemesini tutar.
--
-- GÜVENLİK — eşleme YALNIZCA auth_user_id ile yapılır, e-posta ile ASLA:
-- e-posta tabanlı otomatik bağlama, aynı e-postayla kayıt olan birinin başka
-- bir şirketin paneline girmesine (hesap ele geçirme) yol açabilirdi. `email`
-- yalnızca bilgi amaçlıdır. Bağlama, operatörün bilinçli adımıdır
-- (scripts/link-member.ts).
--
-- ⚠️ ERİŞİMİN ASIL KAPISI BU TABLODUR, kayıt ekranı değil.
-- Neon Auth şu an açık kayıt alıyor ("restricted signups coming soon").
-- Bir yabancı kayıt olsa bile buraya satırı YALNIZCA operatör yazabildiği için
-- `wheels_resolve_member()` boş döner ve AuthGuard 401 verir — hiçbir veri
-- görünmez (test: app.e2e.spec.ts "sirkete BAGLI OLMAYAN kullanici 401").
-- Kayıt kapatma geldiğinde bu, fazladan bir kat olacak; tek kat değil.
--
-- auth_user_id başta NULL olabilir: şirket ve yönetici satırı oluşturulur,
-- yönetici Neon Auth'ta hesabını açınca operatör kimliği bağlar. Bağlanmamış
-- satırla HİÇBİR token eşleşmez (NULL hiçbir şeye eşit değildir) — fail-closed.

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL REFERENCES rental_companies(id) ON DELETE CASCADE,
    -- neon_auth.user.id ile aynı tip (UUID). Foreign key aşağıda, KOŞULLU olarak.
    auth_user_id   UUID UNIQUE,
    full_name      TEXT NOT NULL,
    email          TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'filo_yoneticisi',
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT users_role_valid
      CHECK (role IN ('filo_yoneticisi')),
    -- Aynı şirkette aynı e-posta iki kez olmasın (farklı şirketlerde olabilir).
    CONSTRAINT users_company_email_unique UNIQUE (company_id, email)
);

CREATE INDEX idx_users_company_id ON users (company_id);

-- `neon_auth.user(id)`'ye KOŞULLU foreign key.
--
-- NEDEN koşullu: `neon_auth` şeması Neon tarafından YÖNETİLİR — Neon Auth
-- etkinleştirildiğinde oluşur. Koşulsuz bir FK şu iki durumda migration'ı
-- komple patlatırdı: (a) Neon Auth henüz açılmamış, (b) sahip rolünün o
-- yönetilen tabloda REFERENCES yetkisi yok. İkisi de kurulumu tamamen
-- bloke eder ve ikisi de bizim kontrolümüzde değil.
--
-- Bu yüzden: mümkünse FK kurulur (gerçek bütünlük), mümkün değilse NOTICE ile
-- atlanır ve kurulum devam eder. FK olmasa da izolasyon bozulmaz — asıl
-- garanti UNIQUE kısıtı + operatörün bilinçli bağlama adımıdır.
--
-- ON DELETE SET NULL: auth kullanıcısı silinirse yönetici satırı KALIR ama
-- bağlantısı düşer -> o kişi artık giremez (fail-closed), şirketin kaydı ise
-- kaybolmaz.
DO $$
BEGIN
  IF to_regclass('neon_auth.user') IS NULL THEN
    RAISE NOTICE 'neon_auth.user bulunamadi -> auth_user_id foreign key ATLANDI. Neon Auth etkinlestirildikten sonra 0008 ile eklenebilir.';
  ELSIF NOT has_table_privilege(current_user, 'neon_auth.user', 'REFERENCES') THEN
    RAISE NOTICE 'neon_auth.user uzerinde REFERENCES yetkisi yok -> auth_user_id foreign key ATLANDI.';
  ELSE
    ALTER TABLE users
      ADD CONSTRAINT users_auth_user_fk
      FOREIGN KEY (auth_user_id) REFERENCES neon_auth."user"(id)
      ON DELETE SET NULL;
    RAISE NOTICE 'auth_user_id -> neon_auth.user(id) foreign key kuruldu.';
  END IF;
END
$$;
