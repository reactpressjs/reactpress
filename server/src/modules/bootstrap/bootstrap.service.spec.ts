import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { marked } from '../../utils/markdown.util';
import { ArticleService } from '../article/article.service';
import { Article } from '../article/article.entity';
import { Category } from '../category/category.entity';
import { Tag } from '../tag/tag.entity';
import { HELLO_WORLD_SEED_MARKER } from './bootstrap.constants';
import { BootstrapService } from './bootstrap.service';

jest.mock('../../utils/markdown.util', () => ({
  marked: jest.fn(() => ({ html: '<p>hi</p>', toc: '[]' })),
}));

describe('BootstrapService', () => {
  let service: BootstrapService;
  let articleRepository: jest.Mocked<Pick<Repository<Article>, 'findOne' | 'count' | 'save' | 'create'>>;
  let categoryRepository: jest.Mocked<Pick<Repository<Category>, 'findOne' | 'create' | 'save'>>;
  let tagRepository: jest.Mocked<Pick<Repository<Tag>, 'findOne' | 'create' | 'save'>>;
  let articleService: jest.Mocked<Pick<ArticleService, 'create'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(() => {
    articleRepository = {
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn(async (a) => a),
      create: jest.fn((a) => a as Article),
    };
    categoryRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((c) => c as Category),
      save: jest.fn(async (c) => ({ ...c, id: 'cat1' }) as Category),
    };
    tagRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((t) => t as Tag),
      save: jest.fn(async (t) => ({ ...t, id: `tag-${t.value}` }) as Tag),
    };
    articleService = { create: jest.fn().mockResolvedValue({ id: 'a1' } as Article) };
    configService = { get: jest.fn(() => 'en') };

    service = new BootstrapService(
      articleRepository as unknown as Repository<Article>,
      categoryRepository as unknown as Repository<Category>,
      tagRepository as unknown as Repository<Tag>,
      articleService as ArticleService,
      configService as ConfigService
    );

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('seeds hello world article when database is empty', async () => {
    await service.seedHelloWorldArticle();

    expect(marked).toHaveBeenCalledWith(expect.stringContaining(HELLO_WORLD_SEED_MARKER));
    expect(articleService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Hello World',
        status: 'publish',
        isRecommended: true,
      })
    );
  });

  it('updates existing legacy article content and recommendation flags', async () => {
    const existing = {
      id: 'a1',
      title: 'Hello World',
      content: '<!-- reactpress-seed: -->',
      toc: '[]',
      isRecommended: false,
      cover: '',
    } as Article;

    articleRepository.findOne.mockResolvedValue(existing);

    await service.seedHelloWorldArticle();

    expect(existing.isRecommended).toBe(true);
    expect(existing.cover).toBe('/logo.png');
    expect(articleRepository.save).toHaveBeenCalledWith(existing);
    expect(articleService.create).not.toHaveBeenCalled();
  });

  it('looks up existing article by legacy titles', async () => {
    articleRepository.findOne.mockResolvedValue(null);
    articleRepository.count.mockResolvedValue(1);
    await service.seedHelloWorldArticle();
    expect(articleRepository.findOne).toHaveBeenCalledWith({
      where: { title: In(expect.arrayContaining(['Hello World', '世界，您好！'])) },
    });
    expect(articleService.create).not.toHaveBeenCalled();
  });

  it('onModuleInit runs bootstrap without throwing', async () => {
    articleRepository.count.mockResolvedValue(0);
    service.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('repairs toc values that are not heading objects', async () => {
    const existing = {
      id: 'a1',
      title: 'Hello World',
      content: `<!-- ${HELLO_WORLD_SEED_MARKER}:en -->`,
      toc: JSON.stringify([['legacy']]),
      isRecommended: true,
      cover: '/logo.png',
    } as Article;
    articleRepository.findOne.mockResolvedValue(existing);

    await service.seedHelloWorldArticle();
    expect(articleRepository.save).toHaveBeenCalledWith(existing);

    existing.toc = JSON.stringify([{ text: 'missing-id' }]);
    await service.seedHelloWorldArticle();

    existing.toc = '{not-json';
    await service.seedHelloWorldArticle();
    expect(articleRepository.save).toHaveBeenCalledTimes(3);
  });

  it('logs bootstrap failures from error and non-error throws', async () => {
    articleRepository.findOne.mockRejectedValue(new Error('db down'));
    service.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));
    expect(Logger.prototype.error).toHaveBeenCalledWith('First-run bootstrap failed', expect.any(String));

    (Logger.prototype.error as jest.Mock).mockClear();
    articleRepository.findOne.mockRejectedValue('plain failure');
    service.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));
    expect(Logger.prototype.error).toHaveBeenCalledWith('First-run bootstrap failed', 'plain failure');
  });

  it('reuses existing category/tag by value or label', async () => {
    categoryRepository.findOne
      .mockResolvedValueOnce({ id: 'c1', value: 'uncategorized' } as Category)
      .mockResolvedValue(null);
    tagRepository.findOne.mockResolvedValue({ id: 't1', value: 'reactpress' } as Tag);
    articleRepository.count.mockResolvedValue(0);

    await service.seedHelloWorldArticle();
    expect(categoryRepository.create).not.toHaveBeenCalled();
    expect(tagRepository.create).not.toHaveBeenCalled();
  });
});
