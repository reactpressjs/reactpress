import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as imageProcessor from '../../utils/image-processor.util';
import { ArticleRevision } from '../article/article-revision.entity';
import { Article } from '../article/article.entity';
import { Page } from '../page/page.entity';
import { SettingService } from '../setting/setting.service';
import { File } from './file.entity';
import { FileOptimizationService } from './file-optimization.service';

const ossInstance = {
  hasOssConfig: jest.fn().mockResolvedValue(false),
  putFile: jest.fn().mockResolvedValue('https://oss.example/opt.webp'),
  getFile: jest.fn().mockResolvedValue(Buffer.from('bytes')),
  deleteFile: jest.fn().mockResolvedValue(undefined),
};

const localInstance = {
  putFile: jest.fn().mockResolvedValue(undefined),
  getFile: jest.fn().mockResolvedValue(Buffer.from('bytes')),
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
  rewriteBrokenUploadUrl: jest.fn((url: string) => url),
}));

jest.mock('../../utils/uniqueid.util', () => ({
  uniqueid: jest.fn(() => 'job-item-id'),
}));

jest.mock('../../utils/image-processor.util', () => ({
  isProcessableImage: jest.fn(),
  variantsForScene: jest.fn(() => ['large', 'medium', 'thumb']),
  processImageVariants: jest.fn(),
  buildVariantFilename: jest.fn((base: string, variant: string) => `${base.replace('.webp', '')}-${variant}.webp`),
  primaryVariantForScene: jest.fn(() => 'large'),
}));

function makeUpdateQb(affected: number) {
  return {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    execute: jest.fn().mockResolvedValue({ affected }),
  };
}

