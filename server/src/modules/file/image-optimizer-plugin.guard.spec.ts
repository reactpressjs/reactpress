import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PluginService } from '../extension/plugin.service';
import { IMAGE_OPTIMIZER_PLUGIN_ID } from './file-optimization.types';
import { ImageOptimizerPluginGuard } from './image-optimizer-plugin.guard';

describe('ImageOptimizerPluginGuard', () => {
  let guard: ImageOptimizerPluginGuard;
  let pluginService: jest.Mocked<Pick<PluginService, 'getPluginState'>>;

  beforeEach(async () => {
    pluginService = { getPluginState: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageOptimizerPluginGuard, { provide: PluginService, useValue: pluginService }],
    }).compile();

    guard = module.get(ImageOptimizerPluginGuard);
  });

  it('allows access when image optimizer plugin is active', async () => {
    pluginService.getPluginState.mockResolvedValue({
      activePlugins: [IMAGE_OPTIMIZER_PLUGIN_ID],
    } as never);

    await expect(guard.canActivate({} as ExecutionContext)).resolves.toBe(true);
  });

  it('throws ForbiddenException when plugin is not active', async () => {
    pluginService.getPluginState.mockResolvedValue({ activePlugins: [] } as never);

    await expect(guard.canActivate({} as ExecutionContext)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
