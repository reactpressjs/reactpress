import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import { dateFormat } from '../../utils/date.util';
import { Knowledge } from './knowledge.entity';
import { KnowledgeService } from './knowledge.service';

jest.mock('../../utils/date.util', () => ({
  dateFormat: jest.fn(() => '2020-01-01 00:00:00'),
}));

function chainableQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  return qb;
}

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let repository: jest.Mocked<
    Pick<Repository<Knowledge>, 'findOne' | 'create' | 'save' | 'merge' | 'remove' | 'createQueryBuilder'>
  >;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [KnowledgeService, { provide: getRepositoryToken(Knowledge), useValue: repository }],
    }).compile();

    service = module.get(KnowledgeService);
    jest.clearAllMocks();
  });

  describe('createKnowledgeBook', () => {
    it('throws when duplicate book title exists', async () => {
      repository.findOne.mockResolvedValue({ id: '1', title: 'Book' } as Knowledge);
      await expect(service.createKnowledgeBook({ title: 'Book' })).rejects.toMatchObject({
        response: ApiMsg.KNOWLEDGE_EXISTS,
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('creates book and sets publishAt when publishing', async () => {
      repository.findOne.mockResolvedValue(null);
      const entity = { title: 'Book', status: 'publish' } as Knowledge;
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue({ ...entity, id: 'k1' });

      const saved = await service.createKnowledgeBook({ title: 'Book', status: 'publish' });
      expect(saved.id).toBe('k1');
      expect(dateFormat).toHaveBeenCalled();
    });
  });

  describe('createKnowledgeChapter', () => {
    it('requires parentId on every chapter', async () => {
      await expect(service.createKnowledgeChapter({ title: 'c' })).rejects.toMatchObject({
        response: ApiMsg.INVALID_KNOWLEDGE_SECTION,
      });
    });

    it('creates one or many chapters', async () => {
      repository.findOne.mockResolvedValue(null);
      const entity = { title: 'c', parentId: 'p' } as Knowledge;
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue({ ...entity, id: 'c1' });

      const rows = await service.createKnowledgeChapter([
        { title: 'c1', parentId: 'p' },
        { title: 'c2', parentId: 'p' },
      ]);
      expect(rows).toHaveLength(2);
    });
  });

  describe('deleteById', () => {
    it('removes children when deleting a book', async () => {
      const book = { id: 'b1', parentId: null } as Knowledge;
      const child = { id: 'c1', parentId: 'b1' } as Knowledge;
      repository.findOne.mockResolvedValue(book);
      const qb = chainableQueryBuilder({ getMany: jest.fn().mockResolvedValue([child]) });
      repository.createQueryBuilder.mockReturnValue(qb as never);
      repository.remove.mockResolvedValue(book);

      await service.deleteById('b1');
      expect(repository.remove).toHaveBeenCalledWith(child);
      expect(repository.remove).toHaveBeenCalledWith(book);
    });
  });

  describe('updateById', () => {
    it('sets publishAt when transitioning draft to publish', async () => {
      const old = { id: '1', status: 'draft', views: 2, publishAt: null } as Knowledge;
      repository.findOne.mockResolvedValue(old);
      const merged = { ...old, status: 'publish' } as Knowledge;
      repository.merge.mockReturnValue(merged);
      repository.save.mockResolvedValue(merged);

      await service.updateById('1', { status: 'publish' });
      expect(repository.merge).toHaveBeenCalledWith(
        old,
        expect.objectContaining({ publishAt: '2020-01-01 00:00:00', views: 2 })
      );
    });
  });

  describe('metrics', () => {
    it('increments views and likes', async () => {
      const old = { id: '1', views: 1, likes: 2 } as Knowledge;
      repository.findOne.mockResolvedValue(old);
      repository.merge.mockImplementation((_o, patch) => ({ ...old, ...patch }) as Knowledge);
      repository.save.mockImplementation(async (r) => r);

      await service.updateViewsById('1');
      await service.updateLikesById('1', 'like');
      await service.updateLikesById('1', 'unlike');

      expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ likes: 1 }));
    });
  });

  describe('findAll', () => {
    it('lists root knowledge rows with pagination', async () => {
      const qb = chainableQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: '1' }], 1]),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      const [rows, total] = await service.findAll({ page: 2, pageSize: 5, status: 'publish', title: 'Guide' });
      expect(total).toBe(1);
      expect(rows).toHaveLength(1);
      expect(qb.setParameter).toHaveBeenCalledWith('parentId', null);
      expect(qb.andWhere).toHaveBeenCalledWith('knowledge.title LIKE :title');
    });
  });

  describe('findById', () => {
    it('returns null when missing', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.findById('x')).resolves.toBeNull();
    });

    it('attaches sorted children for books', async () => {
      const book = { id: 'b1', parentId: null } as Knowledge;
      const children = [
        { id: 'c2', parentId: 'b1', order: 2 },
        { id: 'c1', parentId: 'b1', order: 1 },
      ] as Knowledge[];
      repository.findOne.mockResolvedValue(book);
      const qb = chainableQueryBuilder({ getMany: jest.fn().mockResolvedValue(children) });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.findById('b1');
      expect(result.children?.map((c) => c.id)).toEqual(['c1', 'c2']);
    });
  });
});
