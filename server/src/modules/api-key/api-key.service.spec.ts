import { HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';

import { ApiMsg } from '../../common/api-messages';
import { ApiKey } from './api-key.entity';
import { ApiKeyService } from './api-key.service';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let repository: jest.Mocked<
    Pick<Repository<ApiKey>, 'create' | 'save' | 'find' | 'findOne' | 'update' | 'createQueryBuilder'>
  >;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    jest.clearAllMocks();
    jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('a'.repeat(24)) as never);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash-value' as never);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
    service = new ApiKeyService(repository as unknown as Repository<ApiKey>);
  });

  describe('create', () => {
    it('hashes a generated key and persists the entity', async () => {
      repository.create.mockImplementation((payload) => payload as ApiKey);
      repository.save.mockImplementation(async (entity) => ({ ...entity, id: 'id-1' }) as ApiKey);

      const result = await service.create('CI', 'read,write');

      expect(result.rawKey).toMatch(/^rp_[0-9a-f]+$/);
      expect(result.rawKey.slice(0, 10)).toBe(result.apiKey.keyPrefix);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CI',
          scopes: 'read,write',
          enabled: true,
          keyPrefix: result.rawKey.slice(0, 10),
        })
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(result.rawKey, 10);
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns keys ordered by create date', async () => {
      const rows = [{ id: '1' }] as ApiKey[];
      repository.find.mockResolvedValue(rows);
      await expect(service.findAll()).resolves.toBe(rows);
      expect(repository.find).toHaveBeenCalledWith({ order: { createAt: 'DESC' } });
    });
  });

  describe('revoke', () => {
    it('throws when the key is missing', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.revoke('missing')).rejects.toThrow(HttpException);
      try {
        await service.revoke('missing');
      } catch (error) {
        expect((error as HttpException).getResponse()).toBe(ApiMsg.API_KEY_NOT_FOUND);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('disables an existing key', async () => {
      const key = { id: 'k1', enabled: true } as ApiKey;
      repository.findOne.mockResolvedValue(key);
      repository.save.mockResolvedValue({ ...key, enabled: false });

      const result = await service.revoke('k1');

      expect(key.enabled).toBe(false);
      expect(repository.save).toHaveBeenCalledWith(key);
      expect(result.enabled).toBe(false);
    });
  });

  describe('validateRawKey', () => {
    it('returns null for empty or non-rp keys', async () => {
      await expect(service.validateRawKey('')).resolves.toBeNull();
      await expect(service.validateRawKey('sk_live')).resolves.toBeNull();
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns null when no bcrypt candidate matches', async () => {
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: '1', keyHash: 'h1' } as ApiKey]),
      };
      repository.createQueryBuilder.mockReturnValue(qb as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateRawKey('rp_abcdefgh')).resolves.toBeNull();
      expect(qb.andWhere).toHaveBeenCalledWith('api_key.keyPrefix = :prefix', { prefix: 'rp_abcdefg' });
    });

    it('updates lastUsedAt and returns a matching key', async () => {
      const candidate = { id: '1', keyHash: 'h1' } as ApiKey;
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([candidate]),
      };
      repository.createQueryBuilder.mockReturnValue(qb as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      repository.update.mockResolvedValue({ affected: 1 } as never);
      const before = Date.now();

      const result = await service.validateRawKey('rp_abcdefgh');

      expect(result).toBe(candidate);
      expect(candidate.lastUsedAt).toBeInstanceOf(Date);
      expect(candidate.lastUsedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(repository.update).toHaveBeenCalledWith(candidate.id, { lastUsedAt: candidate.lastUsedAt });
    });
  });

  describe('hasScope', () => {
    it('checks comma-separated scopes and wildcard', () => {
      const key = { scopes: 'read, write' } as ApiKey;
      expect(service.hasScope(key, 'read')).toBe(true);
      expect(service.hasScope(key, 'write')).toBe(true);
      expect(service.hasScope(key, 'delete')).toBe(false);
      expect(service.hasScope({ scopes: '*' } as ApiKey, 'anything')).toBe(true);
      expect(service.hasScope({} as ApiKey, 'read')).toBe(true);
    });
  });
});
