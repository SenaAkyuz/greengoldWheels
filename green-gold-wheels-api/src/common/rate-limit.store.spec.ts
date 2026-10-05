import { RateLimitStore, type RedisLike } from './rate-limit.store';

/** Lua betiğinin gözlemlenebilir davranışını taklit eden sahte Redis. */
class FakeRedis implements RedisLike {
  /** Yazılan anahtarlar — isimlendirmeyi doğrulamak için. */
  readonly keys: string[] = [];
  private readonly counts = new Map<string, number>();

  eval(
    _script: string,
    keys: string[],
    args: (string | number)[],
  ): Promise<unknown> {
    const key = keys[0];
    this.keys.push(key);
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return Promise.resolve([next, Number(args[0])]);
  }
}

type StoreModule = typeof import('./rate-limit.store');

/** Her çağrıda modülün TAZE bir kopyasını yükler (singleton'ı sıfırlar). */
function freshModule(): StoreModule {
  let mod: StoreModule | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual<StoreModule>('./rate-limit.store');
  });
  if (!mod) throw new Error('modül yüklenemedi');
  return mod;
}

describe('getRateLimitStore — env ne zaman okunur', () => {
  const OLD = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD };
  });

  /**
   * HATA (düzeltildi): sayaç dosya içe aktarılırken kuruluyordu; yerelde
   * .env ise ConfigModule ile DAHA SONRA okunur. Upstash değişkenleri o an
   * yoktu ve API sessizce bellek içi moda düşüyordu (Vercel'de değişkenler
   * önceden hazır olduğu için orada çalışırdı).
   */
  it('modul ice aktarildiktan SONRA gelen env i da gorur', () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const mod = freshModule();

    // .env şimdi yükleniyor (ConfigModule'ün yaptığı gibi):
    process.env.UPSTASH_REDIS_REST_URL = 'https://ornek.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'ornek-token';

    expect(mod.getRateLimitStore().distributed).toBe(true);
  });

  it('tek ornek doner (iki tuketici ayni sayaci paylasir)', () => {
    const mod = freshModule();
    expect(mod.getRateLimitStore()).toBe(mod.getRateLimitStore());
  });
});

describe('RateLimitStore — anahtar alanı', () => {
  /**
   * Aynı Upstash veritabanı başka bir Green Gold projesiyle paylaşılabilir.
   * Önek düşerse iki projenin sayaçları birleşir ve limitler birbirine
   * karışır — sessizce. Bu yüzden isimlendirme testle sabitlenmiştir.
   */
  it('her anahtari ggw: onekiyle yazar (baska proje ile CAKISMAZ)', async () => {
    const redis = new FakeRedis();
    const store = new RateLimitStore(redis);

    await store.hit('thr:1.2.3.4-POST-/widget/events', 60_000);
    await store.hit('wk:widget-anahtari', 60_000);

    expect(redis.keys).toEqual([
      'ggw:thr:1.2.3.4-POST-/widget/events',
      'ggw:wk:widget-anahtari',
    ]);
  });

  it('ayni anahtar iki instance arasinda PAYLASILIR (dagitik)', async () => {
    const redis = new FakeRedis();
    const a = new RateLimitStore(redis);
    const b = new RateLimitStore(redis);

    expect((await a.hit('k', 60_000)).count).toBe(1);
    expect((await b.hit('k', 60_000)).count).toBe(2);
    expect(a.distributed).toBe(true);
  });

  it('Redis yoksa bellek-ici sayar ve dagitik DEGILDIR', async () => {
    const store = new RateLimitStore(null);

    expect(store.distributed).toBe(false);
    expect((await store.hit('k', 60_000)).count).toBe(1);
    expect((await store.hit('k', 60_000)).count).toBe(2);
    // Ayrı instance ayrı sayar: canlıda (çok-instance) Upstash bu yüzden şart.
    expect((await new RateLimitStore(null).hit('k', 60_000)).count).toBe(1);
  });

  it('pencere dolunca sayac sifirlanir (bellek)', async () => {
    const store = new RateLimitStore(null);

    expect((await store.hit('k', 1)).count).toBe(1);
    await new Promise((r) => setTimeout(r, 8));
    expect((await store.hit('k', 1)).count).toBe(1);
  });
});
