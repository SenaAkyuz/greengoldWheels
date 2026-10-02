'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { demoLogin, type DemoLoginState } from './actions';

/**
 * Giriş formu — panelin TEK auth ekranı.
 *
 * ⚠️ KAYIT EKRANI BİLİNÇLİ OLARAK YOK. Erişim davet usulüdür: yöneticinin
 * hesabını operatör açar (scripts/create-auth-user.ts) ve şirkete bağlar.
 * Bağlanmamış bir hesap API'den 401 alır — erişimin kapısı `users` tablosudur.
 */
export function LoginForm({ demoEnabled }: { demoEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = (await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      })) as { error?: { status?: number; message?: string } | null };
      if (result?.error) {
        // Kimlik hataları için TEK genel mesaj: "kullanıcı yok" ile "şifre
        // yanlış"ı ayırmak e-posta sayımına (enumeration) izin verirdi.
        // Kimlik DIŞI sebepler (deneme limiti) ayrı söylenir.
        setError(
          result.error.status === 429
            ? 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.'
            : 'Giriş başarısız. E-posta adresinizi ve şifrenizi kontrol edin.',
        );
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
            E-posta
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            className="gg-input py-2.5"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Şifre
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            className="gg-input py-2.5"
          />
        </div>

        <button type="submit" disabled={busy} className="gg-btn w-full">
          {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>

      {demoEnabled && <DemoLogin />}
    </>
  );
}

function DemoLogin() {
  const [state, formAction] = useActionState<DemoLoginState, FormData>(demoLogin, {
    error: null,
  });

  return (
    <div className="mt-5 border-t border-neutral-200 pt-5">
      {state.error && (
        <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <form action={formAction}>
        <DemoSubmitButton />
      </form>
      <p className="mt-2 text-center text-xs text-neutral-400">
        Salt okunur inceleme hesabı; değişiklik kaydedilmez.
      </p>
    </div>
  );
}

function DemoSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] w-full rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-60"
    >
      {pending ? 'Demo açılıyor…' : 'Demo panelini görüntüle'}
    </button>
  );
}
