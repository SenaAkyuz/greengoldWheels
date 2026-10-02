import { dashboard, normalizeRange } from '@/lib/api';
import { guarded, loadCompany } from '@/lib/page';
import { AppShell } from '../components/AppShell';
import { MetricCard, PageHeader, RangePills, fmt } from '../components/ui';

export const metadata = { title: 'Raporlar · Green Gold Wheels' };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const company = await loadCompany();
  const range = normalizeRange((await searchParams).range);

  const [summary, carbon] = await guarded(() =>
    Promise.all([dashboard.summary(range), dashboard.carbon(range)]),
  );

  const exportHref =
    range === 'month' ? '/raporlar/export' : `/raporlar/export?range=${range}`;
  const empty = summary.stages.viewed === 0;

  return (
    <AppShell company={company} active="reports">
      <main className="gg-page">
        <PageHeader
          kicker="Veri özeti"
          title="Raporlar"
          subtitle={`Etkileşim, dönüşüm ve tahmini karbon özeti · ${fmt.period(summary.period)}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <RangePills current={range} basePath="/raporlar" />
            {/* <a>: dosya indirmesi bir sayfa geçişi değil. */}
            <a href={exportHref} className="gg-btn rounded-full">
              CSV indir
            </a>
          </div>
        </PageHeader>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-neutral-700">Etkileşim</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Görüntülenme" value={fmt.int(summary.stages.viewed)} />
            <MetricCard label="Katkı seçimi" value={fmt.int(summary.stages.selected)} />
            <MetricCard label="Katkı onayı" value={fmt.int(summary.stages.clicked)} />
            <MetricCard
              label="Dönüşüm"
              value={empty ? '—' : fmt.pct(summary.conversion_rate_pct)}
              hint="Katkı onayı / Görüntülenme"
            />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-neutral-700">Tahmini karbon</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Tahmini CO₂e" value={`≈ ${fmt.one(carbon.estimated_co2e_kg)}`} unit="kg" />
            <MetricCard label="Ağaç-yılı eşdeğeri" value={`≈ ${fmt.one(carbon.tree_equivalent)}`} />
            <MetricCard label="Toplam mesafe" value={fmt.int(carbon.total_distance_km)} unit="km" />
            <MetricCard
              label="Araç değişikliği"
              value={fmt.int(summary.vehicle_selected_sessions)}
              hint="Widget’ta aracı değiştiren oturum"
            />
          </div>
        </section>

        <section className="gg-card mt-8 p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Ham olay sayaçları</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Tekilleştirilmemiş olay sayıları — teşhis amaçlı.
          </p>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {(
              [
                ['Görüntülenme', summary.raw_counts.widget_goruntulendi],
                ['Araç seçimi', summary.raw_counts.arac_secildi],
                ['Katkı seçimi', summary.raw_counts.checkbox_secildi],
                ['Katkı onayı', summary.raw_counts.katki_ekle_butonuna_basildi],
                ['Rezervasyona devam', summary.raw_counts.rezervasyona_devam_edildi],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-neutral-100 py-1.5">
                <dt className="text-neutral-600">{label}</dt>
                <dd className="font-semibold tabular-nums text-neutral-900">{fmt.int(value)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-6 text-xs text-neutral-400">
          CSV, seçili aralığı gün gün (şirketinizin saat diliminde) içerir.
        </p>
      </main>
    </AppShell>
  );
}
