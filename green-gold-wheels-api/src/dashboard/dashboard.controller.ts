import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { DashboardService } from './dashboard.service';
import {
  CreateVehicleClassDto,
  UpdateCompanyDto,
  UpdateVehicleClassDto,
} from './dto/update-company.dto';

/**
 * /dashboard/* — auth'lı (global AuthGuard; @Public YOK).
 *
 * TENANT İZOLASYONU: company_id YALNIZCA req.auth'tan (imzası doğrulanmış
 * Neon Auth token'ı -> users eşlemesi) gelir. Hiçbir uç istemciden
 * company_id/şirket kimliği KABUL ETMEZ — query parametresi olarak bile.
 * Servis katmanı bu kimlikle tenant transaction'ı açar; RLS ikinci kat olarak
 * başka şirketin satırını veritabanı seviyesinde engeller.
 *
 * CORS: bu uçlar panelden SERVER-SIDE çağrılır, tarayıcıdan değil — bu yüzden
 * /widget/* gibi bir CORS katmanı yoktur (bilinçli).
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // GET /dashboard/widget-events-summary?range=month|7d|30d veya ?from=&to=
  @Get('widget-events-summary')
  async summary(
    @Req() req: AuthenticatedRequest,
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboard.getWidgetEventsSummary(req.auth.companyId, {
      range,
      from,
      to,
    });
  }

  // GET /dashboard/carbon-summary
  @Get('carbon-summary')
  async carbon(
    @Req() req: AuthenticatedRequest,
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboard.getCarbonSummary(req.auth.companyId, {
      range,
      from,
      to,
    });
  }

  // GET /dashboard/funnel
  @Get('funnel')
  async funnel(
    @Req() req: AuthenticatedRequest,
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboard.getFunnel(req.auth.companyId, { range, from, to });
  }

  // GET /dashboard/company — temel bilgi + embed anahtarı.
  // `role` panelin demo rozeti/salt-okunur arayüzü içindir; YETKİ DEĞİLDİR —
  // yazma yasağını DemoReadOnlyGuard sunucuda uygular.
  @Get('company')
  async company(@Req() req: AuthenticatedRequest) {
    const company = await this.dashboard.getCompany(req.auth.companyId);
    return { ...company, role: req.auth.role };
  }

  // GET /dashboard/export.csv?range=  — günlük rapor, şirkete kapsamlı.
  // @Res kullanıldığı için ortak zarf (interceptor) devreye girmez; ham CSV döner.
  @Get('export.csv')
  async exportCsv(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<void> {
    const { filename, csv } = await this.dashboard.exportCsv(
      req.auth.companyId,
      { range, from, to },
    );
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    });
    // BOM: Excel'in UTF-8'i doğru okuması için.
    res.send('﻿' + csv);
  }

  // GET /dashboard/vehicle-classes — faktörler + provenance.
  @Get('vehicle-classes')
  async vehicleClasses(@Req() req: AuthenticatedRequest) {
    return this.dashboard.getVehicleClasses(req.auth.companyId);
  }

  // ---------------------------------------------------------------------
  // YAZMA — panel yönetim ekranları.
  //
  // Hiçbiri şirket kimliği parametresi ALMAZ: hedef her zaman req.auth'taki
  // şirkettir. "Hangi şirketi düzenliyorum" sorusunu istemci soramaz.
  // ---------------------------------------------------------------------

  // PATCH /dashboard/company — ayarlar + izinli origin listesi.
  @Patch('company')
  async updateCompany(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.dashboard.updateCompany(req.auth.companyId, dto);
  }

  // POST /dashboard/vehicle-classes — yeni araç sınıfı.
  @Post('vehicle-classes')
  async createVehicleClass(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateVehicleClassDto,
  ) {
    return this.dashboard.createVehicleClass(req.auth.companyId, dto);
  }

  // PATCH /dashboard/vehicle-classes/:classCode — faktör/etiket düzenleme.
  @Patch('vehicle-classes/:classCode')
  async updateVehicleClass(
    @Req() req: AuthenticatedRequest,
    @Param('classCode') classCode: string,
    @Body() dto: UpdateVehicleClassDto,
  ) {
    return this.dashboard.updateVehicleClass(
      req.auth.companyId,
      classCode,
      dto,
    );
  }
}
