import Link from 'next/link';
import {
  dashboard,
  publicApiBaseUrl,
  widgetEmbedSrc,
  type Company,
} from '@/lib/api';
import { guarded, loadCompany } from '@/lib/page';
import { AppShell } from '../components/AppShell';
import { CopyBlock } from '../components/CopyBlock';
import { ChecklistItem, PageHeader, type CheckState } from '../components/ui';

export const metadata = { title: 'Entegrasyon · Green Gold Wheels' };

export default async function IntegrationPage() {
  const company = await loadCompany();
  // Son 30 gün sinyali: "ilk etkileşim" değil, yalnızca bu pencerede
  // etkileşim olup olmadığını iddia ederiz. İstek başarısızsa 'unknown'.
  const [classes, recent] = await guarded(() =>
    Promise.all([
      dashboard.vehicleClasses(),
      dashboard.summary('30d').catch(() => null),
    ]),
  );
  const recentActivity: CheckState =
    recent === null ? 'unknown' : recent.stages.viewed > 0 ? 'done' : 'pending';
  const activeClasses = classes.filter((c) => c.is_active);

  const { src: widgetSrc, configured: srcConfigured } = widgetEmbedSrc();
  const apiBase = publicApiBaseUrl();
  const firstClass = activeClasses[0]?.class_code;

  const snippet = `<script src="${widgetSrc}" async></script>

<green-gold-wheels-widget
  data-key="${company.public_widget_key}"
  data-api="${apiBase}"
  data-distance-km="350"${firstClass ? `\n  data-vehicle-class="${firstClass}"` : ''}
  data-lang="tr"
></green-gold-wheels-widget>`;

  const callbackSnippet = `document.addEventListener('greengold:contribution-selected', (e) => {
  const { session_ref, distance_km, vehicle_class_code, currency } = e.detail;
  // Kendi ödeme akışınıza ekstra satır olarak bağlayın.
  // Tutar burada YOKTUR: güvenilir tutar API'den gelir.
});`;

  const continueSnippet = `// "Ödemeye devam" butonunuzun tıklamasında (isteğe bağlı ölçüm):
document.querySelector('green-gold-wheels-widget')?.trackBookingContinue();`;

  return (
    <AppShell company={company} active="integration">
      <main className="gg-page">
        <PageHeader
          kicker="Kurulum ve bağlantı"
          title="Entegrasyon"
          subtitle="Widget embed kodu, izinli domain durumu ve kurulum adımları"
        >
          <StatusBadge status={company.status} />
        </PageHeader>

        <section className="gg-card mt-6 p-6">
          <h2 className="text-sm font-semibold text-neutral-900">1 · Embed kodu</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Kodu kiralama sitenizin/uygulamanızın rezervasyon (checkout)
            sayfasına, müşterinin aracı ve tahmini mesafeyi gördüğü yere
            yapıştırın.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ConnectionField label="Widget script URL" value={widgetSrc} />
            <ConnectionField label="API URL" value={apiBase} />
            <ConnectionField label="Public widget key" value={company.public_widget_key} />
          </div>

          <div className="mt-4">
            <CopyBlock code={snippet} />
          </div>

          {!srcConfigured && (
            <div role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Widget script adresi henüz yapılandırılmadı (
              <code>NEXT_PUBLIC_WIDGET_SRC</code> / <code>NEXT_PUBLIC_SITE_URL</code>{' '}
              eksik). Kod geçici bir yer tutucu içeriyor — canlıya almadan önce
              ayarlanmalı.
            </div>
          )}

          <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-relaxed text-neutral-600">
            <strong className="font-semibold text-neutral-800">Geliştiriciniz için:</strong>{' '}
            <code>data-distance-km</code> rezervasyondaki tahmini mesafedir
            (müşteri değiştirebilir; verilmezse 100 km).{' '}
            <code>data-vehicle-class</code> kiralanan aracın sınıf kodudur —{' '}
            <Link href="/araclar" className="font-semibold underline">Araç Sınıfları</Link>{' '}
            ekranındaki kodlardan biri ({activeClasses.map((c) => c.class_code).join(', ') || '—'}).
            Değerler sonradan değişirse attribute’u güncellemeniz yeterli; widget
            kendini yeniden hesaplar. <code>data-lang</code>: <code>tr</code> veya{' '}
            <code>en</code>.
          </div>
        </section>

        <section className="gg-card mt-6 p-6">
          <h2 className="text-sm font-semibold text-neutral-900">2 · İzinli domain’ler</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Widget yalnızca{' '}
            <Link href="/ayarlar" className="font-semibold text-[#0b5c49] underline">Ayarlar</Link>
            ’daki izinli domain’lerde çalışır.
          </p>
          {company.allowed_origins.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {company.allowed_origins.map((o) => (
                <li key={o} className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-mono text-xs text-neutral-700">
                  {o}
                </li>
              ))}
            </ul>
          ) : (
            <div role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Henüz izinli domain eklenmemiş — widget hiçbir sitede çalışmaz.
            </div>
          )}
        </section>

        <section className="gg-card mt-6 p-6">
          <h2 className="text-sm font-semibold text-neutral-900">
            3 · Katkı onayını ödeme akışınıza bağlayın
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Widget ödeme almaz ve rezervasyon oluşturmaz; müşterinin tercihini
            bir event ile bildirir. Tahsilatı kendi ödeme adımınızda yaparsınız.
          </p>
          <div className="mt-4 space-y-3">
            <CopyBlock code={callbackSnippet} />
            <CopyBlock code={continueSnippet} />
          </div>
        </section>

        <SetupChecklist
          company={company}
          srcConfigured={srcConfigured}
          activeClassCount={activeClasses.length}
          recentActivity={recentActivity}
        />
      </main>
    </AppShell>
  );
}

