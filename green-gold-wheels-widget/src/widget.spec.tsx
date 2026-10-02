/**
 * Widget davranış testleri — jsdom, gerçek Shadow DOM, gerçek custom element.
 *
 * `fetch` sahtelenir (ağ yok) ama widget'ın kendi kodu olduğu gibi çalışır:
 * config çekme, shadow root kurma, hesap, event gönderme, host callback.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { estimateContribution } from '@wheels/carbon';
import './main';
import type { WidgetConfig, WidgetImpact } from './types';

const KEY = 'test-widget-key';
const API = 'https://api.test';

const PETROL = {
  class_code: 'ekonomi-benzin',
  label_tr: 'Ekonomi · Benzinli',
  label_en: 'Economy · Petrol',
  fuel_type: 'benzin',
  co2e_per_km_kg: 0.171,
  factor_source: 'placeholder',
  factor_country: 'TR',
  factor_year: 2026,
  factor_scope: 'tank_to_wheel' as const,
  is_placeholder_factor: true,
};

const ELECTRIC = {
  ...PETROL,
  class_code: 'elektrik',
  label_tr: 'Elektrikli · şebeke tahmini',
  label_en: 'Electric · grid estimate',
  fuel_type: 'elektrik',
  co2e_per_km_kg: 0.047,
  factor_scope: 'well_to_wheel' as const,
};

function config(over: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    company_name: 'Pilot Araç Kiralama',
    city: 'İstanbul',
    currency: 'TRY',
    price_per_kg_co2e: 1,
    min_contribution_amount: 19,
    vehicle_classes: [PETROL, ELECTRIC],
    is_estimated: true,
    logo_url: null,
    brand_color: null,
    show_estimated_impact: false,
    content_overrides: {},
    ...over,
  };
}

interface PostedEvent {
  event_type: string;
  session_ref?: string;
  metadata?: Record<string, unknown>;
}

let posted: PostedEvent[] = [];
let configResponse: WidgetConfig | null = null;
let impactResponse: WidgetImpact | null = null;

beforeEach(() => {
  posted = [];
  configResponse = config();
  impactResponse = null;

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/widget/config')) {
        return Promise.resolve({
          ok: configResponse !== null,
          json: () =>
            Promise.resolve({
              success: configResponse !== null,
              data: configResponse,
            }),
        } as Response);
      }
      if (url.includes('/widget/impact')) {
        return Promise.resolve({
          ok: impactResponse !== null,
          json: () =>
            Promise.resolve({
              success: impactResponse !== null,
              data: impactResponse,
            }),
        } as Response);
      }
      if (url.includes('/widget/events')) {
        posted.push(JSON.parse(String(init?.body)) as PostedEvent);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { id: 'x' } }),
        } as Response);
      }
      return Promise.reject(new Error(`beklenmeyen istek: ${url}`));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  try {
    window.sessionStorage.clear();
  } catch {
    /* jsdom'da engelliyse önemsiz */
  }
});

/** Elementi kurar ve ilk render'ı bekler. */
async function mount(attrs: Record<string, string> = {}) {
  const el = document.createElement('green-gold-wheels-widget');
  el.setAttribute('data-key', KEY);
  el.setAttribute('data-api', API);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  // connectedCallback async: microtask kuyruğunu boşalt.
  await vi.waitFor(() => {
    if (attrs['data-tracker-only'] !== 'true' && configResponse) {
      if (!el.shadowRoot?.querySelector('.card')) throw new Error('henüz yok');
    }
  });
  return el;
}

const q = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel);
const text = (el: Element, sel: string) => q(el, sel)?.textContent?.trim() ?? '';

