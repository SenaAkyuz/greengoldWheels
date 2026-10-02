/**
 * DEMO şirketi + temsili widget etkileşimleri (Stay'deki seed-demo-data'nın
 * Wheels karşılığı). Saf üretici + sahip-rolü SQL çekirdekleri; I/O'lu kabuk
 * scripts/setup-demo.ts'tedir.
 *
 * DÜRÜSTLÜK: üretilen veri TEMSİLİDİR. Panel demo oturumunda bunu üst bantta
 * açıkça söyler ("Bu veriler temsilidir"). Gerçek bir şirketin tablosuna ASLA
 * yazılmaz: çekirdek, şirketin `company_code`'u DEMO_CODE_PREFIX ile
 * başlamıyorsa reddeder.
 *
 * GERÇEKÇİLİK: her event'in metadata'sı, API'nin `recordEvent` sırasında
 * yazdığıyla BİREBİR aynı şekilde `estimateContribution` ile hesaplanır —
 * panel bu satırları gerçek event'lerden ayırt etmeden okur ve sayılar
 * kendi içinde tutarlıdır (CO₂ = km × faktör, tutar = max(alt sınır, ...)).
 *
 * DETERMİNİZM: sabit tohum -> aynı session_ref'ler. Tekrar çalıştırmak
 * çoğaltmaz (unique index + ON CONFLICT). `refresh` verilirse eski demo
 * event'leri silinip bugünden geriye yeniden üretilir — "Bu ay" boş kalmasın.
 */
import type { Queryable } from '../src/database/database';
import {
  estimateContribution,
  type ContributionPricing,
  type VehicleFactor,
} from '../src/common/carbon-estimate';
import { toSeedRows } from '../src/common/vehicle-factors';
import { OperatorError } from './operator.core';

export const DEMO_CODE_PREFIX = 'RNT-DEMO';
export const DEMO_SESSION_PREFIX = 'demo-sess-';

export type DemoEventType =
  | 'widget_goruntulendi'
  | 'arac_secildi'
  | 'checkbox_secildi'
  | 'katki_ekle_butonuna_basildi';

