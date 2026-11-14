import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SMTP } from './smtp.entity';
import { SMTPController } from './smtp.controller';
import { SMTPService } from './smtp.service';

describe('SMTPController', () => {
  let controller: SMTPController;
  let smtpService: jest.Mocked<Pick<SMTPService, 'create' | 'testSend' | 'findAll' | 'deleteById'>>;

  beforeEach(async () => {
    smtpService = {
      create: jest.fn(),
      testSend: jest.fn(),
      findAll: jest.fn(),
      deleteById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SMTPController],
      providers: [{ provide: SMTPService, useValue: smtpService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SMTPController);
  });

  it('delegates create', () => {
    const body = { to: 'a@b.com', subject: 'Hi' };
    smtpService.create.mockResolvedValue(body as SMTP);
    controller.create(body);
    expect(smtpService.create).toHaveBeenCalledWith(body);
  });

  it('delegates testSend', () => {
    smtpService.testSend.mockResolvedValue({ ok: true });
    controller.testSend({ to: 'a@b.com' });
    expect(smtpService.testSend).toHaveBeenCalledWith({ to: 'a@b.com' });
  });

  it('delegates findAll', () => {
    smtpService.findAll.mockResolvedValue([[], 0]);
    controller.findAll({ page: 1 });
    expect(smtpService.findAll).toHaveBeenCalledWith({ page: 1 });
  });

  it('delegates deleteById', () => {
    smtpService.deleteById.mockResolvedValue({ id: '1' } as SMTP);
    controller.deleteById('1');
    expect(smtpService.deleteById).toHaveBeenCalledWith('1');
  });
});