describe('FileOptimizationService', () => {
  let service: FileOptimizationService;
  let fileRepository: jest.Mocked<Pick<Repository<File>, 'find' | 'save'>>;
  let articleRepository: jest.Mocked<Pick<Repository<Article>, 'createQueryBuilder'>>;
  let revisionRepository: jest.Mocked<Pick<Repository<ArticleRevision>, 'createQueryBuilder'>>;
  let pageRepository: jest.Mocked<Pick<Repository<Page>, 'createQueryBuilder'>>;

  beforeEach(() => {
    fileRepository = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (f) => f),
    };
    articleRepository = {
      createQueryBuilder: jest.fn(),
    };
    revisionRepository = {
      createQueryBuilder: jest.fn(),
    };
    pageRepository = {
      createQueryBuilder: jest.fn(),
    };

    service = new FileOptimizationService(
      fileRepository as unknown as Repository<File>,
      articleRepository as unknown as Repository<Article>,
      revisionRepository as unknown as Repository<ArticleRevision>,
      pageRepository as unknown as Repository<Page>,
      {} as SettingService,
      { get: jest.fn(() => 'http://localhost:3002') } as ConfigService
    );

    jest.clearAllMocks();
    (imageProcessor.isProcessableImage as jest.Mock).mockReturnValue(false);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getJob', () => {
    it('throws when job is missing', () => {
      expect(() => service.getJob('missing')).toThrow(NotFoundException);
    });
  });

  describe('analyze', () => {
    it('classifies files and estimates savings', async () => {
      fileRepository.find.mockResolvedValue([
        { id: '1', size: 100, variants: { large: {} }, type: 'image/webp' } as File,
        { id: '2', size: 50, type: 'image/svg+xml' } as File,
        { id: '3', size: 80, type: 'application/pdf' } as File,
        { id: '4', size: 70, type: 'image/gif' } as File,
        {
          id: '5',
          size: 200,
          type: 'image/jpeg',
          filename: 'missing.jpg',
        } as File,
        {
          id: '6',
          size: 300,
          type: 'image/jpeg',
          filename: 'ok.jpg',
        } as File,
      ]);
      (imageProcessor.isProcessableImage as jest.Mock).mockImplementation((type: string) => type.startsWith('image/'));

      localInstance.getFile.mockImplementation(async (filename: string) => {
        if (filename === 'missing.jpg') throw new Error('missing');
        return Buffer.from('ok');
      });

      articleRepository.createQueryBuilder.mockReturnValue(makeUpdateQb(0) as never);
      pageRepository.createQueryBuilder.mockReturnValue(makeUpdateQb(0) as never);

      const report = await service.analyze();

      expect(report.total).toBe(6);
      expect(report.alreadyOptimized).toBe(1);
      expect(report.skipped.svg).toBe(1);
      expect(report.skipped.nonImage).toBe(1);
      expect(report.skipped.gif).toBe(1);
      expect(report.skipped.missing).toBe(1);
      expect(report.needsOptimization).toBe(1);
      expect(report.storageBytes.estimatedSaved).toBeGreaterThan(0);
    });
  });

  describe('startJob', () => {
    it('completes immediately when there are no candidates', async () => {
      const job = await service.startJob({ batchSize: 5 });
      expect(job.status).toBe('completed');
      expect(job.total).toBe(0);
      expect(service.getJob(job.id)).toBe(job);
    });

    it('runs dry-run optimization and records success', async () => {
      (imageProcessor.isProcessableImage as jest.Mock).mockReturnValue(true);
      (imageProcessor.processImageVariants as jest.Mock).mockResolvedValue(
        new Map([['large', { buffer: Buffer.from('w'), width: 10, height: 10, size: 40 }]])
      );

      fileRepository.find.mockResolvedValue([
        {
          id: 'f1',
          originalname: 'a.jpg',
          filename: '2020/a.jpg',
          url: 'http://localhost/uploads/2020/a.jpg',
          type: 'image/jpeg',
          size: 100,
        } as File,
      ]);

      const job = await service.startJob({ dryRun: true, limit: 1, batchSize: 1, skipGif: true });
      await new Promise((resolve) => setImmediate(resolve));

      const finalJob = service.getJob(job.id);
      expect(finalJob.status).toBe('completed');
      expect(finalJob.succeeded).toBe(1);
      expect(finalJob.items[0].status).toBe('success');
    });

    it('marks job failed when processing throws', async () => {
      (imageProcessor.isProcessableImage as jest.Mock).mockReturnValue(true);
      (imageProcessor.processImageVariants as jest.Mock).mockRejectedValue(new Error('sharp failed'));

      fileRepository.find.mockResolvedValue([
        {
          id: 'f1',
          originalname: 'a.jpg',
          filename: '2020/a.jpg',
          url: 'http://localhost/uploads/2020/a.jpg',
          type: 'image/jpeg',
          size: 100,
        } as File,
      ]);

      const job = await service.startJob({ limit: 1, batchSize: 1 });
      await new Promise((resolve) => setImmediate(resolve));

      const finalJob = service.getJob(job.id);
      expect(finalJob.failed).toBe(1);
      expect(finalJob.items[0].error).toBe('sharp failed');
    });

    it('persists variants on OSS, rewrites content, and deletes the original', async () => {
      (imageProcessor.isProcessableImage as jest.Mock).mockReturnValue(true);
      (imageProcessor.processImageVariants as jest.Mock).mockResolvedValue(
        new Map([
          ['large', { buffer: Buffer.from('w'), width: 10, height: 10, size: 40 }],
          ['thumb', { buffer: Buffer.from('t'), width: 4, height: 4, size: 8 }],
        ])
      );
      ossInstance.hasOssConfig.mockResolvedValue(true);
      articleRepository.createQueryBuilder.mockReturnValue(makeUpdateQb(1) as never);
      revisionRepository.createQueryBuilder.mockReturnValue(makeUpdateQb(1) as never);
      pageRepository.createQueryBuilder.mockReturnValue(makeUpdateQb(1) as never);

      fileRepository.find.mockResolvedValue([
        {
          id: 'f1',
          originalname: 'a.jpg',
          filename: '2020/a.jpg',
          url: 'http://cdn.example/uploads/2020/a.jpg',
          type: 'image/jpeg',
          size: 100,
        } as File,
      ]);

      const job = await service.startJob({
        dryRun: false,
        cleanupOriginals: true,
        rewriteContent: true,
        limit: 1,
        batchSize: 1,
      });
      await new Promise((resolve) => setImmediate(resolve));

      const finalJob = service.getJob(job.id);
      expect(finalJob.status).toBe('completed');
      expect(finalJob.succeeded).toBe(1);
      expect(finalJob.items[0].newUrl).toBe('https://oss.example/opt.webp');
      expect(finalJob.urlMap['http://cdn.example/uploads/2020/a.jpg']).toBe('https://oss.example/opt.webp');
      expect(finalJob.urlMap['/uploads/2020/a.jpg']).toBe('/opt.webp');
      expect(finalJob.urlMap['uploads/2020/a.jpg']).toBe('opt.webp');
      expect(finalJob.contentRewrite).toEqual({ articles: 3, pages: 3, revisions: 3 });
      expect(ossInstance.getFile).toHaveBeenCalledWith('2020/a.jpg');
      expect(ossInstance.putFile).toHaveBeenCalled();
      expect(ossInstance.deleteFile).toHaveBeenCalledWith('2020/a.jpg');
      expect(localInstance.putFile).not.toHaveBeenCalled();
    });

    it('persists variants locally and keeps undefined upload urls for rewrite', async () => {
      (imageProcessor.isProcessableImage as jest.Mock).mockReturnValue(true);
      (imageProcessor.processImageVariants as jest.Mock).mockResolvedValue(
        new Map([['large', { buffer: Buffer.from('w'), width: 10, height: 10, size: 40 }]])
      );
      ossInstance.hasOssConfig.mockResolvedValue(false);

      fileRepository.find.mockResolvedValue([
        {
          id: 'f2',
          originalname: 'b.jpg',
          filename: '2020/b.jpg',
          url: 'undefined/uploads/b.jpg',
          type: 'image/jpeg',
          size: 80,
        } as File,
      ]);

      const job = await service.startJob({
        cleanupOriginals: true,
        limit: 1,
        batchSize: 1,
      });
      await new Promise((resolve) => setImmediate(resolve));

      const finalJob = service.getJob(job.id);
      expect(finalJob.status).toBe('completed');
      expect(finalJob.items[0].status).toBe('success');
      expect(finalJob.items[0].oldUrl).toBe('undefined/uploads/b.jpg');
      expect(String(finalJob.items[0].newUrl)).toContain('http://localhost:3002/uploads/');
      expect(localInstance.putFile).toHaveBeenCalled();
      expect(localInstance.deleteFile).toHaveBeenCalledWith('2020/b.jpg');
      expect(ossInstance.putFile).not.toHaveBeenCalled();
    });

    it('counts skipped items without rewriting content', async () => {
      (imageProcessor.isProcessableImage as jest.Mock).mockReturnValue(true);
      fileRepository.find.mockResolvedValue([
        {
          id: 'f1',
          originalname: 'a.jpg',
          filename: '2020/a.jpg',
          url: 'http://localhost/uploads/2020/a.jpg',
          type: 'image/jpeg',
          size: 100,
        } as File,
      ]);
      jest.spyOn(service as unknown as { reprocessOne: () => Promise<unknown> }, 'reprocessOne').mockResolvedValue({
        fileId: 'f1',
        status: 'skipped',
      });

      const job = await service.startJob({ rewriteContent: true, limit: 1, batchSize: 1 });
      await new Promise((resolve) => setImmediate(resolve));

      const finalJob = service.getJob(job.id);
      expect(finalJob.status).toBe('completed');
      expect(finalJob.skipped).toBe(1);
      expect(finalJob.succeeded).toBe(0);
      expect(finalJob.contentRewrite).toBeUndefined();
    });

    it('fails the whole job when setup throws before the candidate loop', async () => {
      (imageProcessor.isProcessableImage as jest.Mock).mockReturnValue(true);
      ossInstance.hasOssConfig.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('oss down'));
      fileRepository.find.mockResolvedValue([
        {
          id: 'f1',
          originalname: 'a.jpg',
          filename: '2020/a.jpg',
          url: 'http://localhost/uploads/2020/a.jpg',
          type: 'image/jpeg',
          size: 100,
        } as File,
      ]);

      const job = await service.startJob({ limit: 1, batchSize: 1 });
      await new Promise((resolve) => setImmediate(resolve));

      const finalJob = service.getJob(job.id);
      expect(finalJob.status).toBe('failed');
      expect(finalJob.error).toBe('oss down');
      expect(finalJob.finishedAt).toEqual(expect.any(String));
    });

    it('fails the whole job when a candidate throws a non-error', async () => {
      (imageProcessor.isProcessableImage as jest.Mock).mockReturnValue(true);
      fileRepository.find.mockResolvedValue([
        {
          id: 'f1',
          originalname: 'a.jpg',
          filename: '2020/a.jpg',
          url: 'http://localhost/uploads/2020/a.jpg',
          type: 'image/jpeg',
          size: 100,
        } as File,
      ]);
      jest
        .spyOn(service as unknown as { reprocessOne: () => Promise<unknown> }, 'reprocessOne')
        .mockRejectedValue('plain failure');

      const job = await service.startJob({ limit: 1, batchSize: 1 });
      await new Promise((resolve) => setImmediate(resolve));

      expect(service.getJob(job.id).error).toBe('plain failure');
      expect(service.getJob(job.id).status).toBe('failed');
    });

    it('ignores malformed urls when recording rewrite variants', async () => {
      (imageProcessor.isProcessableImage as jest.Mock).mockReturnValue(true);
      (imageProcessor.processImageVariants as jest.Mock).mockResolvedValue(
        new Map([['large', { buffer: Buffer.from('w'), width: 10, height: 10, size: 40 }]])
      );
      ossInstance.hasOssConfig.mockResolvedValue(true);
      fileRepository.find.mockResolvedValue([
        {
          id: 'f1',
          originalname: 'a.jpg',
          filename: '2020/a.jpg',
          url: 'http://[',
          type: 'image/jpeg',
          size: 100,
        } as File,
      ]);

      const job = await service.startJob({ limit: 1, batchSize: 1 });
      await new Promise((resolve) => setImmediate(resolve));

      const finalJob = service.getJob(job.id);
      expect(finalJob.status).toBe('completed');
      expect(finalJob.urlMap).toEqual({ 'http://[': 'https://oss.example/opt.webp' });
    });
  });

  describe('rewriteContentUrls', () => {
    it('returns zero counts for empty map', async () => {
      await expect(service.rewriteContentUrls({})).resolves.toEqual({ articles: 0, pages: 0, revisions: 0 });
    });

    it('updates articles, revisions, and pages', async () => {
      const articleQb = makeUpdateQb(2);
      const revisionQb = makeUpdateQb(1);
      const pageQb = makeUpdateQb(3);
      articleRepository.createQueryBuilder.mockReturnValue(articleQb as never);
      revisionRepository.createQueryBuilder.mockReturnValue(revisionQb as never);
      pageRepository.createQueryBuilder.mockReturnValue(pageQb as never);

      const result = await service.rewriteContentUrls({
        'http://localhost/old.jpg': 'http://localhost/new.webp',
      });

      expect(result).toEqual({ articles: 2, pages: 3, revisions: 1 });
      const articleSet = articleQb.set.mock.calls[0][0] as {
        cover: () => string;
        content: () => string;
        html: () => string;
      };
      const revisionSet = revisionQb.set.mock.calls[0][0] as { content: () => string; html: () => string };
      const pageSet = pageQb.set.mock.calls[0][0] as {
        cover: () => string;
        content: () => string;
        html: () => string;
      };
      expect(articleSet.cover()).toContain('REPLACE(cover');
      expect(articleSet.content()).toContain('REPLACE(content');
      expect(articleSet.html()).toContain('REPLACE(html');
      expect(revisionSet.content()).toContain('REPLACE(content');
      expect(revisionSet.html()).toContain('REPLACE(html');
      expect(pageSet.cover()).toContain('REPLACE(cover');
      expect(pageSet.content()).toContain('REPLACE(content');
      expect(pageSet.html()).toContain('REPLACE(html');
    });

    it('treats a missing affected count as zero', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      articleRepository.createQueryBuilder.mockReturnValue(qb as never);
      revisionRepository.createQueryBuilder.mockReturnValue(qb as never);
      pageRepository.createQueryBuilder.mockReturnValue(qb as never);

      await expect(service.rewriteContentUrls({ old: 'new' })).resolves.toEqual({
        articles: 0,
        pages: 0,
        revisions: 0,
      });
    });

    it('escapes single quotes in SQL replace values', async () => {
      const qb = makeUpdateQb(1);
      articleRepository.createQueryBuilder.mockReturnValue(qb as never);
      revisionRepository.createQueryBuilder.mockReturnValue(makeUpdateQb(0) as never);
      pageRepository.createQueryBuilder.mockReturnValue(makeUpdateQb(0) as never);

      await service.rewriteContentUrls({ "http://x/a'b.jpg": "http://x/c'd.webp" });
      const assignment = qb.set.mock.calls[0][0] as { cover: () => string };
      expect(assignment.cover()).toContain("a''b");
    });
  });
});
