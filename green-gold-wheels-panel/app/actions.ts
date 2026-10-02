'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, NotAuthenticatedError, api } from '@/lib/api';

/**
 * Panel yazma işlemleri — Server Action'lar.
 *
 * Hepsi API'ye gider; panel veritabanına doğrudan yazmaz. Doğrulamanın ASLI
 * API'dedir (DTO + RLS + kolon bazlı GRANT); buradaki kontroller yalnızca
 * kullanıcıya hızlı geri bildirim içindir.
 */

export interface ActionState {
  ok?: string;
  error?: string;
}

async function run(fn: () => Promise<unknown>, okMessage: string, path: string): Promise<ActionState> {
  try {
    await fn();
    revalidatePath(path);
    return { ok: okMessage };
  } catch (e) {
    if (e instanceof NotAuthenticatedError) {
      return { error: 'Oturumunuz sona ermiş. Sayfayı yenileyip tekrar girin.' };
    }
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Beklenmeyen bir hata oluştu.' };
  }
}

/** İzinli origin listesini günceller. */
export async function saveOrigins(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = String(formData.get('origins') ?? '');
  const origins = raw
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  // Boş liste geçerli bir durumdur (widget'ı geçici olarak durdurmak).
  return run(
    () => api.patch('/dashboard/company', { allowed_origins: origins }),
    origins.length === 0
      ? 'Origin listesi boşaltıldı — widget hiçbir sitede çalışmayacak.'
      : 'İzinli adresler güncellendi.',
    '/ayarlar',
  );
}

/** Katkı fiyatlandırmasını günceller. */
export async function savePricing(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const price = Number(formData.get('price_per_kg_co2e'));
  const min = Number(formData.get('min_contribution_amount'));

  if (!Number.isFinite(price) || price < 0) {
    return { error: 'kg başına fiyat negatif olmayan bir sayı olmalı.' };
  }
  if (!Number.isFinite(min) || min < 0) {
    return { error: 'Alt sınır negatif olmayan bir sayı olmalı.' };
  }

  return run(
    () =>
      api.patch('/dashboard/company', {
        price_per_kg_co2e: price,
        min_contribution_amount: min,
      }),
    'Fiyatlandırma güncellendi.',
    '/ayarlar',
  );
}

/**
 * Araç sınıfının faktörünü ve provenance'ını günceller.
 *
 * METODOLOJİ KURALI (asıl denetim API'de): faktör değişiyorsa kaynak, ülke,
 * yıl ve kapsam birlikte gönderilir. Form bu alanları zaten birlikte yolluyor.
 */
export async function saveVehicleClass(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const classCode = String(formData.get('class_code') ?? '');
  if (!classCode) return { error: 'Araç sınıfı kodu eksik.' };

  const factor = Number(formData.get('co2e_per_km_kg'));
  if (!Number.isFinite(factor) || factor <= 0) {
    return { error: 'Faktör sıfırdan büyük bir sayı olmalı.' };
  }

  // Kaynak alanı boş bırakılırsa mevcut kaynak korunur: form, sistemin
  // kurulumda yazdığı ön değeri ham haliyle göstermiyor (lib/factor-source.ts),
  // bu yüzden "boş" = "değiştirmedim" demektir.
  const source =
    String(formData.get('factor_source') ?? '').trim() ||
    String(formData.get('current_factor_source') ?? '').trim();
  if (!source) {
    return { error: 'Faktör kaynağı boş olamaz.' };
  }

  return run(
    () =>
      api.patch(`/dashboard/vehicle-classes/${encodeURIComponent(classCode)}`, {
        co2e_per_km_kg: factor,
        factor_source: source,
        factor_country: String(formData.get('factor_country') ?? 'TR')
          .trim()
          .toUpperCase(),
        factor_year: Number(formData.get('factor_year')),
        factor_scope: String(formData.get('factor_scope') ?? 'tank_to_wheel'),
        label_tr: String(formData.get('label_tr') ?? '').trim(),
        label_en: String(formData.get('label_en') ?? '').trim(),
      }),
    'Araç sınıfı güncellendi.',
    '/araclar',
  );
}

/** Araç sınıfını aktif/pasif yapar (silme YOK — geçmiş veriye bağlı). */
export async function toggleVehicleClass(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const classCode = String(formData.get('class_code') ?? '');
  const next = formData.get('is_active') === 'true';
  if (!classCode) return { error: 'Araç sınıfı kodu eksik.' };

  return run(
    () =>
      api.patch(`/dashboard/vehicle-classes/${encodeURIComponent(classCode)}`, {
        is_active: next,
      }),
    next ? 'Araç sınıfı aktifleştirildi.' : 'Araç sınıfı pasife alındı.',
    '/araclar',
  );
}
