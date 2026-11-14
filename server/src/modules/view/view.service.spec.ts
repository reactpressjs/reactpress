import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as ipUtil from '../../utils/ip.util';
import * as uaUtil from '../../utils/ua.util';
import { View } from './view.entity';
import { ViewService } from './view.service';

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

describe('ViewService', () => {
  let service: ViewService;
  let repository: jest.Mocked<
    Pick<Repository<View>, 'findOne' | 'create' | 'save' | 'merge' | 'remove' | 'find' | 'createQueryBuilder'>
  >;
  let parseIpSpy: jest.SpyInstance;
  let parseUserAgentSpy: jest.SpyInstance;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      remove: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViewService,
        {
          provide: getRepositoryToken(View),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(ViewService);
    jest.clearAllMocks();
    parseIpSpy = jest.spyOn(ipUtil, 'parseIp').mockReturnValue('127.0.0.1|local');
    parseUserAgentSpy = jest
      .spyOn(uaUtil, 'parseUserAgent')
      .mockReturnValue({ data: { browser: 'Chrome', os: 'macOS' } } as never);
  });

  afterEach(() => {
    parseIpSpy.mockRestore();
    parseUserAgentSpy.mockRestore();
  });

  describe('create', () => {
    it('increments count when a matching view exists', async () => {
      const exist = { id: '1', ip: '1.1.1.1', userAgent: 'ua', url: '/a', count: 3 } as View;
      const merged = { ...exist, count: 4 } as View;
      repository.findOne.mockResolvedValue(exist);
      repository.merge.mockReturnValue(merged);
      repository.save.mockResolvedValue(merged);

      await expect(service.create('1.1.1.1', 'ua', '/a')).resolves.toBe(merged);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { ip: '1.1.1.1', userAgent: 'ua', url: '/a' },
      });
      expect(repository.merge).toHaveBeenCalledWith(exist, { count: 4 });
    });

    it('creates a new view with parsed UA and IP', async () => {
      repository.findOne.mockResolvedValue(null);
      const entity = {
        ip: '2.2.2.2',
        userAgent: 'Mozilla',
        url: '/b',
        address: '127.0.0.1|local',
        browser: 'Chrome',
        os: 'macOS',
      } as View;
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue({ ...entity, id: 'v1' } as View);

      const result = await service.create('2.2.2.2', 'Mozilla', '/b');

      expect(parseUserAgentSpy).toHaveBeenCalledWith('Mozilla');
      expect(parseIpSpy).toHaveBeenCalledWith('2.2.2.2');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: '2.2.2.2',
          browser: 'Chrome',
          address: '127.0.0.1|local',
        })
      );
      expect(result.id).toBe('v1');
    });
  });

  describe('findAll', () => {
    it('paginates and applies LIKE filters', async () => {
      const qb = chainableQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: '1' }], 1]),
      });
      repository.createQueryBuilder.mockReturnValue(qb as never);

      await service.findAll({ page: '1', pageSize: '5', url: '/home' });

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(qb.andWhere).toHaveBeenCalledWith('view.url LIKE :url');
      expect(qb.setParameter).toHaveBeenCalledWith('url', '%/home%');
    });
  });

  describe('findByUrl', () => {
    it('finds views ordered by updateAt', async () => {
      const rows = [{ id: '1' }] as View[];
      repository.find.mockResolvedValue(rows);

      await expect(service.findByUrl('/x')).resolves.toBe(rows);
      expect(repository.find).toHaveBeenCalledWith({
        where: { url: '/x' },
        order: { updateAt: 'ASC' },
      });
    });
  });

  describe('findById', () => {
    it('finds by primary key', async () => {
      const row = { id: '1' } as View;
      repository.findOne.mockResolvedValue(row);

      await expect(service.findById('1')).resolves.toBe(row);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('deleteById', () => {
    it('removes the view row', async () => {
      const row = { id: '1' } as View;
      repository.findOne.mockResolvedValue(row);
      repository.remove.mockResolvedValue(row);

      await expect(service.deleteById('1')).resolves.toBe(row);
    });
  });
});
