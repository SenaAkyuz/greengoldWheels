import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateNested,
} from 'class-validator';
import {
  MAX_FACTOR_PER_KM,
  type FactorScope,
} from '../../common/carbon-estimate';
import { IsIanaTimezone } from '../../common/is-iana-timezone.validator';
import { IsHttpsOrigin } from '../../common/is-origin.validator';

/**
 * Şirket ayarları — panelin düzenleyebildiği alanlar.
 *
 * `forbidNonWhitelisted` ile çalıştığı için burada OLMAYAN bir alan göndermek
 * 400 döner. `status`, `public_widget_key`, `commission_rate`, `company_code`
 * bilinçli olarak YOK — zaten veritabanı da o kolonlara yazma yetkisi vermiyor
 * (0008_panel_writes.sql). İki kat: DTO önce reddeder, GRANT son savunmadır.
 */
export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @Validate(IsIanaTimezone)
  timezone?: string;

  /**
   * Widget'ın çalışabileceği origin'ler. Boş dizi = widget hiçbir tarayıcıdan
   * çalışmaz (geçerli bir durum: şirketi geçici olarak durdurmak).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Validate(IsHttpsOrigin, { each: true })
  allowed_origins?: string[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(10000)
  price_per_kg_co2e?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  min_contribution_amount?: number;

  /** Yalnızca https. Widget zaten http logoyu çizmez. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^https:\/\/\S+$/, { message: 'logo_url https ile başlamalıdır.' })
  logo_url?: string;

  /** Katı 6 haneli hex — widget yalnızca bunu CSS değişkenine yazar. */
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'brand_color #RRGGBB biçiminde olmalıdır.',
  })
  brand_color?: string;
}

export const FACTOR_SCOPES: readonly FactorScope[] = [
  'tank_to_wheel',
  'well_to_wheel',
];

export const FUEL_TYPES = [
  'benzin',
  'dizel',
  'hibrit',
  'plugin_hibrit',
  'elektrik',
  'lpg',
] as const;

/**
 * Araç sınıfı düzenleme.
 *
 * ⚠️ METODOLOJİ KURALI: faktör değiştirmek bir İDDİADIR. `co2e_per_km_kg`
 * gönderiliyorsa provenance'ın tamamı (kaynak + ülke + yıl + kapsam) da
 * gönderilmek ZORUNDADIR — servis bunu denetler. Böylece "sayıyı değiştirdim
 * ama kaynağı eski kaldı" durumu oluşamaz.
 */
export class UpdateVehicleClassDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label_tr?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label_en?: string;

  @IsOptional()
  @IsIn(FUEL_TYPES)
  fuel_type?: (typeof FUEL_TYPES)[number];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 5 })
  @Min(0.00001)
  @Max(MAX_FACTOR_PER_KM)
  co2e_per_km_kg?: number;

  /**
   * Boş bırakılamaz: kaynağı olmayan bir faktör yazılamaz (0002'deki CHECK ile
   * aynı kural). 'placeholder' geçerli bir değerdir — "henüz onaylanmadı"
   * demektir ve activate-company bunu --force olmadan canlıya almaz.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  factor_source?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'factor_country 2 harfli ülke kodu olmalı.',
  })
  factor_country?: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  factor_year?: number;

  @IsOptional()
  @IsIn(FACTOR_SCOPES)
  factor_scope?: FactorScope;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sort_order?: number;

  @IsOptional()
  @Type(() => Boolean)
  is_active?: boolean;
}

/** Yeni araç sınıfı — düzenlemeden farkı: kod ve provenance ZORUNLU. */
export class CreateVehicleClassDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,59}$/, {
    message:
      'class_code yalnızca küçük harf, rakam ve tire içerebilir (en fazla 60).',
  })
  class_code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label_tr!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label_en!: string;

  @IsIn(FUEL_TYPES)
  fuel_type!: (typeof FUEL_TYPES)[number];

  @IsNumber({ maxDecimalPlaces: 5 })
  @Min(0.00001)
  @Max(MAX_FACTOR_PER_KM)
  co2e_per_km_kg!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  factor_source!: string;

  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'factor_country 2 harfli ülke kodu olmalı.',
  })
  factor_country!: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  factor_year!: number;

  @IsIn(FACTOR_SCOPES)
  factor_scope!: FactorScope;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sort_order?: number;
}

/** `widget_settings` içindeki görünürlük bayrakları. */
export class UpdateWidgetSettingsDto {
  @IsOptional()
  @Type(() => Boolean)
  show_estimated_impact?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  enable_booking_click_tracking?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  content_overrides?: Record<string, unknown>;
}
