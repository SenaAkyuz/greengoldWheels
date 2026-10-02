import Link from 'next/link';
import type { Range } from '@/lib/api';
import { RANGES } from '@/lib/api';

/** Sayfa başlığı — Stay panelindeki kicker + serif başlık + alt satır. */
export function PageHeader({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="gg-page-header">
      <div>
        <div className="gg-kicker">{kicker}</div>
        <h1 className="gg-title">{title}</h1>
        {subtitle && <p className="gg-subtitle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Tarih aralığı seçici — aralık BACKEND'de, şirketin kendi tz'inde çözülür. */
export function RangePills({
  current,
  basePath,
}: {
  current: Range;
  basePath: string;
}) {
  return (
    <nav
      aria-label="Tarih aralığı"
      className="inline-flex rounded-full border border-[#d8e2da] bg-white p-1 shadow-sm"
    >
      {RANGES.map((r) => {
        const isActive = r.value === current;
        return (
          <Link
            key={r.value}
            href={r.value === 'month' ? basePath : `${basePath}?range=${r.value}`}
            aria-current={isActive ? 'page' : undefined}
            className={
              'flex min-h-[44px] items-center rounded-full px-3.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#5c9f80]/40 ' +
              (isActive ? 'bg-[#0b5c49] text-white' : 'text-[#66756e] hover:bg-[#f1f5f1]')
            }
          >
            {r.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="gg-card relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0b6652] via-[#5c9f80] to-[#d7e9a0]" />
      <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#5a6862]">
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-[Georgia] text-[34px] font-medium tracking-tight text-[#102b22] tabular-nums">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-[#87928d]">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-xs text-[#87928d]">{hint}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  children,
  footer,
  className = '',
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`gg-card p-6 ${className}`}>
      {title && <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>}
      {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
      <div className={title || description ? 'mt-4' : ''}>{children}</div>
      {footer && (
        <div className="mt-4 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-500">
          {footer}
        </div>
      )}
    </section>
  );
}

export function ErrorNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {children}
    </div>
  );
}

/** Demo hesabında formların üstünde — neden kaydedilemediğini baştan söyler. */
export function DemoLockNotice() {
  return (
    <div
      role="status"
      className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <span aria-hidden="true" className="mt-0.5">🔒</span>
      <span>Demo hesabında değişiklik kaydedilmez.</span>
    </div>
  );
}

export type CheckState = 'done' | 'pending' | 'unknown';

/** Kurulum kontrol listesi satırı — anlam yalnızca renkle değil metinle de. */
export function ChecklistItem({ state, label }: { state: CheckState; label: string }) {
  const iconCls =
    state === 'done'
      ? 'bg-emerald-100 text-emerald-700'
      : state === 'unknown'
        ? 'border border-dashed border-neutral-300 text-neutral-400'
        : 'border border-neutral-300 text-neutral-400';
  const icon = state === 'done' ? '✓' : state === 'unknown' ? '?' : '…';
  const sr =
    state === 'done' ? ' (tamamlandı)' : state === 'unknown' ? ' (kontrol edilemedi)' : ' (bekleniyor)';
  return (
    <li className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${iconCls}`}
      >
        {icon}
      </span>
      <span className={state === 'done' ? 'text-neutral-700' : 'text-neutral-500'}>
        {label}
        <span className="sr-only">{sr}</span>
      </span>
    </li>
  );
}

/**
 * Faz 2 sekmeleri için dürüst boş durum. SAHTE VERİ YOK — yalnızca ne
 * göstereceğini, neden boş olduğunu ve neyin gerektiğini açıklar.
 */
export function ComingSoon({
  badge,
  title,
  whatItShows,
  whyEmpty,
  requirements,
  notice,
  ctaHref,
  ctaLabel,
}: {
  badge: string;
  title: string;
  whatItShows: string;
  whyEmpty: string;
  requirements: string[];
  notice?: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="mt-8 flex justify-center">
      <div className="gg-card w-full max-w-2xl p-8 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#edf5ef] text-[#1c6b58]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="mt-5 rounded-full border border-[#d8e7d9] bg-[#f1f7f1] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#286b5a]">
            {badge}
          </span>
          <h2 className="mt-4 font-[Georgia] text-3xl font-medium text-[#102b22]">{title}</h2>
        </div>

        <dl className="mt-8 space-y-5 text-left text-sm">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#5a6862]">
              Ne gösterecek?
            </dt>
            <dd className="mt-1 leading-relaxed text-[#3d4a45]">{whatItShows}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#5a6862]">
              Neden henüz boş?
            </dt>
            <dd className="mt-1 leading-relaxed text-[#3d4a45]">{whyEmpty}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#5a6862]">
              Gereken
            </dt>
            <dd className="mt-2">
              <ul className="space-y-1.5">
                {requirements.map((req) => (
                  <li key={req} className="flex items-start gap-2 leading-relaxed text-[#3d4a45]">
                    <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#a8cbb6]" />
                    {req}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>

        {notice && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800"
          >
            {notice}
          </div>
        )}

        <div className="mt-7">
          <Link href={ctaHref} className="gg-btn">
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

const nf = new Intl.NumberFormat('tr-TR');
const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

export const fmt = {
  int: (n: number) => nf.format(n),
  one: (n: number) => nf1.format(n),
  pct: (n: number) => `%${nf1.format(n)}`,
  money: (value: number | string, currency: string) => {
    const n = typeof value === 'string' ? Number(value) : value;
    try {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${nf.format(n)} ${currency}`;
    }
  },
  date: (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  },
  period: (p: { from: string; to: string }) =>
    `${fmt.date(p.from)} – ${fmt.date(p.to)}`,
};
