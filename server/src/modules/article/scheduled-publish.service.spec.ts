import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { WebhookService } from '../webhook/webhook.service';
import { Article } from './article.entity';
import { ScheduledPublishService } from './scheduled-publish.service';

describe('ScheduledPublishService', () => {
  let service: ScheduledPublishService;
  let articleRepository: jest.Mocked<Pick<Repository<Article>, 'find' | 'save'>>;
  let webhookService: jest.Mocked<Pick<WebhookService, 'dispatch'>>;

  beforeEach(async () => {
    jest.useFakeTimers();
    articleRepository = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (a) => a),
    };
    webhookService = { dispatch: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledPublishService,
        { provide: getRepositoryToken(Article), useValue: articleRepository },
        { provide: WebhookService, useValue: webhookService },
      ],
    }).compile();

    service = module.get(ScheduledPublishService);
  });

  afterEach(() => {
    jest.useRealTimers();
    service.onModuleDestroy();
  });

  it('schedules tick on init and clears interval on destroy', async () => {
    const tickSpy = jest.spyOn(service, 'tick').mockResolvedValue(undefined);
    service.onModuleInit();
    expect(tickSpy).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('publishes due draft articles and dispatches webhooks', async () => {
    const due = {
      id: 'a1',
      title: 'Post',
      status: 'draft',
      scheduledPublishAt: new Date('2020-01-01'),
    } as Article;

    articleRepository.find.mockResolvedValue([due]);

    await service.tick();

    expect(articleRepository.find).toHaveBeenCalledWith({
      where: {
        status: 'draft',
        scheduledPublishAt: LessThanOrEqual(expect.any(Date)),
      },
    });
    expect(due.status).toBe('publish');
    expect(due.scheduledPublishAt).toBeNull();
    expect(articleRepository.save).toHaveBeenCalledWith(due);
    expect(webhookService.dispatch).toHaveBeenCalledWith(
      'article.published',
      expect.objectContaining({ id: 'a1', scheduled: true })
    );
  });
});
