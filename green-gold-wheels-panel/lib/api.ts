import 'server-only';
import { cookies, headers } from 'next/headers';

/**
 * API istemcisi — panel verisinin TEK kaynağı.
 *
 * Panel veritabanına DOĞRUDAN bağlanmaz. Her şey `green-gold-wheels-api`
 * üzerinden geçer, çünkü tenant izolasyonu (hangi şirketin verisi) orada tek
 * noktada çözülüyor: token -> users eşlemesi -> RLS. Panelin kendi bağlantısı
 * olsaydı aynı kuralı ikinci kez, ikinci bir yerde doğru yazmak zorunda
 * kalırdık.
 *
 * ⚠️ TOKEN BELİRSİZLİĞİ (bilinçli olarak tek dosyada):
 * `@neondatabase/auth` 0.5.0-beta ve dokümanı JWT alma yolunu net vermiyor.
 * Better Auth'un JWT plugin'i `/token` ucunu sağlıyor; biz bunu panelin kendi
 * proxy'si (`/api/auth/token`) üzerinden, oturum çerezini ileterek çağırıyoruz.
 * Çalışmazsa düzeltilecek yer SADECE `getAccessToken()`.
 */

const API_BASE = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Oturum yoksa/sona erdiyse atılır — çağıran /login'e yönlendirir. */
export class NotAuthenticatedError extends Error {
  constructor(message = 'Oturum bulunamadı.') {
    super(message);
    this.name = 'NotAuthenticatedError';
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

/**
 * Oturum çerezinden API'ye gidecek JWT'yi çıkarır.
 *
 * Panelin kendi proxy'sine (aynı origin) istek atar ve gelen çerezleri aynen
 * iletir. Dönen token kısa ömürlüdür (15 dk) — önbelleğe ALINMAZ, her istekte
 * tazesi alınır; bir istek sırasında birkaç çağrı olursa `cache` ile aynı
 * render içinde tekrar kullanılır.
 */
async function fetchAccessToken(): Promise<string> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  if (!cookieHeader) throw new NotAuthenticatedError();

  // Kendi origin'imiz: sunucu tarafında mutlak URL gerekiyor.
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  if (!host) throw new NotAuthenticatedError('İstek başlıkları okunamadı.');

  const res = await fetch(`${proto}://${host}/api/auth/token`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });

  if (!res.ok) throw new NotAuthenticatedError();

  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new NotAuthenticatedError();
  return body.token;
}

/** Oturumdaki kullanıcı (yalnızca kimlik — yetki API'de çözülür). */
export async function getSessionUser(): Promise<{
  id: string;
  email: string | null;
  name: string | null;
} | null> {
  const { auth } = await import('./auth/server');
  try {
    const result = (await auth.getSession()) as {
      data?: { user?: { id?: string; email?: string; name?: string } } | null;
    };
    const user = result?.data?.user;
    if (!user?.id) return null;
    return {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
    };
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const token = await fetchAccessToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    // Panel verisi her zaman taze: önbelleğe alınmış bir şirket özeti
    // başka bir şirketin ekranında görünemez.
    cache: 'no-store',
  });

  let envelope: Envelope<T> | null = null;
  try {
    envelope = (await res.json()) as Envelope<T>;
  } catch {
    /* gövde JSON değilse aşağıda status'a göre hata üretilir */
  }

  if (!res.ok || !envelope?.success) {
    if (res.status === 401) throw new NotAuthenticatedError();
    throw new ApiError(
      res.status,
      envelope?.error?.code ?? 'error',
      envelope?.error?.message ?? `İstek başarısız (HTTP ${res.status}).`,
    );
  }

  return envelope.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body }),
};

// ---------------------------------------------------------------------------
// API sözleşmesi (green-gold-wheels-api ile birebir)
// ---------------------------------------------------------------------------

