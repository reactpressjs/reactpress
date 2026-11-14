import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';

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

describe('TagService', () => {
  let service: TagService;
  let repository: jest.Mocked<
    Pick<Repository<Tag>, 'findOne' | 'create' | 'save' | 'merge' | 'remove' | 'findByIds' | 'createQueryBuilder'>
  >;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      remove: jest.fn(),
      findByIds: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        {
          provide: getRepositoryToken(Tag),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(TagService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws when the label already exists', async () => {
      repository.findOne.mockResolvedValue({ id: '1', label: 'news' } as Tag);
      await expect(service.create({ label: 'news' })).rejects.toMatchObject({
        response: ApiMsg.TAG_EXISTS,
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('creates and saves a new tag', async () => {
      repository.findOne.mockResolvedValue(null);
      const entity = { label: 'news' } as Tag;
      const saved = { ...entity, id: 't1' } as Tag;
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(saved);

      await expect(service.create({ label: 'news' })).resolves.toBe(entity);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { label: 'news' } });
      expect(repository.create).toHaveBeenCalledWith({ label: 'news' });
      expect(repository.save).toHaveBeenCalledWith(entity);
    });
  });

  describe('findAll', () => {
    it('joins all articles when articleStatus is omitted', async () => {
      const qb = chainableQueryBuilder({
        getMany: jest.fn().mockResolvedValue([
          { id: '1', articles: [{}, {}] },
          { id: '2', articles: [] },
        ] as Tag[]),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.findAll({});

      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('tag.articles', 'articles');
      expect(result[0]).toMatchObject({ articleCount: 2 });
      expect(result[0]).not.toHaveProperty('articles');
      expect(result[1]).toMatchObject({ articleCount: 0 });
    });

    it('filters joined articles when articleStatus is set', async () => {
      const qb = chainableQueryBuilder({
        getMany: jest.fn().mockResolvedValue([{ id: '1', articles: [{}] }] as Tag[]),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      await service.findAll({ articleStatus: 'publish' });

      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('tag.articles', 'articles', 'articles.status=:status', {
        status: 'publish',
      });
    });
  });

  describe('findById', () => {
    it('returns a tag from query builder', async () => {
      const tag = { id: '1', label: 'a' } as Tag;
      const qb = chainableQueryBuilder({
        getOne: jest.fn().mockResolvedValue(tag),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      await expect(service.findById('1')).resolves.toBe(tag);
      expect(qb.setParameter).toHaveBeenCalledWith('id', '1');
    });
  });

  describe('getArticleById', () => {
    it('returns tag with all articles when status is falsy', async () => {
      const tag = {
        id: '1',
        articles: [{ status: 'draft' }, { status: 'publish' }],
      } as unknown as Tag;
      const qb = chainableQueryBuilder({
        getOne: jest.fn().mockResolvedValue(tag),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.getArticleById('1', null);
      expect(result.articles).toHaveLength(2);
    });

    it('filters articles by status when status is provided', async () => {
      const tag = {
        id: '1',
        articles: [{ status: 'draft' }, { status: 'publish' }],
      } as unknown as Tag;
      const qb = chainableQueryBuilder({
        getOne: jest.fn().mockResolvedValue(tag),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.getArticleById('1', 'publish');
      expect(result.articles).toEqual([{ status: 'publish' }]);
    });
  });

  describe('findByIds', () => {
    it('delegates to findByIds on the repository', async () => {
      const rows = [{ id: '1' }] as Tag[];
      repository.findByIds.mockResolvedValue(rows);
      await expect(service.findByIds(['1'])).resolves.toBe(rows);
      expect(repository.findByIds).toHaveBeenCalledWith(['1']);
    });
  });

  describe('updateById', () => {
    it('merges and saves the tag', async () => {
      const oldTag = { id: '1', label: 'old' } as Tag;
      const merged = { ...oldTag, label: 'new' } as Tag;
      repository.findOne.mockResolvedValue(oldTag);
      repository.merge.mockReturnValue(merged);
      repository.save.mockResolvedValue(merged);

      await expect(service.updateById('1', { label: 'new' })).resolves.toBe(merged);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('deleteById', () => {
    it('removes the tag and returns true', async () => {
      const tag = { id: '1' } as Tag;
      repository.findOne.mockResolvedValue(tag);
      repository.remove.mockResolvedValue(tag);

      await expect(service.deleteById('1')).resolves.toBe(true);
      expect(repository.remove).toHaveBeenCalledWith(tag);
    });

    it('throws DELETE_HAS_ARTICLES when remove fails', async () => {
      const tag = { id: '1' } as Tag;
      repository.findOne.mockResolvedValue(tag);
      repository.remove.mockRejectedValue(new Error('fk'));

      await expect(service.deleteById('1')).rejects.toMatchObject({
        response: ApiMsg.DELETE_HAS_ARTICLES,
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });
});
