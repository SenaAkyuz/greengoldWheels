import Link from 'next/link';
import {
  dashboard,
  normalizeRange,
  type CarbonSummary,
  type Company,
  type Summary,
} from '@/lib/api';
import { guarded, loadCompany } from '@/lib/page';
import { AppShell } from './components/AppShell';
import {
  ChecklistItem,
  MetricCard,
  PageHeader,
  RangePills,
  fmt,
} from './components/ui';

export const metadata = { title: 'Genel Bakış · Green Gold Wheels' };

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const company = await loadCompany();
  const range = normalizeRange((await searchParams).range);

  const [summary, carbon] = await guarded(() =>
    Promise.all([dashboard.summary(range), dashboard.carbon(range)]),
  );

  const { stages } = summary;
  const isEmpty = stages.viewed === 0;

  return (
    <AppShell company={company} active="overview">
      <main className="gg-page">
        <PageHeader
          kicker="Green Wheels performansı"
          title="Genel Bakış"
          subtitle={`Widget etkileşim özeti · ${fmt.period(summary.period)}`}
        >
          <RangePills current={range} basePath="/" />
        </PageHeader>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Görüntülenme" value={fmt.int(stages.viewed)} unit="oturum" />
          <MetricCard label="Katkı seçimi" value={fmt.int(stages.selected)} unit="oturum" />
          <MetricCard
            label="Dönüşüm"
            value={isEmpty ? '—' : fmt.pct(summary.conversion_rate_pct)}
            hint="Katkı onayı / Görüntülenme"
          />
          <MetricCard
            label="Tahmini CO₂ etkisi"
            value={fmt.one(carbon.estimated_co2e_kg)}
            unit="kg"
          />
        </div>

        {isEmpty ? (
          <EmptyOverviewState company={company} />
        ) : (
          <>
            <ConversionStory summary={summary} />
            <EstimatedImpactSummary carbon={carbon} />
          </>
        )}

        <section className="gg-card mt-8 flex flex-wrap items-center justify-between gap-3 p-6">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Entegrasyon</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Embed kodu, izinli domain durumu ve kurulum adımları Entegrasyon
              sekmesinde.
            </p>
          </div>
          <Link href="/entegrasyon" className="gg-btn shrink-0">
            Entegrasyon sayfasına git
          </Link>
        </section>
      </main>
    </AppShell>
  );
}

// Görüntülendi -> Katkı seçildi -> Katkı onaylandı. Sayı VE oran birlikte.
function ConversionStory({ summary }: { summary: Summary }) {
  const { stages } = summary;
  const rate = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  const rows = [
    { label: 'Widget görüntülendi', count: stages.viewed },
    { label: 'Katkı seçeneği işaretlendi', count: stages.selected },
    { label: 'Katkı onaylandı', count: stages.clicked },
  ];
  const transitions = [rate(stages.selected, stages.viewed), rate(stages.clicked, stages.selected)];
  const max = Math.max(stages.viewed, 1);

  return (
    <section className="gg-card mt-8 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">Dönüşüm hikâyesi</h2>
        <Link
          href="/funnel"
          className="rounded text-xs font-semibold text-[#0b5c49] underline focus:outline-none focus:ring-2 focus:ring-[#5c9f80]/40"
        >
          Tüm dönüşüm hunisini gör →
        </Link>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Oturum bazlı etkileşim akışı — ödeme/rezervasyon onayını göstermez.
      </p>

      <div className="mt-5 space-y-4">
        {rows.map((row, i) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-neutral-700">{row.label}</span>
              <span className="font-semibold tabular-nums text-neutral-900">
                {fmt.int(row.count)}
                <span className="ml-1 text-xs font-normal text-neutral-400">tekil oturum</span>
              </span>
            </div>
            <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-[#0b5c49]"
                style={{ width: `${Math.max((row.count / max) * 100, row.count > 0 ? 3 : 0)}%` }}
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

      {summary.vehicle_selected_sessions > 0 && (
        <p className="mt-5 text-xs text-neutral-500">
          Ayrıca {fmt.int(summary.vehicle_selected_sessions)} oturumda müşteri
          widget içinde araç sınıfını değiştirdi.
        </p>
      )}
    </section>
  );
}

function EstimatedImpactSummary({ carbon }: { carbon: CarbonSummary }) {
  return (
    <section className="gg-card mt-6 bg-gradient-to-br from-[#eaf4ec] to-white p-6">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Tahmini etki özeti
      </span>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <div className="font-[Georgia] text-3xl font-medium tracking-tight text-[#0a493b] tabular-nums">
            {fmt.one(carbon.estimated_co2e_kg)} kg CO₂e
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {fmt.int(carbon.contributions_count)} katkı onayının toplamı.
          </p>
        </div>
        <div>
          <div className="font-[Georgia] text-3xl font-medium tracking-tight text-[#0a493b] tabular-nums">
            ≈ {fmt.one(carbon.tree_equivalent)}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Ağaç-yılı eşdeğeri (21 kg CO₂e / ağaç-yıl).
          </p>
        </div>
        <div>
          <div className="font-[Georgia] text-3xl font-medium tracking-tight text-[#0a493b] tabular-nums">
            {fmt.int(carbon.total_distance_km)} km
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Katkı onaylanan yolculukların toplam tahmini mesafesi.
          </p>
        </div>
      </div>
      <Link
        href="/karbon"
        className="mt-4 inline-block rounded text-xs font-semibold text-[#0b5c49] underline focus:outline-none focus:ring-2 focus:ring-[#5c9f80]/40"
      >
        Hesap yöntemini ve araç faktörlerini gör →
      </Link>
    </section>
  );
}

// Veri yoksa: dürüst boş durum + yalnızca GERÇEK şirket verisinden türetilen
// kontrol listesi. Ölçülemeyen madde ("kod kopyalandı" vb.) YOK.
function EmptyOverviewState({ company }: { company: Company }) {
  return (
    <section className="gg-card mt-6 p-6">
      <h2 className="text-sm font-semibold text-neutral-900">Henüz veri yok</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Widget kiralama sitenize eklenip ilk müşteri etkileşimi geldiğinde
        veriler burada görünecek.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        <ChecklistItem
          state={company.allowed_origins.length > 0 ? 'done' : 'pending'}
          label="İzinli domain eklendi"
        />
        <ChecklistItem
          state={company.status === 'active' ? 'done' : 'pending'}
          label="Şirket aktifleştirildi"
        />
        <ChecklistItem state="pending" label="İlk etkileşim bekleniyor" />
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/entegrasyon" className="gg-btn">
          Entegrasyon sekmesindeki kodu kullanın
        </Link>
        <Link
          href="/musteri-onizleme"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-[#cfdad2] px-4 text-sm font-medium text-[#315d50] transition hover:bg-[#f1f6f2]"
        >
          Widget’ı önizleyin
        </Link>
      </div>
    </section>
  );
}
