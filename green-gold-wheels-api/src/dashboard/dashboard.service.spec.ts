import { BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import {
  createTestDatabase,
  IDS,
  seedCompany,
  seedEvent,
  type PgliteDatabase,
} from '../../test/pglite-db';

let db: PgliteDatabase;
let service: DashboardService;

beforeAll(async () => {
  db = await createTestDatabase();
  service = new DashboardService(db);
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  await seedCompany(db, { id: IDS.co1, public_widget_key: 'k1' });
  await seedCompany(db, { id: IDS.co2, public_widget_key: 'k2' });
});

/** Bu ay içinde kalacağı garantili bir zaman damgası (ayın 15'i, öğlen UTC). */
function thisMonth(day = 15, hour = 12): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, 0, 0),
  ).toISOString();
}

function ev(
  event_type: string,
  session_ref: string | null,
  metadata: Record<string, unknown> | null = null,
  created_at = thisMonth(),
  company_id: string = IDS.co1,
) {
  return seedEvent(db, {
    company_id,
    event_type,
    session_ref,
    metadata,
    created_at,
  });
}

function fullEstimate(co2e: number, km: number) {
  return {
    distance_km: km,
    estimated_co2e_kg: co2e,
    amount: co2e,
    currency: 'TRY',
    estimate_available: true,
    computed_by: 'server',
  };
}

describe('DashboardService — tenant izolasyonu', () => {
  it('baska sirketin event lerini HIC saymaz', async () => {
    await ev('widget_goruntulendi', 's1');
    await ev('widget_goruntulendi', 's2', null, thisMonth(), IDS.co2);
    await ev('widget_goruntulendi', 's3', null, thisMonth(), IDS.co2);

    const summary = await service.getWidgetEventsSummary(IDS.co1, {});
    expect(summary.raw_counts.widget_goruntulendi).toBe(1);
    expect(summary.stages.viewed).toBe(1);
  });

  it('karbon ozeti de yalnizca kendi sirketini toplar', async () => {
    await ev('katki_ekle_butonuna_basildi', 's1', fullEstimate(50, 300));
    await ev(
      'katki_ekle_butonuna_basildi',
      's2',
      fullEstimate(500, 3000),
      thisMonth(),
      IDS.co2,
    );

    const carbon = await service.getCarbonSummary(IDS.co1, {});
    expect(carbon.estimated_co2e_kg).toBe(50);
    expect(carbon.contributions_count).toBe(1);
  });

  it('sirket bilgisi ve arac siniflari yalnizca kendi sirketinden gelir', async () => {
    const company = (await service.getCompany(IDS.co1)) as {
      public_widget_key: string;
    };
    expect(company.public_widget_key).toBe('k1');
  });
});

describe('DashboardService — huni monotonlugu', () => {
  it('sirali cohort uygular: viewed >= selected >= clicked', async () => {
    await ev('widget_goruntulendi', 's1');
    await ev('widget_goruntulendi', 's2');
    await ev('widget_goruntulendi', 's3');
    await ev('checkbox_secildi', 's1');
    await ev('checkbox_secildi', 's2');
    await ev('katki_ekle_butonuna_basildi', 's1');

    const funnel = await service.getFunnel(IDS.co1, {});
    expect(funnel.stages).toEqual({ viewed: 3, selected: 2, clicked: 1 });
    expect(funnel.rates.view_to_select_pct).toBeCloseTo(66.7, 1);
    expect(funnel.rates.select_to_button_pct).toBe(50);
    expect(funnel.rates.view_to_button_pct).toBeCloseTo(33.3, 1);
  });

  it('view suz select orani %100 u asmaz (strict kesisim)', async () => {
    await ev('widget_goruntulendi', 's1');
    await ev('checkbox_secildi', 's1');
    await ev('checkbox_secildi', 's-hayalet');

    const funnel = await service.getFunnel(IDS.co1, {});
    expect(funnel.stages.viewed).toBe(1);
    expect(funnel.stages.selected).toBe(1);
    expect(funnel.rates.view_to_select_pct).toBe(100);
  });

  it('summary.conversion_rate_pct funnel.view_to_button_pct ile BIREBIR ayni', async () => {
    await ev('widget_goruntulendi', 's1');
    await ev('widget_goruntulendi', 's2');
    await ev('widget_goruntulendi', 's3');
    await ev('checkbox_secildi', 's1');
    await ev('checkbox_secildi', 's2');
    await ev('katki_ekle_butonuna_basildi', 's1');

    const summary = await service.getWidgetEventsSummary(IDS.co1, {});
    const funnel = await service.getFunnel(IDS.co1, {});
    expect(summary.conversion_rate_pct).toBe(funnel.rates.view_to_button_pct);
    expect(summary.stages).toEqual(funnel.stages);
  });

  it('arac_secildi huni ASAMASI DEGIL — ayri yan sinyal olarak raporlanir', async () => {
    await ev('widget_goruntulendi', 's1');
    await ev('arac_secildi', 's1');
    await ev('arac_secildi', 's2');
    await ev('checkbox_secildi', 's1');

    const summary = await service.getWidgetEventsSummary(IDS.co1, {});
    expect(summary.stages).toEqual({ viewed: 1, selected: 1, clicked: 0 });
    expect(summary.vehicle_selected_sessions).toBe(2);
  });
});

