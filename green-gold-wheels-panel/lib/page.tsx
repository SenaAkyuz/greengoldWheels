import 'server-only';
import { redirect } from 'next/navigation';
import { dashboard, NotAuthenticatedError, type Company } from './api';

/**
 * Her korumalı sayfanın ortak girişi: oturumu doğrula + şirketi getir.
 *
 * Tek yerde olmasının sebebi güvenlik: yeni bir sayfa eklerken kontrolü
 * unutmak mümkün olmasın. Sayfa `loadCompany()` çağırmadan veri gösteremez,
 * çünkü şirket bilgisi (ve dolayısıyla API token'ı) buradan geliyor.
 *
 * Oturum yoksa/sona erdiyse `/login`'e yönlendirir — hata ekranı değil,
 * çünkü kullanıcının yapacağı tek şey yeniden giriş.
 */
export async function loadCompany(): Promise<Company> {
  try {
    return await dashboard.company();
  } catch (e) {
    if (e instanceof NotAuthenticatedError) redirect('/login');
    throw e;
  }
}

/**
 * Sayfa verisi getirirken oturum hatasını yönlendirmeye çeviren sarmalayıcı.
 * Diğer hatalar (403, 500) yukarı çıkar ve error boundary'ye düşer.
 */
export async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotAuthenticatedError) redirect('/login');
    throw e;
  }
}
