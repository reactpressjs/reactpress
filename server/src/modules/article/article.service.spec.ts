import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import { dateFormat } from '../../utils/date.util';
import { CategoryService } from '../category/category.service';
import { HookService } from '../hook/hook.service';
import { TagService } from '../tag/tag.service';
import { WebhookService } from '../webhook/webhook.service';
import { Article } from './article.entity';
import { ArticleRevision } from './article-revision.entity';
import { ArticleService } from './article.service';

jest.mock('../../utils/date.util', () => ({
  dateFormat: jest.fn(() => '2020-01-01 00:00:00'),
}));

jest.mock('segment', () => {
  const api = {
    useDefault: jest.fn(),
    doSegment: jest.fn((text: string) => (text ? [{ w: 'keyword' }] : [])),
  };
  return jest.fn().mockImplementation(() => api);
});

function chainableQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  return qb;
}

describe('ArticleService', () => {
  let service: ArticleService;
  let articleRepository: jest.Mocked<
    Pick<Repository<Article>, 'findOne' | 'find' | 'create' | 'save' | 'merge' | 'remove' | 'createQueryBuilder'>
  >;
  let revisionRepository: jest.Mocked<Pick<Repository<ArticleRevision>, 'create' | 'save' | 'find' | 'findOne'>>;
  let tagService: jest.Mocked<Pick<TagService, 'findByIds'>>;
  let categoryService: jest.Mocked<Pick<CategoryService, 'findById'>>;
  let webhookService: jest.Mocked<Pick<WebhookService, 'dispatch'>>;
  let hookService: jest.Mocked<Pick<HookService, 'applyFilters' | 'doAction'>>;

  beforeEach(async () => {
    articleRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((a) => a as Article),
      save: jest.fn(async (a) => ({ ...a, id: a.id ?? 'a1' }) as Article),
      merge: jest.fn((old, patch) => ({ ...old, ...patch }) as Article),
      remove: jest.fn(async (a) => a),
      createQueryBuilder: jest.fn(),
    };
    revisionRepository = {
      create: jest.fn((r) => r as ArticleRevision),
      save: jest.fn(async (r) => r),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    tagService = { findByIds: jest.fn().mockResolvedValue([{ id: 't1' }]) };
    categoryService = { findById: jest.fn().mockResolvedValue({ id: 'c1' }) };
    webhookService = { dispatch: jest.fn().mockResolvedValue(undefined) };
    hookService = {
      applyFilters: jest.fn(async (_name, payload) => payload),
      doAction: jest.fn(async () => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleService,
        { provide: getRepositoryToken(Article), useValue: articleRepository },
        { provide: getRepositoryToken(ArticleRevision), useValue: revisionRepository },
        { provide: TagService, useValue: tagService },
        { provide: CategoryService, useValue: categoryService },
        { provide: WebhookService, useValue: webhookService },
        { provide: HookService, useValue: hookService },
      ],
    }).compile();

    service = module.get(ArticleService);
    jest.clearAllMocks();
    hookService.applyFilters.mockImplementation(async (_n, payload) => payload);
  });

  describe('create', () => {
    it('throws when title exists', async () => {
      articleRepository.findOne.mockResolvedValue({ id: '1', title: 'Dup' } as Article);
      await expect(service.create({ title: 'Dup' })).rejects.toMatchObject({
        response: ApiMsg.ARTICLE_TITLE_EXISTS,
      });
    });

    it('throws when slug exists', async () => {
      articleRepository.findOne.mockResolvedValue(null);
      const slugQb = chainableQueryBuilder({ getOne: jest.fn().mockResolvedValue({ id: '2' }) });
      articleRepository.createQueryBuilder.mockReturnValue(slugQb as never);

      await expect(service.create({ title: 'New', slug: 'taken' })).rejects.toMatchObject({
        response: ApiMsg.ARTICLE_SLUG_EXISTS,
      });
    });

    it('creates draft article with category and tags', async () => {
      articleRepository.findOne.mockResolvedValue(null);
      articleRepository.createQueryBuilder.mockReturnValue(chainableQueryBuilder() as never);

      const saved = await service.create({
        title: 'Post',
        tags: 't1,t2',
        category: 'c1',
        status: 'draft',
      });

      expect(saved.id).toBe('a1');
      expect(tagService.findByIds).toHaveBeenCalled();
      expect(categoryService.findById).toHaveBeenCalledWith('c1');
    });

    it('publishes on create and fires hooks/webhook', async () => {
      articleRepository.findOne.mockResolvedValue(null);
      articleRepository.createQueryBuilder.mockReturnValue(chainableQueryBuilder() as never);

      await service.create({ title: 'Pub', status: 'publish', category: 'c1', tags: 't1' });

      expect(hookService.doAction).toHaveBeenCalledWith('article.afterPublish', expect.any(Object));
      expect(webhookService.dispatch).toHaveBeenCalledWith('article.published', expect.any(Object));
      expect(dateFormat).toHaveBeenCalled();
    });

    it('trims seo keywords and clears a blank description', async () => {
      articleRepository.findOne.mockResolvedValue(null);
      const saved = await service.create({
        title: 'Seo',
        status: 'draft',
        seoKeywords: '  kw  ',
        seoDescription: '   ',
      });
      expect(saved.seoKeywords).toBe('kw');
      expect(saved.seoDescription).toBeNull();
    });
  });

  describe('findAll and listings', () => {
    it('strips protected content for passworded articles', async () => {
      const row = {
        id: '1',
        needPassword: true,
        content: 'x',
        html: '<p>x</p>',
      } as Article;
      const qb = chainableQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([[row], 1]) });
      articleRepository.createQueryBuilder.mockReturnValue(qb as never);

      const [data] = await service.findAll({ page: 1, status: 'publish', title: 'Hello' });
      expect(data[0].content).toBeUndefined();
      expect(qb.andWhere).toHaveBeenCalledWith('article.status=:status');
      expect(qb.andWhere).toHaveBeenCalledWith('article.title LIKE :title');
    });

    it('redacts passworded rows from category and tag listings', async () => {
      const row = { id: '1', needPassword: true, content: 'x', html: '<p>x</p>' } as Article;
      const qb = chainableQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([[row], 1]) });
      articleRepository.createQueryBuilder.mockReturnValue(qb as never);

      const [byCategory] = await service.findArticlesByCategory('tech', { page: 1 });
      const [byTag] = await service.findArticlesByTag('news', { page: 1 });
      expect(byCategory[0].content).toBeUndefined();
      expect(byTag[0].content).toBeUndefined();
    });

    it('findArticlesByCategory and findArticlesByTag apply pagination', async () => {
      const qb = chainableQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) });
      articleRepository.createQueryBuilder.mockReturnValue(qb as never);
      await service.findArticlesByCategory('tech', { page: 1, status: 'publish' });
      await service.findArticlesByTag('news', { page: 1, status: 'publish' });
      expect(qb.skip).toHaveBeenCalled();
    });
  });

  describe('getRecommendArticles and getArchives', () => {
    it('filters passworded articles from recommendations', async () => {
      articleRepository.find.mockResolvedValue([
        { id: '1', needPassword: false },
        { id: '2', needPassword: true, content: 'c' },
      ] as Article[]);
      const rows = await service.getRecommendArticles();
      expect(rows).toHaveLength(1);
    });

    it('groups archives by year and month', async () => {
      articleRepository.find.mockResolvedValue([
        { id: '1', publishAt: new Date('2020-06-15'), needPassword: false, title: 'A' },
        { id: '2', publishAt: new Date('2020-06-20'), needPassword: true, content: 'c', title: 'B' },
      ] as Article[]);
      const archives = await service.getArchives();
      expect(archives['2020'].June).toHaveLength(2);
      expect(archives['2020'].June[1].content).toBeUndefined();
    });
  });

  describe('checkPassword and findById', () => {
    it('returns pass flag from query match', async () => {
      const qb = chainableQueryBuilder({ getOne: jest.fn().mockResolvedValue({ id: '1', title: 't' }) });
      articleRepository.createQueryBuilder.mockReturnValue(qb as never);
      await expect(service.checkPassword('1', { password: 'p' })).resolves.toMatchObject({ pass: true });

      qb.getOne.mockResolvedValue(null);
      await expect(service.checkPassword('1', { password: 'p' })).resolves.toEqual({ pass: false });
    });

    it('redacts protected article for non-admin readers', async () => {
      const data = { id: '1', needPassword: true, content: 'c', html: '<p>c</p>' } as Article;
      const qb = chainableQueryBuilder({ getOne: jest.fn().mockResolvedValue(data) });
      articleRepository.createQueryBuilder.mockReturnValue(qb as never);

      const row = await service.findById('1', 'publish', false);
      expect(row.content).toBeUndefined();
      expect(qb.andWhere).toHaveBeenCalledWith('article.status=:status');
    });
  });

  describe('updateById', () => {
    it('saves revision and rejects duplicate slug', async () => {
      const old = { id: 'a1', title: 'Old', status: 'draft', views: 1, publishAt: null } as Article;
      articleRepository.findOne.mockResolvedValue(old);
      const slugQb = chainableQueryBuilder({ getOne: jest.fn().mockResolvedValue({ id: 'other' }) });
      articleRepository.createQueryBuilder.mockReturnValue(slugQb as never);

      await expect(service.updateById('a1', { slug: 'dup', category: 'c1' })).rejects.toMatchObject({
        response: ApiMsg.ARTICLE_SLUG_EXISTS,
      });
      expect(revisionRepository.save).toHaveBeenCalled();
    });

    it('publishes draft and dispatches webhook', async () => {
      const old = { id: 'a1', status: 'draft', views: 2, publishAt: null, title: 'T', summary: 'S' } as Article;
      articleRepository.findOne.mockResolvedValue(old);
      articleRepository.createQueryBuilder.mockReturnValue(chainableQueryBuilder() as never);
      hookService.applyFilters.mockResolvedValue({ summary: 'Filtered', slug: 'filtered-slug' });

      await service.updateById('a1', {
        status: 'publish',
        category: 'c1',
        tags: 't1',
        slug: 'my-slug',
      });

      expect(hookService.doAction).toHaveBeenCalledWith('article.afterPublish', expect.any(Object));
      expect(webhookService.dispatch).toHaveBeenCalled();
    });
  });

  describe('revisions', () => {
    it('lists revisions', async () => {
      await service.listRevisions('a1');
      expect(revisionRepository.find).toHaveBeenCalledWith({
        where: { articleId: 'a1' },
        order: { createAt: 'DESC' },
        take: 50,
      });
    });

    it('throws when revision missing or mismatched', async () => {
      revisionRepository.findOne.mockResolvedValue(null);
      await expect(service.restoreRevision('a1', 'r1')).rejects.toMatchObject({
        response: ApiMsg.REVISION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('restores revision content', async () => {
      revisionRepository.findOne.mockResolvedValue({
        id: 'r1',
        articleId: 'a1',
        title: 'R',
        content: 'c',
        html: '<p>c</p>',
        status: 'draft',
      } as ArticleRevision);
      articleRepository.findOne.mockResolvedValue({ id: 'a1', title: 'Old' } as Article);

      const restored = await service.restoreRevision('a1', 'r1');
      expect(restored.title).toBe('R');
    });
  });

  describe('metrics and delete', () => {
    it('updates views and likes', async () => {
      const old = { id: 'a1', views: 1, likes: 2 } as Article;
      articleRepository.findOne.mockResolvedValue(old);
      articleRepository.merge.mockImplementation((_o, patch) => ({ ...old, ...patch }) as Article);

      await service.updateViewsById('a1');
      await service.updateLikesById('a1', 'like');
      await service.updateLikesById('a1', 'unlike');
      expect(articleRepository.save).toHaveBeenCalled();
    });

    it('deletes and searches articles', async () => {
      const article = { id: 'a1' } as Article;
      articleRepository.findOne.mockResolvedValue(article);
      await expect(service.deleteById('a1')).resolves.toBe(article);

      const qb = chainableQueryBuilder({ getMany: jest.fn().mockResolvedValue([article]) });
      articleRepository.createQueryBuilder.mockReturnValue(qb as never);
      await expect(service.search('key')).resolves.toEqual([article]);
    });
  });

  describe('recommend', () => {
    it('returns latest publish list when articleId is missing', async () => {
      const qb = chainableQueryBuilder({ getMany: jest.fn().mockResolvedValue([{ id: '1', status: 'publish' }]) });
      articleRepository.createQueryBuilder.mockReturnValue(qb as never);
      const rows = await service.recommend(null, 3);
      expect(rows).toHaveLength(1);
    });

    it('filters related articles by id and publish status', async () => {
      const existQb = chainableQueryBuilder({
        getOne: jest.fn().mockResolvedValue({ id: 'a1', title: 'T', summary: 'S', status: 'publish' }),
      });
      const relatedQb = chainableQueryBuilder({
        getMany: jest.fn().mockResolvedValue([
          { id: 'a1', status: 'publish' },
          { id: 'a2', status: 'publish' },
          { id: 'a3', status: 'draft' },
        ]),
      });
      articleRepository.createQueryBuilder
        .mockReturnValueOnce(relatedQb as never)
        .mockReturnValueOnce(existQb as never);

      const rows = await service.recommend('a1', 5);
      expect(rows.map((r) => r.id)).toEqual(['a2']);
    });

    it('returns the latest list when the source article is missing', async () => {
      const relatedQb = chainableQueryBuilder({
        getMany: jest.fn().mockResolvedValue([{ id: 'latest', status: 'publish' }]),
      });
      const existQb = chainableQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) });
      articleRepository.createQueryBuilder
        .mockReturnValueOnce(relatedQb as never)
        .mockReturnValueOnce(existQb as never);

      const rows = await service.recommend('missing', 4);
      expect(rows).toEqual([{ id: 'latest', status: 'publish' }]);
    });

    it('adds an or-where clause for each extra title keyword', async () => {
      const Segment = require('segment');
      const segment = new Segment() as { doSegment: jest.Mock };
      segment.doSegment.mockImplementation((text: string) => {
        if (text === 'Alpha Beta') return [{ w: 'Alpha' }, { w: 'Beta' }];
        return text ? [{ w: 'Sum' }] : [];
      });
      const relatedQb = chainableQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) });
      const existQb = chainableQueryBuilder({
        getOne: jest.fn().mockResolvedValue({ id: 'a1', title: 'Alpha Beta', summary: 'notes', status: 'publish' }),
      });
      articleRepository.createQueryBuilder
        .mockReturnValueOnce(relatedQb as never)
        .mockReturnValueOnce(existQb as never);

      try {
        await service.recommend('a1', 5);
        expect(relatedQb.orWhere).toHaveBeenCalledWith('article.title LIKE :title_1');
      } finally {
        segment.doSegment.mockImplementation((text: string) => (text ? [{ w: 'keyword' }] : []));
      }
    });

    it('queries summary keywords when the title yields none', async () => {
      const Segment = require('segment');
      const segment = new Segment() as { doSegment: jest.Mock };
      segment.doSegment.mockImplementation((text: string) => (text ? [{ w: 'Sum' }] : []));
      const relatedQb = chainableQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) });
      const existQb = chainableQueryBuilder({
        getOne: jest.fn().mockResolvedValue({ id: 'a1', title: '', summary: 'notes', status: 'publish' }),
      });
      articleRepository.createQueryBuilder
        .mockReturnValueOnce(relatedQb as never)
        .mockReturnValueOnce(existQb as never);

      try {
        await service.recommend('a1', 5);
        expect(relatedQb.where).toHaveBeenCalledWith('article.summary LIKE :summary_0');
      } finally {
        segment.doSegment.mockImplementation((text: string) => (text ? [{ w: 'keyword' }] : []));
      }
    });
  });
});
