import { HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { ApiMsg } from '../../common/api-messages';
import { User } from './user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<
    Pick<UserService, 'findAll' | 'createUser' | 'findById' | 'updateById' | 'updatePassword'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'decode'>>;

  beforeEach(async () => {
    userService = {
      findAll: jest.fn(),
      createUser: jest.fn(),
      findById: jest.fn(),
      updateById: jest.fn(),
      updatePassword: jest.fn(),
    };
    jwtService = { decode: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    controller = module.get(UserController);
  });

  it('findAll delegates to UserService', () => {
    userService.findAll.mockResolvedValue([[], 0]);
    controller.findAll({ page: 1 });
    expect(userService.findAll).toHaveBeenCalledWith({ page: 1 });
  });

  describe('register', () => {
    it('validates email', async () => {
      await expect(controller.register({ email: '' })).rejects.toMatchObject({
        response: ApiMsg.EMAIL_REQUIRED,
        status: HttpStatus.BAD_REQUEST,
      });
      await expect(controller.register({ email: 'not-an-email' })).rejects.toMatchObject({
        response: ApiMsg.EMAIL_INVALID,
      });
    });

    it('creates user when email is valid', async () => {
      const created = { id: 'u1', email: 'a@b.com' } as User;
      userService.createUser.mockResolvedValue(created);
      await expect(controller.register({ email: 'a@b.com', name: 'a', password: 'p' })).resolves.toBe(created);
    });
  });

  describe('checkPermission', () => {
    it('rejects missing authorization', async () => {
      await expect(controller.checkPermission({ headers: {} }, { id: 'u1' })).rejects.toMatchObject({
        response: ApiMsg.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('allows self or admin updates', async () => {
      const req = { headers: { authorization: 'Bearer token123' } };
      jwtService.decode.mockReturnValue({ id: 'u1' } as User);
      userService.findById.mockResolvedValue({ id: 'u1', role: 'visitor' } as User);

      await controller.checkPermission(req, { id: 'u1' });
      expect(req).toHaveProperty('user');
    });

    it('rejects a token that does not carry a user id', async () => {
      jwtService.decode.mockReturnValue({} as User);
      await expect(
        controller.checkPermission({ headers: { authorization: 'raw-token' } }, { id: 'u1' })
      ).rejects.toMatchObject({
        response: ApiMsg.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('forbids non-admin updating others', async () => {
      jwtService.decode.mockReturnValue({ id: 'u1' } as User);
      userService.findById.mockResolvedValue({ id: 'u1', role: 'visitor' } as User);

      await expect(
        controller.checkPermission({ headers: { authorization: 'token' } }, { id: 'u2' })
      ).rejects.toMatchObject({ response: ApiMsg.FORBIDDEN_ACTION, status: HttpStatus.FORBIDDEN });
    });
  });

  it('update and updatePassword call service after permission check', async () => {
    const req = { headers: { authorization: 'Bearer t' }, user: { id: 'a1', role: 'admin' } };
    jest.spyOn(controller, 'checkPermission').mockResolvedValue(undefined);
    const user = { id: 'u1', name: 'n' } as User;
    userService.updateById.mockResolvedValue(user);
    userService.updatePassword.mockResolvedValue(user);

    await expect(controller.update(req, user)).resolves.toBe(user);
    await expect(controller.updatePassword(req, user)).resolves.toBe(user);
  });
});
