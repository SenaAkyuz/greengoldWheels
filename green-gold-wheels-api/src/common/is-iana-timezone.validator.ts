import {
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

/**
 * IANA timezone doğrulaması — biçim değil, GERÇEK varlık kontrolü.
 *
 * Timezone bu sistemde kozmetik değil: tüm panel aralıkları (month/7d/30d)
 * şirketin yerel gününde çözülüyor. Var olmayan bir tz, tarih hesabını
 * sessizce UTC'ye kaydırıp raporları yanlış gösterirdi.
 */
@ValidatorConstraint({ name: 'IsIanaTimezone', async: false })
export class IsIanaTimezone implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'timezone geçerli bir IANA zaman dilimi olmalıdır (ör. Europe/Istanbul).';
  }
}
