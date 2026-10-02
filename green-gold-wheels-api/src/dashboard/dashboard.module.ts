import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  // WidgetModule, /widget/impact'in panelle BİREBİR aynı sayıyı döndürmesi için
  // DashboardService'i kullanır (tek hesap kaynağı).
  exports: [DashboardService],
})
export class DashboardModule {}
