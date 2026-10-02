import { RLS_PROTECTED_TABLES, type Queryable } from './database';

/**
 * AÇILIŞ GÜVENLİK KONTROLÜ — uygulama yanlış rolle bağlandıysa AÇILMAZ.
 *
 * Neon'un RLS rehberindeki 1 numaralı tuzak: "uygulama yanlış rolle
 * bağlanırsa RLS sessizce bypass edilir". Hiçbir hata, hiçbir uyarı olmaz —
 * sadece her şirket her şirketin verisini görür. Bunu talimatla değil kodla
 * engelliyoruz.
 *
 * NEDEN row_security_active(): rol özniteliklerini (rolsuper, rolbypassrls)
 * tek tek kontrol etmek bazı bypass yollarını kaçırırdı — tablo SAHİBİ olmak,
 * sahibin ÜYESİ olmak, ya da Neon'un konsoldan oluşturulan rollere verdiği
 * `neon_superuser` üyeliği. row_security_active(tablo), planner'ın kullandığı
 * mantığın aynısıyla "RLS bu kullanıcı için şu an GERÇEKTEN uygulanıyor mu"
 * sorusunu cevaplar. Dört bypass yolunun dördü de PGlite üzerinde doğrulandı
 * (superuser / BYPASSRLS / sahip / sahibin üyesi -> hepsi false).
 *
 * Tablolar yoksa (migration çalıştırılmamış) sorgu hata verir — bu da
 * istenen davranıştır: şemasız bir veritabanıyla açılmak anlamsızdır.
 */
export class RlsBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RlsBindingError';
  }
}

export async function assertRlsBinding(q: Queryable): Promise<void> {
  const { rows: who } = await q.query<{ role: string }>(
    'SELECT current_user AS role',
  );
  const role = who[0]?.role ?? '?';

  const bypassed: string[] = [];
  for (const table of RLS_PROTECTED_TABLES) {
    // Tablo adı sabit bir listeden gelir; yine de parametre olarak geçiyoruz.
    const { rows } = await q.query<{ active: boolean }>(
      'SELECT row_security_active($1::regclass) AS active',
      [`public.${table}`],
    );
    if (rows[0]?.active !== true) bypassed.push(table);
  }

  if (bypassed.length > 0) {
    throw new RlsBindingError(
      `GÜVENLİK: '${role}' rolü için RLS şu tablolarda UYGULANMIYOR: ` +
        `${bypassed.join(', ')}. Uygulama bu rolle AÇILMAYACAK.\n` +
        'Muhtemel sebepler: (1) DATABASE_URL tablo sahibinin (ör. neondb_owner) ' +
        'adresi — çalışma zamanı wheels_app rolüyle bağlanmalı; (2) rol Neon ' +
        'konsolundan oluşturuldu ve neon_superuser üzerinden BYPASSRLS aldı — ' +
        'rolü SQL ile oluşturun (db/migrations/0007_app_role.sql + ' +
        'scripts/setup-app-role.ts).',
    );
  }
}
