import { Test, TestingModule } from '@nestjs/testing';

import { AdminAccessGuard } from '../api-key/admin-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Tag } from './tag.entity';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';

describe('TagController', () => {
  let controller: TagController;
  let tagService: jest.Mocked<
    Pick<TagService, 'create' | 'findAll' | 'findById' | 'getArticleById' | 'updateById' | 'deleteById'>
  >;

  beforeEach(async () => {
    tagService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      getArticleById: jest.fn(),
      updateById: jest.fn(),
      deleteById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TagController],
      providers: [{ provide: TagService, useValue: tagService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TagController);
  });

  it('delegates create to TagService', async () => {
    const body = { label: 'x' };
    tagService.create.mockResolvedValue(body as Tag);
    await expect(controller.create(body)).resolves.toEqual(body);
    expect(tagService.create).toHaveBeenCalledWith(body);
  });

  it('delegates findAll to TagService', () => {
    const query = { articleStatus: 'publish' };
    tagService.findAll.mockResolvedValue([]);
    controller.findAll(query);
    expect(tagService.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates findById to TagService', () => {
    tagService.findById.mockResolvedValue({ id: '1' } as Tag);
    controller.findById('1');
    expect(tagService.findById).toHaveBeenCalledWith('1');
  });

  it('delegates getArticleById to TagService', () => {
    tagService.getArticleById.mockResolvedValue({ id: '1' } as Tag);
    controller.getArticleById('1', 'publish');
    expect(tagService.getArticleById).toHaveBeenCalledWith('1', 'publish');
  });

  it('delegates updateById to TagService', () => {
    const body = { label: 'y' };
    tagService.updateById.mockResolvedValue(body as Tag);
    controller.updateById('1', body);
    expect(tagService.updateById).toHaveBeenCalledWith('1', body);
  });

  it('delegates deleteById to TagService', () => {
    tagService.deleteById.mockResolvedValue(true);
    controller.deleteById('1');
    expect(tagService.deleteById).toHaveBeenCalledWith('1');
  });
});
