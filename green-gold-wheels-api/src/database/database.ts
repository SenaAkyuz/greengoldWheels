/**
 * Veritabanı PORT'u — servisler yalnızca buna bağlıdır, sürücüye değil.
 *
 * Üretimde `PgDatabase` (node-postgres -> Neon), testte `PgliteDatabase`
 * (gerçek Postgres'in WASM derlemesi, süreç içinde). İkisi de AYNI
 * migration'ları ve AYNI SQL'i çalıştırır — testler sahte bir istemciye değil,
 * gerçek Postgres semantiğine (RLS dahil) karşı koşar.
 *
 * Bu port bilinçli olarak DAR tutuldu: yalnızca iki giriş kapısı var ve ikisi
 * de bir transaction açar. "Transaction dışında sorgu" diye bir yol YOKTUR —
 * tenant ayarı transaction'a yerel olduğu için, transaction'sız bir sorgu
 * şirket bağlamını kaybederdi.
 */

/** Tek bir transaction içinde sorgu çalıştırabilen nesne. */
export interface Queryable {
  query<R = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: R[] }>;
}

/** Açılış güvenlik kontrolünün denetlediği tablolar (0006_rls.sql). */
export const RLS_PROTECTED_TABLES = [
  'rental_companies',
  'vehicle_classes',
  'users',
  'widget_events',
] as const;

/** UUID biçimi — set_config'e gitmeden önce şirket kimliği doğrulanır. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertCompanyId(companyId: string): void {
  if (typeof companyId !== 'string' || !UUID_RE.test(companyId)) {
    // Bu bir programlama hatasıdır (company_id her zaman DB'den/token
    // eşlemesinden gelir) — sessizce geçmek yerine yüksek sesle patla.
    throw new Error('Geçersiz company_id: tenant bağlamı kurulamadı.');
  }
}

/**
 * Nest DI token'ı olarak da kullanılan soyut sınıf (interface'ler çalışma
 * zamanında yok olur, abstract class kalır).
 */
export abstract class Database {
  /**
   * Şirket bağlamında transaction. İçeride `app.current_company_id` ayarlıdır;
   * RLS yalnızca bu şirketin satırlarını gösterir ve yalnızca bu şirket adına
   * yazmaya izin verir. Fırlatılan hata transaction'ı geri alır.
   */
  abstract withTenant<T>(
    companyId: string,
    fn: (q: Queryable) => Promise<T>,
  ): Promise<T>;

  /**
   * Şirket bağlamı OLMADAN transaction. RLS altında tablolar burada BOŞ
   * görünür; tek amacı tenant sınırını geçen dar SECURITY DEFINER
   * fonksiyonlarını (wheels_resolve_*, wheels_*_origins) çağırmaktır.
   */
  abstract withoutTenant<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}
