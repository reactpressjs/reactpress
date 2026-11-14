import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import { ArticleService } from '../article/article.service';
import { HookService } from '../hook/hook.service';
import { SettingService } from '../setting/setting.service';
import { SMTPService } from '../smtp/smtp.service';
import { UserService } from '../user/user.service';
import { WebhookService } from '../webhook/webhook.service';
import { Comment } from './comment.entity';
import { CommentService } from './comment.service';

jest.mock('../../utils/markdown.util', () => ({
  marked: jest.fn(() => ({ html: '<p>hi</p>' })),
}));

jest.mock('../../utils/html-sanitize.util', () => ({
  sanitizeHtml: jest.fn((h: string) => h),
}));

jest.mock('../../utils/ua.util', () => ({
  parseUserAgent: jest.fn(() => ({ text: 'jest-agent' })),
}));

function chainableQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  return qb;
}

describe('CommentService', () => {
  let service: CommentService;
  let repository: jest.Mocked<
    Pick<Repository<Comment>, 'create' | 'save' | 'merge' | 'remove' | 'findOne' | 'createQueryBuilder'>
  >;
  let hookService: jest.Mocked<Pick<HookService, 'applyFilters' | 'doAction'>>;
  let settingService: jest.Mocked<Pick<SettingService, 'findAll'>>;
  let smtpService: jest.Mocked<Pick<SMTPService, 'create'>>;
  let userService: jest.Mocked<Pick<UserService, 'findAll'>>;
  let webhookService: jest.Mocked<Pick<WebhookService, 'dispatch'>>;

  beforeEach(async () => {
    repository = {
      create: jest.fn((c) => c as Comment),
      save: jest.fn(async (c) => ({ ...c, id: 'c1' }) as Comment),
      merge: jest.fn((old, patch) => ({ ...old, ...patch }) as Comment),
      remove: jest.fn(async (c) => c),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    hookService = {
      applyFilters: jest.fn(async (_name, payload) => payload),
      doAction: jest.fn(async () => undefined),
    };
    settingService = {
      findAll: jest.fn().mockResolvedValue({
        smtpFromUser: 'noreply@test.io',
        systemUrl: 'https://site.test',
        systemTitle: 'Site',
      }),
    };
    smtpService = { create: jest.fn().mockResolvedValue(undefined) };
    userService = { findAll: jest.fn().mockResolvedValue([[{ name: 'Admin', email: 'admin@test.io' }], 1]) };
    webhookService = { dispatch: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: getRepositoryToken(Comment), useValue: repository },
        { provide: ArticleService, useValue: {} },
        { provide: SMTPService, useValue: smtpService },
        { provide: SettingService, useValue: settingService },
        { provide: UserService, useValue: userService },
        { provide: WebhookService, useValue: webhookService },
        { provide: HookService, useValue: hookService },
      ],
    }).compile();

    service = module.get(CommentService);
    jest.clearAllMocks();
    hookService.applyFilters.mockImplementation(async (_n, payload) => payload);
  });

  describe('create', () => {
    it('requires hostId, name, email, and content', async () => {
      await expect(service.create('ua', {})).rejects.toMatchObject({
        response: ApiMsg.MISSING_PARAMS,
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws when hook rejects creation', async () => {
      hookService.applyFilters.mockResolvedValue({
        hostId: 'a1',
        name: 'n',
        email: 'e@e.com',
        content: 'c',
        __hookReject: { message: 'blocked', statusCode: 403 },
      });

      await expect(
        service.create('ua', { hostId: 'a1', name: 'n', email: 'e@e.com', content: 'c' })
      ).rejects.toMatchObject({ response: 'blocked', status: 403 });
    });

    it('creates comment, emails admins, and dispatches webhook', async () => {
      const saved = await service.create('ua', {
        hostId: 'a1',
        name: 'Guest',
        email: 'g@g.com',
        content: 'hello',
      });

      expect(saved.id).toBe('c1');
      expect(smtpService.create).toHaveBeenCalled();
      expect(webhookService.dispatch).toHaveBeenCalledWith('comment.created', expect.any(Object));
      expect(hookService.doAction).toHaveBeenCalledWith('comment.afterCreate', expect.any(Object));
    });

    it('logs when the admin notification email fails', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      smtpService.create.mockRejectedValue(new Error('smtp down'));
      await service.create('ua', { hostId: 'a1', name: 'Guest', email: 'g@g.com', content: 'hello' });
      await new Promise((resolve) => setImmediate(resolve));
      expect(log).toHaveBeenCalledWith('收到新评论，但发送邮件通知失败');
      log.mockRestore();
    });

    it('logs when admin lookup fails', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      userService.findAll.mockRejectedValue(new Error('db down'));
      await service.create('ua', { hostId: 'a1', name: 'Guest', email: 'g@g.com', content: 'hello' });
      expect(log).toHaveBeenCalledWith(expect.any(Error));
      log.mockRestore();
    });

    it('skips admin email when createByAdmin is true', async () => {
      await service.create('ua', {
        hostId: 'a1',
        name: 'Guest',
        email: 'g@g.com',
        content: 'hello',
        createByAdmin: true,
      });
      expect(smtpService.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('paginates comments', async () => {
      const qb = chainableQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: '1' }], 1]),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);
      const [rows, total] = await service.findAll({ page: 1, pass: true, name: 'a' });
      expect(total).toBe(1);
      expect(rows).toHaveLength(1);
    });
  });

  describe('getArticleComments', () => {
    it('loads child comments for each top-level row', async () => {
      const parent = { id: 'p1' } as Comment;
      const child = { id: 'c1' } as Comment;
      const rootQb = chainableQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[parent], 1]),
      });
      const subQb = chainableQueryBuilder({
        getMany: jest.fn().mockResolvedValue([child]),
      });
      repository.createQueryBuilder.mockReturnValueOnce(rootQb as never).mockReturnValue(subQb as never);

      const [rows] = await service.getArticleComments('host1', { page: 1, pageSize: 10 });
      expect(rows[0].children).toEqual([child]);
    });
  });

  describe('updateById', () => {
    it('sends reply email when pass and reply user fields present', async () => {
      const old = { id: 'c1', pass: false } as Comment;
      repository.findOne.mockResolvedValue(old);
      repository.merge.mockReturnValue({
        ...old,
        pass: true,
        replyUserName: 'Alice',
        replyUserEmail: 'alice@test.io',
        url: '/post/1',
      } as Comment);

      await service.updateById('c1', { pass: true });
      expect(smtpService.create).toHaveBeenCalled();
    });

    it('logs when the reply notification email fails', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const old = { id: 'c1', pass: false } as Comment;
      repository.findOne.mockResolvedValue(old);
      repository.merge.mockReturnValue({
        ...old,
        pass: true,
        replyUserName: 'Alice',
        replyUserEmail: 'alice@test.io',
        url: '/post/1',
      } as Comment);
      smtpService.create.mockRejectedValue(new Error('smtp down'));

      await service.updateById('c1', { pass: true });
      await new Promise((resolve) => setImmediate(resolve));
      expect(log).toHaveBeenCalledWith(expect.stringContaining('alice@test.io'));
      log.mockRestore();
    });
  });

  describe('deleteById', () => {
    it('removes comment row', async () => {
      const row = { id: 'c1' } as Comment;
      repository.findOne.mockResolvedValue(row);
      await expect(service.deleteById('c1')).resolves.toBe(row);
    });
  });

  describe('findById', () => {
    it('returns comment by id', async () => {
      const row = { id: 'c1' } as Comment;
      repository.findOne.mockResolvedValue(row);
      await expect(service.findById('c1')).resolves.toBe(row);
    });
  });
});
