import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { ApiMsg } from '../../common/api-messages';
import { ApiKey } from './api-key.entity';
import { AdminAccessGuard } from './admin-access.guard';
import { ApiKeyService } from './api-key.service';

describe('AdminAccessGuard', () => {
  let guard: AdminAccessGuard;
  let apiKeyService: jest.Mocked<Pick<ApiKeyService, 'validateRawKey' | 'hasScope'>>;
  let jwtCanActivate: jest.SpyInstance;

  const buildContext = (headers: Record<string, string> = {}): ExecutionContext => {
    const request: { headers: Record<string, string>; apiKey?: ApiKey; user?: unknown } = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  beforeEach(() => {
    apiKeyService = {
      validateRawKey: jest.fn(),
      hasScope: jest.fn(),
    };
    guard = new AdminAccessGuard(apiKeyService as unknown as ApiKeyService);
    jwtCanActivate = jest.spyOn(Object.getPrototypeOf(AdminAccessGuard.prototype), 'canActivate');
  });

  afterEach(() => {
    jwtCanActivate.mockRestore();
  });

  it('accepts X-API-Key with write scope', async () => {
    const key = { id: 'k1', name: 'agent', scopes: 'read,write' } as ApiKey;
    apiKeyService.validateRawKey.mockResolvedValue(key);
    apiKeyService.hasScope.mockReturnValue(true);
    const ctx = buildContext({ 'x-api-key': 'rp_abc' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().apiKey).toBe(key);
    expect(apiKeyService.hasScope).toHaveBeenCalledWith(key, 'write');
    expect(jwtCanActivate).not.toHaveBeenCalled();
  });

  it('rejects API keys without write scope', async () => {
    const key = { id: 'k1', name: 'ro', scopes: 'read' } as ApiKey;
    apiKeyService.validateRawKey.mockResolvedValue(key);
    apiKeyService.hasScope.mockReturnValue(false);
    const ctx = buildContext({ 'x-api-key': 'rp_abc' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('treats Bearer rp_… as API key and does not use JWT', async () => {
    const key = { id: 'k1', name: 'agent' } as ApiKey;
    apiKeyService.validateRawKey.mockResolvedValue(key);
    apiKeyService.hasScope.mockReturnValue(true);
    const ctx = buildContext({ authorization: 'Bearer rp_secret' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwtCanActivate).not.toHaveBeenCalled();
  });

  it('falls back to JWT for non-rp Bearer tokens', async () => {
    jwtCanActivate.mockResolvedValue(true);
    const ctx = buildContext({ authorization: 'Bearer eyJhbGciOi...' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(apiKeyService.validateRawKey).not.toHaveBeenCalled();
    expect(jwtCanActivate).toHaveBeenCalled();
  });

  it('rejects invalid API keys', async () => {
    apiKeyService.validateRawKey.mockResolvedValue(null);
    const ctx = buildContext({ 'x-api-key': 'rp_bad' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('handleRequest requires admin role for JWT users', () => {
    expect(() => guard.handleRequest(null, { role: 'visitor' } as never)).toThrow(ForbiddenException);
    expect(guard.handleRequest(null, { role: 'admin' } as never)).toEqual({ role: 'admin' });
  });

  it('handleRequest maps auth failures to UnauthorizedException', () => {
    expect(() => guard.handleRequest(null, null as never)).toThrow(
      expect.objectContaining({ message: expect.stringContaining(ApiMsg.AUTH_FAILED) })
    );
  });
});
