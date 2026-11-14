import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import { Article } from '../article/article.entity';
import { ArticleService } from '../article/article.service';
import { CategoryService } from '../category/category.service';
import { PluginService } from '../extension/plugin.service';
import { TagService } from '../tag/tag.service';
import { AI_ASSIST_PLUGIN_ID, DEFAULT_AI_ASSIST_CONFIG } from './ai-config';
import { AiReview } from './ai-review.entity';
import { AiService } from './ai.service';
import { chatCompletionsJson } from './llm.client';
import { buildSkillMessages } from './skills/prompts';

jest.mock('./llm.client', () => ({
  chatCompletionsJson: jest.fn(),
}));

const chatMock = chatCompletionsJson as jest.MockedFunction<typeof chatCompletionsJson>;

const AI_ENV_KEYS = ['REACTPRESS_AI_API_KEY', 'REACTPRESS_AI_BASE_URL', 'REACTPRESS_AI_MODEL'] as const;
const originalAiEnv = new Map(AI_ENV_KEYS.map((key) => [key, process.env[key]]));

const SAVED_CONFIG = {
  enabled: true,
  apiKey: 'sk-test',
  baseUrl: 'https://llm.example/v1',
  model: 'gpt-test',
};

const ARTICLE_CONTEXT = {
  id: 'a1',
  title: 'Existing title',
  content: 'Existing content',
  summary: 'Sum',
  slug: 'existing-title',
  seoKeywords: 'k',
  seoDescription: 'd',
};

const DEFAULT_STATUS = {
  pluginId: AI_ASSIST_PLUGIN_ID,
  enabled: true,
  configured: false,
  model: DEFAULT_AI_ASSIST_CONFIG.model,
  baseUrl: DEFAULT_AI_ASSIST_CONFIG.baseUrl,
  skills: ['write', 'organize', 'polish', 'pre-review'],
};

function chainableQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  return qb;
}

function pendingReview(overrides: Partial<AiReview> = {}): AiReview {
  return {
    id: 'r1',
    articleId: 'a1',
    skillId: 'write',
    status: 'pending',
    proposedJson: '{}',
    notes: null,
    model: 'gpt-test',
    approvedBy: null,
    createAt: new Date('2020-01-01T00:00:00.000Z'),
    updateAt: new Date('2020-01-01T00:00:00.000Z'),
    ...overrides,
  } as AiReview;
}

function mockLlm(content: unknown, model = 'gpt-test') {
  chatMock.mockResolvedValue({
    content: typeof content === 'string' ? content : JSON.stringify(content),
    model,
  });
}

