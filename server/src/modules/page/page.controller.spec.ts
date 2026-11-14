import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Page } from './page.entity';
import { PageController } from './page.controller';
import { PageService } from './page.service';

describe('PageController', () => {
  let controller: PageController;
  let pageService: jest.Mocked<
    Pick<PageService, 'create' | 'findAll' | 'findById' | 'updateById' | 'updateViewsById' | 'deleteById'>
  >;

  beforeEach(async () => {
    pageService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      updateById: jest.fn(),
      updateViewsById: jest.fn(),
      deleteById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PageController],
      providers: [{ provide: PageService, useValue: pageService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PageController);
  });

  it('delegates create', () => {
    const body = { path: '/a' };
    pageService.create.mockResolvedValue(body as Page);
    controller.create(body);
    expect(pageService.create).toHaveBeenCalledWith(body);
  });

  it('delegates findAll', () => {
    pageService.findAll.mockResolvedValue([[], 0]);
    controller.findAll({ page: 1 });
    expect(pageService.findAll).toHaveBeenCalledWith({ page: 1 });
  });

  it('delegates findById', () => {
    pageService.findById.mockResolvedValue({ id: '1' } as Page);
    controller.findById('1');
    expect(pageService.findById).toHaveBeenCalledWith('1');
  });

  it('delegates updateById', () => {
    const body = { title: 't' };
    pageService.updateById.mockResolvedValue({ id: '1', title: 't' } as Page);
    controller.updateById('1', body);
    expect(pageService.updateById).toHaveBeenCalledWith('1', body);
  });

  it('delegates updateViewsById', () => {
    pageService.updateViewsById.mockResolvedValue({ id: '1', views: 2 } as Page);
    controller.updateViewsById('1');
    expect(pageService.updateViewsById).toHaveBeenCalledWith('1');
  });

  it('delegates deleteById', () => {
    pageService.deleteById.mockResolvedValue({ id: '1' } as Page);
    controller.deleteById('1');
    expect(pageService.deleteById).toHaveBeenCalledWith('1');
  });
});
