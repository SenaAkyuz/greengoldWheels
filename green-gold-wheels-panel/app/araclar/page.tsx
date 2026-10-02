import { dashboard, isDemo } from '@/lib/api';
import { guarded, loadCompany } from '@/lib/page';
import { AppShell } from '../components/AppShell';
import { DemoLockNotice, PageHeader } from '../components/ui';
import { VehicleClassCard } from './VehicleClassForm';

export const metadata = { title: 'Araç Sınıfları · Green Gold Wheels' };

export default async function VehicleClassesPage() {
  const company = await loadCompany();
  const classes = await guarded(() => dashboard.vehicleClasses());
  const readOnly = isDemo(company);

  return (
    <AppShell company={company} active="vehicles">
      <main className="gg-page">
        <PageHeader
          kicker="Hesap girdileri"
          title="Araç Sınıfları"
          subtitle="Widget’ta görünen araç seçenekleri ve emisyon faktörleri — karbon hesabı doğrudan bu sayılara dayanır"
        />

        {readOnly && <DemoLockNotice />}

        {classes.length === 0 ? (
          <div className="gg-card mt-6 p-8 text-center text-sm text-neutral-500">
            Tanımlı araç sınıfı yok. Widget araç seçtiremediği için hesap
            yapamaz — Green Gold ile iletişime geçin.
          </div>
        ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {classes.map((item) => (
              <VehicleClassCard key={item.class_code} item={item} readOnly={readOnly} />
            ))}
          </div>
        )}

        <p className="mt-6 text-xs leading-relaxed text-neutral-500">
          Araç sınıfları silinemez; kullanılmayanlar <strong>pasife</strong>{' '}
          alınır. Geçmiş etkileşim kayıtları bu sınıflara bağlıdır.
        </p>
      </main>
    </AppShell>
  );
}
