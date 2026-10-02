import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/** HTTP durum kodu -> ortak hata kodu (tablo: tip güvenli, tek satırda genişler). */
const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'bad_request',
  [HttpStatus.UNAUTHORIZED]: 'unauthorized',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.TOO_MANY_REQUESTS]: 'too_many_requests',
};

/** Tüm hataları { success: false, data: null, error: { code, message } } yapar. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let message = 'Beklenmeyen bir hata oluştu.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      code = CODE_BY_STATUS[status] ?? 'error';
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const body = res as Record<string, unknown>;
        const rawMessage = body.message ?? body.error;
        // Yalnızca string ve string dizisi mesaja çevrilir; nesne/sayı String()
        // ile '[object Object]' üretirdi -> varsayılan mesaj korunur.
        if (Array.isArray(rawMessage)) {
          const parts = rawMessage.filter(
            (part): part is string => typeof part === 'string',
          );
          if (parts.length) message = parts.join(', ');
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        }
        if (typeof body.code === 'string') code = body.code;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      success: false,
      data: null,
      error: { code, message },
    });
  }
}
