import type { NextFunction, Request, Response } from 'express';
import type { Database } from '../database/database';

/**
 * /widget/* için şirket bazlı dinamik CORS (global açık CORS'un YERİNE).
 *
 *  - Gerçek istek (GET /widget/config?key=, POST /widget/events + X-Widget-Key):
 *    Origin, isteğin şirketinin allowed_origins'inde varsa ACAO ver; Origin var
 *    ama izinli değilse 403; Origin yoksa (server-side/non-browser) dokunma, geç.
 *  - Preflight (OPTIONS): anahtar taşımadığı için şirket çözülemez -> TÜM AKTİF
 *    şirketlerin origin birleşimi. Asıl yetki kontrolü gerçek istekte.
 *  - Dev kolaylığı: NODE_ENV !== 'production' iken http://localhost[:port] serbest.
 *
 * Veritabanına yalnızca iki dar SECURITY DEFINER fonksiyonuyla erişir
 * (0007_app_role.sql); ikisi de YALNIZCA aktif şirketleri dikkate alır.
 */
const ALLOW_METHODS = 'GET, POST, OPTIONS';
const ALLOW_HEADERS = 'X-Widget-Key, Content-Type';
const UNION_TTL_MS = 30_000;

function isDevLocalhost(origin: string): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const u = new URL(origin);
    return (
      u.protocol === 'http:' &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

/**
 * Panelin kendi origin'i (WIDGET_PREVIEW_ORIGINS, virgülle ayrılmış).
 *
 * Panelin "Müşteri Önizleme" ekranı ve public /demo sayfası widget'ı
 * panelin domain'inde çizer. O domain şirketlerin allowed_origins listesinde
 * olmaz (olmamalı da). Bu yüzden panel origin'ine YALNIZCA GET izni verilir:
 * config/impact okunabilir (zaten public veri), ama POST /widget/events
 * ASLA — önizlemeden rapora tek bir event bile yazılamaz. (Widget önizleme
 * modunda zaten event göndermez; bu, sunucu tarafındaki ikinci kattır.)
 */
function previewOrigins(): Set<string> {
  return new Set(
    (process.env.WIDGET_PREVIEW_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  );
}

function setCorsHeaders(res: Response, origin: string): void {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
  res.setHeader('Access-Control-Max-Age', '600');
}

function forbidden(res: Response): void {
  res.status(403).json({
    success: false,
    data: null,
    error: { code: 'forbidden', message: 'origin not allowed' },
  });
}

export function createWidgetCors(db: Database) {
  let unionCache: { origins: Set<string>; at: number } | null = null;
  const preview = previewOrigins();

  async function globalOrigins(): Promise<Set<string>> {
    const now = Date.now();
    if (unionCache && now - unionCache.at < UNION_TTL_MS) {
      return unionCache.origins;
    }
    const origins = await db.withoutTenant(async (q) => {
      const { rows } = await q.query<{ origins: string[] | null }>(
        'SELECT wheels_all_widget_origins() AS origins',
      );
      return rows[0]?.origins ?? [];
    });
    const set = new Set<string>(origins);
    unionCache = { origins: set, at: now };
    return set;
  }

  async function companyOrigins(
    key: string | undefined,
  ): Promise<Set<string> | null> {
    if (!key) return null;
    const origins = await db.withoutTenant(async (q) => {
      const { rows } = await q.query<{ origins: string[] | null }>(
        'SELECT wheels_widget_origins($1) AS origins',
        [key],
      );
      return rows[0]?.origins ?? null;
    });
    return origins ? new Set<string>(origins) : null;
  }

  return function widgetCors(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const origin = req.headers.origin;
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      void (async () => {
        try {
          if (
            origin &&
            (isDevLocalhost(origin) || (await globalOrigins()).has(origin))
          ) {
            setCorsHeaders(res, origin);
          }
        } catch {
          // DB erişilemezse CORS başlığı VERME (fail-closed); tarayıcı
          // isteği göndermez. Host sayfa bozulmaz, widget sessizce çizilmez.
        }
        res.status(204).end();
      })();
      return;
    }

    if (!origin) {
      next();
      return;
    }

    // Panel önizlemesi: yalnızca okuma (bkz. previewOrigins).
    if (req.method === 'GET' && preview.has(origin)) {
      setCorsHeaders(res, origin);
      next();
      return;
    }

    void (async () => {
      try {
        const key =
          (req.headers['x-widget-key'] as string | undefined) ??
          (req.query?.key as string | undefined);
        const allowed = await companyOrigins(key);
        if (isDevLocalhost(origin) || (allowed && allowed.has(origin))) {
          setCorsHeaders(res, origin);
          next();
          return;
        }
        forbidden(res);
      } catch {
        // DB hatası -> reddet (fail-closed). Origin'i doğrulayamadıysak geçirmeyiz.
        forbidden(res);
      }
    })();
  };
}
