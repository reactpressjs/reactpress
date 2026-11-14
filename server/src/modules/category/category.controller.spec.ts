import { Test, TestingModule } from '@nestjs/testing';

import { AdminAccessGuard } from '../api-key/admin-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Category } from './category.entity';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

describe('CategoryController', () => {
  let controller: CategoryController;
  let categoryService: jest.Mocked<
    Pick<CategoryService, 'create' | 'findAll' | 'findById' | 'updateById' | 'deleteById'>
  >;

  beforeEach(async () => {
    categoryService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      updateById: jest.fn(),
      deleteById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [{ provide: CategoryService, useValue: categoryService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CategoryController);
  });

  it('delegates create', () => {
    const body = { label: 'a' };
    categoryService.create.mockResolvedValue(body as Category);
    controller.create(body);
    expect(categoryService.create).toHaveBeenCalledWith(body);
  });

  it('delegates findAll', () => {
    categoryService.findAll.mockResolvedValue([]);
    controller.findAll({});
    expect(categoryService.findAll).toHaveBeenCalledWith({});
  });

  it('delegates findById', () => {
    categoryService.findById.mockResolvedValue({ id: '1' } as Category);
    controller.findById('1');
    expect(categoryService.findById).toHaveBeenCalledWith('1');
  });

  it('delegates updateById', () => {
    const patch = { label: 'b' };
    categoryService.updateById.mockResolvedValue(patch as Category);
    controller.updateById('1', patch);
    expect(categoryService.updateById).toHaveBeenCalledWith('1', patch);
  });

  it('delegates deleteById', () => {
    categoryService.deleteById.mockResolvedValue(true);
    controller.deleteById('1');
    expect(categoryService.deleteById).toHaveBeenCalledWith('1');
  });
});