function SetupChecklist({
  company,
  srcConfigured,
  activeClassCount,
  recentActivity,
}: {
  company: Company;
  srcConfigured: boolean;
  activeClassCount: number;
  recentActivity: CheckState;
}) {
  const items: { state: CheckState; label: string }[] = [
    { state: srcConfigured ? 'done' : 'pending', label: 'Widget script adresi yapılandırıldı' },
    { state: company.public_widget_key ? 'done' : 'pending', label: 'Widget anahtarı üretildi' },
    { state: company.allowed_origins.length > 0 ? 'done' : 'pending', label: 'İzinli domain eklendi' },
    { state: activeClassCount > 0 ? 'done' : 'pending', label: 'En az bir araç sınıfı aktif' },
    { state: company.status === 'active' ? 'done' : 'pending', label: 'Şirket aktifleştirildi' },
    {
      state: recentActivity,
      label:
        recentActivity === 'unknown'
          ? 'Son 30 gün etkileşim durumu kontrol edilemedi'
          : 'Son 30 günde etkileşim alındı',
    },
  ];
  return (
    <section className="gg-card mt-6 p-6">
      <h2 className="text-sm font-semibold text-neutral-900">Kurulum durumu</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Yalnızca gerçekten doğrulanabilen adımlar işaretlenir.
      </p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {items.map((it) => (
          <ChecklistItem key={it.label} state={it.state} label={it.label} />
        ))}
      </ul>
    </section>
  );
}

function StatusBadge({ status }: { status: Company['status'] }) {
  const map = {
    active: { label: 'Aktif', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    pending: { label: 'Beklemede', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
    suspended: { label: 'Askıya alındı', cls: 'border-red-200 bg-red-50 text-red-800' },
  } as const;
  const s = map[status];
  return (
    <span className={`inline-flex h-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${s.cls}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      Şirket durumu: {s.label}
    </span>
  );
}

function ConnectionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">{label}</div>
      <div className="mt-1 break-all font-mono text-xs text-neutral-800">{value}</div>
    </div>
  );
}
