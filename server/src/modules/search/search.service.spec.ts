import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ArticleService } from '../article/article.service';
import { Search } from './search.entity';
import { SearchService } from './search.service';

function chainableQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
  return qb;
}

describe('SearchService', () => {
  let service: SearchService;
  let repository: jest.Mocked<
    Pick<Repository<Search>, 'findOne' | 'create' | 'save' | 'merge' | 'remove' | 'createQueryBuilder'>
  >;
  let articleService: jest.Mocked<Pick<ArticleService, 'search'>>;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    articleService = { search: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(Search), useValue: repository },
        { provide: ArticleService, useValue: articleService },
      ],
    }).compile();

    service = module.get(SearchService);
    jest.clearAllMocks();
  });

  describe('searchArticle', () => {
    it('searches articles and records the keyword', async () => {
      const articles = [{ id: 'a1' }];
      articleService.search.mockResolvedValue(articles as never);
      repository.findOne.mockResolvedValue(null);
      const created = { type: 'article', keyword: 'nest' } as Search;
      repository.create.mockReturnValue(created);
      repository.save.mockResolvedValue({ ...created, id: 's1' } as Search);

      await expect(service.searchArticle('article', 'nest')).resolves.toBe(articles);
      expect(articleService.search).toHaveBeenCalledWith('nest');
      expect(repository.findOne).toHaveBeenCalledWith({ where: { type: 'article', keyword: 'nest' } });
    });
  });

  describe('addRecord', () => {
    it('increments count for existing record', async () => {
      const exist = { id: '1', type: 'article', keyword: 'go', count: 2 } as Search;
      const merged = { ...exist, count: 3 } as Search;
      repository.findOne.mockResolvedValue(exist);
      repository.merge.mockReturnValue(merged);
      repository.save.mockResolvedValue(merged);

      await expect(service.addRecord('article', 'go')).resolves.toBe(merged);
      expect(repository.merge).toHaveBeenCalledWith(exist, { count: 3 });
    });

    it('creates a new record when none exists', async () => {
      repository.findOne.mockResolvedValue(null);
      const created = { type: 'article', keyword: 'new' } as Search;
      repository.create.mockReturnValue(created);
      repository.save.mockResolvedValue({ ...created, id: '2' } as Search);

      await expect(service.addRecord('article', 'new')).resolves.toMatchObject({ id: '2' });
      expect(repository.create).toHaveBeenCalledWith({ type: 'article', keyword: 'new' });
    });
  });

  describe('findAll', () => {
    it('paginates with dynamic filters', async () => {
      const qb = chainableQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: '1' }], 1]),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      await service.findAll({ page: '2', pageSize: '6', keyword: 'api' });

      expect(qb.skip).toHaveBeenCalledWith(6);
      expect(qb.take).toHaveBeenCalledWith(6);
      expect(qb.andWhere).toHaveBeenCalledWith('search.keyword LIKE :keyword');
    });
  });

  describe('deleteById', () => {
    it('removes the search record', async () => {
      const row = { id: '1' } as Search;
      repository.findOne.mockResolvedValue(row);
      repository.remove.mockResolvedValue(row);

      await expect(service.deleteById('1')).resolves.toBe(row);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });
});
