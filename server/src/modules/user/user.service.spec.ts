import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import { User } from './user.entity';
import { UserService } from './user.service';

function chainableQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
  return qb;
}

describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<Pick<Repository<User>, 'findOne' | 'create' | 'save' | 'merge' | 'createQueryBuilder'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((u) => u as User),
      save: jest.fn(async (u) => ({ ...u, id: 'u1' }) as User),
      merge: jest.fn((old, patch) => ({ ...old, ...patch }) as User),
      createQueryBuilder: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'ADMIN_USER') return 'admin';
        if (key === 'ADMIN_PASSWD') return 'admin';
        return undefined;
      }),
    };

    service = new UserService(repository as unknown as Repository<User>, configService as ConfigService);
    await Promise.resolve();
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('paginates and filters users', async () => {
      const qb = chainableQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: '1' }], 1]),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      const [rows, total] = await service.findAll({ page: 2, pageSize: 5, status: 'active', name: 'a' });
      expect(total).toBe(1);
      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.andWhere).toHaveBeenCalledWith('user.status=:status');
    });
  });

  describe('createUser', () => {
    it('requires name and password for public registration', async () => {
      await expect(service.createUser({ email: 'e@e.com' })).rejects.toMatchObject({
        response: ApiMsg.USERNAME_PASSWORD_REQUIRED,
      });
    });

    it('rejects invalid username', async () => {
      await expect(service.createUser({ name: 'bad name!', password: 'p' })).rejects.toMatchObject({
        response: ApiMsg.USERNAME_INVALID,
      });
    });

    it('rejects duplicate name', async () => {
      repository.findOne.mockResolvedValue({ id: '1', name: 'ada' } as User);
      await expect(service.createUser({ name: 'ada', password: 'secret1' })).rejects.toMatchObject({
        response: ApiMsg.USER_EXISTS,
      });
    });

    it('creates a new user', async () => {
      repository.findOne.mockResolvedValue(null);
      const saved = await service.createUser({ name: 'ada', password: 'secret12', email: 'a@b.com' });
      expect(saved.id).toBe('u1');
    });
  });

  describe('login', () => {
    it('rejects invalid credentials', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.login({ name: 'n', password: 'p' })).rejects.toMatchObject({
        response: ApiMsg.INVALID_CREDENTIALS,
      });
    });

    it('rejects locked users and non-admin console access', async () => {
      const hash = User.encryptPassword('secret12');
      repository.findOne
        .mockResolvedValueOnce({ id: '1', name: 'a', password: hash, status: 'locked', role: 'admin' } as User)
        .mockResolvedValueOnce({ id: '2', name: 'v', password: hash, status: 'active', role: 'visitor' } as User);

      await expect(service.login({ name: 'a', password: 'secret12' })).rejects.toMatchObject({
        response: ApiMsg.USER_LOCKED,
      });
      await expect(service.login({ name: 'v', password: 'secret12' })).rejects.toMatchObject({
        response: ApiMsg.ADMIN_CONSOLE_ACCESS_REQUIRED,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('returns admin without password field', async () => {
      const hash = User.encryptPassword('secret12');
      const user = { id: '1', name: 'a', password: hash, status: 'active', role: 'admin' } as User;
      repository.findOne.mockResolvedValue(user);
      const loggedIn = await service.login({ name: 'a', password: 'secret12' });
      expect(loggedIn.password).toBeUndefined();
    });
  });

  describe('loginWithoutPasswd', () => {
    it('rejects locked accounts', async () => {
      repository.findOne.mockResolvedValue({ status: 'locked' } as User);
      await expect(service.loginWithoutPasswd({ name: 'a' })).rejects.toMatchObject({
        response: ApiMsg.USER_LOCKED,
      });
    });

    it('returns an active user without the password', async () => {
      const user = { name: 'a', password: 'hash', status: 'active' } as User;
      repository.findOne.mockResolvedValue(user);
      const loggedIn = await service.loginWithoutPasswd({ name: 'a' });
      expect(loggedIn.name).toBe('a');
      expect(loggedIn.password).toBeUndefined();
    });
  });

  describe('default admin bootstrap', () => {
    it('logs when the factory admin password is still in use', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const hash = User.encryptPassword('admin');
      repository.findOne.mockResolvedValue({ id: '1', name: 'admin', password: hash } as User);
      new UserService(repository as unknown as Repository<User>, configService as ConfigService);
      await new Promise((resolve) => setImmediate(resolve));
      expect(log).toHaveBeenCalledWith(expect.stringContaining('already exists'));
      log.mockRestore();
    });
  });

  describe('updateById', () => {
    it('forbids promoting to admin without privilege', async () => {
      await expect(service.updateById({ role: 'visitor' }, 'u1', { role: 'admin' })).rejects.toMatchObject({
        response: ApiMsg.FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('rejects duplicate rename', async () => {
      repository.findOne
        .mockResolvedValueOnce({ id: 'u1', name: 'old' } as User)
        .mockResolvedValueOnce({ id: 'u2', name: 'taken' } as User);
      await expect(service.updateById({ role: 'admin' }, 'u1', { name: 'taken' })).rejects.toMatchObject({
        response: ApiMsg.USER_EXISTS,
      });
    });

    it('merges and saves updates', async () => {
      const oldUser = { id: 'u1', name: 'old' } as User;
      repository.findOne.mockResolvedValueOnce(oldUser).mockResolvedValueOnce(null);
      const updated = await service.updateById({ role: 'admin' }, 'u1', { name: 'new', password: 'x' });
      expect(updated.name).toBe('new');
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('updatePassword', () => {
    it('rejects wrong old password', async () => {
      repository.findOne.mockResolvedValue({ id: 'u1', password: User.encryptPassword('oldpw12') } as User);
      await expect(
        service.updatePassword('u1', { oldPassword: 'bad', newPassword: 'newpw1234' })
      ).rejects.toMatchObject({ response: ApiMsg.INVALID_CREDENTIALS });
    });

    it('updates password hash', async () => {
      repository.findOne.mockResolvedValue({ id: 'u1', password: User.encryptPassword('oldpw123') } as User);
      await service.updatePassword('u1', { oldPassword: 'oldpw123', newPassword: 'newpw1234' });
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('findByConditions / findById', () => {
    it('reads users by conditions and id', async () => {
      const user = { id: '1' } as User;
      repository.findOne.mockResolvedValue(user);
      await expect(service.findByConditions({ name: 'a' })).resolves.toBe(user);
      await expect(service.findById('1')).resolves.toBe(user);
    });
  });
});
