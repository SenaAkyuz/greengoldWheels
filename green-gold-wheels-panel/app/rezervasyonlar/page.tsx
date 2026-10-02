import { loadCompany } from '@/lib/page';
import { AppShell } from '../components/AppShell';
import { ComingSoon, PageHeader } from '../components/ui';

export const metadata = { title: 'Rezervasyonlar · Green Gold Wheels' };

export default async function ReservationsPage() {
  const company = await loadCompany();
  return (
    <AppShell company={company} active="reservations">
      <main className="gg-page">
        <PageHeader kicker="Faz 2" title="Rezervasyonlar" subtitle="Katkı içeren onaylı kiralamalar" />
        <ComingSoon
          badge="Faz 2 · Entegrasyon bekleniyor"
          title="Onaylı kiralamalar"
          whatItShows="Katkı seçilerek tamamlanan kiralamaların listesi: tarih, araç sınıfı, mesafe, tahmini CO₂e ve katkı tutarı."
          whyEmpty="Widget bugün yalnızca müşterinin tercihini bildirir; kiralamanın gerçekten tamamlandığını sizin rezervasyon sisteminiz bilir. O onay bize henüz sunucudan sunucuya iletilmiyor."
          requirements={[
            'Rezervasyon sisteminizden imzalı bir onay bildirimi (webhook)',
            'Bildirimde widget oturum kimliği (session_ref) ve rezervasyon durumu',
            'İptal/iade durumlarının da bildirilmesi',
          ]}
          notice="Buradaki sayılar uydurulmaz: entegrasyon gelene kadar bu ekran bilinçli olarak boştur."
          ctaHref="/entegrasyon"
          ctaLabel="Entegrasyon sayfasına git"
        />
      </main>
    </AppShell>
  );
}
