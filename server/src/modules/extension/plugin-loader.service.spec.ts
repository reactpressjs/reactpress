import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';

import { HookService } from '../hook/hook.service';
import { PluginLoaderService } from './plugin-loader.service';
import { PluginService } from './plugin.service';

describe('PluginLoaderService', () => {
  let loader: PluginLoaderService;
  let hookService: jest.Mocked<
    Pick<HookService, 'registerLoadedModule' | 'removePluginHooks' | 'deactivatePluginModule'>
  >;
  let pluginService: jest.Mocked<
    Pick<
      PluginService,
      | 'ensureDefaultPlugins'
      | 'getPluginState'
      | 'readRuntimeManifest'
      | 'resolveServerModulePath'
      | 'recordLoadError'
      | 'createPluginContext'
      | 'clearLoadError'
    >
  >;
  let existsSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const modulePath = path.join(__dirname, '__fixtures__', 'demo-plugin-server.js');

  function seedRequireCache(exportsValue: Record<string, unknown>): void {
    (global as { __demoPluginServerExports?: Record<string, unknown> }).__demoPluginServerExports = exportsValue;
    delete require.cache[modulePath];
  }

  beforeEach(async () => {
    hookService = {
      registerLoadedModule: jest.fn(),
      removePluginHooks: jest.fn(),
      deactivatePluginModule: jest.fn().mockResolvedValue(undefined),
    };
    pluginService = {
      ensureDefaultPlugins: jest.fn().mockResolvedValue(undefined),
      getPluginState: jest.fn().mockResolvedValue({ activePlugins: ['demo', '!!bad'] }),
      readRuntimeManifest: jest.fn(),
      resolveServerModulePath: jest.fn(),
      recordLoadError: jest.fn().mockResolvedValue(undefined),
      createPluginContext: jest.fn().mockResolvedValue({ id: 'demo', config: {}, logger: {} }),
      clearLoadError: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginLoaderService,
        { provide: HookService, useValue: hookService },
        { provide: PluginService, useValue: pluginService },
      ],
    }).compile();

    loader = module.get(PluginLoaderService);
    existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete require.cache[modulePath];
    delete global.__demoPluginRegister;
  });

  it('loads active plugins and skips invalid ids', async () => {
    pluginService.readRuntimeManifest.mockReturnValue(null);
    await loader.loadActivePlugins();
    expect(pluginService.ensureDefaultPlugins).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid id'));
  });

  it('warns when default plugin seed fails', async () => {
    pluginService.ensureDefaultPlugins.mockRejectedValue(new Error('seed failed'));
    pluginService.getPluginState.mockResolvedValue({ activePlugins: [] });
    await loader.loadActivePlugins();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Default plugin seed skipped'));
  });

  it('records load error when server module path is missing', async () => {
    pluginService.readRuntimeManifest.mockReturnValue({
      id: 'demo',
      name: 'Demo',
      version: '1.0.0',
      server: { module: 'dist/index.js' },
    });
    pluginService.resolveServerModulePath.mockReturnValue(null);
    await loader.loadPlugin('demo');
    expect(pluginService.recordLoadError).toHaveBeenCalledWith('demo', expect.stringContaining('not found'));
  });

  it('records load error when register export is missing', async () => {
    pluginService.readRuntimeManifest.mockReturnValue({
      id: 'demo',
      name: 'Demo',
      version: '1.0.0',
      server: { module: 'dist/index.js' },
    });
    pluginService.resolveServerModulePath.mockReturnValue(modulePath);
    seedRequireCache({});
    await loader.loadPlugin('demo');
    expect(pluginService.recordLoadError).toHaveBeenCalledWith('demo', expect.stringContaining('register()'));
  });

  it('loads plugin and calls register', async () => {
    const register = jest.fn().mockResolvedValue(undefined);
    global.__demoPluginRegister = register;
    pluginService.readRuntimeManifest.mockReturnValue({
      id: 'demo',
      name: 'Demo',
      version: '2.0.0',
      server: { module: 'dist/index.js' },
    });
    pluginService.resolveServerModulePath.mockReturnValue(modulePath);
    await loader.loadPlugin('demo');
    expect(hookService.registerLoadedModule).toHaveBeenCalled();
    expect(register).toHaveBeenCalledWith(hookService, expect.objectContaining({ id: 'demo' }));
    expect(pluginService.clearLoadError).toHaveBeenCalledWith('demo');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded plugin'));
  });

  it('unloads and records error when register throws', async () => {
    const register = jest.fn().mockRejectedValue(new Error('boom'));
    global.__demoPluginRegister = register;
    pluginService.readRuntimeManifest.mockReturnValue({
      id: 'demo',
      name: 'Demo',
      version: '1.0.0',
      server: { module: 'dist/index.js' },
    });
    pluginService.resolveServerModulePath.mockReturnValue(modulePath);
    await loader.loadPlugin('demo');
    expect(hookService.removePluginHooks).toHaveBeenCalledWith('demo');
    expect(pluginService.recordLoadError).toHaveBeenCalledWith('demo', 'boom');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('refuses invalid plugin id on loadPlugin', async () => {
    await loader.loadPlugin('!!');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Refusing to load'));
  });

  it('reloads only when plugin is active', async () => {
    pluginService.getPluginState.mockResolvedValue({ activePlugins: [] });
    pluginService.readRuntimeManifest.mockReturnValue(null);
    await loader.reloadPlugin('demo');
    expect(hookService.removePluginHooks).toHaveBeenCalledWith('demo');
    expect(pluginService.readRuntimeManifest).not.toHaveBeenCalled();
  });

  it('loads the plugin again when reload finds it active', async () => {
    pluginService.getPluginState.mockResolvedValue({ activePlugins: ['demo'] });
    pluginService.readRuntimeManifest.mockReturnValue(null);
    await loader.reloadPlugin('demo');
    expect(pluginService.readRuntimeManifest).toHaveBeenCalledWith('demo');
  });

  it('returns early when manifest has no server module', async () => {
    pluginService.readRuntimeManifest.mockReturnValue({ id: 'demo', name: 'D', version: '1.0.0' });
    await loader.loadPlugin('demo');
    expect(pluginService.resolveServerModulePath).not.toHaveBeenCalled();
  });

  it('records error when module file is missing on disk', async () => {
    existsSpy.mockReturnValue(false);
    pluginService.readRuntimeManifest.mockReturnValue({
      id: 'demo',
      name: 'Demo',
      version: '1.0.0',
      server: { module: 'dist/index.js' },
    });
    pluginService.resolveServerModulePath.mockReturnValue(modulePath);
    await loader.loadPlugin('demo');
    expect(pluginService.recordLoadError).toHaveBeenCalled();
  });
});
