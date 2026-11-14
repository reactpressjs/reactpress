import { Test, TestingModule } from '@nestjs/testing';

import { AI_ASSIST_PLUGIN_ID } from '../ai/ai-config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PluginLoaderService } from './plugin-loader.service';
import { PluginController } from './plugin.controller';
import { PluginListItem, PluginService } from './plugin.service';

describe('PluginController', () => {
  let controller: PluginController;
  let pluginService: jest.Mocked<
    Pick<
      PluginService,
      | 'listPlugins'
      | 'getPluginState'
      | 'getPluginAdminLocale'
      | 'getPlugin'
      | 'installPlugin'
      | 'activatePlugin'
      | 'deactivatePlugin'
      | 'uninstallPlugin'
      | 'updatePluginConfig'
    >
  >;
  let pluginLoader: jest.Mocked<Pick<PluginLoaderService, 'reloadPlugin' | 'unloadPlugin'>>;

  const emptyState = { installedPlugins: [], activePlugins: [], entries: {} };

  function listItem(partial: Partial<PluginListItem> & Pick<PluginListItem, 'id' | 'name'>): PluginListItem {
    return {
      version: '1.0.0',
      source: 'installed',
      installed: true,
      active: true,
      ...partial,
    };
  }

  beforeEach(async () => {
    pluginService = {
      listPlugins: jest.fn().mockResolvedValue([]),
      getPluginState: jest.fn().mockResolvedValue(emptyState),
      getPluginAdminLocale: jest.fn(),
      getPlugin: jest.fn(),
      installPlugin: jest.fn().mockResolvedValue(emptyState),
      activatePlugin: jest.fn().mockResolvedValue(emptyState),
      deactivatePlugin: jest.fn().mockResolvedValue(emptyState),
      uninstallPlugin: jest.fn().mockResolvedValue(emptyState),
      updatePluginConfig: jest.fn().mockResolvedValue(emptyState),
    };
    pluginLoader = {
      reloadPlugin: jest.fn().mockResolvedValue(undefined),
      unloadPlugin: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PluginController],
      providers: [
        { provide: PluginService, useValue: pluginService },
        { provide: PluginLoaderService, useValue: pluginLoader },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PluginController);
  });

  it('returns other plugins unchanged and redacts AI Assist config', async () => {
    const alpha = listItem({ id: 'alpha', name: 'Alpha', config: { apiKey: 'visible', title: 'Alpha' } });
    const ai = listItem({
      id: AI_ASSIST_PLUGIN_ID,
      name: 'AI Assist',
      config: { apiKey: 'sk-test-key-1234', model: 'gpt-4o-mini' },
    });
    pluginService.listPlugins.mockResolvedValue([ai, alpha]);

    const result = await controller.list();

    expect(result[1]).toBe(alpha);
    expect(result[0]).toMatchObject({
      id: AI_ASSIST_PLUGIN_ID,
      name: 'AI Assist',
      config: {
        apiKey: '',
        apiKeyConfigured: true,
        apiKeyHint: '1234',
        model: 'gpt-4o-mini',
      },
    });
    expect(ai.config?.apiKey).toBe('sk-test-key-1234');
  });

  it('redacts an AI Assist list item that has no config', async () => {
    const ai = listItem({ id: AI_ASSIST_PLUGIN_ID, name: 'AI Assist' });
    pluginService.listPlugins.mockResolvedValue([ai]);

    const result = await controller.list();

    expect(result).toHaveLength(1);
    expect(result[0]).not.toBe(ai);
    expect(result[0].config).toBeUndefined();
    expect(result[0].id).toBe(AI_ASSIST_PLUGIN_ID);
  });

  it('returns plugin state unchanged when AI Assist has no stored config', async () => {
    const state = {
      installedPlugins: [AI_ASSIST_PLUGIN_ID, 'alpha'],
      activePlugins: [] as string[],
      entries: {
        [AI_ASSIST_PLUGIN_ID]: { version: '1.0.0', source: 'local' as const },
        alpha: { version: '1.0.0', source: 'local' as const, config: { title: 'keep' } },
      },
    };
    pluginService.getPluginState.mockResolvedValue(state);
    await expect(controller.state()).resolves.toBe(state);
  });

  it('returns plugin state unchanged when AI Assist is absent', async () => {
    const state = { installedPlugins: ['alpha'], activePlugins: ['alpha'], entries: {} };
    pluginService.getPluginState.mockResolvedValue(state);
    await expect(controller.state()).resolves.toBe(state);
  });

  it('redacts AI Assist config on plugin state and keeps sibling entries', async () => {
    const alphaEntry = { version: '1.0.0', source: 'local' as const, config: { title: 'keep' } };
    const state = {
      installedPlugins: [AI_ASSIST_PLUGIN_ID, 'alpha'],
      activePlugins: [AI_ASSIST_PLUGIN_ID],
      entries: {
        [AI_ASSIST_PLUGIN_ID]: {
          version: '1.0.0',
          source: 'local' as const,
          loadError: 'nope',
          config: { apiKey: 'sk-test-key-1234', model: 'gpt-4o-mini' },
        },
        alpha: alphaEntry,
      },
    };
    pluginService.getPluginState.mockResolvedValue(state);

    const result = await controller.state();

    expect(result).not.toBe(state);
    expect(result.entries.alpha).toBe(alphaEntry);
    expect(result.entries[AI_ASSIST_PLUGIN_ID]).toMatchObject({
      version: '1.0.0',
      source: 'local',
      loadError: 'nope',
      config: {
        apiKey: '',
        apiKeyConfigured: true,
        apiKeyHint: '1234',
        model: 'gpt-4o-mini',
      },
    });
    expect(state.entries[AI_ASSIST_PLUGIN_ID].config?.apiKey).toBe('sk-test-key-1234');
  });

  it('delegates admin locale lookup', async () => {
    const payload = { pluginId: 'alpha', locale: 'zh-cn', messages: { title: 'Hello CN' } };
    pluginService.getPluginAdminLocale.mockResolvedValue(payload);
    await expect(controller.getLocale('alpha', 'zh-cn')).resolves.toBe(payload);
    expect(pluginService.getPluginAdminLocale).toHaveBeenCalledWith('alpha', 'zh-cn');
  });

  it('returns a non-AI plugin as-is and redacts AI Assist on get', async () => {
    const alpha = listItem({ id: 'alpha', name: 'Alpha', config: { title: 'Alpha' } });
    pluginService.getPlugin.mockResolvedValueOnce(alpha);
    await expect(controller.getOne('alpha')).resolves.toBe(alpha);

    const ai = listItem({
      id: AI_ASSIST_PLUGIN_ID,
      name: 'AI Assist',
      config: { apiKey: 'sk-test-key-1234', enabled: true },
    });
    pluginService.getPlugin.mockResolvedValueOnce(ai);
    const result = await controller.getOne(AI_ASSIST_PLUGIN_ID);
    expect(result).not.toBe(ai);
    expect(result.config).toMatchObject({ apiKey: '', apiKeyConfigured: true, apiKeyHint: '1234', enabled: true });
  });

  it('delegates install and uninstall', async () => {
    const installed = { installedPlugins: ['alpha'], activePlugins: [], entries: {} };
    const removed = { installedPlugins: [], activePlugins: [], entries: {} };
    pluginService.installPlugin.mockResolvedValue(installed);
    pluginService.uninstallPlugin.mockResolvedValue(removed);

    await expect(controller.install('alpha')).resolves.toBe(installed);
    await expect(controller.uninstall('alpha')).resolves.toBe(removed);
    expect(pluginService.installPlugin).toHaveBeenCalledWith('alpha');
    expect(pluginService.uninstallPlugin).toHaveBeenCalledWith('alpha');
  });

  it('activates a plugin and then reloads it', async () => {
    const state = { installedPlugins: ['alpha'], activePlugins: ['alpha'], entries: {} };
    pluginService.activatePlugin.mockResolvedValue(state);

    await expect(controller.activate('alpha')).resolves.toBe(state);
    expect(pluginService.activatePlugin).toHaveBeenCalledWith('alpha');
    expect(pluginLoader.reloadPlugin).toHaveBeenCalledWith('alpha');
    expect(pluginService.activatePlugin.mock.invocationCallOrder[0]).toBeLessThan(
      pluginLoader.reloadPlugin.mock.invocationCallOrder[0]
    );
  });

  it('unloads a plugin before deactivating it', async () => {
    const state = { installedPlugins: ['alpha'], activePlugins: [], entries: {} };
    pluginService.deactivatePlugin.mockResolvedValue(state);

    await expect(controller.deactivate('alpha')).resolves.toBe(state);
    expect(pluginLoader.unloadPlugin).toHaveBeenCalledWith('alpha');
    expect(pluginService.deactivatePlugin).toHaveBeenCalledWith('alpha');
    expect(pluginLoader.unloadPlugin.mock.invocationCallOrder[0]).toBeLessThan(
      pluginService.deactivatePlugin.mock.invocationCallOrder[0]
    );
  });

  it('uses an empty config when the body omits one', async () => {
    await controller.updateConfig('alpha', {});
    await controller.updateConfig('alpha', undefined as never);
    expect(pluginService.updatePluginConfig).toHaveBeenNthCalledWith(1, 'alpha', {});
    expect(pluginService.updatePluginConfig).toHaveBeenNthCalledWith(2, 'alpha', {});
    expect(pluginLoader.reloadPlugin).not.toHaveBeenCalled();
  });

  it('reloads an active plugin after a config update and redacts the returned state', async () => {
    const updated = {
      installedPlugins: [AI_ASSIST_PLUGIN_ID, 'alpha'],
      activePlugins: ['alpha'],
      entries: {
        [AI_ASSIST_PLUGIN_ID]: {
          version: '4.0.0',
          source: 'local' as const,
          config: { apiKey: 'sk-test-key-1234', model: 'gpt-4o-mini' },
        },
      },
    };
    pluginService.updatePluginConfig.mockResolvedValue(updated);
    pluginService.getPluginState.mockResolvedValue({
      installedPlugins: ['alpha'],
      activePlugins: ['beta', 'alpha'],
      entries: {},
    });

    const result = await controller.updateConfig('alpha', { config: { title: 'T' } });

    expect(pluginService.updatePluginConfig).toHaveBeenCalledWith('alpha', { title: 'T' });
    expect(pluginLoader.reloadPlugin).toHaveBeenCalledWith('alpha');
    expect(result.entries[AI_ASSIST_PLUGIN_ID].config).toMatchObject({
      apiKey: '',
      apiKeyConfigured: true,
      apiKeyHint: '1234',
      model: 'gpt-4o-mini',
    });
    expect(updated.entries[AI_ASSIST_PLUGIN_ID].config?.apiKey).toBe('sk-test-key-1234');
  });

  it('does not reload an inactive plugin and returns an unredacted state', async () => {
    const updated = { installedPlugins: ['alpha'], activePlugins: [], entries: {} };
    pluginService.updatePluginConfig.mockResolvedValue(updated);
    pluginService.getPluginState.mockResolvedValue({
      installedPlugins: ['alpha'],
      activePlugins: ['beta'],
      entries: {},
    });

    await expect(controller.updateConfig('alpha', { config: { title: 'T' } })).resolves.toBe(updated);
    expect(pluginLoader.reloadPlugin).not.toHaveBeenCalled();
  });
});
