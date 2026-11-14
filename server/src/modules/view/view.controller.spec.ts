import { Test, TestingModule } from '@nestjs/testing';

import * as ipUtil from '../../utils/ip.util';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { View } from './view.entity';
import { ViewController } from './view.controller';
import { ViewService } from './view.service';

describe('ViewController', () => {
  let controller: ViewController;
  let viewService: jest.Mocked<Pick<ViewService, 'create' | 'findAll' | 'findByUrl' | 'findById' | 'deleteById'>>;
  let getClientIPSpy: jest.SpyInstance;

  beforeEach(async () => {
    viewService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByUrl: jest.fn(),
      findById: jest.fn(),
      deleteById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ViewController],
      providers: [{ provide: ViewService, useValue: viewService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ViewController);
    getClientIPSpy = jest.spyOn(ipUtil, 'getClientIP').mockReturnValue('10.0.0.1');
  });

  afterEach(() => {
    getClientIPSpy.mockRestore();
  });

  it('create passes client IP, user-agent, and url', () => {
    const req = { headers: { 'user-agent': 'TestAgent' } };
    const body = { url: '/post/1' };
    viewService.create.mockResolvedValue({ id: '1' } as View);

    controller.create(req as never, body);

    expect(getClientIPSpy).toHaveBeenCalledWith(req);
    expect(viewService.create).toHaveBeenCalledWith('10.0.0.1', 'TestAgent', '/post/1');
  });

  it('delegates findAll', () => {
    viewService.findAll.mockResolvedValue([[], 0]);
    controller.findAll({ page: 1 });
    expect(viewService.findAll).toHaveBeenCalledWith({ page: 1 });
  });

  it('delegates findByUrl', () => {
    viewService.findByUrl.mockResolvedValue([]);
    controller.findByUrl('/x');
    expect(viewService.findByUrl).toHaveBeenCalledWith('/x');
  });

  it('delegates findById', () => {
    viewService.findById.mockResolvedValue({ id: '1' } as View);
    controller.findById('1');
    expect(viewService.findById).toHaveBeenCalledWith('1');
  });

  it('delegates deleteById', () => {
    viewService.deleteById.mockResolvedValue({ id: '1' } as View);
    controller.deleteById('1');
    expect(viewService.deleteById).toHaveBeenCalledWith('1');
  });
});
