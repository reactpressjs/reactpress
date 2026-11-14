import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import { Category } from './category.entity';
import { CategoryService } from './category.service';

function chainableQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    orderBy: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  return qb;
}

describe('CategoryService', () => {
  let service: CategoryService;
  let repository: jest.Mocked<
    Pick<Repository<Category>, 'findOne' | 'create' | 'save' | 'merge' | 'remove' | 'createQueryBuilder'>
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
      providers: [
        CategoryService,
        {
          provide: getRepositoryToken(Category),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(CategoryService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws when the label already exists', async () => {
      repository.findOne.mockResolvedValue({ id: '1', label: 'tech' } as Category);
      await expect(service.create({ label: 'tech' })).rejects.toMatchObject({
        response: ApiMsg.CATEGORY_EXISTS,
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('creates and saves a new category', async () => {
      repository.findOne.mockResolvedValue(null);
      const entity = { label: 'tech' } as Category;
      const saved = { ...entity, id: 'c1' } as Category;
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(saved);

      await expect(service.create({ label: 'tech' })).resolves.toBe(entity);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { label: 'tech' } });
    });
  });

  describe('findAll', () => {
    it('counts articles per category without status filter', async () => {
      const qb = chainableQueryBuilder({
        getMany: jest.fn().mockResolvedValue([{ id: '1', articles: [{}] }] as Category[]),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.findAll({});
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('category.articles', 'articles');
      expect(result[0]).toMatchObject({ articleCount: 1 });
    });

    it('filters articles by articleStatus', async () => {
      const qb = chainableQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      await service.findAll({ articleStatus: 'publish' });
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('category.articles', 'articles', 'articles.status=:status', {
        status: 'publish',
      });
    });
  });

  describe('findById', () => {
    it('returns a category from query builder', async () => {
      const row = { id: '1' } as Category;
      const qb = chainableQueryBuilder({ getOne: jest.fn().mockResolvedValue(row) });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      await expect(service.findById('slug')).resolves.toBe(row);
    });
  });

  describe('updateById', () => {
    it('merges and saves', async () => {
      const old = { id: '1' } as Category;
      const merged = { id: '1', label: 'n' } as Category;
      repository.findOne.mockResolvedValue(old);
      repository.merge.mockReturnValue(merged);
      repository.save.mockResolvedValue(merged);

      await expect(service.updateById('1', { label: 'n' })).resolves.toBe(merged);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('deleteById', () => {
    it('removes and returns true', async () => {
      const row = { id: '1' } as Category;
      repository.findOne.mockResolvedValue(row);
      repository.remove.mockResolvedValue(row);

      await expect(service.deleteById('1')).resolves.toBe(true);
    });

    it('throws DELETE_HAS_ARTICLES on remove failure', async () => {
      repository.findOne.mockResolvedValue({ id: '1' } as Category);
      repository.remove.mockRejectedValue(new Error('fk'));

      await expect(service.deleteById('1')).rejects.toMatchObject({
        response: ApiMsg.DELETE_HAS_ARTICLES,
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });
});
