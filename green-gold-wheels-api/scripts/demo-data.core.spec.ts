/**
 * Demo kurulum çekirdekleri — gerçek Postgres (PGlite), üretim migration'ları,
 * SAHİP rolü. Ayrıca üretilen verinin PANEL tarafından doğru okunduğunu
 * gerçek DashboardService ile kanıtlar (demo sayıları kendi içinde tutarlı).
 */
import {
  DEFAULT_DEMO_OPTIONS,
  DEMO_SESSION_PREFIX,
  assertDemoCode,
  ensureDemoCompany,
  generateDemoEvents,
  seedDemoEvents,
  type DemoClass,
} from './demo-data.core';
import { ensureMember, OperatorError } from './operator.core';
import { estimateContribution } from '../src/common/carbon-estimate';
import { DashboardService } from '../src/dashboard/dashboard.service';
import {
  createTestDatabase,
  seedAuthUser,
  type PgliteDatabase,
} from '../test/pglite-db';

let db: PgliteDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.reset();
});

const NOW = new Date('2026-10-02T12:00:00Z');

const CLASSES: DemoClass[] = [
  {
    class_code: 'ekonomi-benzin',
    co2e_per_km_kg: 0.171,
    factor_source: 'placeholder',
    factor_country: 'TR',
    factor_year: 2026,
    factor_scope: 'tank_to_wheel',
    weight: 0.6,
  },
  {
    class_code: 'elektrik',
    co2e_per_km_kg: 0.047,
    factor_source: 'placeholder',
    factor_country: 'TR',
    factor_year: 2026,
    factor_scope: 'well_to_wheel',
    weight: 0.4,
  },
];
const PRICING = {
  price_per_kg_co2e: 1.25,
  min_contribution_amount: 19,
  currency: 'TRY',
};

const demoInput = {
  code: 'RNT-DEMO',
  name: 'Green Gold Demo Rent a Car',
  city: 'İstanbul',
  origins: ['https://demo.greengold-wheels.example'],
  factorYear: 2026,
};

describe('generateDemoEvents (saf)', () => {
  const events = generateDemoEvents(
    { ...DEFAULT_DEMO_OPTIONS, now: NOW },
    CLASSES,
    PRICING,
  );

  it('deterministik: ayni tohum -> ayni veri', () => {
    const again = generateDemoEvents(
      { ...DEFAULT_DEMO_OPTIONS, now: NOW },
      CLASSES,
      PRICING,
    );
    expect(again).toEqual(events);
  });

  it('huni MONOTON ve donusum %100 degil', () => {
    const by = (t: string) =>
      new Set(
        events.filter((e) => e.event_type === t).map((e) => e.session_ref),
      );
    const viewed = by('widget_goruntulendi');
    const selected = by('checkbox_secildi');
    const clicked = by('katki_ekle_butonuna_basildi');
    expect(viewed.size).toBe(DEFAULT_DEMO_OPTIONS.sessions);
    for (const s of selected) expect(viewed.has(s)).toBe(true);
    for (const s of clicked) expect(selected.has(s)).toBe(true);
    expect(selected.size).toBeLessThan(viewed.size);
    expect(clicked.size).toBeLessThan(selected.size);
    expect(clicked.size).toBeGreaterThan(0);
  });

  it('metadata API nin yazdigiyla BIREBIR ayni (sunucu formulu)', () => {
    for (const e of events.slice(0, 50)) {
      const md = e.metadata;
      const cls = CLASSES.find((c) => c.class_code === md.vehicle_class_code)!;
      expect(md).toEqual({
        ...estimateContribution(md.distance_km, cls, PRICING),
        estimate_available: true,
      });
    }
  });

  it('gelecek tarihli event YOK ve hepsi son 60 gun icinde', () => {
    const min = NOW.getTime() - 61 * 86_400_000;
    for (const e of events) {
      const t = new Date(e.created_at).getTime();
      expect(t).toBeLessThanOrEqual(NOW.getTime());
      expect(t).toBeGreaterThan(min);
    }
  });

  it('session_ref leri demo onekli (gercek veriden ayrilabilir)', () => {
    expect(
      events.every((e) => e.session_ref.startsWith(DEMO_SESSION_PREFIX)),
    ).toBe(true);
  });
});

describe('assertDemoCode', () => {
  it('RNT-DEMO onekli olmayan koda temsili veri YAZDIRMAZ', () => {
    expect(() => assertDemoCode('RNT-GREENG')).toThrow(OperatorError);
    expect(assertDemoCode('rnt-demo')).toBe('RNT-DEMO');
  });
});

describe('ensureDemoCompany', () => {
  it('olusturur, arac siniflarini ekler, aktiflestirir; ikinci kez idempotent', async () => {
    const first = await db.asOwner((q) => ensureDemoCompany(q, demoInput));
    expect(first.created).toBe(true);
    const second = await db.asOwner((q) => ensureDemoCompany(q, demoInput));
    expect(second.created).toBe(false);
    expect(second.public_widget_key).toBe(first.public_widget_key);

    const { rows } = await db.asOwner((q) =>
      q.query<{ status: string; n: number }>(
        `SELECT c.status, (SELECT count(*)::int FROM vehicle_classes v WHERE v.company_id = c.id) AS n
           FROM rental_companies c WHERE c.company_code = 'RNT-DEMO'`,
      ),
    );
    expect(rows[0]).toEqual({ status: 'active', n: 4 });
  });

  it('gercek bir sirket koduyla calismaz', async () => {
    await expect(
      db.asOwner((q) =>
        ensureDemoCompany(q, { ...demoInput, code: 'RNT-ACME' }),
      ),
    ).rejects.toThrow(/RNT-DEMO/);
  });
});

