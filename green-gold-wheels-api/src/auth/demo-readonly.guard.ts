import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_DEMO_WRITE_KEY } from '../common/route-metadata';
import type { AuthenticatedRequest } from './auth.guard';

export const DEMO_ROLE = 'demo_viewer';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Deny-by-default (GLOBAL, AuthGuard'dan SONRA çalışır): rolü `demo_viewer`
 * olan kullanıcı için TÜM yazma metotları 403 döner — endpoint listesi DEĞİL,
 * metot bazlı genel kural. Yeni eklenen korumalı bir yazma ucu otomatik
 * olarak demo'ya kapalı kalır; bir ucu bilerek açmak için @AllowDemoWrite().
 *
 * Public uçlarda (auth yok -> req.auth undefined) demo rolü olmadığından bu
 * guard karışmaz — ör. public POST /widget/events kapsam dışıdır (kasıtlı;
 * o uç kullanıcı değil widget anahtarıyla çalışır).
 */
@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = (req.method ?? 'GET').toUpperCase();
    if (!WRITE_METHODS.has(method)) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_DEMO_WRITE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;

    if (req.auth?.role === DEMO_ROLE) {
      throw new ForbiddenException({
        code: 'demo_read_only',
        message: 'Demo hesabı salt okunurdur; değişiklik kaydedilmez.',
      });
    }
    return true;
  }
}
