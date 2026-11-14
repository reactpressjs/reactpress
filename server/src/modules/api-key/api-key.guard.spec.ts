import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { ApiMsg } from '../../common/api-messages';
import { ApiKey } from './api-key.entity';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyService } from './api-key.service';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let apiKeyService: jest.Mocked<Pick<ApiKeyService, 'validateRawKey'>>;

  const buildContext = (headers: Record<string, string> = {}): ExecutionContext => {
    const request: { headers: Record<string, string>; apiKey?: ApiKey } = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  const validKey = { id: 'key-1', name: 'ci', enabled: true } as ApiKey;

  beforeEach(() => {
    apiKeyService = { validateRawKey: jest.fn() };
    guard = new ApiKeyGuard(apiKeyService as unknown as ApiKeyService);
  });

  it('rejects when no API key header is present', async () => {
    const ctx = buildContext();
    let error: unknown;
    try {
      await guard.canActivate(ctx);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getResponse()).toEqual(
      expect.objectContaining({ message: ApiMsg.MISSING_API_KEY })
    );
  });

  it('validates x-api-key and attaches the entity to the request', async () => {
    const ctx = buildContext({ 'x-api-key': 'rp_abcdef' });
    apiKeyService.validateRawKey.mockResolvedValue(validKey);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(apiKeyService.validateRawKey).toHaveBeenCalledWith('rp_abcdef');
    expect(ctx.switchToHttp().getRequest().apiKey).toBe(validKey);
  });

  it('accepts Bearer token in Authorization when x-api-key is absent', async () => {
    const ctx = buildContext({ authorization: 'Bearer rp_secret' });
    apiKeyService.validateRawKey.mockResolvedValue(validKey);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(apiKeyService.validateRawKey).toHaveBeenCalledWith('rp_secret');
  });

  it('rejects invalid keys', async () => {
    const ctx = buildContext({ 'x-api-key': 'rp_bad' });
    apiKeyService.validateRawKey.mockResolvedValue(null);

    let error: unknown;
    try {
      await guard.canActivate(ctx);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getResponse()).toEqual(
      expect.objectContaining({ message: ApiMsg.INVALID_API_KEY })
    );
  });
});
