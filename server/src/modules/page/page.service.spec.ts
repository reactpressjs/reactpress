import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import * as dateUtil from '../../utils/date.util';
import { Page } from './page.entity';
import { PageService } from './page.service';

function chainableQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  return qb;
}

describe('PageService', () => {
  let service: PageService;
  let repository: jest.Mocked<
    Pick<Repository<Page>, 'findOne' | 'create' | 'save' | 'merge' | 'remove' | 'createQueryBuilder'>
  >;
  let dateFormatSpy: jest.SpyInstance;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PageService,
        {
          provide: getRepositoryToken(Page),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(PageService);
    jest.clearAllMocks();
    dateFormatSpy = jest.spyOn(dateUtil, 'dateFormat').mockReturnValue('2020-01-01 00:00:00');
  });

  afterEach(() => {
    dateFormatSpy.mockRestore();
  });

  describe('create', () => {
    it('throws when path exists', async () => {
      repository.findOne.mockResolvedValue({ id: '1', path: '/about' } as Page);
      await expect(service.create({ path: '/about' })).rejects.toMatchObject({
        response: ApiMsg.PAGE_EXISTS,
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('sets publishAt when status is publish', async () => {
      repository.findOne.mockResolvedValue(null);
      const entity = { path: '/about', status: 'publish' } as Page;
      const saved = { ...entity, id: 'p1' } as Page;
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(saved);

      await expect(service.create({ path: '/about', status: 'publish' })).resolves.toBe(saved);
      expect(dateFormatSpy).toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/about', publishAt: '2020-01-01 00:00:00' })
      );
    });

    it('keeps provided publishAt for non-publish status', async () => {
      repository.findOne.mockResolvedValue(null);
      const entity = { path: '/draft', status: 'draft', publishAt: 'old' } as Page;
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(entity);

      await service.create({ path: '/draft', status: 'draft', publishAt: 'old' });
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ publishAt: 'old' }));
      expect(dateFormatSpy).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('paginates and filters by status and whitelist columns', async () => {
      const qb = chainableQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: '1' }], 1]),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.findAll({ page: '2', pageSize: '10', status: 'publish', name: 'hello' });

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.andWhere).toHaveBeenCalledWith('page.status=:status');
      expect(qb.setParameter).toHaveBeenCalledWith('status', 'publish');
      expect(qb.andWhere).toHaveBeenCalledWith('page.name LIKE :name');
      expect(result).toEqual([[{ id: '1' }], 1]);
    });

    it('returns all pages when queryParams is not an object branch', async () => {
      const qb = chainableQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      await service.findAll(null as never);
      expect(qb.skip).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('queries by id or path', async () => {
      const page = { id: '1', path: '/x' } as Page;
      const qb = chainableQueryBuilder({ getOne: jest.fn().mockResolvedValue(page) });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      await expect(service.findById('/x')).resolves.toBe(page);
      expect(qb.setParameter).toHaveBeenCalledWith('id', '/x');
      expect(qb.setParameter).toHaveBeenCalledWith('path', '/x');
    });
  });

  describe('updateViewsById', () => {
    it('increments views', async () => {
      const old = { id: '1', views: 5 } as Page;
      const merged = { ...old, views: 6 } as Page;
      repository.findOne.mockResolvedValue(old);
      repository.merge.mockReturnValue(merged);
      repository.save.mockResolvedValue(merged);

      await expect(service.updateViewsById('1')).resolves.toBe(merged);
      expect(repository.merge).toHaveBeenCalledWith(old, { views: 6 });
    });
  });

  describe('updateById', () => {
    it('sets publishAt on publish transition', async () => {
      const old = { id: '1', publishAt: 'old-date' } as Page;
      const merged = { id: '1', status: 'publish', publishAt: '2020-01-01 00:00:00' } as Page;
      repository.findOne.mockResolvedValue(old);
      repository.merge.mockReturnValue(merged);
      repository.save.mockResolvedValue(merged);

      await expect(service.updateById('1', { status: 'publish' })).resolves.toBe(merged);
      expect(repository.merge).toHaveBeenCalledWith(
        old,
        expect.objectContaining({ status: 'publish', publishAt: '2020-01-01 00:00:00' })
      );
    });

    it('preserves old publishAt when not publishing', async () => {
      const old = { id: '1', publishAt: 'keep' } as Page;
      repository.findOne.mockResolvedValue(old);
      repository.merge.mockImplementation((_o, patch) => ({ ...old, ...patch }) as Page);
      repository.save.mockImplementation((p) => Promise.resolve(p));

      await service.updateById('1', { title: 'New' });
      expect(repository.merge).toHaveBeenCalledWith(old, expect.objectContaining({ publishAt: 'keep', title: 'New' }));
    });
  });

  describe('deleteById', () => {
    it('removes the page', async () => {
      const page = { id: '1' } as Page;
      repository.findOne.mockResolvedValue(page);
      repository.remove.mockResolvedValue(page);

      await expect(service.deleteById('1')).resolves.toBe(page);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });
});
