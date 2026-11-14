import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import { SettingService } from '../setting/setting.service';
import * as mailUtil from './mail.util';
import { SMTP } from './smtp.entity';
import { SMTPService } from './smtp.service';

function chainableQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
  return qb;
}

describe('SMTPService', () => {
  let service: SMTPService;
  let repository: jest.Mocked<Pick<Repository<SMTP>, 'findOne' | 'create' | 'save' | 'remove' | 'createQueryBuilder'>>;
  let settingService: jest.Mocked<Pick<SettingService, 'findAll'>>;
  let sendEmailSpy: jest.SpyInstance;

  const fullSettings = {
    smtpHost: 'smtp.test',
    smtpPort: '587',
    smtpUser: 'user@test',
    smtpPass: 'secret',
    smtpFromUser: 'from@test',
  };

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    settingService = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SMTPService,
        { provide: getRepositoryToken(SMTP), useValue: repository },
        { provide: SettingService, useValue: settingService },
      ],
    }).compile();

    service = module.get(SMTPService);
    jest.clearAllMocks();
    settingService.findAll.mockResolvedValue(fullSettings as never);
    sendEmailSpy = jest.spyOn(mailUtil, 'sendEmail').mockResolvedValue({ messageId: 'ok' } as never);
  });

  afterEach(() => {
    sendEmailSpy.mockRestore();
  });

  describe('testSend', () => {
    it('throws when recipient is empty', async () => {
      await expect(service.testSend({ to: '  ' })).rejects.toMatchObject({
        response: ApiMsg.EMAIL_REQUIRED,
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws when SMTP settings are incomplete', async () => {
      settingService.findAll.mockResolvedValue({ smtpHost: 'h' } as never);

      await expect(service.testSend({ to: 'a@b.com' })).rejects.toMatchObject({
        response: ApiMsg.EMAIL_CONFIG_INCOMPLETE,
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('sends a test email with override config', async () => {
      await expect(
        service.testSend({
          to: 'to@test.com',
          smtpHost: 'custom.smtp',
          smtpPort: '465',
          smtpUser: 'u',
          smtpPass: 'p',
          smtpFromUser: 'from@test',
        })
      ).resolves.toEqual({ ok: true });

      expect(sendEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'to@test.com',
          subject: ApiMsg.EMAIL_TEST_SUBJECT,
          html: ApiMsg.EMAIL_TEST_HTML,
        }),
        expect.objectContaining({ host: 'custom.smtp', port: '465' })
      );
    });

    it('throws EMAIL_SEND_FAILED when sendEmail rejects', async () => {
      sendEmailSpy.mockRejectedValue(new Error('fail'));

      await expect(service.testSend({ to: 'a@b.com' })).rejects.toMatchObject({
        response: ApiMsg.EMAIL_SEND_FAILED,
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('create', () => {
    it('sends mail, persists record, and sets from', async () => {
      const payload = { to: 'a@b.com', subject: 'Hello', html: '<p>Hi</p>' };
      const entity = { ...payload, from: 'from@test' } as SMTP;
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue({ ...entity, id: 'm1' } as SMTP);

      await expect(service.create(payload)).resolves.toMatchObject({ id: 'm1', from: 'from@test' });
      expect(sendEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'from@test' }),
        expect.objectContaining({ host: 'smtp.test' })
      );
    });

    it('throws EMAIL_SEND_FAILED when delivery fails', async () => {
      sendEmailSpy.mockRejectedValue(new Error('x'));

      await expect(service.create({ to: 'a@b.com' })).rejects.toMatchObject({
        response: ApiMsg.EMAIL_SEND_FAILED,
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('findAll', () => {
    it('paginates with filters', async () => {
      const qb = chainableQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: '1' }], 1]),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      await service.findAll({ page: '1', pageSize: '20', subject: 'test' });
      expect(qb.andWhere).toHaveBeenCalledWith('smtp.subject LIKE :subject');
    });
  });

  describe('deleteById', () => {
    it('removes the mail record', async () => {
      const row = { id: '1' } as SMTP;
      repository.findOne.mockResolvedValue(row);
      repository.remove.mockResolvedValue(row);

      await expect(service.deleteById('1')).resolves.toBe(row);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });
});
