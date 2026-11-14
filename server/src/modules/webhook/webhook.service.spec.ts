import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import { Webhook } from './webhook.entity';
import { WebhookService } from './webhook.service';

jest.mock('axios');
// Keep real createHash — Nest TestingModule hashes provider tokens with it.
// Automocking the whole module makes `createHash().update` undefined.
jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    randomBytes: jest.fn((size: number) => actual.randomBytes(size)),
    createHmac: jest.fn((algorithm: string, key: string) => actual.createHmac(algorithm, key)),
  };
});

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedCrypto = crypto as jest.Mocked<typeof crypto>;

function chainableQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return qb;
}

describe('WebhookService', () => {
  let service: WebhookService;
  let repository: jest.Mocked<
    Pick<Repository<Webhook>, 'create' | 'save' | 'find' | 'findOne' | 'remove' | 'createQueryBuilder'>
  >;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookService, { provide: getRepositoryToken(Webhook), useValue: repository }],
    }).compile();

    service = module.get(WebhookService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('uses provided secret', async () => {
      const entity = { url: 'https://example.com/hook', events: 'article.published', secret: 'sec' } as Webhook;
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue({ ...entity, id: 'w1' } as Webhook);

      await expect(service.create({ url: entity.url, events: entity.events, secret: 'sec' })).resolves.toMatchObject({
        id: 'w1',
      });
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ secret: 'sec' }));
    });

    it('generates a secret when omitted', async () => {
      mockedCrypto.randomBytes.mockReturnValue(Buffer.from('a'.repeat(16)) as never);
      const entity = { url: 'https://example.com', events: 'comment.created' } as Webhook;
      repository.create.mockImplementation((d) => d as Webhook);
      repository.save.mockResolvedValue({ ...entity, id: 'w2' } as Webhook);

      await service.create({ url: entity.url, events: entity.events });
      expect(mockedCrypto.randomBytes).toHaveBeenCalledWith(16);
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ secret: expect.any(String) }));
    });
  });

  describe('findAll', () => {
    it('orders by createAt DESC', async () => {
      const rows = [{ id: '1' }] as Webhook[];
      repository.find.mockResolvedValue(rows);

      await expect(service.findAll()).resolves.toBe(rows);
      expect(repository.find).toHaveBeenCalledWith({ order: { createAt: 'DESC' } });
    });
  });

  describe('remove', () => {
    it('throws when webhook is missing', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toMatchObject({
        response: ApiMsg.WEBHOOK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'missing' } });
    });

    it('removes an existing webhook', async () => {
      const hook = { id: '1' } as Webhook;
      repository.findOne.mockResolvedValue(hook);
      repository.remove.mockResolvedValue(hook);

      await expect(service.remove('1')).resolves.toBe(hook);
    });
  });

  describe('dispatch', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      const hmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('sig'),
      };
      mockedCrypto.createHmac.mockReturnValue(hmac as never);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('delivers to enabled hooks subscribed to the event', async () => {
      const hooks = [
        {
          id: '1',
          url: 'https://hook.test/a',
          secret: 'secret-a',
          enabled: true,
          events: 'article.published, comment.created',
        },
        {
          id: '2',
          url: 'https://hook.test/b',
          secret: 'secret-b',
          enabled: true,
          events: 'comment.created',
        },
      ] as Webhook[];
      const qb = chainableQueryBuilder({ getMany: jest.fn().mockResolvedValue(hooks) });
      repository.createQueryBuilder.mockReturnValue(qb as never);
      mockedAxios.post.mockResolvedValue({ status: 200 } as never);

      const dispatchPromise = service.dispatch('article.published', { id: 'post-1' });
      await jest.runAllTimersAsync();
      await dispatchPromise;

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://hook.test/a',
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-ReactPress-Event': 'article.published',
            'X-ReactPress-Signature': 'sha256=sig',
          }),
          timeout: 10000,
        })
      );
    });

    it('retries and logs after all attempts fail', async () => {
      const hooks = [
        {
          id: '1',
          url: 'https://hook.test/fail',
          secret: 's',
          enabled: true,
          events: 'comment.created',
        },
      ] as Webhook[];
      const qb = chainableQueryBuilder({ getMany: jest.fn().mockResolvedValue(hooks) });
      repository.createQueryBuilder.mockReturnValue(qb as never);
      mockedAxios.post.mockRejectedValue(new Error('network'));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      const dispatchPromise = service.dispatch('comment.created', { id: 'c1' });
      await jest.runAllTimersAsync();
      await dispatchPromise;

      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
