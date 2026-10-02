import { loadCompany } from '@/lib/page';
import { AppShell } from '../components/AppShell';
import { ComingSoon, PageHeader } from '../components/ui';

export const metadata = { title: 'Sertifikalar · Green Gold Wheels' };

export default async function CertificatesPage() {
  const company = await loadCompany();
  return (
    <AppShell company={company} active="certificates">
      <main className="gg-page">
        <PageHeader kicker="Faz 2" title="Sertifikalar" subtitle="Doğrulanmış karbon dengeleme belgeleri" />
        <ComingSoon
          badge="Faz 2"
          title="Karbon dengeleme belgeleri"
          whatItShows="Toplanan katkılarla desteklenen projelerin belgeleri ve dönemsel etki raporu."
          whyEmpty="Belge, ancak tahsil edilen katkılar onaylı bir projeye aktarıldığında düzenlenebilir — bu akış henüz kurulmadı."
          requirements={[
            'Onaylı bir kaynaktan gelen emisyon faktörleri',
            'Tahsilat kayıtları (Tahsilatlar)',
            'Doğrulanmış proje ortağı ve belge akışı',
          ]}
          ctaHref="/karbon"
          ctaLabel="Karbon etkisine git"
        />
      </main>
    </AppShell>
  );
}
