import Link from 'next/link';
import { getSessionUser } from '@/lib/api';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Giriş · Green Gold Wheels' };
// Oturum çerezine bakar — her istekte sunucuda çizilir.
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  /**
   * Giriş ekranı HER ZAMAN açılır — açık bir oturum varken bile.
   *
   * Önceden burada panele yönlendirme vardı; ama bu sayfaya çoğunlukla
   * tanıtım sitesindeki "Sisteme giriş" butonundan geliniyor ve o butona
   * basan kişi giriş ekranını görmeyi bekliyor. Oturumu açık olan kişi
   * aşağıdaki satırdan tek tıkla panele geçebilir (ya da başka bir hesapla
   * giriş yapabilir).
   */
  const user = await getSessionUser();

  // Demo butonu görünürlüğü SUNUCUDA hesaplanır; istemciye yalnızca bayrak
  // gider — kimlik bilgisi asla.
  const demoEnabled =
    process.env.DEMO_LOGIN_ENABLED === 'true' &&
    !!process.env.DEMO_LOGIN_EMAIL &&
    !!process.env.DEMO_LOGIN_PASSWORD;

  const demoRejected = (await searchParams).demo === 'gecersiz';

  return (
    <main className="grid min-h-screen flex-1 bg-[#f5f7f3] lg:grid-cols-[52%_48%]">
      <section className="relative hidden overflow-hidden bg-[#064b3d] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -bottom-32 -left-32 h-[430px] w-[430px] rounded-full border border-[#c9eb47]/20" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-[#c9eb47] font-[Georgia] text-xl text-[#c9eb47]">
            G
          </span>
          <div>
            <div className="font-bold tracking-[0.18em]">GREEN GOLD</div>
            <div className="mt-1 text-[9px] tracking-[0.26em] text-[#9cc7ba]">WHEELS PORTAL</div>
          </div>
        </div>
        <div className="relative max-w-xl">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#c9eb47]">
            Sürdürülebilir kiralama
          </div>
          <h2 className="mt-5 font-[Georgia] text-5xl leading-[1.08]">
            Filonuzun Green Wheels yolculuğunu yönetin.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-[#b9d3cb]">
            Widget etkileşimlerini, yolculukların tahmini karbon etkisini ve
            entegrasyon ayarlarını tek panelden takip edin.
          </p>
        </div>
        <div className="relative text-xs text-[#8fb9ae]">
          Green Gold · Car Rental Sustainability Platform
        </div>
      </section>

      <div className="flex items-center justify-center px-5 py-14">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#064b3d] font-[Georgia] text-[#c9eb47]">
              G
            </span>
            <div>
              <div className="text-[15px] font-bold tracking-[0.14em] text-[#12372c]">GREEN GOLD</div>
              <div className="text-xs text-neutral-500">Filo Paneli</div>
            </div>
          </div>

          <div className="gg-card p-7 sm:p-9">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#347866]">
              Kiralama şirketi paneli
            </div>
            <h1 className="mt-3 font-[Georgia] text-4xl font-medium text-[#102b22]">Giriş yap</h1>
            <p className="mb-7 mt-2 text-sm text-[#5a6862]">
              Şirket panelinize erişmek için giriş yapın.
            </p>

            {user && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d2e5d6] bg-[#edf6ee] px-3 py-2 text-sm text-[#174d3f]">
                <span>Bu tarayıcıda açık bir oturum var.</span>
                <Link href="/" className="font-semibold text-[#0b5c49] underline">
                  Panele git →
                </Link>
              </div>
            )}

            {demoRejected && (
              <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Demo hesabı doğrulanamadı; oturum kapatıldı. Lütfen yöneticinize
                bildirin.
              </div>
            )}

            <LoginForm demoEnabled={demoEnabled} />
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-neutral-500">
            Panel erişimi davet usulüdür. Hesabınız yoksa veya şifrenizi
            unuttuysanız Green Gold ile iletişime geçin.
          </p>
        </div>
      </div>
    </main>
  );
}
