import Link from 'next/link';
import { dashboard, normalizeRange } from '@/lib/api';
import { factorSourceLabel } from '@/lib/factor-source';
import { guarded, loadCompany } from '@/lib/page';
import { AppShell } from '../components/AppShell';
import { Card, MetricCard, PageHeader, RangePills, fmt } from '../components/ui';

export const metadata = { title: 'Karbon Etkisi · Green Gold Wheels' };

export default async function CarbonPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const company = await loadCompany();
  const range = normalizeRange((await searchParams).range);

  const [carbon, classes] = await guarded(() =>
    Promise.all([dashboard.carbon(range), dashboard.vehicleClasses()]),
  );

  const active = classes.filter((c) => c.is_active);
  const avg =
    carbon.contributions_count > 0
      ? carbon.estimated_co2e_kg / carbon.contributions_count
      : 0;

  return (
    <AppShell company={company} active="carbon">
      <main className="gg-page">
        <PageHeader
          kicker="Tahmini etki"
          title="Karbon Etkisi"
          subtitle={`Katkı onaylanan yolculukların tahmini CO₂e’si · ${fmt.period(carbon.period)}`}
        >
          <RangePills current={range} basePath="/karbon" />
        </PageHeader>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Tahmini CO₂e"
            value={fmt.one(carbon.estimated_co2e_kg)}
            unit="kg"
          />
          <MetricCard
            label="Ağaç-yılı eşdeğeri"
            value={`≈ ${fmt.one(carbon.tree_equivalent)}`}
            hint="21 kg CO₂e / ağaç-yıl"
          />
          <MetricCard
            label="Katkı onayı"
            value={fmt.int(carbon.contributions_count)}
            unit="oturum"
          />
          <MetricCard
            label="Toplam mesafe"
            value={fmt.int(carbon.total_distance_km)}
            unit="km"
          />
        </div>

        {carbon.contributions_count === 0 ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Bu aralıkta katkı onayı yok, bu yüzden hesaplanmış bir karbon etkisi
            de yok.
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Onay başına ortalama">
              <div className="font-[Georgia] text-3xl font-medium tabular-nums text-[#0a493b]">
                {fmt.one(avg)} kg CO₂e
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {fmt.int(carbon.contributions_count)} onay üzerinden
              </p>
            </Card>
            <Card title="Hesaplanamayan oturumlar">
              <div className="font-[Georgia] text-3xl font-medium tabular-nums text-[#0a493b]">
                {fmt.int(carbon.missing_estimate_count)}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                {carbon.missing_estimate_count === 0
                  ? 'Tüm onaylarda mesafe ve araç bilgisi vardı.'
                  : 'Mesafe veya araç bilgisi eksik olduğu için toplama girmedi — gerçek etki yukarıdakinden yüksek olabilir.'}
              </p>
            </Card>
          </div>
        )}

        <section className="gg-card mt-6 p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Hesap nasıl yapılıyor?</h2>
          <div className="mt-3 grid gap-4 text-sm leading-relaxed text-[#3d4a45] md:grid-cols-3">
            <div className="rounded-xl bg-[#f4f8f4] p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#347866]">1 · Emisyon</div>
              <p className="mt-1.5">
                <strong>mesafe (km) × araç faktörü (kg CO₂e/km)</strong>. Faktör
                şirketinizin <em>Araç Sınıfları</em> tablosundan gelir.
              </p>
            </div>
            <div className="rounded-xl bg-[#f4f8f4] p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#347866]">2 · Katkı tutarı</div>
              <p className="mt-1.5">
                <strong>max(alt sınır, CO₂e × kg fiyatı)</strong> — şu an kg
                başına {fmt.money(company.price_per_kg_co2e, company.default_currency)},
                alt sınır {fmt.money(company.min_contribution_amount, company.default_currency)}.
              </p>
            </div>
            <div className="rounded-xl bg-[#f4f8f4] p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#347866]">3 · Otomatik aktarım</div>
              <p className="mt-1.5">
                Widget aynı formülü aynı faktörlerle çalıştırır; onaylanan her
                katkı <strong>sunucuda yeniden hesaplanır</strong>. Tarayıcıdan
                gelen bir tutara güvenilmez.
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            Bir oturum yalnızca bir kez sayılır; müşteri mesafeyi değiştirip
            tekrar onaylasa bile toplam şişmez.
          </p>
        </section>

        <section className="gg-card mt-6 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Kullanılan araç faktörleri</h2>
            <Link href="/araclar" className="text-xs font-semibold text-[#0b5c49] underline">
              Düzenle →
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-[0.1em] text-[#5a6862]">
                  <th className="py-2 pr-3 font-bold">Araç sınıfı</th>
                  <th className="py-2 pr-3 font-bold">kg CO₂e/km</th>
                  <th className="py-2 pr-3 font-bold">Kaynak</th>
                  <th className="py-2 font-bold">Kapsam</th>
                </tr>
              </thead>
              <tbody>
                {active.map((c) => (
                  <tr key={c.class_code} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-neutral-800">{c.label_tr}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{Number(c.co2e_per_km_kg).toLocaleString('tr-TR')}</td>
                    <td className="py-2.5 pr-3 text-neutral-600">
                      {factorSourceLabel(c.factor_source)} · {c.factor_country}{' '}
                      {c.factor_year}
                    </td>
                    <td className="py-2.5 text-neutral-600">
                      {c.factor_scope === 'well_to_wheel' ? 'Yakıt zinciri dahil' : 'Egzoz'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
