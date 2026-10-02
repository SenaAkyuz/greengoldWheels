import {
  isValidTimezone,
  planCreateCompany,
  suggestCompanyCode,
  validateInput,
} from './create-company.core';

const base = { name: 'Pilot Arac Kiralama', email: 'yonetici@pilot.com' };

describe('validateInput', () => {
  it('varsayilanlari uygular (TRY, 1 TL/kg, 19 taban, Istanbul)', () => {
    const v = validateInput(base);
    expect(v).toMatchObject({
      currency: 'TRY',
      pricePerKgCo2e: 1,
      minContributionAmount: 19,
      timezone: 'Europe/Istanbul',
      country: 'TR',
      city: null,
    });
    expect(v.factorYear).toBe(new Date().getUTCFullYear());
  });

  it('name zorunlu — bosluk da gecersiz', () => {
    expect(() => validateInput({ ...base, name: '   ' })).toThrow('--name');
  });

  it('gecersiz e-postayi reddeder', () => {
    expect(() => validateInput({ ...base, email: 'yok' })).toThrow('--email');
  });

  it('e-postayi kucuk harfe cevirir', () => {
    expect(validateInput({ ...base, email: 'A@B.COM' }).email).toBe('a@b.com');
  });

  it('gecersiz IANA timezone u reddeder', () => {
    expect(() => validateInput({ ...base, tz: 'Mars/Olympus' })).toThrow(
      '--tz',
    );
  });

  it('gecersiz para birimini reddeder', () => {
    expect(() => validateInput({ ...base, currency: 'TURKLIRA' })).toThrow(
      '--currency',
    );
  });

  it('negatif fiyat ve negatif tabani reddeder', () => {
    expect(() => validateInput({ ...base, pricePerKg: '-1' })).toThrow(
      '--pricePerKg',
    );
    expect(() => validateInput({ ...base, minAmount: '-5' })).toThrow(
      '--minAmount',
    );
  });

  it('sifir fiyat ve sifir taban GECERLI (ucretsiz pilot mumkun)', () => {
    const v = validateInput({ ...base, pricePerKg: '0', minAmount: '0' });
    expect(v.pricePerKgCo2e).toBe(0);
    expect(v.minContributionAmount).toBe(0);
  });

  it('bant disi faktor yilini reddeder', () => {
    expect(() => validateInput({ ...base, factorYear: '1999' })).toThrow(
      '--factorYear',
    );
  });

  it('verilen kodu buyuk harfe cevirir ve bicimi dogrular', () => {
    expect(validateInput({ ...base, code: 'rnt-pilot' }).companyCode).toBe(
      'RNT-PILOT',
    );
    expect(() => validateInput({ ...base, code: 'a b' })).toThrow('--code');
  });
});

describe('suggestCompanyCode', () => {
  it('addan okunur bir kod uretir', () => {
    expect(suggestCompanyCode('Pilot Arac Kiralama')).toBe('RNT-PILOTA');
  });

  it('Turkce harfleri SILMEZ, ASCII ye cevirir', () => {
    // Harf atilsa "Pilot" -> "PLOT" olurdu (i -> İ -> silinir). Cevrim sayesinde
    // harf kaybi yok.
    expect(suggestCompanyCode('Pilot Araç Kiralama')).toBe('RNT-PILOTA');
    expect(suggestCompanyCode('Şişli Oto')).toBe('RNT-SISLIO');
    expect(suggestCompanyCode('Çiğdem Güven')).toBe('RNT-CIGDEM');
  });

  it('cok kisa/alfanumerik olmayan adda guvenli taban kullanir', () => {
    expect(suggestCompanyCode('!!')).toBe('RNT-RENTAL');
  });
});

describe('isValidTimezone', () => {
  it('gercek tz leri kabul, uydurmalari reddeder', () => {
    expect(isValidTimezone('Europe/Istanbul')).toBe(true);
    expect(isValidTimezone('America/Los_Angeles')).toBe(true);
    expect(isValidTimezone('Yok/Boyle')).toBe(false);
  });
});

describe('planCreateCompany', () => {
  it('sirketi PENDING ve origin listesi BOS dogurur (deny-by-default)', () => {
    const plan = planCreateCompany(validateInput(base));
    expect(plan.company.status).toBe('pending');
    expect(plan.company.allowed_origins).toEqual([]);
  });

  it('placeholder arac siniflarini provenance ile planlar', () => {
    const plan = planCreateCompany(
      validateInput({ ...base, factorYear: '2026' }),
    );
    const rows = plan.vehicleClasses('co-1');

    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.company_id).toBe('co-1');
      // Kaynagi belirtilmemis faktor YAZILAMAZ — hepsi placeholder isaretli.
      expect(r.factor_source).toBe('placeholder');
      expect(r.factor_year).toBe(2026);
      expect(r.factor_country).toBe('TR');
      expect(Number(r.co2e_per_km_kg)).toBeGreaterThan(0);
    }
  });

  it('elektrikli sinifi well_to_wheel kapsaminda planlar', () => {
    const plan = planCreateCompany(validateInput(base));
    const electric = plan
      .vehicleClasses('co-1')
      .find((r) => r.class_code === 'elektrik');
    expect(electric?.factor_scope).toBe('well_to_wheel');
  });

  it('yoneticiyi sirkete bagli planlar (sifre YOK)', () => {
    const plan = planCreateCompany(validateInput(base));
    const user = plan.user('co-1');
    expect(user).toMatchObject({
      company_id: 'co-1',
      email: 'yonetici@pilot.com',
      role: 'filo_yoneticisi',
    });
    expect('password' in user).toBe(false);
  });
});
