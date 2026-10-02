import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { WidgetModule } from './widget/widget.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthGuard } from './auth/auth.guard';
import { DemoReadOnlyGuard } from './auth/demo-readonly.guard';
import { DistributedThrottlerStorage } from './common/distributed-throttler.storage';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // IP başına 60 istek / dakika (yalnızca /widget/* controller'ında uygulanır).
    // storage: paylaşılan RateLimitStore (Upstash Redis bağlıysa dağıtık; yoksa
    // bellek-içi fallback + uyarı) — Vercel'de instance'lar arası tutarlılık için.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
      storage: new DistributedThrottlerStorage(),
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    WidgetModule,
    DashboardModule,
  ],
  // Global AuthGuard: @Public() olmayan her ucu korur ve req.auth'ı doldurur
  // (deny-by-default — yeni bir dashboard ucu eklendiğinde unutulamaz).
  // SIRA ÖNEMLİ: DemoReadOnlyGuard, AuthGuard'ın doldurduğu req.auth.role'e
  // bakar; o yüzden ondan SONRA kaydedilir.
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: DemoReadOnlyGuard },
  ],
})
export class AppModule {}
