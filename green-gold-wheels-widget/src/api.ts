import type {
  WidgetConfig,
  WidgetEventMetadata,
  WidgetEventType,
  WidgetImpact,
} from './types';

/**
 * API istemcisi. TEMEL KURAL: host sayfayı ASLA bozma.
 * Her hata yutulur; başarısızlık "widget sessizce görünmez" demektir,
 * kiralama şirketinin rezervasyon sayfasında bir JS hatası DEĞİL.
 */

/** Public config'i çeker. Hata/geçersiz key -> null (widget render etmez). */
export async function fetchConfig(
  apiBase: string,
  key: string,
): Promise<WidgetConfig | null> {
  try {
    const res = await fetch(
      `${apiBase}/widget/config?key=${encodeURIComponent(key)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success: boolean;
      data: WidgetConfig | null;
    };
    if (!json.success || !json.data) return null;
    // Araç sınıfı yoksa widget hesap yapamaz -> hiç render etme.
    if (!Array.isArray(json.data.vehicle_classes)) return null;
    return json.data;
  } catch {
    return null;
  }
}

/**
 * Aylık toplu tahmini etki (public). Hata/erişim yoksa -> null:
 * canlı sayaç satırı sessizce gizlenir.
 */
export async function fetchImpact(
  apiBase: string,
  key: string,
): Promise<WidgetImpact | null> {
  try {
    const res = await fetch(
      `${apiBase}/widget/impact?key=${encodeURIComponent(key)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success: boolean;
      data: WidgetImpact | null;
    };
    if (!json.success || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

/**
 * Event gönderir. FIRE-AND-FORGET: UI'ı bloklamaz, ağ hatasını sessizce yutar,
 * yanıtı beklemez. `keepalive` ile sayfa kapanırken/yönlenirken bile gider —
 * "rezervasyona devam" tıklamasının navigasyonu geciktirmemesi için şart.
 */
export function sendEvent(
  apiBase: string,
  key: string,
  eventType: WidgetEventType,
  sessionRef: string,
  metadata: WidgetEventMetadata,
): void {
  try {
    void fetch(`${apiBase}/widget/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Widget-Key': key,
      },
      body: JSON.stringify({
        event_type: eventType,
        session_ref: sessionRef,
        // Boş metadata göndermek yerine alanı hiç koyma: API'nin
        // forbidNonWhitelisted doğrulaması gereksiz alanlara takılmasın.
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      }),
      keepalive: true,
    }).catch(() => {
      /* sessizce yut */
    });
  } catch {
    /* sessizce yut */
  }
}
