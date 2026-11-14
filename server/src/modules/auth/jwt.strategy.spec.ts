jest.mock('passport-jwt', () => ({
  Strategy: class JwtStrategyMock {
    constructor(_options?: unknown) {}
  },
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: () => () => undefined,
  },
}));

jest.mock('@nestjs/passport', () => ({
  PassportStrategy: () =>
    class PassportStrategyMixin {
      constructor(_options?: unknown) {}
    },
}));

import { ApiMsg } from '../../common/api-messages';
import { User } from '../user/user.entity';
import type { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: jest.Mocked<Pick<AuthService, 'validateUser'>>;

  const user = { id: 'u1', role: 'admin' } as User;

  beforeEach(() => {
    authService = { validateUser: jest.fn() };
    strategy = new JwtStrategy(authService as unknown as AuthService);
  });

  it('returns the user when validation succeeds', async () => {
    authService.validateUser.mockResolvedValue(user);
    await expect(strategy.validate(user)).resolves.toBe(user);
    expect(authService.validateUser).toHaveBeenCalledWith(user);
  });

  it('throws when the user does not exist', async () => {
    authService.validateUser.mockResolvedValue(null);
    await expect(strategy.validate(user)).rejects.toThrow(ApiMsg.AUTH_FAILED);
  });
});
