/**
 * Operatör script'i — Neon Auth hesaplarını ve şirket eşlemelerini listeler.
 *
 *   npm run list-auth-users
 *
 * İki tabloyu YAN YANA gösterir, çünkü karıştırmak kolay:
 *   neon_auth."user" -> gerçek hesap (Neon Auth yönetir)
 *   public.users     -> hangi hesap hangi şirkete ait (bizim eşlememiz)
 *
 * "BAĞLI DEĞİL" görünen bir hesap panele GİREMEZ (fail-closed) — bağlamak için
 * `npm run link-member`.
 *
 * ⚠️ Sahip rolüyle okur (yalnızca lokal/operatör). Şifre/hash GÖSTERMEZ.
 */
import { fail, withOwnerTransaction } from './env';

interface Row {
  auth_user_id: string;
  auth_email: string | null;
  created_at: string | null;
  company_code: string | null;
  company_name: string | null;
  mapped_email: string | null;
  role: string | null;
}

async function main() {
  const rows = await withOwnerTransaction(async (q) => {
    // neon_auth.user SOL tabloda: bağlanmamış hesaplar da görünsün.
    const { rows } = await q.query<Row>(
      `SELECT u.id::text        AS auth_user_id,
              u.email           AS auth_email,
              u."createdAt"::text AS created_at,
              c.company_code    AS company_code,
              c.name            AS company_name,
              m.email           AS mapped_email,
              m.role            AS role
         FROM neon_auth."user" u
         LEFT JOIN users m            ON m.auth_user_id = u.id
         LEFT JOIN rental_companies c ON c.id = m.company_id
        ORDER BY u."createdAt" DESC NULLS LAST`,
    );
    return rows;
  });

  if (rows.length === 0) {
    console.log(
      '\nHiç Neon Auth hesabı yok.\n' +
        'Açmak için: npm run create-auth-user -- --email ... --name "..." --code RNT-XXXX\n',
    );
    return;
  }

  console.log(`\n${rows.length} hesap:\n`);
  for (const r of rows) {
    const bound = r.company_code
      ? `${r.company_code} (${r.company_name ?? '?'}) · ${r.role ?? '?'}`
      : 'BAĞLI DEĞİL — panele giremez';
    console.log(`  ${r.auth_email ?? '(e-posta yok)'}`);
    console.log(`    auth_user_id : ${r.auth_user_id}`);
    console.log(`    şirket       : ${bound}`);
    if (r.mapped_email && r.auth_email && r.mapped_email !== r.auth_email) {
      // Eşleme e-postası bilgi amaçlıdır; kimlik eşleşmesi auth_user_id ile
      // yapılır. Yine de farklıysa operatöre söyle (yazım hatası olabilir).
      console.log(`    NOT: eşleme e-postası farklı -> ${r.mapped_email}`);
    }
    console.log('');
  }

  const unbound = rows.filter((r) => !r.company_code).length;
  if (unbound > 0) {
    console.log(
      `${unbound} hesap hiçbir şirkete bağlı değil. Bağlamak için:\n` +
        '  npm run link-member -- --code RNT-XXXX --email <e-posta> --authUserId <uuid>\n',
    );
  }
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