describe('kurulum ve izolasyon', () => {
  it('shadow root icinde render eder (host CSS sizamaz)', async () => {
    const el = await mount();
    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.card')).toBeTruthy();
    // Host DOM'da kart YOK — stil izolasyonunun ön şartı.
    expect(document.querySelector('.card')).toBeNull();
  });

  it('data-key YOKSA hicbir sey yapmaz (host sayfayi bozmaz)', async () => {
    const el = document.createElement('green-gold-wheels-widget');
    el.setAttribute('data-api', API);
    document.body.append(el);
    await Promise.resolve();
    expect(el.shadowRoot).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('gecersiz key / pasif sirket -> sessizce render ETMEZ', async () => {
    configResponse = null;
    const el = document.createElement('green-gold-wheels-widget');
    el.setAttribute('data-key', KEY);
    el.setAttribute('data-api', API);
    document.body.append(el);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(el.shadowRoot?.querySelector('.card')).toBeFalsy();
    expect(posted).toHaveLength(0);
  });

  it('arac sinifi yoksa render ETMEZ (hesap yapilamaz)', async () => {
    configResponse = config({ vehicle_classes: [] });
    const el = document.createElement('green-gold-wheels-widget');
    el.setAttribute('data-key', KEY);
    el.setAttribute('data-api', API);
    document.body.append(el);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(el.shadowRoot?.querySelector('.card')).toBeFalsy();
  });

  it('DOM dan cikip tekrar eklenince TEK shadow root kalir', async () => {
    const el = await mount();
    const first = el.shadowRoot;
    el.remove();
    document.body.append(el);
    await vi.waitFor(() => expect(q(el, '.card')).toBeTruthy());
    expect(el.shadowRoot).toBe(first);
  });
});

describe('hesap — API ile AYNI fonksiyon', () => {
  it('gosterilen CO2 ve tutar, sunucunun hesabiyla BIREBIR ayni', async () => {
    const el = await mount({ 'data-distance-km': '350' });
    const expected = estimateContribution(350, PETROL, {
      price_per_kg_co2e: 1,
      min_contribution_amount: 19,
      currency: 'TRY',
    });

    expect(expected.estimated_co2e_kg).toBe(59.85);
    // Orbit'te 1 ondalıkla gösterilir (tr-TR: virgül).
    expect(text(el, '.orbit-value')).toBe('59,9');
    expect(text(el, '.contribution .amount')).toContain('59,85');
    expect(expected.amount).toBe(59.85);
  });

  it('formul satiri mesafe ve faktoru gosterir', async () => {
    const el = await mount({ 'data-distance-km': '350' });
    expect(text(el, '.formula')).toBe('350 km × 0,171 kg CO₂e/km');
  });

  it('arac degisince hesap ANINDA guncellenir', async () => {
    const el = await mount({ 'data-distance-km': '350' });
    const select = q(el, 'select') as HTMLSelectElement;
    select.value = 'elektrik';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => expect(text(el, '.orbit-value')).toBe('16,5'));
    // 350 × 0.047 = 16.45 -> taban 19 TL devreye girer.
    expect(text(el, '.contribution .amount')).toContain('19');
  });

  it('mesafe degisince hesap guncellenir', async () => {
    const el = await mount({ 'data-distance-km': '100' });
    const input = q(el, 'input[type=number]') as HTMLInputElement;
    input.value = '500';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await vi.waitFor(() => expect(text(el, '.orbit-value')).toBe('85,5'));
  });

  it('alt sinir uygulandiginda bunu ACIKCA soyler', async () => {
    const el = await mount({ 'data-distance-km': '10' });
    // 10 × 0.171 = 1.71 kg -> 1.71 TL < 19 TL taban
    expect(text(el, '.note')).toMatch(/En düşük katkı tutarı/);
  });

  it('HOST sonradan mesafe/arac attribute unu degistirirse kart guncellenir', async () => {
    // Gerçek senaryo: müşteri rezervasyon formunda aracı ya da güzergâhı
    // değiştirir, host sayfa attribute'u günceller. Kart eski değerde kalmamalı.
    const el = await mount({ 'data-distance-km': '100' });
    el.setAttribute('data-distance-km', '500');
    await vi.waitFor(() => expect(text(el, '.orbit-value')).toBe('85,5'));

    el.setAttribute('data-vehicle-class', 'elektrik');
    await vi.waitFor(() =>
      expect((q(el, 'select') as HTMLSelectElement).value).toBe('elektrik'),
    );
    // 500 × 0.047 = 23.5
    expect(text(el, '.orbit-value')).toBe('23,5');
  });

  it('host girdisi degisince onceki onay sifirlanir (eski tutarla kalmaz)', async () => {
    const el = await mount({ 'data-distance-km': '350' });
    (q(el, '.contribution input') as HTMLInputElement).click();
    await vi.waitFor(() =>
      expect((q(el, 'button.primary') as HTMLButtonElement).disabled).toBe(false),
    );
    (q(el, 'button.primary') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(q(el, '.confirm')).toBeTruthy());

    el.setAttribute('data-distance-km', '600');
    await vi.waitFor(() => expect(q(el, '.confirm')).toBeFalsy());
    expect(q(el, 'button.primary')).toBeTruthy();
  });

  it('bant disi mesafe guvenli sinira cekilir', async () => {
    const el = await mount({ 'data-distance-km': '999999' });
    const input = q(el, 'input[type=number]') as HTMLInputElement;
    expect(Number(input.value)).toBe(20000);
  });
});

describe('sadelestirilmis kart', () => {
  it('orbit etiketi tahmin oldugunu soyler (ayri metodoloji blogu YOK)', async () => {
    const el = await mount();
    expect(text(el, '.orbit-label')).toMatch(/Tahmini karbon etkisi/i);
  });

  it('metodoloji aciklamalari kartta GOSTERILMEZ (Sena karari)', async () => {
    const el = await mount();
    const txt = el.shadowRoot!.textContent ?? '';
    expect(txt).not.toMatch(/kesin ölçüm değildir/);
    expect(txt).not.toMatch(/Kapsam:/);
    expect(txt).not.toMatch(/Kaynak:/);
    expect(txt).not.toMatch(/onaylanmamış/);
  });

  it('onay mesaji ucret eklenmedigini ACIKCA soyler', async () => {
    const el = await mount();
    (q(el, '.contribution input') as HTMLInputElement).click();
    await vi.waitFor(() =>
      expect((q(el, '.primary') as HTMLButtonElement).disabled).toBe(false),
    );
    (q(el, '.primary') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(q(el, '.confirm')).toBeTruthy());
    expect(text(el, '.confirm')).toMatch(/henüz herhangi bir ücret eklenmedi/);
  });

  it('faktor provenance API den gelmeye DEVAM eder (panel/denetim icin)', async () => {
    // Kartta gösterilmiyor ama veri akışta duruyor: panelde (Adım 3) ve
    // activate-company kapısında metodoloji denetimi buna dayanıyor.
    const el = await mount();
    expect(el).toBeTruthy();
    expect(configResponse!.vehicle_classes[0].is_placeholder_factor).toBe(true);
    expect(configResponse!.vehicle_classes[0].factor_source).toBe('placeholder');
  });
});

describe('event gonderimi', () => {
  it('goruntulenme event i session basina TEK kez', async () => {
    const el = await mount({ 'data-distance-km': '350' });
    el.remove();
    document.body.append(el);
    await vi.waitFor(() => expect(q(el, '.card')).toBeTruthy());

    const views = posted.filter((p) => p.event_type === 'widget_goruntulendi');
    expect(views).toHaveLength(1);
    expect(views[0].metadata).toMatchObject({ distance_km: 350 });
  });

  it('event metadata SONUC alani TASIMAZ (fiyat manipule edilemez)', async () => {
    const el = await mount({ 'data-distance-km': '350' });
    (q(el, '.contribution input') as HTMLInputElement).click();
    await vi.waitFor(() => expect(posted.length).toBeGreaterThan(1));

    for (const p of posted) {
      const md = p.metadata ?? {};
      expect(md).not.toHaveProperty('amount');
      expect(md).not.toHaveProperty('estimated_co2e_kg');
      expect(md).not.toHaveProperty('co2e_per_km_kg');
      expect(Object.keys(md).every((k) =>
        ['distance_km', 'vehicle_class_code'].includes(k),
      )).toBe(true);
    }
  });

  it('checkbox ve katki butonu event leri bir kez gider', async () => {
    const el = await mount();
    const box = q(el, '.contribution input') as HTMLInputElement;
    box.click(); // seç
    box.click(); // kaldır
    box.click(); // tekrar seç
    await vi.waitFor(() =>
      expect(posted.some((p) => p.event_type === 'checkbox_secildi')).toBe(true),
    );
    expect(
      posted.filter((p) => p.event_type === 'checkbox_secildi'),
    ).toHaveLength(1);
  });

  it('arac secimi event i gonderilir', async () => {
    const el = await mount();
    const select = q(el, 'select') as HTMLSelectElement;
    select.value = 'elektrik';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() =>
      expect(posted.some((p) => p.event_type === 'arac_secildi')).toBe(true),
    );
    const ev = posted.find((p) => p.event_type === 'arac_secildi')!;
    expect(ev.metadata).toEqual({ vehicle_class_code: 'elektrik' });
  });

  it('preview modunda HICBIR event gitmez ama etkilesim calisir', async () => {
    const el = await mount({ 'data-preview': 'true' });
    expect(text(el, '.preview-badge')).toMatch(/Önizleme/);
    (q(el, '.contribution input') as HTMLInputElement).click();
    await vi.waitFor(() =>
      expect((q(el, '.primary') as HTMLButtonElement).disabled).toBe(false),
    );
    (q(el, '.primary') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(q(el, '.confirm')).toBeTruthy());
    expect(posted).toHaveLength(0);
  });

  it('ag hatasi host sayfayi BOZMAZ', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const el = document.createElement('green-gold-wheels-widget');
    el.setAttribute('data-key', KEY);
    el.setAttribute('data-api', API);
    expect(() => document.body.append(el)).not.toThrow();
    await Promise.resolve();
    expect(el.shadowRoot?.querySelector('.card')).toBeFalsy();
  });
});

