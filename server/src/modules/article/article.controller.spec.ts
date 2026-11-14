import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { ApiMsg } from '../../common/api-messages';
import { ApiKeyService } from '../api-key/api-key.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { Article } from './article.entity';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';

describe('ArticleController', () => {
  let controller: ArticleController;
  let articleService: jest.Mocked<
    Pick<
      ArticleService,
      | 'create'
      | 'findAll'
      | 'listRevisions'
      | 'restoreRevision'
      | 'findArticlesByCategory'
      | 'findArticlesByTag'
      | 'getRecommendArticles'
      | 'getArchives'
      | 'recommend'
      | 'findById'
      | 'checkPassword'
      | 'updateViewsById'
      | 'updateLikesById'
      | 'updateById'
      | 'deleteById'
    >
  >;
  let apiKeyService: jest.Mocked<Pick<ApiKeyService, 'hasScope'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'decode'>>;
  let userService: jest.Mocked<Pick<UserService, 'findById'>>;

  beforeEach(async () => {
    articleService = {
      create: jest.fn(),
      findAll: jest.fn(),
      listRevisions: jest.fn(),
      restoreRevision: jest.fn(),
      findArticlesByCategory: jest.fn(),
      findArticlesByTag: jest.fn(),
      getRecommendArticles: jest.fn(),
      getArchives: jest.fn(),
      recommend: jest.fn(),
      findById: jest.fn(),
      checkPassword: jest.fn(),
      updateViewsById: jest.fn(),
      updateLikesById: jest.fn(),
      updateById: jest.fn(),
      deleteById: jest.fn(),
    };
    apiKeyService = { hasScope: jest.fn() };
    jwtService = { decode: jest.fn() };
    userService = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticleController],
      providers: [
        { provide: ArticleService, useValue: articleService },
        { provide: ApiKeyService, useValue: apiKeyService },
        { provide: JwtService, useValue: jwtService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    controller = module.get(ArticleController);
  });

  it('delegates standard article routes', async () => {
    const article = { id: 'a1' } as Article;
    articleService.create.mockResolvedValue(article);
    articleService.findAll.mockResolvedValue([[article], 1]);
    articleService.listRevisions.mockResolvedValue([]);
    articleService.restoreRevision.mockResolvedValue(article);
    articleService.findArticlesByCategory.mockResolvedValue([[article], 1]);
    articleService.findArticlesByTag.mockResolvedValue([[article], 1]);
    articleService.getRecommendArticles.mockResolvedValue([article]);
    articleService.getArchives.mockResolvedValue({ '2020': {} });
    articleService.recommend.mockResolvedValue([article]);
    articleService.checkPassword.mockResolvedValue({ pass: true });
    articleService.updateViewsById.mockResolvedValue(article);
    articleService.updateLikesById.mockResolvedValue(article);
    articleService.updateById.mockResolvedValue(article);
    articleService.deleteById.mockResolvedValue(article);

    await expect(controller.create({ title: 't' })).resolves.toBe(article);
    await expect(controller.findAll({ page: 1 })).resolves.toEqual([[article], 1]);
    await expect(controller.listRevisions('a1')).resolves.toEqual([]);
    await expect(controller.restoreRevision('a1', 'r1')).resolves.toBe(article);
    await expect(controller.findArticlesByCategory('tech', {})).resolves.toEqual([[article], 1]);
    await expect(controller.findArticlesByTag('news', {})).resolves.toEqual([[article], 1]);
    await expect(controller.getRecommendArticles()).resolves.toEqual([article]);
    await expect(controller.getArchives()).resolves.toEqual({ '2020': {} });
    await expect(controller.recommend('a1', '12')).resolves.toEqual([article]);
    await expect(controller.checkPassword('a1', { password: 'p' })).resolves.toEqual({ pass: true });
    await expect(controller.updateViewsById('a1')).resolves.toBe(article);
    await expect(controller.updateLikesById('a1', 'like')).resolves.toBe(article);
    await expect(controller.updateById('a1', { title: 'n' })).resolves.toBe(article);
    await expect(controller.deleteById('a1')).resolves.toBe(article);
  });

  it('findHeadless enforces read scope', async () => {
    apiKeyService.hasScope.mockReturnValue(false);
    expect(() => controller.findHeadless({ apiKey: {} }, {})).toThrow(ForbiddenException);

    apiKeyService.hasScope.mockReturnValue(true);
    articleService.findAll.mockResolvedValue([[], 0]);
    await controller.findHeadless({ apiKey: {} }, { page: 1 });
    expect(articleService.findAll).toHaveBeenCalledWith({ page: 1, status: 'publish' });
  });

  it('recommend clamps pageSize between 1 and 30', () => {
    articleService.recommend.mockResolvedValue([]);
    controller.recommend('a1', '0');
    expect(articleService.recommend).toHaveBeenCalledWith('a1', 6);
    controller.recommend('a1', '999');
    expect(articleService.recommend).toHaveBeenCalledWith('a1', 30);
  });

  it('findById uses admin flag when JWT decodes', async () => {
    articleService.findById.mockResolvedValue({ id: 'a1' } as Article);
    jwtService.decode.mockReturnValue({ id: 'u1' } as User);
    userService.findById.mockResolvedValue({ id: 'u1', role: 'admin' } as User);

    await controller.findById({ headers: { authorization: 'Bearer t' } }, 'a1', 'publish');
    expect(articleService.findById).toHaveBeenCalledWith('a1', 'publish', true);
  });

  it('findById falls back without admin on errors', async () => {
    articleService.findById.mockResolvedValue({ id: 'a1' } as Article);
    jwtService.decode.mockImplementation(() => {
      throw new Error('bad');
    });

    await controller.findById({ headers: {} }, 'a1', undefined);
    expect(articleService.findById).toHaveBeenCalledWith('a1', undefined);
  });

  it('findHeadless throws with ApiMsg when scope missing', () => {
    apiKeyService.hasScope.mockReturnValue(false);
    expect(() => controller.findHeadless({ apiKey: {} }, {})).toThrow(
      expect.objectContaining({ message: ApiMsg.API_KEY_MISSING_READ })
    );
  });
});
