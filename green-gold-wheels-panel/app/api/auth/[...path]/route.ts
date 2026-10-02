import { auth } from '@/lib/auth/server';

/**
 * Neon Auth proxy'si — tarayıcı buraya konuşur, burası Neon'a.
 *
 * Neden proxy: oturum çerezi panelin kendi alan adında kalsın ve tarayıcı
 * Neon Auth ile doğrudan konuşmasın. `[...all]` tüm Better Auth yollarını
 * (sign-in, sign-out, session, token …) aynen iletir.
 *
 * NOT: `authApiHandler` paketten dışa aktarılmıyor (yalnızca tip olarak
 * görünüyor); doğru yol `createNeonAuth(...).handler()`. Böylece baseUrl ve
 * çerez sırrı tek yerde (lib/auth/server.ts) tanımlı kalıyor.
 *
 * ⚠️ `sign-up` yolu da teknik olarak açıktır (Neon Auth henüz kayıt kapatmayı
 * desteklemiyor). Panelde kayıt EKRANI yoktur ve kendi kendine kayıt olan biri
 * API'den 401 alır: erişimin kapısı `users` eşleme tablosudur, ona yalnızca
 * operatör yazar (scripts/create-auth-user.ts).
 */
export const { GET, POST } = auth.handler();
