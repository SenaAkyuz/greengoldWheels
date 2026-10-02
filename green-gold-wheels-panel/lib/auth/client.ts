'use client';
import { createAuthClient } from '@neondatabase/auth/next';

/**
 * Tarayıcı tarafı auth istemcisi — YALNIZCA giriş/çıkış için.
 *
 * Argümansız çağrılır: Next sürümü istekleri panelin kendi
 * `/api/auth/*` proxy'sine gönderir, Neon'a doğrudan değil. Böylece oturum
 * çerezi panelin alan adında kalır ve Neon Auth anahtarları tarayıcıya
 * hiç inmez.
 *
 * Veri okuma bu istemciden GEÇMEZ: panel verisi server component'lerde
 * API'den çekilir (lib/api.ts).
 */
export const authClient = createAuthClient();