export interface DemoEvent {
  session_ref: string;
  event_type: DemoEventType;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface DemoClass extends VehicleFactor {
  /** Göreli seçilme ağırlığı (ekonomi sınıfları daha sık kiralanır). */
  weight: number;
}

export interface DemoOptions {
  now: Date;
  days: number;
  sessions: number;
  /** görüntüleyen -> katkıyı seçen */
  selectRate: number;
  /** seçen -> onaylayan */
  clickRate: number;
  /** görüntüleyen -> aracı widget'ta değiştiren (huni aşaması DEĞİL) */
  vehicleChangeRate: number;
  seed: number;
}

export const DEFAULT_DEMO_OPTIONS: Omit<DemoOptions, 'now'> = {
  days: 60,
  sessions: 420,
  selectRate: 0.36,
  clickRate: 0.68,
  vehicleChangeRate: 0.22,
  seed: 20261002,
};

/** mulberry32 — küçük, deterministik PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Kiralama yolculuğu mesafeleri (km). Şehir içi kısa kiralamalar çok,
 * şehirlerarası uzun yolculuklar az — düz dağılım gerçekçi olmazdı.
 */
const DISTANCE_BUCKETS: readonly { min: number; max: number; w: number }[] = [
  { min: 40, max: 150, w: 0.34 },
  { min: 150, max: 400, w: 0.36 },
  { min: 400, max: 800, w: 0.22 },
  { min: 800, max: 1500, w: 0.08 },
];

function pickWeighted<T extends { w: number }>(
  items: readonly T[],
  r: number,
): T {
  const total = items.reduce((s, i) => s + i.w, 0);
  let acc = 0;
  for (const item of items) {
    acc += item.w / total;
    if (r < acc) return item;
  }
  return items[items.length - 1];
}

export function generateDemoEvents(
  opts: DemoOptions,
  classes: readonly DemoClass[],
  pricing: ContributionPricing,
): DemoEvent[] {
  if (classes.length === 0) {
    throw new OperatorError(
      'Demo verisi için en az bir aktif araç sınıfı gerekli.',
    );
  }
  const rand = mulberry32(opts.seed);
  const weighted = classes.map((c) => ({ c, w: c.weight }));
  const events: DemoEvent[] = [];

  for (let i = 0; i < opts.sessions; i++) {
    const session_ref = `${DEMO_SESSION_PREFIX}${i}`;
    const bucket = pickWeighted(DISTANCE_BUCKETS, rand());
    const km = Math.round(bucket.min + rand() * (bucket.max - bucket.min));
    const initial = pickWeighted(weighted, rand()).c;

    // Bugün dahil son `days` gün; saat 08–22 arası.
    const dayOffset = Math.floor(rand() * opts.days);
    const base = new Date(opts.now.getTime());
    base.setUTCDate(base.getUTCDate() - dayOffset);
    base.setUTCHours(
      5 + Math.floor(rand() * 14),
      Math.floor(rand() * 60),
      0,
      0,
    );
    // Gelecek zamanlı event olmasın (bugünün ileri saatleri). Oturumun son
    // adımı +4 dk sonra yazıldığı için 10 dk pay bırakılır.
    const latest = opts.now.getTime() - 10 * 60_000;
    if (base.getTime() > latest) {
      base.setTime(latest - Math.floor(rand() * 3_600_000));
    }
    const at = (min: number) =>
      new Date(base.getTime() + min * 60_000).toISOString();

    const md = (c: VehicleFactor) =>
      ({
        ...estimateContribution(km, c, pricing),
        estimate_available: true,
      }) as Record<string, unknown>;

    events.push({
      session_ref,
      event_type: 'widget_goruntulendi',
      created_at: at(0),
      metadata: md(initial),
    });

    let chosen = initial;
    if (rand() < opts.vehicleChangeRate && classes.length > 1) {
      const others = weighted.filter(
        (x) => x.c.class_code !== initial.class_code,
      );
      chosen = pickWeighted(others, rand()).c;
      events.push({
        session_ref,
        event_type: 'arac_secildi',
        created_at: at(1),
        metadata: md(chosen),
      });
    }

    if (rand() < opts.selectRate) {
      events.push({
        session_ref,
        event_type: 'checkbox_secildi',
        created_at: at(2),
        metadata: md(chosen),
      });
      if (rand() < opts.clickRate) {
        events.push({
          session_ref,
          event_type: 'katki_ekle_butonuna_basildi',
          created_at: at(4),
          metadata: md(chosen),
        });
      }
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// SQL çekirdekleri (sahip rolü, çağıranın transaction'ında)
// ---------------------------------------------------------------------------

export interface DemoCompanyInput {
  code: string;
  name: string;
  city: string;
  origins: string[];
  factorYear: number;
}

export interface DemoCompany {
  id: string;
  company_code: string;
  public_widget_key: string;
  created: boolean;
}

/** Ekonomi sınıfları daha sık; elektrikli en az. */
const CLASS_WEIGHTS: Record<string, number> = {
  'ekonomi-benzin': 0.38,
  'ekonomi-dizel': 0.3,
  hibrit: 0.2,
  elektrik: 0.12,
};

export function assertDemoCode(code: string): string {
  const c = code.trim().toUpperCase();
  if (!c.startsWith(DEMO_CODE_PREFIX)) {
    throw new OperatorError(
      `Demo şirket kodu ${DEMO_CODE_PREFIX} ile başlamalı (verilen: ${c}). ` +
        'Temsili veri gerçek bir şirketin tablosuna yazılmasın diye bu zorunlu.',
    );
  }
  return c;
}

/**
 * Demo şirketini garanti eder (idempotent): yoksa oluşturur, araç
 * sınıflarını ekler ve aktifleştirir. Faktörler bilinçli olarak placeholder'dır
 * (demo, onaylı bir metodoloji iddiasında bulunmaz).
 */
export async function ensureDemoCompany(
  q: Queryable,
  input: DemoCompanyInput,
): Promise<DemoCompany> {
  const code = assertDemoCode(input.code);

  const { rows: existing } = await q.query<{
    id: string;
    company_code: string;
    public_widget_key: string;
  }>(
    `SELECT id, company_code, public_widget_key
       FROM rental_companies WHERE company_code = $1`,
    [code],
  );

  let company = existing[0];
  let created = false;
  if (!company) {
    const { rows } = await q.query<{
      id: string;
      company_code: string;
      public_widget_key: string;
    }>(
      `INSERT INTO rental_companies
         (name, company_code, city, country, timezone, default_currency,
          price_per_kg_co2e, min_contribution_amount, status, allowed_origins)
       VALUES ($1, $2, $3, 'TR', 'Europe/Istanbul', 'TRY', 1.25, 19, 'pending', $4)
       RETURNING id, company_code, public_widget_key`,
      [input.name, code, input.city, input.origins],
    );
    company = rows[0];
    created = true;
  }

  for (const v of toSeedRows(company.id, input.factorYear)) {
    await q.query(
      `INSERT INTO vehicle_classes
         (company_id, class_code, label_tr, label_en, fuel_type, co2e_per_km_kg,
          factor_source, factor_country, factor_year, factor_scope, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (company_id, class_code) DO NOTHING`,
      [
        v.company_id,
        v.class_code,
        v.label_tr,
        v.label_en,
        v.fuel_type,
        v.co2e_per_km_kg,
        v.factor_source,
        v.factor_country,
        v.factor_year,
        v.factor_scope,
        v.sort_order,
        v.is_active,
      ],
    );
  }

  await q.query(
    `UPDATE rental_companies SET status = 'active', updated_at = now()
      WHERE id = $1 AND status <> 'active'`,
    [company.id],
  );

  return { ...company, created };
}

/**
 * Demo event'lerini yazar. `refresh` ise önce bu şirketin ESKİ demo
 * event'lerini (yalnızca demo-sess- önekli) siler. Gerçek widget event'lerine
 * dokunmaz.
 */
export async function seedDemoEvents(
  q: Queryable,
  input: { code: string; now: Date; refresh: boolean },
): Promise<{ inserted: number; deleted: number }> {
  const code = assertDemoCode(input.code);
  const { rows: companies } = await q.query<{
    id: string;
    price_per_kg_co2e: string;
    min_contribution_amount: string;
    default_currency: string;
  }>(
    `SELECT id, price_per_kg_co2e, min_contribution_amount, default_currency
       FROM rental_companies WHERE company_code = $1`,
    [code],
  );
  const company = companies[0];
  if (!company) throw new OperatorError(`Şirket bulunamadı: ${code}`);

  const { rows: classRows } = await q.query<{
    class_code: string;
    co2e_per_km_kg: string;
    factor_source: string;
    factor_country: string;
    factor_year: number;
    factor_scope: 'tank_to_wheel' | 'well_to_wheel';
  }>(
    `SELECT class_code, co2e_per_km_kg, factor_source, factor_country,
            factor_year, factor_scope
       FROM vehicle_classes
      WHERE company_id = $1 AND is_active = true
      ORDER BY sort_order, class_code`,
    [company.id],
  );
  const classes: DemoClass[] = classRows.map((r) => ({
    class_code: r.class_code,
    co2e_per_km_kg: Number(r.co2e_per_km_kg),
    factor_source: r.factor_source,
    factor_country: r.factor_country,
    factor_year: Number(r.factor_year),
    factor_scope: r.factor_scope,
    weight: CLASS_WEIGHTS[r.class_code] ?? 0.1,
  }));

  let deleted = 0;
  if (input.refresh) {
    const { rows } = await q.query<{ n: number }>(
      `WITH d AS (
         DELETE FROM widget_events
          WHERE company_id = $1 AND session_ref LIKE $2
          RETURNING 1)
       SELECT count(*)::int AS n FROM d`,
      [company.id, `${DEMO_SESSION_PREFIX}%`],
    );
    deleted = rows[0]?.n ?? 0;
  }

  const events = generateDemoEvents(
    { ...DEFAULT_DEMO_OPTIONS, now: input.now },
    classes,
    {
      price_per_kg_co2e: Number(company.price_per_kg_co2e),
      min_contribution_amount: Number(company.min_contribution_amount),
      currency: company.default_currency,
    },
  );

  // TEK sorgu: satır başına bir INSERT, uzak bir veritabanında (Neon) yüzlerce
  // ağ gidiş-dönüşü demekti ve kurulum dakikalarca sürüyordu.
  const { rows } = await q.query<{ n: number }>(
    `WITH ins AS (
       INSERT INTO widget_events (company_id, event_type, session_ref, metadata, created_at)
       SELECT $1, e.event_type, e.session_ref, e.metadata, e.created_at
         FROM jsonb_to_recordset($2::jsonb)
           AS e(event_type text, session_ref text, metadata jsonb, created_at timestamptz)
       ON CONFLICT (company_id, session_ref, event_type)
         WHERE session_ref IS NOT NULL
         DO NOTHING
       RETURNING 1)
     SELECT count(*)::int AS n FROM ins`,
    [company.id, JSON.stringify(events)],
  );
  return { inserted: rows[0]?.n ?? 0, deleted };
}
