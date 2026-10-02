import { render } from 'preact';
import { Widget, type EstimateInput } from './widget';
import { STYLES } from './styles';
import { fetchConfig, fetchImpact, sendEvent } from './api';
import type { Lang, WidgetConfig, WidgetEventType, WidgetImpact } from './types';

const DEFAULT_API = 'http://localhost:3000';
const TAG = 'green-gold-wheels-widget';

const MIN_KM = 1;
const MAX_KM = 20_000;
const MAX_SESSION_REF_LEN = 100; // API session_ref MaxLength(100) ile tutarlı
const JOURNEY_STORAGE_KEY = 'greengold_wheels_journey_id';

function parseDistance(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 100;
  return Math.min(MAX_KM, Math.max(MIN_KM, Math.round(n)));
}

function parseLang(raw: string | null): Lang {
  return raw === 'en' ? 'en' : 'tr';
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Kişisel veri İÇERMEYEN, sayfalar arası devam eden yolculuk kimliği.
 *   1) `data-journey-id` host tarafından verilmişse -> o kullanılır.
 *   2) Yoksa first-party `sessionStorage` -> ilk sayfada üretilir, aynı
 *      sekmedeki sonraki sayfalarda okunur. Üçüncü taraf çerez/izleme YOK;
 *      sekme kapanınca temizlenir.
 *   3) Storage engellenmişse (gizli mod) -> bu örnek ömrü boyunca geçerli
 *      rastgele kimliğe GÜVENLE düşer; host sayfa asla bozulmaz.
 *
 * ASLA e-posta/telefon/isim/rezervasyon numarası içermez.
 */
