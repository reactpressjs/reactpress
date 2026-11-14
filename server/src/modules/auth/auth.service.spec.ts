import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';

import { ApiMsg } from '../../common/api-messages';
import * as uniqueidUtil from '../../utils/uniqueid.util';
import { SettingService } from '../setting/setting.service';
import { SMTPService } from '../smtp/smtp.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';

const mockedAxios = axios as jest.MockedFunction<typeof axios>;

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<
    Pick<UserService, 'login' | 'loginWithoutPasswd' | 'findById' | 'findByConditions' | 'createUser'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let settingService: jest.Mocked<Pick<SettingService, 'findAll'>>;
  let smtpService: jest.Mocked<Pick<SMTPService, 'create'>>;

  const baseUser: User = {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    role: 'admin',
  } as User;

  beforeEach(() => {
    userService = {
      login: jest.fn(),
      loginWithoutPasswd: jest.fn(),
      findById: jest.fn(),
      findByConditions: jest.fn(),
      createUser: jest.fn(),
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed-jwt') };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'GITHUB_CLIENT_ID') return 'gh-client';
        if (key === 'GITHUB_CLIENT_SECRET') return 'gh-secret';
        return undefined;
      }),
    };
    settingService = { findAll: jest.fn().mockResolvedValue({ smtpFromUser: 'noreply@test.io' }) };
    smtpService = { create: jest.fn().mockResolvedValue(undefined) };

    service = new AuthService(
      userService as unknown as UserService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      settingService as unknown as SettingService,
      smtpService as unknown as SMTPService
    );

    jest.clearAllMocks();
    jest.spyOn(uniqueidUtil, 'uniqueid').mockReturnValue('mock-nuid');
    mockedAxios.mockReset();
  });

  describe('createToken', () => {
    it('signs the user payload with JwtService', () => {
      const partial = { id: '1', name: 'n', email: 'e', role: 'user' };
      expect(service.createToken(partial)).toBe('signed-jwt');
      expect(jwtService.sign).toHaveBeenCalledWith(partial);
    });
  });

  describe('login', () => {
    it('returns user data with a token', async () => {
      userService.login.mockResolvedValue({ ...baseUser });
      const credentials = { email: 'ada@example.com', password: 'secret' };

      const result = await service.login(credentials);

      expect(userService.login).toHaveBeenCalledWith(credentials);
      expect(jwtService.sign).toHaveBeenCalledWith({
        id: baseUser.id,
        name: baseUser.name,
        email: baseUser.email,
        role: baseUser.role,
      });
      expect(result).toMatchObject({ ...baseUser, token: 'signed-jwt' });
    });
  });

  describe('loginWithoutPasswd', () => {
    it('returns user data with a token', async () => {
      userService.loginWithoutPasswd.mockResolvedValue({ ...baseUser });
      const profile = { email: baseUser.email, type: 'github' };

      const result = await service.loginWithoutPasswd(profile);

      expect(userService.loginWithoutPasswd).toHaveBeenCalledWith(profile);
      expect(result.token).toBe('signed-jwt');
    });
  });

  describe('checkAdmin', () => {
    it('always resolves to true', async () => {
      await expect(service.checkAdmin()).resolves.toBe(true);
    });
  });

  describe('validateUser', () => {
    it('loads the user by id from the payload', async () => {
      userService.findById.mockResolvedValue(baseUser);
      await expect(service.validateUser({ id: baseUser.id } as User)).resolves.toBe(baseUser);
      expect(userService.findById).toHaveBeenCalledWith(baseUser.id);
    });
  });

  describe('loginWithGithub', () => {
    it('rejects when code is missing', async () => {
      let error: unknown;
      try {
        await service.loginWithGithub(undefined);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toBe(ApiMsg.GITHUB_CODE_REQUIRED);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(mockedAxios).not.toHaveBeenCalled();
    });

    it('logs in an existing GitHub user without creating an account', async () => {
      mockedAxios.mockResolvedValueOnce({ data: { access_token: 'gh-at' } } as never).mockResolvedValueOnce({
        data: { name: 'Git User', avatar_url: 'https://a', email: 'git@example.com' },
      } as never);
      userService.findByConditions.mockResolvedValue(baseUser);
      userService.loginWithoutPasswd.mockResolvedValue({ ...baseUser, token: 'tok' });

      const result = await service.loginWithGithub('oauth-code');

      expect(configService.get).toHaveBeenCalledWith('GITHUB_CLIENT_ID');
      expect(userService.createUser).not.toHaveBeenCalled();
      expect(smtpService.create).not.toHaveBeenCalled();
      expect(result.token).toBe('signed-jwt');
    });

    it('creates a new user and sends welcome email when none exists', async () => {
      mockedAxios.mockResolvedValueOnce({ data: { access_token: 'gh-at' } } as never).mockResolvedValueOnce({
        data: { name: 'New User', avatar_url: 'https://a', email: 'new@example.com' },
      } as never);
      userService.findByConditions.mockResolvedValue(null);
      userService.createUser.mockResolvedValue(baseUser);
      userService.loginWithoutPasswd.mockResolvedValue({ ...baseUser, token: 'tok' });

      await service.loginWithGithub('oauth-code');

      expect(userService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          password: 'reactpress_mock-nuid_new@example.com',
          type: 'github',
        })
      );
      expect(smtpService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'new@example.com',
          subject: ApiMsg.EMAIL_GITHUB_LOGIN,
        })
      );
      expect(uniqueidUtil.uniqueid).toHaveBeenCalled();
    });

    it('swallows SMTP failures when notifying a new GitHub user', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      mockedAxios.mockResolvedValueOnce({ data: { access_token: 'gh-at' } } as never).mockResolvedValueOnce({
        data: { name: 'New User', avatar_url: 'https://a', email: 'new@example.com' },
      } as never);
      userService.findByConditions.mockResolvedValue(null);
      userService.createUser.mockResolvedValue(baseUser);
      userService.loginWithoutPasswd.mockResolvedValue({ ...baseUser, token: 'tok' });
      smtpService.create.mockRejectedValue(new Error('smtp down'));

      await service.loginWithGithub('oauth-code');

      await Promise.resolve();
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('rejects when GitHub profile has no public email', async () => {
      mockedAxios
        .mockResolvedValueOnce({ data: { access_token: 'gh-at' } } as never)
        .mockResolvedValueOnce({ data: { name: 'No Email', avatar_url: 'https://a' } } as never);

      await expect(service.loginWithGithub('oauth-code')).rejects.toBeInstanceOf(HttpException);
    });

    it('wraps GitHub API failures as bad request', async () => {
      mockedAxios.mockRejectedValueOnce(new Error('network error'));

      let error: unknown;
      try {
        await service.loginWithGithub('oauth-code');
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect((error as HttpException).getResponse()).toBe('network error');
    });
  });
});
