import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { ApiMsg } from '../../common/api-messages';
import { ApiKeyService } from './api-key.service';

/**
 * Accept either an admin JWT or an API key with `write` (or `*`) scope.
 * Prefer `X-API-Key` for headless/agent clients; `Authorization: Bearer rp_…` also works.
 * JWT Bearer tokens that do not start with `rp_` use the passport JWT strategy.
 */
@Injectable()
export class AdminAccessGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headerKey = request.headers['x-api-key'];
    const auth = String(request.headers.authorization || '').trim();
    const bearer = auth.replace(/^Bearer\s+/i, '').trim();
    const rawKey = headerKey || (bearer.startsWith('rp_') ? bearer : '');

    if (rawKey) {
      const apiKey = await this.apiKeyService.validateRawKey(String(rawKey));
      if (!apiKey) {
        throw new UnauthorizedException(ApiMsg.INVALID_API_KEY);
      }
      if (!this.apiKeyService.hasScope(apiKey, 'write')) {
        throw new ForbiddenException(ApiMsg.API_KEY_MISSING_WRITE);
      }
      request.apiKey = apiKey;
      request.user = {
        id: `api-key:${apiKey.id}`,
        name: apiKey.name,
        role: 'admin',
      };
      return true;
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<User>(err: Error | null, user: User): User {
    if (err || !user) {
      throw err || new UnauthorizedException(ApiMsg.AUTH_FAILED);
    }
    const role = (user as { role?: string }).role;
    if (role !== 'admin') {
      throw new ForbiddenException(ApiMsg.FORBIDDEN);
    }
    return user;
  }
}