export interface Company {
  name: string;
  company_code: string;
  city: string | null;
  country: string;
  timezone: string;
  default_currency: string;
  commission_rate: string;
  price_per_kg_co2e: string;
  min_contribution_amount: string;
  public_widget_key: string;
  allowed_origins: string[];
  status: 'pending' | 'active' | 'suspended';
  /**
   * Oturumdaki kullanıcının rolü. YALNIZCA arayüz içindir (demo rozeti,
   * formları kilitleme). Yetki DEĞİLDİR: yazma yasağını API'deki
   * DemoReadOnlyGuard uygular — bu alan elle değiştirilse bile hiçbir şey
   * kaydedilemez.
   */
  role: 'filo_yoneticisi' | 'demo_viewer';
}

export const isDemo = (c: Pick<Company, 'role'>) => c.role === 'demo_viewer';

/** Tarayıcının (widget'ın) konuşacağı API adresi. */
export function publicApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'
  ).replace(/\/+$/, '');
}

/**
 * Widget script'inin adresi. Panel bundle'ı kendi `public/` klasöründen
 * servis eder (npm run sync-widget). Canlıda NEXT_PUBLIC_WIDGET_SRC (CDN) ya da
 * NEXT_PUBLIC_SITE_URL (panelin kendi domain'i) verilir; ikisi de yoksa embed
 * kodunda bilinçli olarak doldurulması gereken bir yer tutucu görünür.
 */
export function widgetEmbedSrc(): { src: string; configured: boolean } {
  const explicit = process.env.NEXT_PUBLIC_WIDGET_SRC;
  if (explicit) return { src: explicit, configured: true };
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (site) {
    return { src: `${site}/green-gold-wheels-widget.v1.js`, configured: true };
  }
  return {
    src: 'https://<panel-domain>/green-gold-wheels-widget.v1.js',
    configured: false,
  };
}

/**
 * CSV indirme: zarf yok, ham gövde. Token yalnızca sunucuda kullanılır —
 * tarayıcı yalnızca panelin kendi /raporlar/export adresini görür.
 */
export async function fetchExportCsv(range: Range): Promise<Response> {
  const token = await fetchAccessToken();
  return fetch(
    `${API_BASE}/dashboard/export.csv?range=${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
}

export interface VehicleClass {
  class_code: string;
  label_tr: string;
  label_en: string;
  fuel_type: string;
  co2e_per_km_kg: string;
  factor_source: string;
  factor_country: string;
  factor_year: number;
  factor_scope: 'tank_to_wheel' | 'well_to_wheel';
  sort_order: number;
  is_active: boolean;
}

export interface Period {
  from: string;
  to: string;
}

export interface Summary {
  period: Period;
  raw_counts: {
    widget_goruntulendi: number;
    arac_secildi: number;
    checkbox_secildi: number;
    katki_ekle_butonuna_basildi: number;
    rezervasyona_devam_edildi: number;
  };
  stages: { viewed: number; selected: number; clicked: number };
  vehicle_selected_sessions: number;
  conversion_rate_pct: number;
}

export interface CarbonSummary {
  period: Period;
  estimated_co2e_kg: number;
  tree_equivalent: number;
  contributions_count: number;
  total_distance_km: number;
  missing_estimate_count: number;
  is_estimated: boolean;
}

export interface Funnel {
  period: Period;
  stages: { viewed: number; selected: number; clicked: number };
  rates: {
    view_to_select_pct: number;
    select_to_button_pct: number;
    view_to_button_pct: number;
  };
}

/** Panelin desteklediği tarih aralıkları — hesap BACKEND'de, şirket tz'inde. */
export type Range = 'month' | '7d' | '30d';

export const RANGES: { value: Range; label: string }[] = [
  { value: 'month', label: 'Bu ay' },
  { value: '7d', label: 'Son 7 gün' },
  { value: '30d', label: 'Son 30 gün' },
];

export function normalizeRange(raw: string | undefined): Range {
  return raw === '7d' || raw === '30d' ? raw : 'month';
}

export const dashboard = {
  company: () => api.get<Company>('/dashboard/company'),
  vehicleClasses: () => api.get<VehicleClass[]>('/dashboard/vehicle-classes'),
  summary: (range: Range) =>
    api.get<Summary>(`/dashboard/widget-events-summary?range=${range}`),
  carbon: (range: Range) =>
    api.get<CarbonSummary>(`/dashboard/carbon-summary?range=${range}`),
  funnel: (range: Range) => api.get<Funnel>(`/dashboard/funnel?range=${range}`),
};
