import {
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Widget origin doğrulaması.
 *
 * Origin, CORS kararının girdisidir: tarayıcının gönderdiği `Origin` başlığıyla
 * BİREBİR karşılaştırılır. Bu yüzden kurallar katı:
 *
 *   - **https zorunlu.** http bir origin, widget anahtarını ağda açık taşır.
 *     (Geliştirmede localhost ayrı bir yoldan serbest — bkz. widget-cors.ts;
 *     oraya yazılmasına gerek yok.)
 *   - **Yalnızca origin**: yol, sorgu, fragment YOK. `https://x.com/sayfa`
 *     hiçbir zaman eşleşmez, çünkü tarayıcı yol göndermez — sessizce çalışmayan
 *     bir kayıt olurdu.
 *   - **Joker YOK.** `https://*.x.com` eşleşmez ve alt alan adı başına izin
 *     vermek bilinçli bir karar olmalıdır.
 */
@ValidatorConstraint({ name: 'IsHttpsOrigin', async: false })
export class IsHttpsOrigin implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length > 253) return false;
    if (value.includes('*')) return false;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    if (url.protocol !== 'https:') return false;
    // URL.origin yolu/sorguyu atar; girdinin kendisi tam olarak origin olmalı.
    return url.origin === value.replace(/\/+$/, '');
  }

  defaultMessage(): string {
    return 'allowed_origins yalnızca https origin içerebilir (yol/joker yok, ör. https://sirket.com).';
  }
}