function resolveJourneyId(attrValue: string | null): string {
  const attr = attrValue?.trim();
  if (attr && attr.length <= MAX_SESSION_REF_LEN) return attr;
  try {
    const existing = window.sessionStorage.getItem(JOURNEY_STORAGE_KEY);
    if (existing) return existing;
    const created = randomId();
    window.sessionStorage.setItem(JOURNEY_STORAGE_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

class GreenGoldWheelsWidget extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['data-distance-km', 'data-vehicle-class', 'data-lang'];
  }

  private mount?: HTMLDivElement;
  private config: WidgetConfig | null = null;
  private impact: WidgetImpact | null = null;
  private sessionRef = '';
  private key = '';
  private apiBase = DEFAULT_API;
  /** Önizleme: etkileşim çalışır ama HİÇBİR analitik event gönderilmez. */
  private preview = false;
  /**
   * Tracker-only: kart RENDER EDİLMEZ, config/impact ÇEKİLMEZ,
   * `widget_goruntulendi` ASLA gönderilmez. Yalnızca
   * `trackBookingContinue()` çalışsın diye (ör. "Ödemeye devam" butonu
   * kartın görünmediği bir sayfadaysa). Gizli bir kartı `display:none` ile
   * saklamak YANLIŞTIR: o kart sahte görüntülenme üretip funnel'ı bozar.
   */
  private trackerOnly = false;
  /** Bu session'da gönderilmiş event tipleri — her tip en fazla bir kez. */
  private sentEvents = new Set<string>();

  async connectedCallback(): Promise<void> {
    // data-key yoksa hiçbir şey yapma — host sayfayı asla bozma.
    this.key = this.getAttribute('data-key') ?? '';
    if (!this.key) return;

    this.apiBase = this.getAttribute('data-api') ?? DEFAULT_API;
    this.preview = this.getAttribute('data-preview') === 'true';
    this.trackerOnly = this.getAttribute('data-tracker-only') === 'true';

    // sessionRef ve gönderilen-event seti örnek ömrü boyunca KALICI:
    // element DOM'dan çıkıp tekrar eklenirse aynı session sürer.
    if (!this.sessionRef) {
      this.sessionRef = resolveJourneyId(this.getAttribute('data-journey-id'));
    }

    if (this.trackerOnly) return;

    // Tek shadow root: remove+append'te attachShadow tekrar çağrılırsa patlar.
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = STYLES;
      this.mount = document.createElement('div');
      shadow.append(style, this.mount);
    } else if (!this.mount) {
      this.mount =
        (this.shadowRoot.querySelector('div') as HTMLDivElement) ?? undefined;
    }

    if (!this.config) {
      const config = await fetchConfig(this.apiBase, this.key);
      // Geçersiz key / pasif şirket / ağ hatası -> sessizce render etme.
      if (!config || config.vehicle_classes.length === 0) return;
      this.config = config;
    }

    this.rerender();

    // Session başına YALNIZCA bir kez. Mesafe/araç bilgisini de taşır ki
    // panel "hangi girdilerle görüntülendi" sorusunu cevaplayabilsin.
    this.sendOnce('widget_goruntulendi', {
      distance_km: this.distanceKm(),
      vehicle_class_code: this.initialVehicleCode(),
    });

    void this.loadImpact();
  }

  private async loadImpact(): Promise<void> {
    if (this.impact) return; // örnek ömrü boyunca bir kez yeter
    const impact = await fetchImpact(this.apiBase, this.key);
    if (impact) {
      this.impact = impact;
      this.rerender();
    }
  }

  /** Aynı event tipini session başına en fazla bir kez gönderir. */
  private sendOnce(
    type: WidgetEventType,
    metadata: { distance_km?: number; vehicle_class_code?: string },
  ): void {
    if (this.preview) return;
    if (this.sentEvents.has(type)) return;
    this.sentEvents.add(type);
    // undefined alanları ayıkla: API forbidNonWhitelisted ile çalışıyor.
    const clean: Record<string, unknown> = {};
    if (typeof metadata.distance_km === 'number') {
      clean.distance_km = metadata.distance_km;
    }
    if (metadata.vehicle_class_code) {
      clean.vehicle_class_code = metadata.vehicle_class_code;
    }
    sendEvent(this.apiBase, this.key, type, this.sessionRef, clean);
  }

  attributeChangedCallback(name: string): void {
    if (
      GreenGoldWheelsWidget.observedAttributes.includes(name) &&
      this.config &&
      this.mount
    ) {
      this.rerender();
    }
  }

  disconnectedCallback(): void {
    if (this.mount) render(null, this.mount);
  }

  private distanceKm(): number {
    return parseDistance(this.getAttribute('data-distance-km'));
  }

  private initialVehicleCode(): string | undefined {
    return this.getAttribute('data-vehicle-class') ?? undefined;
  }

  private rerender(): void {
    if (!this.config || !this.mount) return;
    render(
      <Widget
        config={this.config}
        initialDistanceKm={this.distanceKm()}
        initialVehicleCode={this.initialVehicleCode()}
        lang={parseLang(this.getAttribute('data-lang'))}
        onVehicleChange={(code) =>
          this.sendOnce('arac_secildi', { vehicle_class_code: code })
        }
        onSelect={(input) => this.sendOnce('checkbox_secildi', input)}
        onAdd={(input) => this.handleAdd(input)}
        preview={this.preview}
        impact={this.impact}
      />,
      this.mount,
    );
  }

  /**
   * Katkı onayı: analitik event (session başına tek) + host callback.
   *
   * Widget "ödeme aldım" DEMEZ — kontrolü kiralama şirketine devreder.
   * `detail` içinde TUTAR YOKTUR ve bu bilinçlidir: tutarın tek doğru kaynağı
   * API'dir (istemci sayısı manipüle edilebilir). Host sayfa tutarı kendi
   * backend'inden `GET /widget/config` + aynı formülle ya da Faz 2'de
   * doğrulanmış işlem kaydından alır.
   */
  private handleAdd(input: EstimateInput): void {
    this.sendOnce('katki_ekle_butonuna_basildi', input);
    this.dispatchEvent(
      new CustomEvent('greengold:contribution-selected', {
        bubbles: true,
        composed: true,
        detail: {
          session_ref: this.sessionRef,
          distance_km: input.distance_km,
          vehicle_class_code: input.vehicle_class_code,
          currency: this.config?.currency ?? null,
        },
      }),
    );
  }

  /**
   * PUBLIC method — host sayfanın "Ödemeye devam / Rezervasyonu tamamla"
   * tıklamasını ölçmesi için:
   *
   *   document.querySelector('green-gold-wheels-widget')?.trackBookingContinue();
   *
   * REZERVASYON/ÖDEME ONAYI DEĞİLDİR — yalnızca tıklama sinyali. Şirket bazlı
   * flag kapalıysa API 400 döner; istek fire-and-forget gönderildiği için host
   * sayfa bunu hiç görmez ve navigasyon ASLA gecikmez.
   * data-key yoksa veya preview modundaysa sessiz no-op.
   */
  trackBookingContinue(): void {
    if (!this.key) return;
    this.sendOnce('rezervasyona_devam_edildi', {});
  }
}

if (!customElements.get(TAG)) {
  customElements.define(TAG, GreenGoldWheelsWidget);
}

export { GreenGoldWheelsWidget };
