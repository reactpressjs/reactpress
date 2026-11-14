import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

describe('AiController', () => {
  let controller: AiController;
  let aiService: jest.Mocked<
    Pick<
      AiService,
      | 'getStatus'
      | 'testConnection'
      | 'runSkill'
      | 'streamAgentChat'
      | 'createDraftFromAgentMarkdown'
      | 'listReviews'
      | 'getReview'
      | 'approveReview'
      | 'rejectReview'
    >
  >;

  beforeEach(async () => {
    aiService = {
      getStatus: jest.fn(),
      testConnection: jest.fn(),
      runSkill: jest.fn(),
      streamAgentChat: jest.fn(),
      createDraftFromAgentMarkdown: jest.fn(),
      listReviews: jest.fn(),
      getReview: jest.fn(),
      approveReview: jest.fn(),
      rejectReview: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: aiService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AiController);
  });

  it('delegates status', () => {
    aiService.getStatus.mockResolvedValue({ enabled: true } as never);
    expect(controller.status()).toEqual(aiService.getStatus());
  });

  it('delegates test connection', () => {
    const body = { apiKey: 'k' };
    aiService.testConnection.mockResolvedValue({ ok: true, model: 'm' });
    expect(controller.test(body)).toEqual(aiService.testConnection(body));
  });

  it('delegates runSkill', () => {
    const body = { skillId: 'write', brief: 'hi' };
    aiService.runSkill.mockResolvedValue({ skillId: 'write' } as never);
    expect(controller.runSkill(body)).toEqual(aiService.runSkill(body));
  });

  it('delegates listReviews', () => {
    const query = { page: 2 };
    aiService.listReviews.mockResolvedValue({ data: [], total: 0, page: 2, pageSize: 20 });
    expect(controller.listReviews(query)).toEqual(aiService.listReviews(query));
  });

  it('delegates getReview', () => {
    aiService.getReview.mockResolvedValue({ id: 'r1' } as never);
    expect(controller.getReview('r1')).toEqual(aiService.getReview('r1'));
  });

  it('delegates approve with user id from req.user.id', async () => {
    aiService.approveReview.mockResolvedValue({ review: { id: 'r1' } } as never);
    await controller.approve('r1', { user: { id: 9 } }, { scheduledPublishAt: '2099-01-01T00:00:00.000Z' });
    expect(aiService.approveReview).toHaveBeenCalledWith('r1', 9, {
      scheduledPublishAt: '2099-01-01T00:00:00.000Z',
    });
  });

  it('delegates approve with userId fallback', async () => {
    aiService.approveReview.mockResolvedValue({ review: { id: 'r1' } } as never);
    await controller.approve('r1', { user: { userId: 3 } }, {});
    expect(aiService.approveReview).toHaveBeenCalledWith('r1', 3, {});
  });

  it('delegates reject', () => {
    aiService.rejectReview.mockResolvedValue({ id: 'r1', status: 'rejected' } as never);
    expect(controller.reject('r1')).toEqual(aiService.rejectReview('r1'));
  });

  it('streams agent chat over SSE', async () => {
    aiService.streamAgentChat.mockImplementation(async (_body, write) => {
      write({ type: 'delta', text: 'Hi' });
      write({ type: 'done', model: 'm' });
    });
    const writes: string[] = [];
    const flush = jest.fn();
    const res = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      flush,
      socket: { setNoDelay: jest.fn() },
      write: jest.fn((chunk: string) => {
        writes.push(chunk);
      }),
      end: jest.fn(),
      writableEnded: false,
    };
    const req = { on: jest.fn(), off: jest.fn() };
    await controller.agentChat({ messages: [{ role: 'user', content: 'hello' }] }, req, res as never);
    expect(aiService.streamAgentChat).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Encoding', 'identity');
    expect(writes.some((chunk) => chunk.includes('"type":"delta"'))).toBe(true);
    expect(flush).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });

  it('delegates agent draft create', () => {
    aiService.createDraftFromAgentMarkdown.mockResolvedValue({ article: { id: 'a1' } } as never);
    const body = { content: '# Hello' };
    expect(controller.createAgentDraft(body)).toEqual(aiService.createDraftFromAgentMarkdown(body));
  });
});