describe('host callback sozlesmesi', () => {
  it('katki onayinda shadow sinirini GECEN event yayinlar', async () => {
    const el = await mount({ 'data-distance-km': '350' });
    const seen: CustomEvent[] = [];
    document.addEventListener('greengold:contribution-selected', (e) =>
      seen.push(e as CustomEvent),
    );

    (q(el, '.contribution input') as HTMLInputElement).click();
    await vi.waitFor(() =>
      expect((q(el, '.primary') as HTMLButtonElement).disabled).toBe(false),
    );
    (q(el, '.primary') as HTMLButtonElement).click();

    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0].detail).toMatchObject({
      distance_km: 350,
      vehicle_class_code: 'ekonomi-benzin',
      currency: 'TRY',
    });
  });

  it('callback detail TUTAR TASIMAZ (tek dogru kaynak API)', async () => {
    const el = await mount();
    const seen: CustomEvent[] = [];
    document.addEventListener('greengold:contribution-selected', (e) =>
      seen.push(e as CustomEvent),
    );
    (q(el, '.contribution input') as HTMLInputElement).click();
    await vi.waitFor(() =>
      expect((q(el, '.primary') as HTMLButtonElement).disabled).toBe(false),
    );
    (q(el, '.primary') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(seen).toHaveLength(1));

    expect(seen[0].detail).not.toHaveProperty('amount');
    expect(seen[0].detail).not.toHaveProperty('amount_total');
  });
});

