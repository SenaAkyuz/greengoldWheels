'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';

export type DemoLoginState = { error: string | null };

// IP başına kaba hız sınırı (buton herkese açık — Neon Auth'a yük binmesin).
// NOT: bellek içi, dağıtık DEĞİL — birden çok sunucu örneğinde paylaşılmaz.
// Canlıda paylaşımlı bir store'a taşınmalı; tek örnekte kötüye kullanımı yavaşlatır.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  const limited = recent.length >= RATE_MAX;
  if (!limited) recent.push(now);
  hits.set(ip, recent);
  return limited;
}

/**
 * "Demo panelini görüntüle" — Stay'deki inceleme modu.
 *
 * Demo hesabının e-posta/şifresi YALNIZCA sunucuda okunur; tarayıcı hiçbir
 * zaman görmez. Buton gizlense de action uç noktası çağrılabileceği için
 * DEMO_LOGIN_ENABLED burada da kontrol edilir.
 *
 * Giriş başarılıysa doğrudan panele DEĞİL, /login/demo-dogrula'ya gidilir:
 * orada hesabın gerçekten `demo_viewer` (salt okunur) olduğu API'den
 * doğrulanır. Yanlış yapılandırma (ör. env'e gerçek bir yöneticinin bilgisi
 * yazılması) herkese açık bir butonla tam yetki vermesin.
 */
// useActionState (önceki durum, form verisi) geçirir; ikisine de ihtiyaç yok —
// kimlik bilgisi formdan DEĞİL, yalnızca sunucu env'inden okunur.
export async function demoLogin(): Promise<DemoLoginState> {
  if (process.env.DEMO_LOGIN_ENABLED !== 'true') {
    return { error: 'Bu özellik devre dışı.' };
  }

  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  if (isRateLimited(ip)) {
    return { error: 'Çok fazla deneme. Lütfen biraz sonra tekrar deneyin.' };
  }

  const email = process.env.DEMO_LOGIN_EMAIL;
  const password = process.env.DEMO_LOGIN_PASSWORD;
  if (!email || !password) {
    return { error: 'Demo girişi yapılandırılmamış.' };
  }

  let ok = false;
  try {
    const result = (await auth.signIn.email({ email, password })) as {
      error?: unknown;
    } | null;
    ok = !!result && !result.error;
  } catch {
    ok = false;
  }
  // Ham hata/şifre asla mesaja konmaz.
  if (!ok) return { error: 'Demo girişi başarısız oldu.' };

  redirect('/login/demo-dogrula');
}
