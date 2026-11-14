import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as imageProcessor from '../../utils/image-processor.util';
import { SettingService } from '../setting/setting.service';
import { File } from './file.entity';
import { FileService } from './file.service';

const ossInstance = {
  hasOssConfig: jest.fn().mockResolvedValue(false),
  putFile: jest.fn().mockResolvedValue('https://oss.example/file.webp'),
  deleteFile: jest.fn().mockResolvedValue(undefined),
};

const localInstance = {
  putFile: jest.fn().mockResolvedValue(undefined),
  deleteFile: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../utils/oss.util', () => ({
  Oss: jest.fn().mockImplementation(() => ossInstance),
}));

jest.mock('../../utils/upload.util', () => ({
  LocalUpload: jest.fn().mockImplementation(() => localInstance),
}));

jest.mock('../../utils/upload-url.util', () => ({
  resolveUploadBaseUrl: jest.fn(() => 'http://localhost:3002/uploads'),
  rewriteBrokenUploadUrl: jest.fn((url: string) => url.replace(/^undefined\//, 'http://localhost:3002/uploads/')),
}));

jest.mock('../../utils/image-processor.util', () => ({
  isProcessableImage: jest.fn(),
  variantsForScene: jest.fn(() => ['large', 'medium', 'thumb']),
  processImageVariants: jest.fn(),
  buildVariantFilename: jest.fn((base: string, variant: string) => `${base.replace('.webp', '')}-${variant}.webp`),
  primaryVariantForScene: jest.fn(() => 'large'),
  listVariantFilenames: jest.fn(() => ['file-large.webp', 'file-medium.webp']),
}));

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

describe('FileService', () => {
  let service: FileService;
  let repository: jest.Mocked<Pick<Repository<File>, 'create' | 'save' | 'findOne' | 'remove' | 'createQueryBuilder'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn((f) => f as File),
      save: jest.fn(async (f) => ({ ...f, id: 'f1' }) as File),
      findOne: jest.fn(),
      remove: jest.fn(async (f) => f),
      createQueryBuilder: jest.fn(),
    };
    configService = { get: jest.fn(() => 'http://localhost:3002') };

    service = new FileService(
      repository as unknown as Repository<File>,
      {} as SettingService,
      configService as ConfigService
    );
    jest.clearAllMocks();
    ossInstance.hasOssConfig.mockResolvedValue(false);
    ossInstance.putFile.mockResolvedValue('https://oss.example/file.webp');
    ossInstance.deleteFile.mockResolvedValue(undefined);
    localInstance.putFile.mockResolvedValue(undefined);
    localInstance.deleteFile.mockResolvedValue(undefined);
    (imageProcessor.isProcessableImage as jest.Mock).mockReturnValue(false);
  });

  it('uploads non-image files locally', async () => {
    const uploaded = await service.uploadFile(
      { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 12, buffer: Buffer.from('pdf') },
      0,
      'default'
    );

    expect(localInstance.putFile).toHaveBeenCalled();
    expect(uploaded.url).toContain('http://localhost:3002/uploads/');
    expect(uploaded.id).toBe('f1');
  });

  it('uploads processable images as webp variants', async () => {
    (imageProcessor.isProcessableImage as jest.Mock).mockReturnValue(true);
    (imageProcessor.processImageVariants as jest.Mock).mockResolvedValue(
      new Map([
        ['large', { buffer: Buffer.from('img'), width: 100, height: 50, size: 99 }],
        ['medium', { buffer: Buffer.from('img'), width: 80, height: 40, size: 60 }],
        ['thumb', { buffer: Buffer.from('img'), width: 40, height: 20, size: 30 }],
      ])
    );

    const uploaded = await service.uploadFile(
      { originalname: 'photo.jpg', mimetype: 'image/jpeg', size: 1200, buffer: Buffer.from('jpg') },
      0,
      'cover'
    );

    expect(uploaded.type).toBe('image/webp');
    expect(uploaded.variants?.large).toBeDefined();
    expect(ossInstance.putFile).not.toHaveBeenCalled();
  });

  it('uses OSS when configured', async () => {
    ossInstance.hasOssConfig.mockResolvedValue(true);
    await service.uploadFile(
      { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 12, buffer: Buffer.from('pdf') },
      1,
      'default'
    );
    expect(ossInstance.putFile).toHaveBeenCalled();
  });

  it('findAll and findById rewrite broken URLs', async () => {
    const row = {
      id: 'f1',
      url: 'undefined/2020/a.webp',
      variants: { large: { url: 'undefined/2020/a-large.webp', filename: 'a-large.webp' } },
    } as File;

    const qb = chainableQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([[row], 1]) });
    repository.createQueryBuilder.mockReturnValue(qb as never);
    repository.findOne.mockResolvedValue(row);

    const [files] = await service.findAll({ page: 1, originalname: 'photo' });
    expect(files[0].url).toContain('http://localhost:3002/uploads/');
    expect(qb.andWhere).toHaveBeenCalledWith('file.originalname LIKE :originalname');

    const single = await service.findById('f1');
    expect(single.url).toContain('http://localhost:3002/uploads/');
  });

  it('deleteById throws when file missing', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.deleteById('missing')).rejects.toBeInstanceOf(HttpException);
  });

  it('deleteById removes stored variants', async () => {
    repository.findOne.mockResolvedValue({
      id: 'f1',
      type: 'image/jpeg',
      filename: '2020/a.jpg',
      url: 'http://localhost/uploads/2020/a.jpg',
    } as File);

    await service.deleteById('f1');
    expect(localInstance.deleteFile).toHaveBeenCalled();
    expect(repository.remove).toHaveBeenCalled();
  });

  it('deleteById removes variant files from OSS', async () => {
    ossInstance.hasOssConfig.mockResolvedValue(true);
    repository.findOne.mockResolvedValue({
      id: 'f1',
      type: 'image/webp',
      filename: '2020/a.webp',
      variants: {
        large: { filename: '2020/a-large.webp' },
        thumb: { filename: '2020/a-thumb.webp' },
      },
    } as File);

    await service.deleteById('f1');
    expect(ossInstance.deleteFile).toHaveBeenCalledWith('2020/a-large.webp');
    expect(ossInstance.deleteFile).toHaveBeenCalledWith('2020/a-thumb.webp');
    expect(localInstance.deleteFile).not.toHaveBeenCalled();
  });
});
