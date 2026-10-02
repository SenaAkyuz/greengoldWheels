import {
  clampDistanceKm,
  clampFactorPerKm,
  contributionAmount,
  estimateCo2eKg,
  estimateContribution,
  isPlaceholderFactor,
  treeEquivalent,
  MAX_DISTANCE_KM,
  MIN_DISTANCE_KM,
  type VehicleFactor,
} from './carbon-estimate';

const petrol: VehicleFactor = {
  class_code: 'ekonomi-benzin',
  co2e_per_km_kg: 0.171,
  factor_source: 'placeholder',
  factor_country: 'TR',
  factor_year: 2026,
  factor_scope: 'tank_to_wheel',
};

describe('clampDistanceKm', () => {
  it('tam km olarak yuvarlar (sahte hassasiyet yok)', () => {
    expect(clampDistanceKm(350.7)).toBe(351);
    expect(clampDistanceKm(350.2)).toBe(350);
  });

  it('bandin altini/ustunu guvenli sinira ceker', () => {
    expect(clampDistanceKm(0)).toBe(MIN_DISTANCE_KM);
    expect(clampDistanceKm(-500)).toBe(MIN_DISTANCE_KM);
    expect(clampDistanceKm(999_999)).toBe(MAX_DISTANCE_KM);
  });

  it('sayi olmayan/sonlu olmayan girdide firlatmaz, MIN e duser', () => {
    // Anlamsiz girdi en YUKSEK karbonu/ucreti uretmemeli — MAX'a degil MIN'e
    // dusmesi bilincli bir guvenlik tercihi (bkz. clampDistanceKm yorumu).
    expect(clampDistanceKm(undefined)).toBe(MIN_DISTANCE_KM);
    expect(clampDistanceKm('abc')).toBe(MIN_DISTANCE_KM);
    expect(clampDistanceKm(NaN)).toBe(MIN_DISTANCE_KM);
    expect(clampDistanceKm(Infinity)).toBe(MIN_DISTANCE_KM);
    expect(clampDistanceKm(-Infinity)).toBe(MIN_DISTANCE_KM);
  });
});

describe('clampFactorPerKm', () => {
  it('akla yatkin bandi korur', () => {
    expect(clampFactorPerKm(0.171)).toBe(0.171);
    expect(clampFactorPerKm(0.047)).toBe(0.047);
  });

  it('sifir ve negatif faktoru 0 yapar (sifir emisyon iddiasi uretmez)', () => {
    expect(clampFactorPerKm(0)).toBe(0);
    expect(clampFactorPerKm(-1)).toBe(0);
  });

  it('ust bandi asan faktoru sinira ceker', () => {
    expect(clampFactorPerKm(99)).toBe(2);
  });
});

describe('estimateCo2eKg', () => {
  it('MVP maketindeki hesabi birebir uretir: 350 km x 0.171', () => {
    // Maket 59,9 kg gosteriyordu; 2 ondalik = 59.85.
    expect(estimateCo2eKg(350, 0.171)).toBe(59.85);
  });

  it('elektrikli arac icin de pozitif sonuc verir (sebeke tahmini)', () => {
    expect(estimateCo2eKg(350, 0.047)).toBe(16.45);
  });
});

describe('contributionAmount', () => {
  it('kg basi fiyatla carpar', () => {
    expect(contributionAmount(59.85, 1, 0)).toBe(59.85);
    expect(contributionAmount(59.85, 2, 0)).toBe(119.7);
  });

  it('alt siniri uygular (MVP: 19 TL taban)', () => {
    expect(contributionAmount(5, 1, 19)).toBe(19);
    expect(contributionAmount(50, 1, 19)).toBe(50);
  });

  it('CO2 sifirsa alt siniri UYGULAMAZ — sifir emisyon, sifir katki', () => {
    expect(contributionAmount(0, 1, 19)).toBe(0);
    expect(contributionAmount(-3, 1, 19)).toBe(0);
  });

  it('gecersiz fiyatta 0 fiyat varsayar ama tabani korur', () => {
    expect(contributionAmount(10, NaN, 19)).toBe(19);
    expect(contributionAmount(10, -5, 0)).toBe(0);
  });
});

describe('estimateContribution', () => {
  const pricing = {
    price_per_kg_co2e: 1,
    min_contribution_amount: 19,
    currency: 'TRY',
  };

  it('tam sonucu provenance ile birlikte dondurur', () => {
    const r = estimateContribution(350, petrol, pricing);
    expect(r).toMatchObject({
      distance_km: 350,
      vehicle_class_code: 'ekonomi-benzin',
      co2e_per_km_kg: 0.171,
      estimated_co2e_kg: 59.85,
      amount: 59.85,
      currency: 'TRY',
      factor_source: 'placeholder',
      factor_country: 'TR',
      factor_year: 2026,
      factor_scope: 'tank_to_wheel',
      is_estimated: true,
      computed_by: 'server',
    });
  });

  it('computed_by her zaman server — istemci sayisi asla yazilmaz', () => {
    expect(estimateContribution(10, petrol, pricing).computed_by).toBe(
      'server',
    );
  });

  it('is_estimated Faz 1 de her zaman true', () => {
    const approved: VehicleFactor = { ...petrol, factor_source: 'DEFRA 2024' };
    expect(estimateContribution(10, approved, pricing).is_estimated).toBe(true);
  });

  it('bandin disindaki mesafeyi guvenli sinira cekerek hesaplar', () => {
    const r = estimateContribution(999_999, petrol, pricing);
    expect(r.distance_km).toBe(MAX_DISTANCE_KM);
    expect(r.estimated_co2e_kg).toBe(
      Math.round(MAX_DISTANCE_KM * 0.171 * 100) / 100,
    );
  });
});

describe('isPlaceholderFactor', () => {
  it('placeholder kaynagini buyuk/kucuk harf ve bosluktan bagimsiz tanir', () => {
    expect(isPlaceholderFactor('placeholder')).toBe(true);
    expect(isPlaceholderFactor('  PLACEHOLDER ')).toBe(true);
  });

  it('onayli kaynagi placeholder saymaz', () => {
    expect(isPlaceholderFactor('DEFRA 2024')).toBe(false);
  });
});

describe('treeEquivalent', () => {
  it('temsili cevrimi uygular', () => {
    expect(treeEquivalent(21)).toBe(1);
    expect(treeEquivalent(59.85)).toBe(2.9);
  });

  it('sifir/negatif girdide 0 doner', () => {
    expect(treeEquivalent(0)).toBe(0);
    expect(treeEquivalent(-10)).toBe(0);
  });
});