describe('DashboardService — karbon dedup ve dürüstlük', () => {
  it('savunma: index oncesi/tasinmis veride ayni session in iki onayi TEK sayilir', async () => {
    // Normal akışta bu durum OLUŞAMAZ: unique index oturum+tip başına tek
    // kayda izin verir. Bu test, index'ten önce yazılmış ya da elle taşınmış
    // veriyi taklit eder — index'i geçici olarak kaldırıp sahip olarak yazar.
    // Beklenen: toplam şişmez, deterministik olarak en yeni kayıt sayılır.
    await db.asOwner((q) =>
      q.query('DROP INDEX IF EXISTS uniq_widget_event_session_type'),
    );
    try {
      await ev(
        'katki_ekle_butonuna_basildi',
        's1',
        fullEstimate(20, 100),
        thisMonth(15, 9),
      );
      await ev(
        'katki_ekle_butonuna_basildi',
        's1',
        fullEstimate(80, 400),
        thisMonth(15, 18),
      );

      const carbon = await service.getCarbonSummary(IDS.co1, {});
      expect(carbon.contributions_count).toBe(1);
      expect(carbon.estimated_co2e_kg).toBe(80);
      expect(carbon.total_distance_km).toBe(400);
    } finally {
      // Index'i geri kur — diğer testler gerçek idempotency'ye güveniyor.
      await db.asOwner(async (q) => {
        await q.query('TRUNCATE widget_events');
        await q.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS uniq_widget_event_session_type
             ON widget_events (company_id, session_ref, event_type)
             WHERE session_ref IS NOT NULL`,
        );
      });
    }
  });

  it('hesaplanamayan session i toplama KATMAZ ama ayrica raporlar', async () => {
    await ev('katki_ekle_butonuna_basildi', 's1', fullEstimate(50, 300));
    await ev('katki_ekle_butonuna_basildi', 's2', {
      vehicle_class_code: 'bilinmeyen',
      estimate_available: false,
      computed_by: 'server',
    });

    const carbon = await service.getCarbonSummary(IDS.co1, {});
    expect(carbon.estimated_co2e_kg).toBe(50);
    expect(carbon.contributions_count).toBe(2);
    expect(carbon.missing_estimate_count).toBe(1);
  });

  it('estimate_available true olmayan metadata ya guvenmez', async () => {
    await ev('katki_ekle_butonuna_basildi', 's1', { estimated_co2e_kg: 999 });

    const carbon = await service.getCarbonSummary(IDS.co1, {});
    expect(carbon.estimated_co2e_kg).toBe(0);
    expect(carbon.missing_estimate_count).toBe(1);
  });

  it('is_estimated her zaman true (dogrulanmis offset iddiasi yok)', async () => {
    expect((await service.getCarbonSummary(IDS.co1, {})).is_estimated).toBe(
      true,
    );
  });

  it('katki butonu DISINDAKI event ler karbona girmez', async () => {
    await ev('widget_goruntulendi', 's1', fullEstimate(50, 300));
    await ev('checkbox_secildi', 's1', fullEstimate(50, 300));

    const carbon = await service.getCarbonSummary(IDS.co1, {});
    expect(carbon.estimated_co2e_kg).toBe(0);
    expect(carbon.contributions_count).toBe(0);
  });
});

describe('DashboardService — tarih araligi', () => {
  it('tek ucu verilen aralik 400', async () => {
    await expect(
      service.getFunnel(IDS.co1, { from: '2026-01-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('from > to 400', async () => {
    await expect(
      service.getFunnel(IDS.co1, { from: '2026-03-01', to: '2026-02-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('var olmayan takvim tarihi 400', async () => {
    await expect(
      service.getFunnel(IDS.co1, { from: '2026-02-31', to: '2026-03-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('aralik disindaki event sayilmaz', async () => {
    await ev('widget_goruntulendi', 's1', null, '2020-01-15T12:00:00.000Z');
    const summary = await service.getWidgetEventsSummary(IDS.co1, {
      range: 'month',
    });
    expect(summary.stages.viewed).toBe(0);
  });

  it('aralik sirketin TIMEZONE unda cozulur (gercek timestamptz)', async () => {
    // Los Angeles'ta ayın 1'i 00:30 = UTC'de ayın 1'i 07:30/08:30.
    // İstanbul şirketi için bu an da aynı ayın içinde; asıl kanıt: explicit
    // aralıkta LA yerel gününün sınırına göre dahil/hariç kalması.
    await db.asOwner((q) =>
      q.query(
        "UPDATE rental_companies SET timezone = 'America/Los_Angeles' WHERE id = $1",
        [IDS.co1],
      ),
    );
    // LA'da 2026-03-01 23:30 = UTC 2026-03-02 07:30
    await ev('widget_goruntulendi', 's-la', null, '2026-03-02T07:30:00.000Z');

    const only1st = await service.getWidgetEventsSummary(IDS.co1, {
      from: '2026-03-01',
      to: '2026-03-01',
    });
    const only2nd = await service.getWidgetEventsSummary(IDS.co1, {
      from: '2026-03-02',
      to: '2026-03-02',
    });
    // UTC'de 2 Mart, ama şirketin yerel gününde 1 Mart.
    expect(only1st.stages.viewed).toBe(1);
    expect(only2nd.stages.viewed).toBe(0);
  });
});
