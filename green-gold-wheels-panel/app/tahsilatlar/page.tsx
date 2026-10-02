import { loadCompany } from '@/lib/page';
import { AppShell } from '../components/AppShell';
import { ComingSoon, PageHeader } from '../components/ui';

export const metadata = { title: 'Tahsilatlar · Green Gold Wheels' };

export default async function PaymentsPage() {
  const company = await loadCompany();
  return (
    <AppShell company={company} active="payments">
      <main className="gg-page">
        <PageHeader kicker="Faz 2" title="Tahsilatlar" subtitle="Toplanan katkılar ve aktarımlar" />
        <ComingSoon
          badge="Faz 2"
          title="Katkı tahsilatları"
          whatItShows="Müşterilerden tahsil edilen katkıların dönemsel toplamı, Green Gold’a aktarılan tutarlar ve komisyon dökümü."
          whyEmpty="Katkı tutarı bugün sizin ödeme akışınızda tahsil edilir; Green Gold bu ödemeyi görmez. Tahsilat kaydı, onaylı rezervasyon entegrasyonuyla birlikte gelecek."
          requirements={[
            'Onaylı rezervasyon entegrasyonu (Rezervasyonlar)',
            'Tahsil edilen tutarın ve para biriminin bildirilmesi',
            'Dönem sonu mutabakat süreci',
          ]}
          ctaHref="/raporlar"
          ctaLabel="Raporlara git"
        />
      </main>
    </AppShell>
  );
}