describe('seedDemoEvents', () => {
  it('yazar, tekrar calistirinca COGALTMAZ, refresh yeniden uretir', async () => {
    await db.asOwner((q) => ensureDemoCompany(q, demoInput));
    const a = await db.asOwner((q) =>
      seedDemoEvents(q, { code: 'RNT-DEMO', now: NOW, refresh: false }),
    );
    expect(a.inserted).toBeGreaterThan(DEFAULT_DEMO_OPTIONS.sessions);

    const b = await db.asOwner((q) =>
      seedDemoEvents(q, { code: 'RNT-DEMO', now: NOW, refresh: false }),
    );
    expect(b.inserted).toBe(0);

    const c = await db.asOwner((q) =>
      seedDemoEvents(q, { code: 'RNT-DEMO', now: NOW, refresh: true }),
    );
    expect(c.deleted).toBe(a.inserted);
    expect(c.inserted).toBe(a.inserted);
  });

  it('refresh GERCEK (demo onekli olmayan) event lere dokunmaz', async () => {
    const company = await db.asOwner((q) => ensureDemoCompany(q, demoInput));
    await db.asOwner((q) =>
      q.query(
        `INSERT INTO widget_events (company_id, event_type, session_ref)
         VALUES ($1, 'widget_goruntulendi', 'gercek-1')`,
        [company.id],
      ),
    );
    await db.asOwner((q) =>
      seedDemoEvents(q, { code: 'RNT-DEMO', now: NOW, refresh: true }),
    );
    const { rows } = await db.asOwner((q) =>
      q.query<{ n: number }>(
        "SELECT count(*)::int n FROM widget_events WHERE session_ref = 'gercek-1'",
      ),
    );
    expect(rows[0].n).toBe(1);
  });

  it('panel (DashboardService, RLS altinda) demo verisini tutarli okur', async () => {
    const company = await db.asOwner((q) => ensureDemoCompany(q, demoInput));
    // Göreli "now": son 30 gün aralığı testin çalıştığı güne göre çözülür.
    await db.asOwner((q) =>
      seedDemoEvents(q, { code: 'RNT-DEMO', now: new Date(), refresh: true }),
    );
    const svc = new DashboardService(db);
    const funnel = await svc.getFunnel(company.id, { range: '30d' });
    const carbon = await svc.getCarbonSummary(company.id, { range: '30d' });

    expect(funnel.stages.viewed).toBeGreaterThan(0);
    expect(funnel.stages.viewed).toBeGreaterThanOrEqual(funnel.stages.selected);
    expect(funnel.stages.selected).toBeGreaterThanOrEqual(
      funnel.stages.clicked,
    );
    expect(carbon.contributions_count).toBe(funnel.stages.clicked);
    expect(carbon.missing_estimate_count).toBe(0);
    expect(carbon.estimated_co2e_kg).toBeGreaterThan(0);
  });
});

describe('ensureMember — demo_viewer rolu', () => {
  const AUTH = '20000000-0000-4000-8000-000000000001';

  it('demo hesabi demo_viewer rolüyle baglanir', async () => {
    await db.asOwner((q) => ensureDemoCompany(q, demoInput));
    await seedAuthUser(db, { id: AUTH, email: 'demo@demo.example' });
    const r = await db.asOwner((q) =>
      ensureMember(q, {
        code: 'RNT-DEMO',
        email: 'demo@demo.example',
        fullName: 'Demo Kullanıcı',
        authUserId: AUTH,
        role: 'demo_viewer',
      }),
    );
    expect(r).toBe('created');
    const { rows } = await db.asOwner((q) =>
      q.query<{ role: string }>(
        'SELECT role FROM users WHERE auth_user_id = $1',
        [AUTH],
      ),
    );
    expect(rows[0].role).toBe('demo_viewer');

    // İkinci çalıştırma idempotent.
    await expect(
      db.asOwner((q) =>
        ensureMember(q, {
          code: 'RNT-DEMO',
          email: 'demo@demo.example',
          fullName: 'Demo Kullanıcı',
          authUserId: AUTH,
          role: 'demo_viewer',
        }),
      ),
    ).resolves.toBe('already-linked');
  });

  it('mevcut uyenin rolu SESSIZCE degistirilmez', async () => {
    await db.asOwner((q) => ensureDemoCompany(q, demoInput));
    await seedAuthUser(db, { id: AUTH, email: 'demo@demo.example' });
    await db.asOwner((q) =>
      ensureMember(q, {
        code: 'RNT-DEMO',
        email: 'demo@demo.example',
        fullName: 'Demo Kullanıcı',
        authUserId: AUTH,
        role: 'demo_viewer',
      }),
    );
    await expect(
      db.asOwner((q) =>
        ensureMember(q, {
          code: 'RNT-DEMO',
          email: 'demo@demo.example',
          fullName: 'Demo Kullanıcı',
          authUserId: AUTH,
        }),
      ),
    ).rejects.toThrow(/demo_viewer/);
  });

  it('veritabani bilinmeyen rolu REDDEDER (CHECK)', async () => {
    const company = await db.asOwner((q) => ensureDemoCompany(q, demoInput));
    await expect(
      db.asOwner((q) =>
        q.query(
          `INSERT INTO users (company_id, full_name, email, role)
           VALUES ($1, 'X', 'x@x.example', 'admin')`,
          [company.id],
        ),
      ),
    ).rejects.toThrow(/users_role_valid/);
  });
});
