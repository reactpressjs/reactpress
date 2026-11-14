import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';

import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { Setting } from './setting.entity';
import { SettingController } from './setting.controller';
import { SettingService } from './setting.service';

describe('SettingController', () => {
  let controller: SettingController;
  let settingService: jest.Mocked<Pick<SettingService, 'update' | 'findAll'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'decode'>>;
  let userService: jest.Mocked<Pick<UserService, 'findById'>>;

  beforeEach(async () => {
    settingService = { update: jest.fn(), findAll: jest.fn() };
    jwtService = { decode: jest.fn() };
    userService = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingController],
      providers: [
        { provide: SettingService, useValue: settingService },
        { provide: JwtService, useValue: jwtService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    controller = module.get(SettingController);
  });

  it('update delegates to SettingService', () => {
    const body = { systemTitle: 'x' };
    settingService.update.mockResolvedValue(body as Setting);
    expect(controller.update(body)).resolves.toBe(body);
  });

  it('findAll returns admin row when token user is admin', async () => {
    const row = { systemTitle: 'site' } as Setting;
    settingService.findAll.mockResolvedValue(row);
    jwtService.decode.mockReturnValue({ id: 'u1' } as User);
    userService.findById.mockResolvedValue({ id: 'u1', role: 'admin' } as User);

    await expect(controller.findAll({ headers: { authorization: 'Bearer abc' } })).resolves.toBe(row);
    expect(settingService.findAll).toHaveBeenCalledWith(false, true);
  });

  it('findAll returns public view on decode failure', async () => {
    const row = { systemTitle: 'public' } as Setting;
    settingService.findAll.mockResolvedValue(row);
    jwtService.decode.mockImplementation(() => {
      throw new Error('bad token');
    });

    await expect(controller.findAll({ headers: { authorization: 'Bearer x' } })).resolves.toBe(row);
    expect(settingService.findAll).toHaveBeenCalledWith(false, false);
  });
});
