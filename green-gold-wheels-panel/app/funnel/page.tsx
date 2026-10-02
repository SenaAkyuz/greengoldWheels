import { dashboard, normalizeRange } from '@/lib/api';
import { guarded, loadCompany } from '@/lib/page';
import { AppShell } from '../components/AppShell';
import { PageHeader, RangePills, fmt } from '../components/ui';

export const metadata = { title: 'Dönüşüm · Green Gold Wheels' };

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const company = await loadCompany();
  const range = normalizeRange((await searchParams).range);

  const [funnel, summary] = await guarded(() =>
    Promise.all([dashboard.funnel(range), dashboard.summary(range)]),
  );

  const { stages, rates } = funnel;
  const isEmpty = stages.viewed === 0;
  const max = Math.max(stages.viewed, 1);
  const rows = [
    { label: 'Görüntülenme', count: stages.viewed },
    { label: 'Katkı seçimi', count: stages.selected },
    { label: 'Katkı onayı', count: stages.clicked },
  ];
  const transitions = [rates.view_to_select_pct, rates.select_to_button_pct];

  return (
    <AppShell company={company} active="funnel">
      <main className="gg-page">
        <PageHeader
          kicker="Müşteri etkileşimleri"
          title="Dönüşüm"
          subtitle={`Oturum bazlı etkileşim hunisi · ${fmt.period(funnel.period)}`}
        >
          <RangePills current={range} basePath="/funnel" />
        </PageHeader>

        <section className="gg-card mt-7 bg-gradient-to-br from-[#eaf4ec] to-white p-7">
          <div className="text-sm font-medium text-emerald-800">
            Görüntülenme → Katkı onayı
          </div>
          <div className="mt-2 font-[Georgia] text-5xl font-medium tracking-tight text-[#0a493b] tabular-nums">
            {fmt.pct(rates.view_to_button_pct)}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Her aşama, o adıma ulaşan tekil müşteri oturumunu sayar ve bir
            önceki aşamanın alt kümesidir — oranlar %100’ü aşmaz. Ödeme veya
            rezervasyon onayını göstermez.
          </p>
        </section>

        {isEmpty ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Henüz etkileşim yok — müşteriler widget’ı gördükçe huni burada
            oluşacak.
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
            <section className="gg-card p-6">
              <div className="space-y-4">
                {rows.map((row, i) => (
                  <div key={row.label}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium text-neutral-700">{row.label}</span>
                      <span className="font-semibold tabular-nums text-neutral-900">
                        {fmt.int(row.count)}
                        <span className="ml-1 text-xs font-normal text-neutral-400">
                          tekil oturum
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-8 w-full overflow-hidden rounded-lg bg-neutral-100">
                      <div
                        className="h-full rounded-lg bg-gradient-to-r from-[#075442] to-[#6da98d]"
                        style={{
                          width: `${Math.max((row.count / max) * 100, row.count > 0 ? 4 : 0)}%`,
                          opacity: 1 - i * 0.18,
                        }}
                      />
                    </div>
                    {i < transitions.length && (
                      <div className="mt-1.5 pl-1 text-xs text-neutral-500">
                        ↓ {fmt.pct(transitions[i])} bir sonraki adıma geçti
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="gg-card h-fit p-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#5a6862]">
                Araç değişikliği
              </div>
              <div className="mt-3 font-[Georgia] text-[34px] font-medium tabular-nums text-[#102b22]">
                {fmt.int(summary.vehicle_selected_sessions)}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#87928d]">
                Widget içinde araç sınıfını değiştiren oturum. Huni aşaması
                değildir: araç rezervasyondan ön seçili gelebilir.
              </p>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}
