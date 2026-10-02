import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_DISTANCE_KM, MIN_DISTANCE_KM } from '../../common/carbon-estimate';

export const WIDGET_EVENT_TYPES = [
  'widget_goruntulendi',
  // Araç sınıfı seçildi/değiştirildi. Huni AŞAMASI DEĞİL — yan sinyal
  // (bkz. dashboard/interaction-funnel.ts başındaki not).
  'arac_secildi',
  'checkbox_secildi',
  // "Katkıyı onayla" — kullanıcının NİYETİ. Ödeme/rezervasyon onayı DEĞİL.
  'katki_ekle_butonuna_basildi',
  // Kiralama şirketinin ödeme/rezervasyon adımına geçiş tıklaması.
  // REZERVASYON BAŞLADI/TAMAMLANDI ANLAMINA GELMEZ. Şirket bazlı feature flag
  // ile korunur (varsayılan kapalı) — bkz. WidgetService.recordEvent.
  'rezervasyona_devam_edildi',
] as const;

export type WidgetEventType = (typeof WIDGET_EVENT_TYPES)[number];

/**
 * İstemciden kabul edilen metadata — SADECE HESABIN GİRDİLERİ.
 *
 * ⚠️ Burada `amount` / `estimated_co2e_kg` / `co2e_per_km_kg` gibi SONUÇ
 * alanları BİLİNÇLİ OLARAK YOKTUR. Global ValidationPipe
 * `forbidNonWhitelisted: true` ile çalıştığı için böyle bir alan göndermek
 * isteği 400 ile reddeder. Sonuçları API kendi faktör tablosundan hesaplar
 * (bkz. common/carbon-estimate.ts) — istemci tutar/CO₂ spoof edemez.
 */
export class WidgetEventMetadataDto {
  /** Tahmini yolculuk mesafesi (km). Mesafe bazlı modelin tek sayısal girdisi. */
  @IsOptional()
  @IsInt()
  @Min(MIN_DISTANCE_KM)
  @Max(MAX_DISTANCE_KM)
  distance_km?: number;

  /**
   * Seçilen araç sınıfının kodu (`vehicle_classes.class_code`). Şirkete ait
   * olmayan/pasif bir kod gönderilirse servis bunu REDDETMEZ ama hesaba da
   * KATMAZ — faktör çözülemediği için CO₂/tutar yazılmaz (bkz. recordEvent).
   * Karakter kümesi daraltıldı: kod bir anahtar, serbest metin değil.
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message:
      'vehicle_class_code yalnızca küçük harf, rakam ve tire içerebilir.',
  })
  vehicle_class_code?: string;
}

export class CreateWidgetEventDto {
  @IsIn(WIDGET_EVENT_TYPES)
  event_type!: WidgetEventType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  session_ref?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WidgetEventMetadataDto)
  metadata?: WidgetEventMetadataDto;
}
