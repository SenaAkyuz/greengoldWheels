import { isDemo } from '@/lib/api';
import { loadCompany } from '@/lib/page';
import { AppShell } from '../components/AppShell';
import { Card, DemoLockNotice, PageHeader, fmt } from '../components/ui';
import { OriginsForm, PricingForm } from './SettingsForms';

export const metadata = { title: 'Ayarlar · Green Gold Wheels' };

const STATUS_LABEL = { active: 'Aktif', pending: 'Beklemede', suspended: 'Askıya alındı' } as const;

export default async function SettingsPage() {
  const company = await loadCompany();
  const readOnly = isDemo(company);

  return (
    <AppShell company={company} active="settings">
      <main className="gg-page">
        <PageHeader
          kicker="Hesap"
          title="Ayarlar"
          subtitle="Widget’ın hangi adreslerde çalışacağı ve katkı tutarının nasıl hesaplanacağı"
        />

        {readOnly && <DemoLockNotice />}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card
            title="İzinli adresler"
            description="Widget yalnızca buradaki adreslerden veri gönderebilir."
            footer="Bu liste bir güvenlik sınırıdır: anahtarınız başka bir siteye kopyalansa bile orada çalışmaz."
          >
            <OriginsForm company={company} readOnly={readOnly} />
          </Card>

          <Card
            title="Katkı fiyatlandırması"
            description="Widget’ın müşteriye önerdiği katkı tutarı buradan hesaplanır."
          >
            <PricingForm company={company} readOnly={readOnly} />
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card
            title="Şirket bilgileri"
            footer="Bu alanları değiştirmek için Green Gold ile iletişime geçin. Zaman dilimi raporların gün sınırlarını belirler."
          >
            <dl className="space-y-2 text-sm">
              {(
                [
                  ['Şirket', company.name],
                  ['Kod', company.company_code],
                  ['Şehir', company.city ?? '—'],
                  ['Ülke', company.country],
                  ['Zaman dilimi', company.timezone],
                  ['Para birimi', company.default_currency],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-neutral-500">{label}</dt>
                  <dd className="font-medium text-neutral-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card
            title="Değiştiremediğiniz alanlar"
            footer="Hesap durumu, komisyon oranı ve widget anahtarı panelden değiştirilemez — bu kısıt veritabanı yetkilerinde de tanımlıdır."
          >
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Hesap durumu</dt>
                <dd className="font-medium text-neutral-900">{STATUS_LABEL[company.status]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Komisyon oranı</dt>
                <dd className="font-medium text-neutral-900">
                  %{fmt.one(Number(company.commission_rate))}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </main>
    </AppShell>
  );
}
