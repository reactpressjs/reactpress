import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: jest.Mocked<Pick<WebhookService, 'findAll' | 'create' | 'remove'>>;

  beforeEach(async () => {
    webhookService = {
      findAll: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [{ provide: WebhookService, useValue: webhookService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(WebhookController);
  });

  it('delegates list', () => {
    webhookService.findAll.mockReturnValue([] as never);
    controller.list();
    expect(webhookService.findAll).toHaveBeenCalled();
  });

  it('delegates create', () => {
    const body = { url: 'https://x', events: 'article.published' };
    webhookService.create.mockResolvedValue({ id: '1' } as never);
    controller.create(body);
    expect(webhookService.create).toHaveBeenCalledWith(body);
  });

  it('delegates remove', () => {
    webhookService.remove.mockResolvedValue({ id: '1' } as never);
    controller.remove('1');
    expect(webhookService.remove).toHaveBeenCalledWith('1');
  });
});
