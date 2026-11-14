import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { HookService } from './hook.service';

describe('HookService', () => {
  let service: HookService;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HookService],
    }).compile();

    service = module.get(HookService);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('applyFilters', () => {
    it('runs filters in priority order and passes context', async () => {
      service.addFilter('content', async (value) => `${value}-a`, { priority: 20 });
      service.addFilter('content', async (value) => `${value}-b`, { priority: 5, pluginId: 'plugin-b' });

      const result = await service.applyFilters('content', 'start');

      expect(result).toBe('start-b-a');
    });

    it('keeps value when a filter throws', async () => {
      service.addFilter(
        'content',
        async () => {
          throw new Error('filter broke');
        },
        { pluginId: 'bad-plugin' }
      );
      service.addFilter('content', async (v) => `${v}!`);

      await expect(service.applyFilters('content', 'ok')).resolves.toBe('ok!');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Filter "content" failed (plugin: bad-plugin)'));
    });
  });

  describe('doAction', () => {
    it('runs actions in priority order', async () => {
      const order: string[] = [];
      service.addAction(
        'save',
        () => {
          order.push('late');
        },
        { priority: 30 }
      );
      service.addAction(
        'save',
        () => {
          order.push('early');
        },
        { priority: 1 }
      );

      await service.doAction('save', { id: 1 });

      expect(order).toEqual(['early', 'late']);
    });

    it('logs and continues when an action throws', async () => {
      service.addAction(
        'save',
        async () => {
          throw 'boom';
        },
        { pluginId: 'p1' }
      );
      service.addAction('save', async () => undefined);

      await expect(service.doAction('save')).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Action "save" failed (plugin: p1)'));
    });
  });

  describe('addFilter / addAction unsubscribe', () => {
    it('removes a filter registration via returned unsubscribe', async () => {
      const unsub = service.addFilter('x', async (v) => `${v}-x`);
      unsub();

      await expect(service.applyFilters('x', 'v')).resolves.toBe('v');
    });

    it('removes an action registration via returned unsubscribe', async () => {
      const fn = jest.fn();
      const unsub = service.addAction('evt', fn);
      unsub();

      await service.doAction('evt');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('removePluginHooks', () => {
    it('removes filters and actions registered for a plugin', async () => {
      service.addFilter('f', async (v) => v, { pluginId: 'keep' });
      service.addFilter('f', async () => 'drop', { pluginId: 'drop-me' });
      service.addAction('a', async () => undefined, { pluginId: 'drop-me' });
      service.addAction('a', async () => undefined, { pluginId: 'keep' });

      service.removePluginHooks('drop-me');

      await expect(service.applyFilters('f', 'x')).resolves.toBe('x');
      const actionFn = jest.fn();
      service.addAction('a', actionFn, { pluginId: 'probe' });
      await service.doAction('a');
      expect(actionFn).toHaveBeenCalled();
    });
  });

  describe('registerLoadedModule and deactivatePluginModule', () => {
    it('calls deactivate on default export when present', async () => {
      const deactivate = jest.fn().mockResolvedValue(undefined);
      service.registerLoadedModule('plugin-a', { default: { deactivate } });

      await service.deactivatePluginModule('plugin-a');

      expect(deactivate).toHaveBeenCalled();
    });

    it('calls deactivate on module root when default is absent', async () => {
      const deactivate = jest.fn();
      service.registerLoadedModule('plugin-b', { deactivate });

      await service.deactivatePluginModule('plugin-b');

      expect(deactivate).toHaveBeenCalled();
    });

    it('no-ops when plugin module is not loaded', async () => {
      await expect(service.deactivatePluginModule('missing')).resolves.toBeUndefined();
    });
  });
});
