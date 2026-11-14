import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Knowledge } from './knowledge.entity';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

describe('KnowledgeController', () => {
  let controller: KnowledgeController;
  let service: jest.Mocked<
    Pick<
      KnowledgeService,
      | 'createKnowledgeBook'
      | 'createKnowledgeChapter'
      | 'deleteById'
      | 'updateById'
      | 'findAll'
      | 'findById'
      | 'updateViewsById'
      | 'updateLikesById'
    >
  >;

  beforeEach(async () => {
    service = {
      createKnowledgeBook: jest.fn(),
      createKnowledgeChapter: jest.fn(),
      deleteById: jest.fn(),
      updateById: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      updateViewsById: jest.fn(),
      updateLikesById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeController],
      providers: [{ provide: KnowledgeService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(KnowledgeController);
  });

  it('delegates CRUD and metrics to KnowledgeService', async () => {
    const row = { id: '1' } as Knowledge;
    service.createKnowledgeBook.mockResolvedValue(row);
    service.createKnowledgeChapter.mockResolvedValue([row]);
    service.deleteById.mockResolvedValue(row);
    service.updateById.mockResolvedValue(row);
    service.findAll.mockResolvedValue([[row], 1]);
    service.findById.mockResolvedValue(row);
    service.updateViewsById.mockResolvedValue(row);
    service.updateLikesById.mockResolvedValue(row);

    await expect(controller.createBook({ title: 'b' })).resolves.toBe(row);
    await expect(controller.createChapter({ parentId: 'p' })).resolves.toEqual([row]);
    await expect(controller.deleteById('1')).resolves.toBe(row);
    await expect(controller.updateById('1', { title: 'n' })).resolves.toBe(row);
    await expect(controller.findAll({ page: 1 })).resolves.toEqual([[row], 1]);
    await expect(controller.findById('1')).resolves.toBe(row);
    await expect(controller.updateViewsById('1')).resolves.toBe(row);
    await expect(controller.updateLikesById('1', 'like')).resolves.toBe(row);
  });
});
