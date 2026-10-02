import { dashboard, publicApiBaseUrl } from '@/lib/api';
import { guarded, loadCompany } from '@/lib/page';
import { AppShell } from '../components/AppShell';
import { CustomerPreviewWidget } from '../components/CustomerPreviewWidget';
import { ErrorNotice, PageHeader } from '../components/ui';

export const metadata = { title: 'Müşteri Önizleme · Green Gold Wheels' };

export default async function CustomerPreviewPage() {
  const company = await loadCompany();
  const classes = await guarded(() => dashboard.vehicleClasses());
  const active = classes.filter((c) => c.is_active);

  return (
    <AppShell company={company} active="customer-preview">
      <main className="gg-page">
        <PageHeader
          kicker="Müşteri deneyimi"
          title="Müşteri Önizleme"
          subtitle="Widget’ın kiralama müşterinize nasıl göründüğünün canlı önizlemesi"
        >
          <span className="rounded-full border border-[#cfe2d4] bg-[#edf6ee] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#17614f]">
            • Önizleme modu
          </span>
        </PageHeader>

        <div className="gg-notice mt-7 flex items-center gap-3 px-5 py-4 text-sm">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#075442] font-semibold text-white">
            ✓
          </span>
          <div>
            <div className="font-semibold">Güvenli önizleme modu</div>
            <div className="mt-0.5 text-xs text-[#5e776f]">
              Bu ekrandaki etkileşimler raporlara yansımaz ve ödeme alınmaz.
            </div>
          </div>
        </div>

        {company.status !== 'active' && (
          <ErrorNotice>
            Şirketiniz henüz aktif olmadığı için widget yapılandırması
            servis edilmiyor; önizleme boş görünebilir. Aktivasyon sonrası
            burada canlı görünür.
          </ErrorNotice>
        )}
        {active.length === 0 && (
          <ErrorNotice>
            Aktif araç sınıfı yok — widget araç seçtiremediği için çizilmez.
            Araç Sınıfları ekranından en az bir sınıfı aktifleştirin.
          </ErrorNotice>
        )}

        <CustomerPreviewWidget
          publicKey={company.public_widget_key}
          apiBase={publicApiBaseUrl()}
          vehicles={active.map((c) => ({
            class_code: c.class_code,
            label_tr: c.label_tr,
            co2e_per_km_kg: c.co2e_per_km_kg,
          }))}
          pricing={{
            pricePerKg: Number(company.price_per_kg_co2e).toLocaleString('tr-TR'),
            minAmount: Number(company.min_contribution_amount).toLocaleString('tr-TR'),
            currency: company.default_currency,
          }}
        />
      </main>
    </AppShell>
  );
}
