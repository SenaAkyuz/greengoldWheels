'use client';

import { useActionState } from 'react';
import type { VehicleClass } from '@/lib/api';
import { isSystemDefaultSource } from '@/lib/factor-source';
import {
  saveVehicleClass,
  toggleVehicleClass,
  type ActionState,
} from '../actions';

const SCOPE_LABEL = {
  tank_to_wheel: 'Egzoz emisyonu (tank-to-wheel)',
  well_to_wheel: 'Yakıt zinciri dahil (well-to-wheel)',
} as const;

export function VehicleClassCard({
  item,
  readOnly = false,
}: {
  item: VehicleClass;
  /** Demo hesabı: formlar kilitli (asıl yasak API'de, DemoReadOnlyGuard). */
  readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveVehicleClass,
    {},
  );
  const [toggleState, toggleAction, toggling] = useActionState<
    ActionState,
    FormData
  >(toggleVehicleClass, {});

  return (
    <section
      className={`gg-card p-6 ${item.is_active ? '' : 'opacity-70'}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">{item.label_tr}</h2>
          <p className="mt-0.5 font-mono text-xs text-slate-500">
            {item.class_code} · {item.fuel_type}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!item.is_active && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Pasif
            </span>
          )}
          <form action={toggleAction}>
            <fieldset disabled={readOnly} className="contents">
            <input type="hidden" name="class_code" value={item.class_code} />
            <input
              type="hidden"
              name="is_active"
              value={item.is_active ? 'false' : 'true'}
            />
            <button
              type="submit"
              disabled={toggling}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {toggling
                ? '…'
                : item.is_active
                  ? 'Pasife al'
                  : 'Aktifleştir'}
            </button>
            </fieldset>
          </form>
        </div>
      </div>

      {toggleState.error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {toggleState.error}
        </p>
      )}

      <form action={action}>
        <fieldset disabled={readOnly} className="space-y-3">
        <input type="hidden" name="class_code" value={item.class_code} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Türkçe etiket" name="label_tr" defaultValue={item.label_tr} />
          <Field label="İngilizce etiket" name="label_en" defaultValue={item.label_en} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-3 text-xs leading-relaxed text-slate-600">
            <strong className="text-slate-800">Emisyon faktörü.</strong> Faktörü
            değiştirirseniz kaynağını, ülkesini, yılını ve kapsamını da
            doldurmanız gerekir.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="kg CO₂e / km"
              name="co2e_per_km_kg"
              type="number"
              step="0.00001"
              min="0.00001"
              defaultValue={item.co2e_per_km_kg}
            />
            {/* Sistemin kurulumda yazdığı ön değer kullanıcıya ham haliyle
                gösterilmez; alan boş görünür ve örnek metin yol gösterir.
                Boş bırakılırsa mevcut değer korunur (hidden input). */}
            <input
              type="hidden"
              name="current_factor_source"
              value={item.factor_source}
            />
            <Field
              label="Kaynak"
              name="factor_source"
              defaultValue={isSystemDefaultSource(item.factor_source) ? '' : item.factor_source}
              placeholder="ör. DEFRA 2024"
            />
            <Field
              label="Ülke (2 harf)"
              name="factor_country"
              defaultValue={item.factor_country}
              maxLength={2}
            />
            <Field
              label="Yıl"
              name="factor_year"
              type="number"
              min="2000"
              max="2100"
              defaultValue={String(item.factor_year)}
            />
          </div>

          <label className="mt-3 block">
            <span className="block text-xs font-semibold text-slate-600">
              Kapsam
            </span>
            <select
              name="factor_scope"
              defaultValue={item.factor_scope}
              className="gg-input mt-1"
            >
              {Object.entries(SCOPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Elektrikli araçlarda egzoz emisyonu ~0’dır; şebeke karışımını
              kapsayan bir faktör well-to-wheel’dir.
            </span>
          </label>
        </div>

        {state.error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {state.ok}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="gg-btn"
        >
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        </fieldset>
      </form>
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  ...rest
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="gg-input mt-1"
        {...rest}
      />
    </label>
  );
}
