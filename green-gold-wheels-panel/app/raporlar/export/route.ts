import { type NextRequest } from 'next/server';
import { fetchExportCsv, normalizeRange, NotAuthenticatedError } from '@/lib/api';

/**
 * CSV indirmeyi sunucu üzerinden proxy'ler: API token'ı yalnızca sunucuda
 * kullanılır; tarayıcı yalnızca /raporlar/export?range=.. adresini görür.
 * Şirket kimliği istekten ALINMAZ — API onu token'dan çözer.
 */
export async function GET(request: NextRequest) {
  const range = normalizeRange(request.nextUrl.searchParams.get('range') ?? undefined);

  let apiRes: Response;
  try {
    apiRes = await fetchExportCsv(range);
  } catch (e) {
    if (e instanceof NotAuthenticatedError) {
      return new Response('Oturum bulunamadı. Lütfen tekrar giriş yapın.', { status: 401 });
    }
    return new Response('Rapor indirilemedi. API çalışıyor mu?', { status: 502 });
  }

  if (apiRes.status === 401) {
    return new Response('Oturum bulunamadı. Lütfen tekrar giriş yapın.', { status: 401 });
  }
  if (!apiRes.ok) {
    return new Response('Rapor indirilemedi. API çalışıyor mu?', { status: 502 });
  }

  return new Response(await apiRes.arrayBuffer(), {
    headers: {
      'Content-Type': apiRes.headers.get('content-type') ?? 'text/csv; charset=utf-8',
      'Content-Disposition':
        apiRes.headers.get('content-disposition') ??
        'attachment; filename="green-gold-wheels.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
