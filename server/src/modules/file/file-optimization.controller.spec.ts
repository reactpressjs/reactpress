import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { FileOptimizationController } from './file-optimization.controller';
import { ImageOptimizerPluginGuard } from './image-optimizer-plugin.guard';
import { FileOptimizationService } from './file-optimization.service';

describe('FileOptimizationController', () => {
  let controller: FileOptimizationController;
  let optimizationService: jest.Mocked<
    Pick<FileOptimizationService, 'analyze' | 'startJob' | 'getJob' | 'rewriteContentUrls'>
  >;

  beforeEach(async () => {
    optimizationService = {
      analyze: jest.fn(),
      startJob: jest.fn(),
      getJob: jest.fn(),
      rewriteContentUrls: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileOptimizationController],
      providers: [{ provide: FileOptimizationService, useValue: optimizationService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ImageOptimizerPluginGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(FileOptimizationController);
  });

  it('delegates optimization endpoints', async () => {
    const report = { total: 1 } as never;
    const job = { id: 'j1' } as never;
    const rewrite = { articles: 1, pages: 0, revisions: 0 };

    optimizationService.analyze.mockResolvedValue(report);
    optimizationService.startJob.mockResolvedValue(job);
    optimizationService.getJob.mockReturnValue(job);
    optimizationService.rewriteContentUrls.mockResolvedValue(rewrite);

    await expect(controller.getReport()).resolves.toBe(report);
    await expect(controller.startRun({ batchSize: 10 })).resolves.toBe(job);
    expect(optimizationService.startJob).toHaveBeenCalledWith({ batchSize: 10 });
    expect(controller.getJob('j1')).toBe(job);
    await expect(controller.rewrite({ urlMap: { a: 'b' } })).resolves.toBe(rewrite);
    await expect(controller.rewrite(undefined as never)).resolves.toBe(rewrite);
  });
});