describe('tracker-only modu', () => {
  it('kart cizmez, config CEKMEZ, goruntulenme GONDERMEZ', async () => {
    const el = await mount({ 'data-tracker-only': 'true' });
    expect(el.shadowRoot).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(posted).toHaveLength(0);
  });

  it('yalnizca trackBookingContinue calisir', async () => {
    const el = (await mount({ 'data-tracker-only': 'true' })) as HTMLElement & {
      trackBookingContinue: () => void;
    };
    el.trackBookingContinue();
    el.trackBookingContinue(); // ikinci kez: session başına tek
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].event_type).toBe('rezervasyona_devam_edildi');
  });
});

describe('aylik toplu etki satiri', () => {
  it('show_estimated_impact KAPALIYKEN gosterilmez', async () => {
    impactResponse = {
      month: '2026-10',
      estimated_co2e_kg: 120,
      tree_equivalent: 5.7,
      contributions_count: 3,
      is_estimated: true,
    };
    const el = await mount();
    await Promise.resolve();
    expect(q(el, '.impact-line')).toBeNull();
  });

  it('ACIKKEN ve veri varken gosterilir', async () => {
    configResponse = config({ show_estimated_impact: true });
    impactResponse = {
      month: '2026-10',
      estimated_co2e_kg: 120,
      tree_equivalent: 5.7,
      contributions_count: 3,
      is_estimated: true,
    };
    const el = await mount();
    await vi.waitFor(() => expect(q(el, '.impact-line')).toBeTruthy());
    expect(text(el, '.impact-line')).toMatch(/120/);
  });
});

describe('marka ve dil', () => {
  it('gecersiz brand_color CSS e YAZILMAZ', async () => {
    configResponse = config({ brand_color: 'red; background:url(x)' });
    const el = await mount();
    expect((q(el, '.card') as HTMLElement).getAttribute('style')).toBeNull();
  });

  it('gecerli hex aksan degiskenine yazilir', async () => {
    configResponse = config({ brand_color: '#123456' });
    const el = await mount();
    // Tarayıcı style niteliğini normalize eder ('--x: v;'), bu yüzden
    // hesaplanmış değeri okuyoruz.
    const card = q(el, '.card') as HTMLElement;
    expect(card.style.getPropertyValue('--gg-accent').trim()).toBe('#123456');
  });

  it('data-lang=en Ingilizce metinleri gosterir', async () => {
    const el = await mount({ 'data-lang': 'en' });
    expect(text(el, '.heading')).toMatch(/Offset your trip/);
    expect(text(el, '.orbit-label')).toMatch(/Estimated carbon impact/i);
  });
});
