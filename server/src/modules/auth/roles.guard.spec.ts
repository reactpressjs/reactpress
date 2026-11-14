import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { User } from '../user/user.entity';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'get'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'decode'>>;

  const handler = jest.fn();
  const context = {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: 'Bearer jwt-token' },
      }),
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { get: jest.fn() };
    jwtService = { decode: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector, jwtService as unknown as JwtService);
  });

  it('allows access when no roles metadata is set', () => {
    reflector.get.mockReturnValue(undefined);
    expect(guard.canActivate(context)).toBe(true);
    expect(jwtService.decode).not.toHaveBeenCalled();
  });

  it('allows access when the user role matches', () => {
    reflector.get.mockReturnValue(['admin']);
    jwtService.decode.mockReturnValue({ role: 'admin' } as User);
    expect(guard.canActivate(context)).toBe(true);
    expect(jwtService.decode).toHaveBeenCalledWith('jwt-token');
  });

  it('strips Bearer prefix before decoding', () => {
    reflector.get.mockReturnValue(['admin']);
    jwtService.decode.mockReturnValue({ role: 'admin' } as User);
    const rawContext = {
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer raw-jwt' } }),
      }),
    } as unknown as ExecutionContext;
    guard.canActivate(rawContext);
    expect(jwtService.decode).toHaveBeenCalledWith('raw-jwt');
  });

  it('decodes token as-is when Authorization is not Bearer', () => {
    reflector.get.mockReturnValue(['admin']);
    jwtService.decode.mockReturnValue({ role: 'admin' } as User);
    const plainContext = {
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'plain-jwt' } }),
      }),
    } as unknown as ExecutionContext;
    guard.canActivate(plainContext);
    expect(jwtService.decode).toHaveBeenCalledWith('plain-jwt');
  });

  it('denies access when decode returns no user', () => {
    reflector.get.mockReturnValue(['admin']);
    jwtService.decode.mockReturnValue(null);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when the user role does not match', () => {
    reflector.get.mockReturnValue(['admin']);
    jwtService.decode.mockReturnValue({ role: 'editor' } as User);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when the user has no role', () => {
    reflector.get.mockReturnValue(['admin']);
    jwtService.decode.mockReturnValue({ id: '1' } as unknown as User);
    expect(guard.canActivate(context)).toBe(false);
  });
});
