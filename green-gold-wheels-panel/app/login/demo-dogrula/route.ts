import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';
import { dashboard } from '@/lib/api';

/**
 * Demo girişinin ikinci adımı: oturum çerezleri artık tarayıcıda; API'ye
 * "bu hesap kim?" diye sorup rolün `demo_viewer` olduğunu DOĞRULA.
 *
 * Değilse (yanlış yapılandırılmış env) oturumu hemen kapat ve reddet —
 * herkese açık bir buton asla yazma yetkili bir hesap açmamalı.
 * Her başarısızlık kapalı sonuçlanır (fail-closed).
 */
export async function GET(request: NextRequest) {
  let isDemoViewer = false;
  try {
    const company = await dashboard.company();
    isDemoViewer = company.role === 'demo_viewer';
  } catch {
    isDemoViewer = false;
  }

  if (isDemoViewer) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    await auth.signOut();
  } catch {
    // Çıkış başarısız olsa bile panel verisi gösterilmez; giriş ekranına dön.
  }
  return NextResponse.redirect(new URL('/login?demo=gecersiz', request.url));
}
