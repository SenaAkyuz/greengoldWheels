import { Global, Module } from '@nestjs/common';
import { NeonAuthTokenVerifier, TokenVerifier } from './token-verifier';

/**
 * Guard soyut `TokenVerifier`'a bağlanır; burada Neon Auth implementasyonu
 * bağlanır. Testler aynı token'a sahte bir doğrulayıcı verir.
 */
@Global()
@Module({
  providers: [{ provide: TokenVerifier, useClass: NeonAuthTokenVerifier }],
  exports: [TokenVerifier],
})
export class AuthModule {}
