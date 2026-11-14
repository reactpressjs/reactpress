import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { ApiMsg } from '../../common/api-messages';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  const mockContext = (request: Record<string, unknown> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('returns the HTTP request from execution context', () => {
    const req = { headers: {} };
    expect(guard.getRequest(mockContext(req))).toBe(req);
  });

  it('returns the authenticated user when present', () => {
    const user = { id: '1' };
    expect(guard.handleRequest(undefined, user)).toBe(user);
  });

  it('throws when an error is passed to handleRequest', () => {
    try {
      guard.handleRequest(new Error('jwt'), null);
      fail('expected UnauthorizedException');
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      const response = (error as UnauthorizedException).getResponse() as { message: string };
      expect(response.message).toBe(ApiMsg.AUTH_FAILED);
    }
  });

  it('throws when user is missing', () => {
    try {
      guard.handleRequest(undefined, null);
      fail('expected UnauthorizedException');
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      const response = (error as UnauthorizedException).getResponse() as { message: string };
      expect(response.message).toBe(ApiMsg.AUTH_FAILED);
    }
  });
});
