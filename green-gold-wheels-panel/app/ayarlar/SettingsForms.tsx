'use client';

import { useActionState } from 'react';
import type { Company } from '@/lib/api';
import { saveOrigins, savePricing, type ActionState } from '../actions';

function Message({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {state.ok}
      </p>
    );
  }
  return null;
}

export function OriginsForm({
  company,
  readOnly = false,
}: {
  company: Company;
  readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveOrigins,
    {},
  );

  return (
    <form action={action}>
      <fieldset disabled={readOnly} className="space-y-3">
      <label className="block">
        <span className="block text-xs font-semibold text-slate-600">
          İzinli adresler (her satıra bir tane)
        </span>
        <textarea
          name="origins"
          rows={4}
          defaultValue={company.allowed_origins.join('\n')}
          placeholder="https://sirketiniz.com"
          className="gg-input mt-1 font-mono"
        />
      </label>

      <ul className="space-y-1 text-xs leading-relaxed text-slate-500">
        <li>
          • Yalnızca <strong>https</strong> kabul edilir ve <strong>sadece adres</strong>{' '}
          yazılır — sayfa yolu değil. Doğru: <code>https://sirketiniz.com</code>,
          yanlış: <code>https://sirketiniz.com/kiralama</code>.
        </li>
        <li>
          • Alt alan adları ayrı yazılır; <code>*</code> kullanılamaz.
        </li>
        <li>
          • Liste boş bırakılırsa widget <strong>hiçbir sitede</strong> çalışmaz.
        </li>
      </ul>

      <Message state={state} />

      <button
        type="submit"
        disabled={pending}
        className="gg-btn"
      >
        {pending ? 'Kaydediliyor…' : 'Adresleri kaydet'}
      </button>
      </fieldset>
    </form>
  );
}

export function PricingForm({
  company,
  readOnly = false,
}: {
  company: Company;
  readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    savePricing,
    {},
  );

  return (
    <form action={action}>
      <fieldset disabled={readOnly} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-semibold text-slate-600">
            kg CO₂e başına fiyat ({company.default_currency})
          </span>
          <input
            name="price_per_kg_co2e"
            type="number"
            step="0.0001"
            min="0"
            defaultValue={company.price_per_kg_co2e}
            className="gg-input mt-1"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-semibold text-slate-600">
            En düşük katkı ({company.default_currency})
          </span>
          <input
            name="min_contribution_amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={company.min_contribution_amount}
            className="gg-input mt-1"
          />
        </label>
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        Katkı tutarı <strong>max(alt sınır, CO₂e × kg fiyatı)</strong> olarak
        hesaplanır. Çok kısa yolculuklarda kuruşluk tutar çıkmasın diye alt sınır
        vardır; tahmini emisyon sıfırsa katkı da sıfırdır.
      </p>

      <Message state={state} />

      <button
        type="submit"
        disabled={pending}
        className="gg-btn"
      >
        {pending ? 'Kaydediliyor…' : 'Fiyatlandırmayı kaydet'}
      </button>
      </fieldset>
    </form>
  );
}
