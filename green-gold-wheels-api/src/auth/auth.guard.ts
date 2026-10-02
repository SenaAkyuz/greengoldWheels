import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Database } from '../database/database';
import { IS_PUBLIC_KEY } from '../common/route-metadata';
import { TokenVerifier } from './token-verifier';

export interface AuthContext {
  authUserId: string;
  companyId: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
}

/**
 * Global kimlik guard'ı (APP_GUARD) — @Public() olmayan her ucu korur.
 *
 *   1. Bearer token -> TokenVerifier (Neon Auth) -> doğrulanmış kullanıcı kimliği.
 *   2. Kimlik -> wheels_resolve_member() -> company_id + rol.
 *   3. req.auth'a yaz. Servisler şirketi YALNIZCA buradan alır.
 *
 * TENANT İZOLASYONU: company_id istemciden ASLA alınmaz — token claim'i,
 * header'ı, query parametresi olarak bile. Yalnızca imzası doğrulanmış
 * kullanıcı kimliğinin veritabanındaki eşlemesinden gelir. Neon Auth'un
 * "organizations" özelliği BİLİNÇLİ OLARAK kullanılmıyor: şirket üyeliğinin
 * tek doğruluk kaynağı bizim `users` tablomuz.
 *
 * Askıya alınmış (suspended) şirketin yöneticisi 403 alır. Beklemedeki
 * (pending) şirketin yöneticisi girebilir — canlıya almadan önce kurulumu
 * (embed kodu, origin listesi) görebilmesi gerekir.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly db: Database,
    private readonly verifier: TokenVerifier,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token gerekli.');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Bearer token gerekli.');
    }

    let authUserId: string;
    try {
      authUserId = await this.verifier.verify(token);
    } catch {
      // Doğrulama hatasının ayrıntısı (süresi doldu / imza / azp) istemciye
      // sızdırılmaz — saldırgana hangi kontrolü geçtiğini söylememek için.
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş token.');
    }

    const member = await this.db.withoutTenant(async (q) => {
      const { rows } = await q.query<{
        company_id: string;
        role: string;
        company_status: string;
      }>(
        'SELECT company_id, role, company_status FROM wheels_resolve_member($1)',
        [authUserId],
      );
      return rows[0] ?? null;
    });

    if (!member) {
      // Geçerli bir Neon Auth kullanıcısı ama hiçbir şirkete bağlı değil.
      // Neon Auth açık kayıt aldığı için bu yol GERÇEKTEN kullanılır: kendi
      // kendine kayıt olan biri buraya düşer ve hiçbir veri görmez.
      throw new UnauthorizedException('Kullanıcı bir şirkete bağlı değil.');
    }

    if (member.company_status === 'suspended') {
      throw new ForbiddenException('Şirket hesabı askıya alınmış.');
    }

    req.auth = {
      authUserId,
      companyId: member.company_id,
      role: member.role,
    };
    return true;
  }
}