describe('AiService', () => {
  let service: AiService;
  let reviewRepository: jest.Mocked<
    Pick<Repository<AiReview>, 'find' | 'findOne' | 'create' | 'save' | 'createQueryBuilder'>
  >;
  let articleRepository: jest.Mocked<Pick<Repository<Article>, 'findOne' | 'createQueryBuilder'>>;
  let pluginService: jest.Mocked<Pick<PluginService, 'getPlugin'>>;
  let articleService: jest.Mocked<Pick<ArticleService, 'findById' | 'create' | 'updateById'>>;
  let tagService: jest.Mocked<Pick<TagService, 'findById' | 'create'>>;
  let categoryService: jest.Mocked<Pick<CategoryService, 'findById' | 'create'>>;
  let reviewQb: ReturnType<typeof chainableQueryBuilder>;

  function mockPlugin(config?: Record<string, unknown>) {
    pluginService.getPlugin.mockResolvedValue({
      id: AI_ASSIST_PLUGIN_ID,
      config,
    } as never);
  }

  function installSlugQb(getOne: jest.Mock = jest.fn().mockResolvedValue(null)) {
    const qb = chainableQueryBuilder({ getOne });
    articleRepository.createQueryBuilder.mockImplementation(() => qb as never);
    return qb;
  }

  function mockTagFlows(sequences: Record<string, Array<{ id?: string } | null>>, failingLabels: string[] = []) {
    const seen = new Map<string, number>();
    tagService.findById.mockImplementation(async (label: string) => {
      const index = seen.get(label) ?? 0;
      seen.set(label, index + 1);
      const sequence = sequences[label] ?? [null];
      return (sequence[Math.min(index, sequence.length - 1)] ?? null) as never;
    });
    tagService.create.mockImplementation(async (tag) => {
      if (failingLabels.includes(String(tag.label))) throw new Error(`duplicate ${tag.label}`);
      return { id: `tag-${tag.value}`, label: tag.label, value: tag.value } as never;
    });
  }

  function mockCategoryFlows(sequences: Record<string, Array<{ id?: string } | null>>, failingLabels: string[] = []) {
    const seen = new Map<string, number>();
    categoryService.findById.mockImplementation(async (label: string) => {
      const index = seen.get(label) ?? 0;
      seen.set(label, index + 1);
      const sequence = sequences[label] ?? [null];
      return (sequence[Math.min(index, sequence.length - 1)] ?? null) as never;
    });
    categoryService.create.mockImplementation(async (category) => {
      if (failingLabels.includes(String(category.label))) throw new Error(`duplicate ${category.label}`);
      return { id: `cat-${category.value}`, label: category.label, value: category.value } as never;
    });
  }

  beforeEach(async () => {
    for (const key of AI_ENV_KEYS) delete process.env[key];

    reviewQb = chainableQueryBuilder();
    reviewRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((row) => ({ id: 'rev-1', ...row }) as AiReview),
      save: jest.fn(async (row) => row as AiReview),
      createQueryBuilder: jest.fn(() => reviewQb as never),
    };
    articleRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => chainableQueryBuilder() as never),
    };
    pluginService = { getPlugin: jest.fn() };
    articleService = {
      findById: jest.fn(async (id: string) => ({
        ...ARTICLE_CONTEXT,
        id,
        tags: [
          { label: 'Alpha', value: 'alpha' },
          { label: '', value: 'beta' },
          { label: '', value: '' },
        ],
        category: { id: 'cat-1', label: 'News', value: 'news' },
      })),
      create: jest.fn(async (payload) => ({ id: 'draft-1', ...payload })),
      updateById: jest.fn(async (id: string, patch) => ({ id, ...patch })),
    };
    tagService = {
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (tag) => ({ id: 'tag-created', ...tag })),
    };
    categoryService = {
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (category) => ({ id: 'cat-created', ...category })),
    };
    mockPlugin(SAVED_CONFIG);

    chatMock.mockReset();
    mockLlm({ fields: { title: 'Draft', content: 'Body' }, notes: 'note' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: getRepositoryToken(AiReview), useValue: reviewRepository },
        { provide: getRepositoryToken(Article), useValue: articleRepository },
        { provide: PluginService, useValue: pluginService },
        { provide: ArticleService, useValue: articleService },
        { provide: TagService, useValue: tagService },
        { provide: CategoryService, useValue: categoryService },
      ],
    }).compile();

    service = module.get(AiService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    for (const key of AI_ENV_KEYS) {
      const value = originalAiEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe('getStatus', () => {
    it('returns configured plugin status', async () => {
      await expect(service.getStatus()).resolves.toEqual({
        pluginId: AI_ASSIST_PLUGIN_ID,
        enabled: true,
        configured: true,
        model: 'gpt-test',
        baseUrl: 'https://llm.example/v1',
        skills: ['write', 'organize', 'polish', 'pre-review'],
      });
      expect(pluginService.getPlugin).toHaveBeenCalledWith(AI_ASSIST_PLUGIN_ID);
    });

    it('uses defaults when the plugin record is missing', async () => {
      const setups = [
        () => pluginService.getPlugin.mockRejectedValue(new Error('missing')),
        () => pluginService.getPlugin.mockResolvedValue(undefined as never),
        () => pluginService.getPlugin.mockResolvedValue({ id: AI_ASSIST_PLUGIN_ID } as never),
      ];

      for (const setup of setups) {
        setup();
        await expect(service.getStatus()).resolves.toEqual(DEFAULT_STATUS);
      }
    });

    it('reports a disabled plugin as disabled and still configured', async () => {
      mockPlugin({ enabled: false, apiKey: 'sk-off', baseUrl: 'https://off.example/v1', model: 'off-model' });

      await expect(service.getStatus()).resolves.toMatchObject({
        enabled: false,
        configured: true,
        model: 'off-model',
        baseUrl: 'https://off.example/v1',
      });
    });

    it('falls back when stored base URL and model are blank', async () => {
      mockPlugin({ apiKey: '  sk-pad  ', baseUrl: '   ', model: '' });

      await expect(service.getStatus()).resolves.toMatchObject({
        configured: true,
        model: DEFAULT_AI_ASSIST_CONFIG.model,
        baseUrl: DEFAULT_AI_ASSIST_CONFIG.baseUrl,
      });
    });

    it('applies trimmed env fallbacks when the plugin has no key', async () => {
      pluginService.getPlugin.mockRejectedValue(new Error('missing'));
      process.env.REACTPRESS_AI_API_KEY = '  env-key  ';
      process.env.REACTPRESS_AI_BASE_URL = '  https://env.example/v1  ';
      process.env.REACTPRESS_AI_MODEL = '  env-model  ';

      await expect(service.getStatus()).resolves.toMatchObject({
        enabled: true,
        configured: true,
        baseUrl: 'https://env.example/v1',
        model: 'env-model',
      });

      chatMock.mockResolvedValue({ content: '{"ok":true}', model: 'echo-model' });
      await expect(service.testConnection()).resolves.toEqual({ ok: true, model: 'echo-model' });
      expect(chatMock).toHaveBeenCalledWith(
        {
          apiKey: 'env-key',
          baseUrl: 'https://env.example/v1',
          model: 'env-model',
          timeoutMs: 30_000,
        },
        expect.any(Array)
      );
    });

    it('keeps a saved key and still lets env override base URL and model', async () => {
      process.env.REACTPRESS_AI_API_KEY = 'env-key';
      process.env.REACTPRESS_AI_BASE_URL = ' https://env.example/v1 ';
      process.env.REACTPRESS_AI_MODEL = ' env-model ';

      await expect(service.getStatus()).resolves.toMatchObject({
        configured: true,
        baseUrl: 'https://env.example/v1',
        model: 'env-model',
      });

      await service.testConnection();
      expect(chatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-test',
          baseUrl: 'https://env.example/v1',
          model: 'env-model',
        }),
        expect.any(Array)
      );
    });

    it('throws when the saved secret cannot be decrypted', async () => {
      mockPlugin({ enabled: true, apiKey: 'enc:v1:aa' });
      process.env.REACTPRESS_AI_API_KEY = 'env-key';

      await expect(service.getStatus()).rejects.toMatchObject({
        response: ApiMsg.AI_SECRET_UNREADABLE,
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('testConnection', () => {
    it('throws when assist is disabled before calling the provider', async () => {
      mockPlugin({ enabled: false, apiKey: 'sk-test' });

      await expect(service.testConnection()).rejects.toMatchObject({
        response: ApiMsg.AI_DISABLED,
        status: HttpStatus.BAD_REQUEST,
      });
      await expect(service.testConnection({ apiKey: 'override-key' })).rejects.toMatchObject({
        response: ApiMsg.AI_DISABLED,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(chatMock).not.toHaveBeenCalled();
    });

    it('throws when the api key is missing', async () => {
      mockPlugin({ enabled: true });

      await expect(service.testConnection()).rejects.toMatchObject({
        response: ApiMsg.AI_API_KEY_REQUIRED,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(chatMock).not.toHaveBeenCalled();
    });

    it('pings the provider and returns the echoed model', async () => {
      chatMock.mockResolvedValue({ content: '{"ok":true}', model: 'echo-model' });

      await expect(service.testConnection()).resolves.toEqual({ ok: true, model: 'echo-model' });
      expect(chatMock).toHaveBeenCalledWith(
        {
          apiKey: 'sk-test',
          baseUrl: 'https://llm.example/v1',
          model: 'gpt-test',
          timeoutMs: 30_000,
        },
        [
          { role: 'system', content: 'Reply with JSON: {"ok":true}' },
          { role: 'user', content: 'ping' },
        ]
      );
    });

    it('trims connection overrides', async () => {
      chatMock.mockResolvedValue({ content: '{"ok":true}', model: 'echo-model' });

      await expect(
        service.testConnection({
          apiKey: '  override-key  ',
          baseUrl: '  https://override.example/v1  ',
          model: '  override-model  ',
        })
      ).resolves.toEqual({ ok: true, model: 'echo-model' });

      expect(chatMock).toHaveBeenCalledWith(
        {
          apiKey: 'override-key',
          baseUrl: 'https://override.example/v1',
          model: 'override-model',
          timeoutMs: 30_000,
        },
        expect.any(Array)
      );
    });

    it('falls back to saved settings when overrides are blank', async () => {
      await service.testConnection({ apiKey: '   ', baseUrl: '\n', model: '' });

      expect(chatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-test',
          baseUrl: 'https://llm.example/v1',
          model: 'gpt-test',
        }),
        expect.any(Array)
      );
    });

    it('accepts a key override when nothing is saved and fills default endpoint settings', async () => {
      mockPlugin({ enabled: true, baseUrl: '   ', model: '  ' });

      await service.testConnection({ apiKey: '  only-key  ', baseUrl: ' https://only.example/v1 ' });

      expect(chatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'only-key',
          baseUrl: 'https://only.example/v1',
          model: DEFAULT_AI_ASSIST_CONFIG.model,
        }),
        expect.any(Array)
      );
    });

    it('trims a stored key before the ping', async () => {
      mockPlugin({
        enabled: true,
        apiKey: '  sk-pad  ',
        baseUrl: '  https://pad.example/v1  ',
        model: '  pad-model  ',
      });

      await service.testConnection();

      expect(chatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-pad',
          baseUrl: 'https://pad.example/v1',
          model: 'pad-model',
        }),
        expect.any(Array)
      );
    });
  });

  describe('runSkill', () => {
    it.each(['publish', 'WRITE', '', 'write '])('rejects unknown skill %j', async (skillId) => {
      await expect(service.runSkill({ skillId })).rejects.toMatchObject({
        response: ApiMsg.AI_UNKNOWN_SKILL,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(pluginService.getPlugin).not.toHaveBeenCalled();
      expect(chatMock).not.toHaveBeenCalled();
    });

    it('throws when assist is disabled', async () => {
      mockPlugin({ enabled: false, apiKey: 'sk-test' });

      await expect(service.runSkill({ skillId: 'write', brief: 'topic' })).rejects.toMatchObject({
        response: ApiMsg.AI_DISABLED,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(chatMock).not.toHaveBeenCalled();
    });

    it('throws when assist is disabled even if an env key is set', async () => {
      mockPlugin({ enabled: false });
      process.env.REACTPRESS_AI_API_KEY = 'env-secret';

      await expect(service.runSkill({ skillId: 'write', brief: 'topic' })).rejects.toMatchObject({
        response: ApiMsg.AI_DISABLED,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(chatMock).not.toHaveBeenCalled();
    });

    it('throws when the api key is missing', async () => {
      mockPlugin({ enabled: true });

      await expect(service.runSkill({ skillId: 'organize' })).rejects.toMatchObject({
        response: ApiMsg.AI_API_KEY_REQUIRED,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(chatMock).not.toHaveBeenCalled();
    });

    it('throws when a saved secret cannot be decrypted', async () => {
      mockPlugin({ apiKey: 'enc:v1:aa' });

      await expect(service.runSkill({ skillId: 'organize' })).rejects.toMatchObject({
        response: ApiMsg.AI_SECRET_UNREADABLE,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(chatMock).not.toHaveBeenCalled();
    });

    it('requires a brief when write has no article content', async () => {
      await expect(service.runSkill({ skillId: 'write' })).rejects.toMatchObject({
        response: ApiMsg.AI_BRIEF_REQUIRED,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(pluginService.getPlugin).toHaveBeenCalled();
      expect(chatMock).not.toHaveBeenCalled();
    });

    it('requires a brief when the article content is empty', async () => {
      articleService.findById.mockResolvedValue({ ...ARTICLE_CONTEXT, content: '' } as never);

      await expect(service.runSkill({ skillId: 'write', articleId: 'a1', brief: '   ' })).rejects.toMatchObject({
        response: ApiMsg.AI_BRIEF_REQUIRED,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(chatMock).not.toHaveBeenCalled();
    });

    it('writes from whitespace article content when the brief is blank', async () => {
      articleService.findById.mockResolvedValue({ ...ARTICLE_CONTEXT, content: ' ' } as never);
      mockLlm({ fields: { summary: 'Tight' } });

      await service.runSkill({ skillId: 'write', articleId: 'a1' });

      expect(chatMock).toHaveBeenCalled();
      expect(articleService.updateById).toHaveBeenCalledWith('a1', { summary: 'Tight' });
    });

    it('propagates article lookup failures before calling the model', async () => {
      articleService.findById.mockRejectedValue(new Error('missing article'));

      await expect(service.runSkill({ skillId: 'polish', articleId: 'missing' })).rejects.toThrow('missing article');
      expect(chatMock).not.toHaveBeenCalled();
    });

    it('creates a draft, rejects older pending reviews, and enqueues the new one', async () => {
      const older = [
        { id: 'old-1', status: 'pending', articleId: 'draft-1' },
        { id: 'old-2', status: 'pending', articleId: 'draft-1' },
      ];
      reviewRepository.find.mockResolvedValue(older as AiReview[]);
      mockLlm(
        {
          fields: { title: 'Draft Title', content: 'Body', summary: 'Sum' },
          notes: 'rationale',
        },
        'model-x'
      );

      const result = await service.runSkill({
        skillId: 'write',
        brief: 'A topic',
        audience: 'devs',
        language: 'en',
      });

      expect(chatMock).toHaveBeenCalledWith(
        { apiKey: 'sk-test', baseUrl: 'https://llm.example/v1', model: 'gpt-test' },
        buildSkillMessages({
          skillId: 'write',
          brief: 'A topic',
          audience: 'devs',
          language: 'en',
          article: undefined,
        })
      );
      expect(older.map((row) => row.status)).toEqual(['rejected', 'rejected']);
      expect(reviewRepository.save).toHaveBeenCalledWith(older[0]);
      expect(reviewRepository.save).toHaveBeenCalledWith(older[1]);
      expect(reviewRepository.find).toHaveBeenCalledWith({
        where: { articleId: 'draft-1', status: 'pending' },
      });
      expect(articleService.create).toHaveBeenCalledWith({
        title: 'Draft Title',
        content: 'Body',
        summary: 'Sum',
        slug: 'draft-title',
        seoKeywords: '',
        seoDescription: '',
        status: 'draft',
      });
      expect(reviewRepository.create).toHaveBeenCalledWith({
        articleId: 'draft-1',
        skillId: 'write',
        status: 'pending',
        proposedJson: JSON.stringify({ title: 'Draft Title', content: 'Body', summary: 'Sum' }),
        notes: 'rationale',
        model: 'model-x',
      });
      expect(result).toMatchObject({
        skillId: 'write',
        model: 'model-x',
        notes: 'rationale',
        fields: { title: 'Draft Title', content: 'Body', summary: 'Sum' },
        article: { id: 'draft-1', title: 'Draft Title' },
        review: { id: 'rev-1', status: 'pending', notes: 'rationale' },
      });
    });

    it('applies a write result onto an existing article', async () => {
      mockLlm({ fields: { content: 'Rewritten' }, notes: 'done' });

      const result = await service.runSkill({ skillId: 'write', articleId: 'a1', brief: '   ' });

      expect(articleService.create).not.toHaveBeenCalled();
      expect(articleService.updateById).toHaveBeenCalledWith('a1', { content: 'Rewritten' });
      expect(result.article).toEqual(expect.objectContaining({ id: 'a1', content: 'Rewritten' }));
      expect(result.review).toEqual(expect.objectContaining({ articleId: 'a1', skillId: 'write' }));
    });

    it('organizes an existing article and sends its context to the model', async () => {
      mockLlm({ fields: { summary: '  Better summary  ', seoDescription: ' Desc ' }, notes: 'meta' });

      const result = await service.runSkill({
        skillId: 'organize',
        articleId: 'a1',
        brief: 'tighten',
        audience: 'devs',
        language: 'en',
      });

      expect(chatMock).toHaveBeenCalledWith(
        { apiKey: 'sk-test', baseUrl: 'https://llm.example/v1', model: 'gpt-test' },
        buildSkillMessages({
          skillId: 'organize',
          brief: 'tighten',
          audience: 'devs',
          language: 'en',
          article: ARTICLE_CONTEXT,
        })
      );
      expect(articleService.updateById).toHaveBeenCalledWith('a1', {
        summary: 'Better summary',
        seoDescription: 'Desc',
      });
      expect(result.notes).toBe('meta');
      expect(result.skillId).toBe('organize');
    });

    it('polishes an existing article', async () => {
      mockLlm({ fields: { content: 'Polished', seoKeywords: ' one, two ' } });

      const result = await service.runSkill({ skillId: 'polish', articleId: 'a1' });

      expect(chatMock).toHaveBeenCalledWith(
        expect.any(Object),
        buildSkillMessages({
          skillId: 'polish',
          brief: undefined,
          audience: undefined,
          language: undefined,
          article: ARTICLE_CONTEXT,
        })
      );
      expect(articleService.updateById).toHaveBeenCalledWith('a1', {
        content: 'Polished',
        seoKeywords: 'one, two',
      });
      expect(result.notes).toBeNull();
    });

    it('pre-reviews without writing proposed fields back to the article', async () => {
      mockLlm({ fields: { title: 'Suggested', content: 'Fix' }, notes: 'checklist' });

      const result = await service.runSkill({ skillId: 'pre-review', articleId: 'a1', enqueueReview: true });

      expect(chatMock).toHaveBeenCalledWith(
        expect.any(Object),
        buildSkillMessages({
          skillId: 'pre-review',
          brief: undefined,
          audience: undefined,
          language: undefined,
          article: ARTICLE_CONTEXT,
        })
      );
      expect(articleService.updateById).not.toHaveBeenCalled();
      expect(articleService.create).not.toHaveBeenCalled();
      expect(articleService.findById).toHaveBeenCalledTimes(2);
      expect(result.fields).toEqual({ title: 'Suggested', content: 'Fix' });
      expect(result.notes).toBe('checklist');
      expect(result.article).toEqual(expect.objectContaining({ id: 'a1' }));
      expect(result.review).toEqual(expect.objectContaining({ skillId: 'pre-review', notes: 'checklist' }));
    });

    it('creates a new draft when createDraft is set on an existing article', async () => {
      mockLlm({ fields: { title: 'Spinoff', content: 'Copy' } });

      const result = await service.runSkill({
        skillId: 'polish',
        articleId: 'a1',
        createDraft: true,
        enqueueReview: false,
      });

      expect(articleService.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Spinoff', status: 'draft' })
      );
      expect(articleService.updateById).not.toHaveBeenCalled();
      expect(reviewRepository.find).not.toHaveBeenCalled();
      expect(result.article).toEqual(expect.objectContaining({ id: 'draft-1' }));
      expect(result.review).toBeNull();
    });

    it('returns no article or review when organize has nothing to attach', async () => {
      const result = await service.runSkill({ skillId: 'organize', brief: 'meta' });

      expect(chatMock).toHaveBeenCalled();
      expect(articleService.findById).not.toHaveBeenCalled();
      expect(articleService.create).not.toHaveBeenCalled();
      expect(result.article).toBeNull();
      expect(result.review).toBeNull();
    });

    it('reloads the article when sanitized fields are empty', async () => {
      mockLlm({ fields: { title: 1, tags: 'nope' }, notes: 'nothing' });

      const result = await service.runSkill({ skillId: 'organize', articleId: 'a1', enqueueReview: false });

      expect(articleService.updateById).not.toHaveBeenCalled();
      expect(articleService.findById).toHaveBeenCalledTimes(2);
      expect(result.fields).toEqual({});
      expect(result.notes).toBe('nothing');
      expect(result.article).toEqual(expect.objectContaining({ id: 'a1' }));
      expect(result.review).toBeNull();
    });

    it('uses env connection settings when the plugin has no key', async () => {
      pluginService.getPlugin.mockRejectedValue(new Error('missing'));
      process.env.REACTPRESS_AI_API_KEY = 'env-secret';
      process.env.REACTPRESS_AI_BASE_URL = 'https://env.example/v1';
      process.env.REACTPRESS_AI_MODEL = 'env-model';
      mockLlm({ fields: { title: 'From Env', content: 'Body' } });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(chatMock).toHaveBeenCalledWith(
        { apiKey: 'env-secret', baseUrl: 'https://env.example/v1', model: 'env-model' },
        expect.any(Array)
      );
    });

    it.each(['{', 'null', '42', '"text"', 'true'])('rejects invalid provider JSON %j', async (content) => {
      mockLlm(content);

      await expect(service.runSkill({ skillId: 'write', brief: 'topic' })).rejects.toMatchObject({
        response: ApiMsg.AI_PROVIDER_INVALID_RESPONSE,
        status: HttpStatus.BAD_GATEWAY,
      });
    });

    it('accepts a JSON array of fields and creates an untitled draft', async () => {
      mockLlm({ fields: ['x'], notes: 'list' });

      const result = await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(articleService.create).toHaveBeenCalledWith({
        title: 'Untitled draft',
        content: '',
        summary: '',
        slug: 'untitled-draft',
        seoKeywords: '',
        seoDescription: '',
        status: 'draft',
      });
      expect(result.fields).toEqual({});
      expect(result.notes).toBe('list');
    });

    it('reads top-level fields and keeps an empty notes string', async () => {
      mockLlm({ title: 'Top', content: 'Body', notes: '' });

      const result = await service.runSkill({ skillId: 'write', brief: 'topic' });

      expect(result.fields).toEqual({ title: 'Top', content: 'Body' });
      expect(result.notes).toBe('');
      expect(reviewRepository.create).toHaveBeenCalledWith(expect.objectContaining({ notes: '' }));
    });

    it('falls back to the root object when fields is not an object', async () => {
      mockLlm({ fields: 'bad', title: 'Fallback', notes: false });

      const result = await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(result.fields).toEqual({ title: 'Fallback' });
      expect(result.notes).toBeNull();
    });

    it('drops non-string fields and creates an untitled draft', async () => {
      mockLlm({
        fields: {
          title: 5,
          content: false,
          summary: {},
          slug: 2,
          seoKeywords: [],
          seoDescription: null,
          tags: 'nope',
          category: 3,
        },
      });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(articleService.create).toHaveBeenCalledWith({
        title: 'Untitled draft',
        content: '',
        summary: '',
        slug: 'untitled-draft',
        seoKeywords: '',
        seoDescription: '',
        status: 'draft',
      });
      expect(articleRepository.findOne).toHaveBeenCalledWith({ where: { title: 'Untitled draft' } });
    });

    it('uses a null fields wrapper as the root object', async () => {
      mockLlm({ fields: null, title: 'From Root', content: 'Body' });

      const result = await service.runSkill({ skillId: 'organize', enqueueReview: false });

      expect(result.fields).toEqual({ title: 'From Root', content: 'Body' });
      expect(result.article).toBeNull();
    });
  });

  describe('taxonomy', () => {
    it('resolves existing labels and creates the missing ones', async () => {
      mockTagFlows({
        'Existing': [{ id: 'id-existing' }],
        'New Tag': [null],
        '技术': [null],
        '!!!': [null],
      });
      mockCategoryFlows({
        'Existing Cat': [{ id: 'cat-keep' }],
      });
      mockLlm({
        fields: {
          title: 'Taxonomy Post',
          content: 'Body',
          tags: ['Existing', '  ', 'New Tag', '技术', '!!!'],
          category: 'Existing Cat',
        },
      });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(tagService.create).toHaveBeenCalledWith({ label: 'New Tag', value: 'new-tag' });
      expect(tagService.create).toHaveBeenCalledWith({ label: '技术', value: '技术' });
      expect(tagService.create).toHaveBeenCalledWith({ label: '!!!', value: '!!!' });
      expect(tagService.create).not.toHaveBeenCalledWith(expect.objectContaining({ label: 'Existing' }));
      expect(tagService.findById).not.toHaveBeenCalledWith('');
      expect(categoryService.create).not.toHaveBeenCalled();
      expect(articleService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Taxonomy Post',
          slug: 'taxonomy-post',
          tags: 'id-existing,tag-new-tag,tag-技术,tag-!!!',
          category: 'cat-keep',
          status: 'draft',
        })
      );
    });

    it('retries lookup after create failure and drops labels that stay missing', async () => {
      mockTagFlows(
        {
          Retry: [null, { id: 'tag-retry' }],
          NoId: [{}, { id: 'tag-noid' }],
          Ghost: [null, null],
        },
        ['Retry', 'NoId', 'Ghost']
      );
      mockCategoryFlows({ 'Retry Cat': [null, { id: 'cat-retry' }] }, ['Retry Cat']);
      mockLlm({
        fields: {
          title: 'Retry Post',
          content: 'Body',
          tags: ['Retry', 'NoId', 'Ghost'],
          category: 'Retry Cat',
        },
      });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(articleService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: 'tag-retry,tag-noid',
          category: 'cat-retry',
        })
      );
    });

    it('creates a category whose label cannot be slugified and omits tags', async () => {
      mockCategoryFlows({ '@@@': [null] });
      mockLlm({ fields: { title: 'Cat Post', content: 'Body', category: '@@@' } });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(categoryService.create).toHaveBeenCalledWith({ label: '@@@', value: '@@@' });
      const payload = articleService.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.category).toBe('cat-@@@');
      expect(payload).not.toHaveProperty('tags');
    });

    it('omits a category that cannot be resolved', async () => {
      mockTagFlows({ Existing: [{ id: 'id-existing' }] });
      mockCategoryFlows({ Missing: [null, null] }, ['Missing']);
      mockLlm({
        fields: { title: 'Partial', content: 'Body', tags: ['Existing'], category: 'Missing' },
      });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      const payload = articleService.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.tags).toBe('id-existing');
      expect(payload).not.toHaveProperty('category');
      expect(tagService.create).not.toHaveBeenCalled();
    });

    it('keeps at most 12 tags', async () => {
      const labels = Array.from({ length: 13 }, (_, index) => `tag${index}`);
      mockTagFlows(Object.fromEntries(labels.map((label) => [label, [{ id: label }]])));
      mockLlm({
        fields: { title: 'Tags', content: 'C', tags: ['  ', '', ...labels] },
      });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(tagService.findById).toHaveBeenCalledTimes(12);
      expect(tagService.findById).not.toHaveBeenCalledWith('tag12');
      expect(tagService.create).not.toHaveBeenCalled();
      expect(articleService.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: labels.slice(0, 12).join(',') })
      );
    });

    it('applies tags without a category', async () => {
      mockTagFlows({ 'New Tag': [null] });
      mockLlm({ fields: { tags: ['New Tag'] } });

      await service.runSkill({ skillId: 'organize', articleId: 'a1', enqueueReview: false });

      expect(articleService.updateById).toHaveBeenCalledWith('a1', { tags: 'tag-new-tag' });
      expect(categoryService.findById).not.toHaveBeenCalled();
    });

    it('applies a category without tags', async () => {
      mockCategoryFlows({ 'New Cat': [null] });
      mockLlm({ fields: { category: 'New Cat' } });

      await service.runSkill({ skillId: 'organize', articleId: 'a1', enqueueReview: false });

      expect(categoryService.create).toHaveBeenCalledWith({ label: 'New Cat', value: 'new-cat' });
      expect(articleService.updateById).toHaveBeenCalledWith('a1', { category: 'cat-new-cat' });
      expect(tagService.findById).not.toHaveBeenCalled();
    });

    it('clears tags and skips a blank slug or category', async () => {
      mockLlm({
        fields: {
          title: '  Kept  ',
          content: '',
          slug: '   ',
          tags: ['  ', ''],
          category: '   ',
        },
      });

      await service.runSkill({ skillId: 'organize', articleId: 'a1', enqueueReview: false });

      expect(articleService.updateById).toHaveBeenCalledWith('a1', { title: 'Kept', content: '', tags: '' });
      expect(articleRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(tagService.findById).not.toHaveBeenCalled();
      expect(categoryService.findById).not.toHaveBeenCalled();
    });
  });

  describe('title and slug uniqueness', () => {
    it('suffixes a duplicate title and slugifies a hyphen-wrapped slug', async () => {
      articleRepository.findOne.mockResolvedValueOnce({ id: 'dup' } as Article).mockResolvedValueOnce(null);
      const qb = installSlugQb();
      mockLlm({ fields: { title: 'My Title', slug: '---Hello---', content: 'Body' } });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(articleRepository.findOne).toHaveBeenNthCalledWith(1, { where: { title: 'My Title' } });
      expect(articleRepository.findOne).toHaveBeenNthCalledWith(2, { where: { title: 'My Title (2)' } });
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith('article.slug = :slug', { slug: 'hello' });
      expect(articleService.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My Title (2)', slug: 'hello' })
      );
    });

    it('uses a timestamp when every title candidate is taken', async () => {
      const now = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      articleRepository.findOne.mockResolvedValue({ id: 'dup' } as Article);
      mockLlm({ fields: { title: 'My Title', slug: 'stable-slug', content: 'Body' } });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(articleRepository.findOne).toHaveBeenCalledTimes(50);
      expect(articleRepository.findOne).toHaveBeenNthCalledWith(1, { where: { title: 'My Title' } });
      expect(articleRepository.findOne).toHaveBeenNthCalledWith(50, { where: { title: 'My Title (50)' } });
      expect(articleService.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: `My Title (${now})`, slug: 'stable-slug' })
      );
    });

    it('suffixes a duplicate slug while creating a draft', async () => {
      const getOne = jest.fn().mockResolvedValueOnce({ id: 'taken' }).mockResolvedValueOnce(null);
      const qb = installSlugQb(getOne);
      mockLlm({ fields: { title: 'Hello', slug: 'My Slug', content: 'Body' } });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(qb.where).toHaveBeenNthCalledWith(1, 'article.slug = :slug', { slug: 'my-slug' });
      expect(qb.where).toHaveBeenNthCalledWith(2, 'article.slug = :slug', { slug: 'my-slug-2' });
      expect(qb.take).toHaveBeenCalledWith(1);
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(articleService.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'my-slug-2' }));
    });

    it('uses a timestamp when every slug candidate is taken', async () => {
      const now = 1_700_000_000_123;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const getOne = jest.fn().mockResolvedValue({ id: 'taken' });
      const qb = installSlugQb(getOne);
      mockLlm({ fields: { title: 'Hello', slug: 'Hello', content: 'Body' } });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(getOne).toHaveBeenCalledTimes(50);
      expect(qb.where).toHaveBeenNthCalledWith(1, 'article.slug = :slug', { slug: 'hello' });
      expect(qb.where).toHaveBeenNthCalledWith(50, 'article.slug = :slug', { slug: 'hello-50' });
      expect(articleService.create).toHaveBeenCalledWith(expect.objectContaining({ slug: `hello-${now}` }));
    });

    it('keeps a slug that is free for the current article', async () => {
      const qb = installSlugQb();
      mockLlm({ fields: { slug: 'Custom Slug' } });

      await service.runSkill({ skillId: 'organize', articleId: 'a1', enqueueReview: false });

      expect(articleService.updateById).toHaveBeenCalledWith('a1', { slug: 'custom-slug' });
      expect(qb.where).toHaveBeenCalledWith('article.slug = :slug', { slug: 'custom-slug' });
      expect(qb.andWhere).toHaveBeenCalledWith('article.id != :excludeId', { excludeId: 'a1' });
      expect(qb.take).toHaveBeenCalledWith(1);
    });

    it('suffixes a slug that another article already uses', async () => {
      const getOne = jest.fn().mockResolvedValueOnce({ id: 'other' }).mockResolvedValueOnce(null);
      const qb = installSlugQb(getOne);
      mockLlm({ fields: { slug: 'Custom Slug' } });

      await service.runSkill({ skillId: 'organize', articleId: 'a1', enqueueReview: false });

      expect(articleService.updateById).toHaveBeenCalledWith('a1', { slug: 'custom-slug-2' });
      expect(qb.andWhere).toHaveBeenCalledWith('article.id != :excludeId', { excludeId: 'a1' });
    });

    it('slugifies mixed titles onto the draft slug', async () => {
      mockLlm({ fields: { title: '  ***中文 Hello,   World!***  ', content: 'Body' } });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(articleService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '***中文 Hello,   World!***',
          slug: '中文-hello-world',
        })
      );
    });

    it('builds a draft slug when the title has no slug characters', async () => {
      const now = 1_711_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      mockLlm({ fields: { title: '!!!', content: 'Body' } });

      await service.runSkill({ skillId: 'write', brief: 'topic', enqueueReview: false });

      expect(articleService.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: '!!!', slug: `draft-${now}` })
      );
    });

    it('replaces a symbol-only slug on the current article', async () => {
      const now = 1_711_000_000_111;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const qb = installSlugQb();
      mockLlm({ fields: { slug: '@@@' } });

      await service.runSkill({ skillId: 'polish', articleId: 'a1', enqueueReview: false });

      expect(articleService.updateById).toHaveBeenCalledWith('a1', { slug: `draft-${now}` });
      expect(qb.andWhere).toHaveBeenCalledWith('article.id != :excludeId', { excludeId: 'a1' });
    });
  });

  describe('listReviews', () => {
    it('normalizes pagination and applies a status filter only when one is set', async () => {
      await expect(service.listReviews({})).resolves.toEqual({ data: [], total: 0, page: 1, pageSize: 20 });
      await expect(service.listReviews({ page: 0, pageSize: 0 })).resolves.toMatchObject({ page: 1, pageSize: 20 });
      await expect(service.listReviews({ page: -3, pageSize: -5 })).resolves.toMatchObject({ page: 1, pageSize: 1 });
      await expect(service.listReviews({ page: Number.NaN, pageSize: Number.NaN })).resolves.toMatchObject({
        page: 1,
        pageSize: 20,
      });
      await expect(
        service.listReviews({ page: 'nope' as never, pageSize: 'nope' as never, status: '' })
      ).resolves.toMatchObject({ page: 1, pageSize: 20 });
      await expect(service.listReviews({ page: 2, pageSize: 1 })).resolves.toMatchObject({ page: 2, pageSize: 1 });
      await expect(
        service.listReviews({ page: '2' as never, pageSize: '101' as never, status: 'approved' })
      ).resolves.toMatchObject({ page: 2, pageSize: 100 });

      expect(reviewQb.orderBy).toHaveBeenCalledWith('review.createAt', 'DESC');
      expect(reviewQb.skip).toHaveBeenCalledWith(0);
      expect(reviewQb.skip).toHaveBeenCalledWith(1);
      expect(reviewQb.skip).toHaveBeenCalledWith(100);
      expect(reviewQb.take).toHaveBeenCalledWith(20);
      expect(reviewQb.take).toHaveBeenCalledWith(1);
      expect(reviewQb.take).toHaveBeenCalledWith(100);
      expect(reviewQb.andWhere).toHaveBeenCalledTimes(1);
      expect(reviewQb.andWhere).toHaveBeenCalledWith('review.status = :status', { status: 'approved' });
    });

    it('attaches article titles and sanitizes proposed JSON', async () => {
      const rows = [
        pendingReview({
          id: 'r1',
          articleId: 'a1',
          proposedJson: JSON.stringify({
            title: '  Hi  ',
            tags: [' a ', '', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'],
          }),
        }),
        pendingReview({ id: 'r2', articleId: 'gone', proposedJson: 'not-json' }),
        pendingReview({ id: 'r3', articleId: 'blank', proposedJson: 'null' }),
        pendingReview({ id: 'r4', articleId: 'a4', proposedJson: '[]' }),
        pendingReview({ id: 'r5', articleId: 'empty', proposedJson: '1' }),
      ];
      reviewQb.getManyAndCount.mockResolvedValue([rows, 42]);
      articleService.findById.mockImplementation(async (id: string) => {
        if (id === 'gone') throw new Error('missing');
        if (id === 'blank') return { id, title: undefined } as never;
        if (id === 'empty') return null as never;
        if (id === 'a1') return { id, title: 'Kept Title' } as never;
        return { id, title: 'Other' } as never;
      });

      const result = await service.listReviews({ status: 'pending', page: 1, pageSize: 10 });

      expect(result.total).toBe(42);
      expect(result.data[0]).toMatchObject({
        articleTitle: 'Kept Title',
        proposed: { title: 'Hi', tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'] },
      });
      expect(result.data[0].proposed.tags).not.toContain('m');
      expect(result.data[1]).toMatchObject({ articleTitle: '', proposed: {} });
      expect(result.data[2]).toMatchObject({ articleTitle: '', proposed: {} });
      expect(result.data[3]).toMatchObject({ articleTitle: 'Other', proposed: {} });
      expect(result.data[4]).toMatchObject({ articleTitle: '', proposed: {} });
      expect(reviewQb.andWhere).toHaveBeenCalledWith('review.status = :status', { status: 'pending' });
    });
  });

  describe('getReview', () => {
    it('throws when the review does not exist', async () => {
      await expect(service.getReview('missing')).rejects.toMatchObject({
        response: ApiMsg.AI_REVIEW_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
      expect(articleService.findById).not.toHaveBeenCalled();
    });

    it('returns proposed fields and a comparable article', async () => {
      const row = pendingReview({
        proposedJson: JSON.stringify({ title: '  From Review  ', category: '  News  ', tags: [' Alpha ', ''] }),
      });
      reviewRepository.findOne.mockResolvedValue(row);

      const result = await service.getReview('r1');

      expect(result.proposed).toEqual({ title: 'From Review', category: 'News', tags: ['Alpha'] });
      expect(result.current).toEqual({
        title: 'Existing title',
        content: 'Existing content',
        summary: 'Sum',
        slug: 'existing-title',
        seoKeywords: 'k',
        seoDescription: 'd',
        tags: ['Alpha', 'beta'],
        category: 'News',
      });
      expect(result.article).toEqual(expect.objectContaining({ id: 'a1', title: 'Existing title' }));
      expect(result.id).toBe('r1');
    });

    it('uses tag and category values when labels are blank', async () => {
      reviewRepository.findOne.mockResolvedValue(pendingReview());
      articleService.findById.mockResolvedValue({
        ...ARTICLE_CONTEXT,
        tags: [
          { label: '', value: 'from-value' },
          { label: 'Labeled', value: 'other' },
          { label: '', value: '' },
        ],
        category: { value: 'from-cat' },
      } as never);

      const result = await service.getReview('r1');

      expect(result.current.tags).toEqual(['from-value', 'Labeled']);
      expect(result.current.category).toBe('from-cat');
    });

    it('returns empty comparable fields when article values are null', async () => {
      reviewRepository.findOne.mockResolvedValue(pendingReview({ proposedJson: '{"title":"Only"}' }));
      articleService.findById.mockResolvedValue({
        id: 'a1',
        title: null,
        content: null,
        summary: null,
        slug: null,
        seoKeywords: null,
        seoDescription: null,
        tags: [{ label: '', value: '' }],
        category: { label: '', value: '' },
      } as never);

      const result = await service.getReview('r1');

      expect(result.proposed).toEqual({ title: 'Only' });
      expect(result.current).toEqual({
        title: '',
        content: '',
        summary: '',
        slug: '',
        seoKeywords: '',
        seoDescription: '',
        tags: [],
        category: '',
      });
    });

    it('returns a null article when lookup fails and proposed JSON is invalid', async () => {
      reviewRepository.findOne.mockResolvedValue(pendingReview({ articleId: 'gone', proposedJson: '{' }));
      articleService.findById.mockRejectedValue(new Error('missing'));

      const result = await service.getReview('r1');

      expect(result.article).toBeNull();
      expect(result.proposed).toEqual({});
      expect(result.current).toEqual({
        title: '',
        content: '',
        summary: '',
        slug: '',
        seoKeywords: '',
        seoDescription: '',
        tags: [],
        category: '',
      });
    });
  });

  describe('approveReview', () => {
    it('throws when the review does not exist', async () => {
      await expect(service.approveReview('missing', 1)).rejects.toMatchObject({
        response: ApiMsg.AI_REVIEW_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
      expect(articleService.updateById).not.toHaveBeenCalled();
      expect(reviewRepository.save).not.toHaveBeenCalled();
    });

    it('throws when the review is not pending', async () => {
      reviewRepository.findOne.mockResolvedValue(pendingReview({ status: 'rejected' }));

      await expect(service.approveReview('r1', 1)).rejects.toMatchObject({
        response: ApiMsg.AI_REVIEW_NOT_PENDING,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(articleService.updateById).not.toHaveBeenCalled();
    });

    it('throws when the schedule is not a date', async () => {
      reviewRepository.findOne.mockResolvedValue(pendingReview());

      await expect(service.approveReview('r1', 1, { scheduledPublishAt: 'not-a-date' })).rejects.toMatchObject({
        response: ApiMsg.AI_SCHEDULE_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(articleService.updateById).not.toHaveBeenCalled();
    });

    it('throws when the schedule is in the past', async () => {
      reviewRepository.findOne.mockResolvedValue(pendingReview());

      await expect(
        service.approveReview('r1', 1, { scheduledPublishAt: '2001-01-01T00:00:00.000Z' })
      ).rejects.toMatchObject({
        response: ApiMsg.AI_SCHEDULE_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(articleService.updateById).not.toHaveBeenCalled();
    });

    it('throws when the schedule is the current instant', async () => {
      const now = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      reviewRepository.findOne.mockResolvedValue(pendingReview());

      await expect(
        service.approveReview('r1', 1, { scheduledPublishAt: new Date(now).toISOString() })
      ).rejects.toMatchObject({
        response: ApiMsg.AI_SCHEDULE_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(articleService.updateById).not.toHaveBeenCalled();
    });

    it('publishes immediately, keeps the category, and stores approver 0', async () => {
      const row = pendingReview({
        proposedJson: JSON.stringify({ title: '  Approved Title  ', slug: 'Approved Slug' }),
      });
      reviewRepository.findOne.mockResolvedValue(row);
      const qb = installSlugQb();

      const result = await service.approveReview('r1', 0);

      expect(articleService.updateById).toHaveBeenNthCalledWith(1, 'a1', {
        title: 'Approved Title',
        slug: 'approved-slug',
      });
      expect(articleService.updateById).toHaveBeenNthCalledWith(2, 'a1', {
        status: 'publish',
        category: 'cat-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('article.id != :excludeId', { excludeId: 'a1' });
      expect(row.status).toBe('approved');
      expect(row.approvedBy).toBe(0);
      expect(reviewRepository.save).toHaveBeenCalledWith(row);
      expect(result.review).toBe(row);
      expect(result.scheduledPublishAt).toBeNull();
      expect(result.article).toEqual({ id: 'a1', status: 'publish', category: 'cat-1' });
    });

    it('schedules a future publish when the article has no category', async () => {
      const row = pendingReview();
      reviewRepository.findOne.mockResolvedValue(row);
      articleService.findById.mockResolvedValue({ id: 'a1' } as Article);
      const when = '  2099-06-01T00:00:00.000Z  ';

      const result = await service.approveReview('r1', 8, { scheduledPublishAt: when });

      expect(articleService.updateById).toHaveBeenNthCalledWith(1, 'a1', {});
      expect(articleService.updateById).toHaveBeenLastCalledWith('a1', {
        status: 'draft',
        scheduledPublishAt: new Date('2099-06-01T00:00:00.000Z'),
      });
      expect(result.scheduledPublishAt).toBe('2099-06-01T00:00:00.000Z');
      expect(row.approvedBy).toBe(8);
      expect(row.status).toBe('approved');
    });

    it('treats a blank schedule as immediate publish and stores a null approver', async () => {
      const row = pendingReview();
      reviewRepository.findOne.mockResolvedValue(row);
      articleService.findById.mockResolvedValue({ id: 'a1', category: { label: 'Orphan' } } as Article);

      const result = await service.approveReview('r1', undefined, { scheduledPublishAt: '   ' });

      expect(articleService.updateById).toHaveBeenLastCalledWith('a1', { status: 'publish' });
      expect(row.approvedBy).toBeNull();
      expect(result.scheduledPublishAt).toBeNull();
    });

    it('publishes when the article lookup returns null', async () => {
      const row = pendingReview();
      reviewRepository.findOne.mockResolvedValue(row);
      articleService.findById.mockResolvedValue(null as never);

      const result = await service.approveReview('r1', 2);

      expect(articleService.updateById).toHaveBeenLastCalledWith('a1', { status: 'publish' });
      expect(row.approvedBy).toBe(2);
      expect(result.article).toEqual({ id: 'a1', status: 'publish' });
    });

    it('publishes when proposed JSON cannot be parsed', async () => {
      const row = pendingReview({ proposedJson: 'not-json' });
      reviewRepository.findOne.mockResolvedValue(row);

      await service.approveReview('r1', 4);

      expect(articleService.updateById).toHaveBeenNthCalledWith(1, 'a1', {});
      expect(articleService.updateById).toHaveBeenNthCalledWith(2, 'a1', {
        status: 'publish',
        category: 'cat-1',
      });
      expect(row.approvedBy).toBe(4);
    });
  });

  describe('rejectReview', () => {
    it('throws when the review does not exist', async () => {
      await expect(service.rejectReview('missing')).rejects.toMatchObject({
        response: ApiMsg.AI_REVIEW_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
      expect(reviewRepository.save).not.toHaveBeenCalled();
    });

    it('throws when the review is not pending', async () => {
      reviewRepository.findOne.mockResolvedValue(pendingReview({ status: 'approved' }));

      await expect(service.rejectReview('r1')).rejects.toMatchObject({
        response: ApiMsg.AI_REVIEW_NOT_PENDING,
        status: HttpStatus.BAD_REQUEST,
      });
      expect(reviewRepository.save).not.toHaveBeenCalled();
    });

    it('marks the review rejected', async () => {
      const row = pendingReview();
      reviewRepository.findOne.mockResolvedValue(row);

      const result = await service.rejectReview('r1');

      expect(row.status).toBe('rejected');
      expect(result).toBe(row);
      expect(reviewRepository.save).toHaveBeenCalledWith(row);
      expect(articleService.updateById).not.toHaveBeenCalled();
    });
  });
});
