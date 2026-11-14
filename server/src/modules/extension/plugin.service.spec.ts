import * as pluginExtension from '@reactpressjs/reactpress-toolkit/plugin/extension';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { decryptAiSecret } from '../ai/ai-secret';
import { Setting } from '../setting/setting.entity';
import { SettingService } from '../setting/setting.service';
import { PluginService } from './plugin.service';

jest.mock('@reactpressjs/reactpress-toolkit/plugin/extension', () => {
  const actual = jest.requireActual<typeof import('@reactpressjs/reactpress-toolkit/plugin/extension')>(
    '@reactpressjs/reactpress-toolkit/plugin/extension'
  );
  return {
    ...actual,
    validatePluginSettings: jest.fn((...args: Parameters<typeof actual.validatePluginSettings>) =>
      actual.validatePluginSettings(...args)
    ),
  };
});

interface PluginEntryFixture {
  version: string;
  source: 'local' | 'npm';
  config?: Record<string, unknown>;
  loadError?: string;
  activatedAt?: string;
}

interface SavedSetting {
  theme?: string;
  pluginDefaultsSeeded?: boolean;
  plugins?: {
    installedPlugins: string[];
    activePlugins: string[];
    entries: Record<string, PluginEntryFixture>;
  };
}

describe('PluginService', () => {
  let service: PluginService;
  let settingRepository: { save: jest.Mock };
  let settingService: { getSettingRow: jest.Mock };
  let row: Setting;
  let root: string;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const envKeys = [
    'REACTPRESS_ORIGINAL_CWD',
    'REACTPRESS_PLUGIN_RUNTIME_COPY',
    'NODE_ENV',
    'REACTPRESS_AI_SECRET',
  ] as const;
  const envBackup: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};

  const alphaManifest = {
    id: 'alpha',
    name: 'Alpha',
    version: '1.2.3',
    description: 'Alpha plugin',
    server: { module: 'dist/index.js' },
  };

  const betaManifest = {
    id: 'beta',
    name: 'Beta',
    version: '2.0.0',
    requiresPlugins: ['alpha'],
    settings: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' } },
      },
    },
  };

  const aiManifest = {
    id: 'ai-assist',
    name: 'AI Assist',
    version: '4.0.0',
    settings: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          enabled: { type: 'boolean' },
          apiKey: { type: 'string' },
          baseUrl: { type: 'string' },
          model: { type: 'string' },
          apiKeyConfigured: { type: 'boolean' },
          apiKeyHint: { type: 'string' },
        },
      },
    },
  };

  function writePlugin(id: string, manifest: Record<string, unknown>, files: Record<string, string> = {}): string {
    const dir = path.join(root, 'plugins', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest));
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    return dir;
  }

  function runtimePlugin(id: string): string {
    return path.join(root, '.reactpress', 'plugins', id);
  }

  function setPlugins(partial: {
    installedPlugins?: string[];
    activePlugins?: string[];
    entries?: Record<string, PluginEntryFixture>;
    pluginDefaultsSeeded?: boolean;
    theme?: string;
  }): void {
    row.globalSetting = JSON.stringify({
      ...(partial.theme !== undefined ? { theme: partial.theme } : {}),
      ...(partial.pluginDefaultsSeeded !== undefined ? { pluginDefaultsSeeded: partial.pluginDefaultsSeeded } : {}),
      plugins: {
        installedPlugins: partial.installedPlugins ?? [],
        activePlugins: partial.activePlugins ?? [],
        entries: partial.entries ?? {},
      },
    });
  }

  function readSaved(): SavedSetting {
    return JSON.parse(row.globalSetting) as SavedSetting;
  }

  function copyAlphaRuntimeManifest(): void {
    const dir = runtimePlugin('alpha');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), path.join(dir, 'plugin.json'));
  }

  beforeAll(() => {
    for (const key of envKeys) envBackup[key] = process.env[key];
  });

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'reactpress-plugin-'));
    process.env.REACTPRESS_ORIGINAL_CWD = root;
    process.env.NODE_ENV = 'test';
    process.env.REACTPRESS_AI_SECRET = 'plugin-service-spec';
    delete process.env.REACTPRESS_PLUGIN_RUNTIME_COPY;

    row = { id: 'setting-1', globalSetting: '' } as Setting;
    const actualPlugins = jest.requireActual<typeof pluginExtension>(
      '@reactpressjs/reactpress-toolkit/plugin/extension'
    );
    jest
      .mocked(pluginExtension.validatePluginSettings)
      .mockImplementation((...args) => actualPlugins.validatePluginSettings(...args));
    settingRepository = { save: jest.fn(async (saved: Setting) => saved) };
    settingService = { getSettingRow: jest.fn(async () => row) };

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginService,
        { provide: getRepositoryToken(Setting), useValue: settingRepository },
        { provide: SettingService, useValue: settingService },
      ],
    }).compile();

    service = module.get(PluginService);
    writePlugin('alpha', alphaManifest, {
      'src/locales/en.json': JSON.stringify({ title: 'Hello' }),
      'src/locales/zh-cn.json': JSON.stringify({ title: 'Hello CN' }),
    });
    writePlugin('beta', betaManifest);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of envKeys) {
      const value = envBackup[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  describe('manifests and plugin state', () => {
    it('resolves the runtime directory under the project root', () => {
      expect(service.runtimeDir()).toBe(path.join(root, '.reactpress', 'plugins'));
    });

    it('returns null when plugin.json is missing', () => {
      expect(service.readManifest(path.join(root, 'scratch', 'missing'))).toBeNull();
      expect(service.readRuntimeManifest('alpha')).toBeNull();
    });

    it('parses a valid manifest and a manifest that omits id and name', () => {
      const validDir = path.join(root, 'scratch', 'alpha');
      fs.mkdirSync(validDir, { recursive: true });
      fs.writeFileSync(
        path.join(validDir, 'plugin.json'),
        JSON.stringify({ id: 'alpha', name: 'From File', version: '9.9.9' })
      );
      expect(service.readManifest(validDir)).toMatchObject({ id: 'alpha', name: 'From File', version: '9.9.9' });

      const fallbackDir = path.join(root, 'scratch', 'fallback-plugin');
      fs.mkdirSync(fallbackDir, { recursive: true });
      fs.writeFileSync(
        path.join(fallbackDir, 'plugin.json'),
        JSON.stringify({ description: 'Filled', version: '3.2.1' })
      );
      expect(service.readManifest(fallbackDir)).toMatchObject({
        id: 'fallback-plugin',
        name: 'fallback-plugin',
        version: '3.2.1',
        description: 'Filled',
      });
    });

    it('returns null for broken JSON and an invalid id, and fills a null manifest from the directory name', () => {
      const brokenDir = path.join(root, 'scratch', 'broken');
      const nullDir = path.join(root, 'scratch', 'null-plugin');
      const badIdDir = path.join(root, 'scratch', 'bad-plugin');
      fs.mkdirSync(brokenDir, { recursive: true });
      fs.mkdirSync(nullDir, { recursive: true });
      fs.mkdirSync(badIdDir, { recursive: true });
      fs.writeFileSync(path.join(brokenDir, 'plugin.json'), '{');
      fs.writeFileSync(path.join(nullDir, 'plugin.json'), 'null');
      fs.writeFileSync(path.join(badIdDir, 'plugin.json'), JSON.stringify({ id: 'BAD', name: 'Nope' }));

      expect(service.readManifest(brokenDir)).toBeNull();
      expect(service.readManifest(nullDir)).toMatchObject({
        id: 'null-plugin',
        name: 'null-plugin',
        version: '1.0.0',
      });
      expect(service.readManifest(badIdDir)).toBeNull();
    });

    it('reads a runtime manifest and resolves a safe server module path', () => {
      copyAlphaRuntimeManifest();
      expect(service.readRuntimeManifest('alpha')).toMatchObject({ id: 'alpha', version: '1.2.3' });
      expect(service.resolveServerModulePath('BAD', 'dist/index.js')).toBeNull();
      expect(service.resolveServerModulePath('alpha', '../secret.js')).toBeNull();
      expect(service.resolveServerModulePath('alpha', '/tmp/index.js')).toBeNull();
      expect(service.resolveServerModulePath('alpha', 'dist/index.ts')).toBeNull();
      expect(service.resolveServerModulePath('alpha', 'dist/index.js')).toBe(
        path.join(root, '.reactpress', 'plugins', 'alpha', 'dist', 'index.js')
      );
    });

    it('treats blank and invalid global settings as empty plugin state', async () => {
      row.globalSetting = '';
      await expect(service.getPluginState()).resolves.toEqual({
        installedPlugins: [],
        activePlugins: [],
        entries: {},
      });

      row.globalSetting = '{';
      await expect(service.getPluginState()).resolves.toEqual({
        installedPlugins: [],
        activePlugins: [],
        entries: {},
      });
    });

    it('drops invalid plugin ids stored in global settings', async () => {
      setPlugins({
        installedPlugins: ['alpha', 'nope!'],
        activePlugins: ['alpha'],
        entries: { alpha: { version: '1.2.3', source: 'local' } },
      });
      await expect(service.getPluginState()).resolves.toEqual({
        installedPlugins: ['alpha'],
        activePlugins: ['alpha'],
        entries: { alpha: { version: '1.2.3', source: 'local' } },
      });
    });
  });

  describe('list and get', () => {
    it('lists local plugins sorted by name', async () => {
      const items = await service.listPlugins();
      expect(items.map((item) => item.id)).toEqual(['alpha', 'beta']);
      expect(items[0]).toMatchObject({
        name: 'Alpha',
        source: 'local',
        installed: false,
        active: false,
        version: '1.2.3',
      });
    });

    it('merges installed state, load errors, and config', async () => {
      setPlugins({
        installedPlugins: ['alpha'],
        activePlugins: ['alpha'],
        entries: {
          alpha: { version: '1.2.3', source: 'local', loadError: 'failed to load', config: { title: 'A' } },
        },
      });
      const items = await service.listPlugins();
      expect(items.find((item) => item.id === 'alpha')).toMatchObject({
        source: 'installed',
        installed: true,
        active: true,
        loadError: 'failed to load',
        config: { title: 'A' },
      });
      expect(items.find((item) => item.id === 'beta')).toMatchObject({
        source: 'local',
        installed: false,
        active: false,
      });
    });

    it('skips local ids that do not resolve to a manifest', async () => {
      fs.writeFileSync(
        path.join(root, 'plugins', 'package.json'),
        JSON.stringify({ reactpress: { local: ['ghost', 'alpha'] } })
      );
      const broken = path.join(root, 'plugins', 'broken');
      fs.mkdirSync(broken, { recursive: true });
      fs.writeFileSync(path.join(broken, 'plugin.json'), '{');

      await expect(service.listPlugins().then((items) => items.map((item) => item.id))).resolves.toEqual([
        'alpha',
        'beta',
      ]);
    });

    it('lists runtime directories and directory symlinks, skipping files and broken links', async () => {
      const runtime = service.runtimeDir();
      fs.mkdirSync(runtime, { recursive: true });

      const extra = path.join(root, 'extras', 'delta');
      fs.mkdirSync(extra, { recursive: true });
      fs.writeFileSync(
        path.join(extra, 'plugin.json'),
        JSON.stringify({ id: 'delta', name: 'Delta', version: '1.0.0' })
      );
      fs.symlinkSync(path.relative(runtime, extra), path.join(runtime, 'delta'), 'dir');
      fs.symlinkSync('missing-target', path.join(runtime, 'broken'), 'dir');
      fs.writeFileSync(path.join(runtime, 'note.txt'), 'note');
      fs.symlinkSync('note.txt', path.join(runtime, 'file-link'));
      fs.mkdirSync(path.join(runtime, 'empty-dir'));
      fs.mkdirSync(path.join(runtime, 'zeta'), { recursive: true });
      fs.writeFileSync(
        path.join(runtime, 'zeta', 'plugin.json'),
        JSON.stringify({ id: 'zeta', name: 'Zeta', version: '1.0.0' })
      );

      const items = await service.listPlugins();
      expect(items.map((item) => item.name)).toEqual(['Alpha', 'Beta', 'Delta', 'Zeta']);
      expect(items.find((item) => item.id === 'delta')).toMatchObject({ source: 'installed', installed: false });
    });

    it('returns one plugin and rejects an unknown id', async () => {
      await expect(service.getPlugin('beta')).resolves.toMatchObject({ id: 'beta', name: 'Beta' });
      await expect(service.getPlugin('missing')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getPlugin('missing')).rejects.toThrow('Plugin "missing" not found');
    });
  });

  describe('admin locales', () => {
    it('rejects an invalid plugin id', async () => {
      await expect(service.getPluginAdminLocale('No', 'en')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.getPluginAdminLocale('No', 'en')).rejects.toThrow('Invalid plugin id "No"');
    });

    it('rejects a plugin that is neither bundled nor installed', async () => {
      await expect(service.getPluginAdminLocale('missing', 'en')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reads a locale file and falls back to English for an unsafe locale', async () => {
      await expect(service.getPluginAdminLocale('alpha', 'zh-cn')).resolves.toEqual({
        pluginId: 'alpha',
        locale: 'zh-cn',
        messages: { title: 'Hello CN' },
      });
      await expect(service.getPluginAdminLocale('alpha', 'not-a-locale')).resolves.toEqual({
        pluginId: 'alpha',
        locale: 'en',
        messages: { title: 'Hello' },
      });
    });

    it('prefers the template locale over the runtime copy', async () => {
      const runtimeLocale = path.join(runtimePlugin('alpha'), 'src', 'locales');
      fs.mkdirSync(runtimeLocale, { recursive: true });
      fs.writeFileSync(path.join(runtimeLocale, 'en.json'), JSON.stringify({ title: 'From runtime' }));

      await expect(service.getPluginAdminLocale('alpha', 'en')).resolves.toEqual({
        pluginId: 'alpha',
        locale: 'en',
        messages: { title: 'Hello' },
      });
    });

    it('falls back to the runtime locale when the template file is unreadable', async () => {
      fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'src', 'locales', 'en.json'), '{');
      const legacyDir = path.join(runtimePlugin('alpha'), 'locales');
      fs.mkdirSync(legacyDir, { recursive: true });
      fs.writeFileSync(path.join(legacyDir, 'en.json'), JSON.stringify({ title: 'From runtime' }));

      await expect(service.getPluginAdminLocale('alpha', 'en')).resolves.toEqual({
        pluginId: 'alpha',
        locale: 'en',
        messages: { title: 'From runtime' },
      });
    });

    it('returns empty messages when no locale file can be read', async () => {
      fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'src', 'locales', 'en.json'), '{');
      await expect(service.getPluginAdminLocale('alpha', 'en')).resolves.toEqual({
        pluginId: 'alpha',
        locale: 'en',
        messages: {},
      });
    });

    it('skips a locale directory that was already queued', async () => {
      const template = path.join(root, 'plugins', 'alpha');
      const realJoin = path.join.bind(path);
      let redirected = 0;
      jest.spyOn(path, 'join').mockImplementation((...parts: string[]) => {
        const joined = realJoin(...parts);
        if (String(parts[0]).includes(`${path.sep}.reactpress${path.sep}plugins`) && parts[1] === 'alpha') {
          redirected += 1;
          return template;
        }
        return joined;
      });

      await expect(service.getPluginAdminLocale('alpha', 'en')).resolves.toEqual({
        pluginId: 'alpha',
        locale: 'en',
        messages: { title: 'Hello' },
      });
      expect(redirected).toBe(1);
    });

    it('ignores an empty locale search path and reads the runtime copy', async () => {
      const localeDir = path.join(runtimePlugin('alpha'), 'src', 'locales');
      fs.mkdirSync(localeDir, { recursive: true });
      fs.writeFileSync(path.join(localeDir, 'en.json'), JSON.stringify({ title: 'From runtime' }));

      const templateParent = path.join(root, 'plugins');
      const realJoin = path.join.bind(path);
      const realExists = fs.existsSync.bind(fs);
      jest.spyOn(path, 'join').mockImplementation((...parts: string[]) => {
        if (parts.length === 2 && parts[0] === templateParent && parts[1] === 'alpha') return '';
        return realJoin(...parts);
      });
      jest.spyOn(fs, 'existsSync').mockImplementation((target) => (target === '' ? true : realExists(target)));

      await expect(service.getPluginAdminLocale('alpha', 'en')).resolves.toEqual({
        pluginId: 'alpha',
        locale: 'en',
        messages: { title: 'From runtime' },
      });
    });

    it('reads a runtime-only locale and keeps the requested locale casing', async () => {
      const localeDir = path.join(runtimePlugin('orphan'), 'src', 'locales');
      fs.mkdirSync(localeDir, { recursive: true });
      fs.writeFileSync(path.join(localeDir, 'EN.json'), JSON.stringify({ title: 'Upper' }));

      await expect(service.getPluginAdminLocale('orphan', 'EN')).resolves.toEqual({
        pluginId: 'orphan',
        locale: 'EN',
        messages: { title: 'Upper' },
      });
    });
  });

  describe('install', () => {
    it('rejects invalid ids, a missing template, and an invalid manifest', async () => {
      await expect(service.installPlugin('BAD')).rejects.toThrow('Invalid plugin id "BAD"');
      await expect(service.activatePlugin('../x')).rejects.toThrow(BadRequestException);
      await expect(service.deactivatePlugin('')).rejects.toThrow(BadRequestException);
      await expect(service.uninstallPlugin('A_B')).rejects.toThrow(BadRequestException);
      await expect(service.updatePluginConfig('nope!', {})).rejects.toThrow(BadRequestException);
      await expect(service.installPlugin('missing')).rejects.toThrow('Plugin template "missing" not found');

      const broken = path.join(root, 'plugins', 'broken');
      fs.mkdirSync(broken, { recursive: true });
      fs.writeFileSync(path.join(broken, 'plugin.json'), '{');
      await expect(service.installPlugin('broken')).rejects.toThrow('Plugin "broken" has invalid plugin.json');
      expect(fs.existsSync(service.runtimeDir())).toBe(false);
      expect(settingRepository.save).not.toHaveBeenCalled();
    });

    it('symlinks a template into the runtime dir and records it', async () => {
      setPlugins({ theme: 'aurora', activePlugins: ['beta'] });
      const state = await service.installPlugin('alpha');
      const runtime = runtimePlugin('alpha');

      expect(state.installedPlugins).toEqual(['alpha']);
      expect(state.activePlugins).toEqual(['beta']);
      expect(state.entries.alpha).toEqual({ version: '1.2.3', source: 'local' });
      expect(fs.lstatSync(runtime).isSymbolicLink()).toBe(true);
      expect(fs.readlinkSync(runtime)).toBe(path.relative(path.dirname(runtime), path.join(root, 'plugins', 'alpha')));
      expect(readSaved().theme).toBe('aurora');
    });

    it('replaces a stale runtime dir and keeps an existing entry', async () => {
      setPlugins({
        theme: 'aurora',
        installedPlugins: ['alpha'],
        activePlugins: ['beta'],
        entries: {
          alpha: {
            version: '9.9.9',
            source: 'npm',
            config: { keep: true },
            activatedAt: '2020-01-01T00:00:00.000Z',
          },
        },
      });
      await service.installPlugin('alpha');
      const runtime = runtimePlugin('alpha');
      fs.unlinkSync(runtime);
      fs.mkdirSync(runtime);
      fs.writeFileSync(path.join(runtime, 'stale.txt'), 'stale');

      await service.installPlugin('alpha');

      expect(fs.existsSync(path.join(runtime, 'stale.txt'))).toBe(false);
      expect(fs.lstatSync(runtime).isSymbolicLink()).toBe(true);
      expect(readSaved().plugins?.installedPlugins).toEqual(['alpha']);
      expect(readSaved().plugins?.activePlugins).toEqual(['beta']);
      expect(readSaved().plugins?.entries.alpha).toMatchObject({
        version: '9.9.9',
        source: 'npm',
        config: { keep: true },
        activatedAt: '2020-01-01T00:00:00.000Z',
      });
    });

    it('copies the template when runtime copy is forced', async () => {
      const dir = writePlugin(
        'rich',
        { id: 'rich', name: 'Rich', version: '1.0.0', server: { module: 'dist/index.js' } },
        {
          'dist/index.js': 'module.exports = {};\n',
          'src/keep.js': 'keep;\n',
          'src/locales/en.json': '{"title":"Hello"}\n',
          'src/server/index.ts': 'hidden;\n',
          'src/admin/panel.tsx': 'hidden;\n',
          'nested/node_modules/pkg.js': 'nested;\n',
          'docs/readme.txt': 'docs;\n',
          'package-lock.json': '{}\n',
          'tsconfig.json': '{}\n',
          'node_modules/pkg/index.js': 'skip;\n',
          '.git/config': 'skip;\n',
          '.turbo/cache': 'skip;\n',
          'coverage/lcov.info': 'skip;\n',
          '.reactpress/state': 'skip;\n',
          '.cache/data': 'skip;\n',
        }
      );
      fs.writeFileSync(path.join(root, 'outside.txt'), 'outside');
      fs.symlinkSync(path.join(root, 'outside.txt'), path.join(dir, 'escape-link'));
      execFileSync('mkfifo', [path.join(dir, 'pipe')]);

      process.env.REACTPRESS_PLUGIN_RUNTIME_COPY = '1';
      await service.installPlugin('rich');

      const runtime = runtimePlugin('rich');
      expect(fs.lstatSync(runtime).isSymbolicLink()).toBe(false);
      expect(fs.readFileSync(path.join(runtime, 'dist', 'index.js'), 'utf8')).toBe('module.exports = {};\n');
      expect(fs.readFileSync(path.join(runtime, 'src', 'keep.js'), 'utf8')).toBe('keep;\n');
      expect(fs.existsSync(path.join(runtime, 'src', 'locales', 'en.json'))).toBe(true);
      expect(fs.existsSync(path.join(runtime, 'docs', 'readme.txt'))).toBe(true);
      expect(fs.existsSync(path.join(runtime, 'nested', 'node_modules', 'pkg.js'))).toBe(true);
      expect(fs.existsSync(path.join(runtime, 'node_modules'))).toBe(false);
      expect(fs.existsSync(path.join(runtime, '.git'))).toBe(false);
      expect(fs.existsSync(path.join(runtime, '.turbo'))).toBe(false);
      expect(fs.existsSync(path.join(runtime, 'coverage'))).toBe(false);
      expect(fs.existsSync(path.join(runtime, '.reactpress'))).toBe(false);
      expect(fs.existsSync(path.join(runtime, '.cache'))).toBe(false);
      expect(fs.existsSync(path.join(runtime, 'package-lock.json'))).toBe(false);
      expect(fs.existsSync(path.join(runtime, 'tsconfig.json'))).toBe(false);
      expect(fs.existsSync(path.join(runtime, 'src', 'server'))).toBe(false);
      expect(fs.existsSync(path.join(runtime, 'src', 'admin'))).toBe(false);
      expect(fs.existsSync(path.join(runtime, 'escape-link'))).toBe(false);
      expect(fs.existsSync(path.join(runtime, 'pipe'))).toBe(false);
    });

    it('copies the template when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.REACTPRESS_PLUGIN_RUNTIME_COPY;
      await service.installPlugin('alpha');
      const runtime = runtimePlugin('alpha');
      expect(fs.lstatSync(runtime).isDirectory()).toBe(true);
      expect(fs.lstatSync(runtime).isSymbolicLink()).toBe(false);
      expect(fs.existsSync(path.join(runtime, 'plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(runtime, 'src', 'locales', 'en.json'))).toBe(true);
    });
  });

  describe('activate and deactivate', () => {
    it('installs a missing runtime copy before activation', async () => {
      await service.activatePlugin('alpha');
      expect(readSaved().plugins?.installedPlugins).toEqual(['alpha']);
      expect(readSaved().plugins?.activePlugins).toEqual(['alpha']);
      expect(fs.lstatSync(runtimePlugin('alpha')).isSymbolicLink()).toBe(true);
    });

    it('records an existing runtime plugin before activation', async () => {
      copyAlphaRuntimeManifest();
      await service.activatePlugin('alpha');
      expect(readSaved().plugins?.installedPlugins).toEqual(['alpha']);
      expect(readSaved().plugins?.activePlugins).toEqual(['alpha']);
      expect(readSaved().plugins?.entries.alpha).toMatchObject({ version: '1.2.3', source: 'local' });
    });

    it('keeps an existing entry when recording a runtime plugin', async () => {
      copyAlphaRuntimeManifest();
      setPlugins({
        entries: { alpha: { version: '9.9.9', source: 'npm', config: { keep: true } } },
      });
      const snapshots: string[] = [];
      settingRepository.save.mockImplementation(async (saved: Setting) => {
        snapshots.push(saved.globalSetting);
        return saved;
      });

      await service.activatePlugin('alpha');

      expect(JSON.parse(snapshots[0]).plugins.entries.alpha).toMatchObject({
        version: '9.9.9',
        source: 'npm',
        config: { keep: true },
      });
      expect(readSaved().plugins?.entries.alpha).toMatchObject({
        version: '1.2.3',
        source: 'npm',
        config: { keep: true },
      });
      expect(readSaved().plugins?.activePlugins).toEqual(['alpha']);
    });

    it('does not reinstall when runtime files already exist', async () => {
      copyAlphaRuntimeManifest();
      fs.writeFileSync(path.join(runtimePlugin('alpha'), 'marker.txt'), 'keep');
      setPlugins({ installedPlugins: ['alpha'], entries: {} });

      await service.activatePlugin('alpha');

      expect(fs.readFileSync(path.join(runtimePlugin('alpha'), 'marker.txt'), 'utf8')).toBe('keep');
      expect(readSaved().plugins?.entries.alpha).toMatchObject({ version: '1.2.3', source: 'local' });
    });

    it('rejects activation when the runtime manifest is missing after recording the template', async () => {
      fs.mkdirSync(runtimePlugin('alpha'), { recursive: true });
      fs.writeFileSync(path.join(runtimePlugin('alpha'), 'plugin.json'), '{');

      await expect(service.activatePlugin('alpha')).rejects.toThrow('Plugin "alpha" not found in runtime');
      expect(readSaved().plugins?.installedPlugins).toEqual(['alpha']);
      expect(readSaved().plugins?.activePlugins).toEqual([]);
    });

    it('rejects activation when an installed plugin has no runtime manifest', async () => {
      fs.mkdirSync(runtimePlugin('alpha'), { recursive: true });
      setPlugins({ installedPlugins: ['alpha'] });

      await expect(service.activatePlugin('alpha')).rejects.toThrow('not found in runtime');
      expect(settingRepository.save).not.toHaveBeenCalled();
    });

    it('rejects activation when every plugin.json is invalid', async () => {
      fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), '{');
      fs.mkdirSync(runtimePlugin('alpha'), { recursive: true });
      fs.writeFileSync(path.join(runtimePlugin('alpha'), 'plugin.json'), '{');

      await expect(service.activatePlugin('alpha')).rejects.toThrow('Plugin "alpha" has invalid plugin.json');
    });

    it('refreshes an active plugin and clears its load error', async () => {
      copyAlphaRuntimeManifest();
      setPlugins({
        installedPlugins: ['alpha'],
        activePlugins: ['alpha'],
        entries: { alpha: { version: '0.0.1', source: 'local', loadError: 'old', config: { k: 1 } } },
      });

      await service.activatePlugin('alpha');

      const entry = readSaved().plugins?.entries.alpha;
      expect(readSaved().plugins?.activePlugins).toEqual(['alpha']);
      expect(entry).toMatchObject({ version: '1.2.3', source: 'local', config: { k: 1 } });
      expect(entry?.loadError).toBeUndefined();
      expect(entry?.activatedAt).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    });

    it('rejects an invalid dependency and a dependency that is not active', async () => {
      writePlugin('needs-bad', {
        id: 'needs-bad',
        name: 'Needs Bad',
        version: '1.0.0',
        requiresPlugins: ['BAD'],
      });
      await expect(service.activatePlugin('needs-bad')).rejects.toThrow('invalid dependency "BAD"');

      row.globalSetting = '';
      await expect(service.activatePlugin('beta')).rejects.toThrow('requires active plugin "alpha"');
      expect(readSaved().plugins?.installedPlugins).toEqual(['beta']);
      expect(readSaved().plugins?.activePlugins).toEqual([]);
    });

    it('allows a plugin to require itself', async () => {
      writePlugin('solo', { id: 'solo', name: 'Solo', version: '1.0.0', requiresPlugins: ['solo'] });
      await service.activatePlugin('solo');
      expect(readSaved().plugins?.activePlugins).toEqual(['solo']);
    });

    it('activates when required plugins are already active and does not duplicate ids', async () => {
      await service.activatePlugin('alpha');
      await service.activatePlugin('beta');
      await service.activatePlugin('beta');
      expect(readSaved().plugins?.activePlugins).toEqual(['alpha', 'beta']);
    });

    it('removes one plugin from the active list', async () => {
      setPlugins({
        installedPlugins: ['alpha', 'beta'],
        activePlugins: ['alpha', 'beta'],
        entries: { alpha: { version: '1.2.3', source: 'local', config: { a: 1 } } },
      });

      await service.deactivatePlugin('alpha');
      expect(readSaved().plugins?.activePlugins).toEqual(['beta']);
      expect(readSaved().plugins?.installedPlugins).toEqual(['alpha', 'beta']);
      expect(readSaved().plugins?.entries.alpha).toMatchObject({ config: { a: 1 } });

      await service.deactivatePlugin('alpha');
      expect(readSaved().plugins?.activePlugins).toEqual(['beta']);
    });
  });

  describe('uninstall', () => {
    it('refuses to uninstall an active plugin', async () => {
      await service.installPlugin('alpha');
      await service.activatePlugin('alpha');
      await expect(service.uninstallPlugin('alpha')).rejects.toThrow('Deactivate plugin "alpha" before uninstalling');
      expect(fs.existsSync(runtimePlugin('alpha'))).toBe(true);
    });

    it('removes a symlinked runtime plugin and keeps the template', async () => {
      await service.installPlugin('alpha');
      await service.installPlugin('beta');
      await service.uninstallPlugin('beta');

      expect(fs.existsSync(path.join(root, 'plugins', 'beta', 'plugin.json'))).toBe(true);
      expect(fs.existsSync(runtimePlugin('beta'))).toBe(false);
      expect(fs.existsSync(runtimePlugin('alpha'))).toBe(true);
      expect(readSaved().plugins?.installedPlugins).toEqual(['alpha']);
      expect(readSaved().plugins?.entries.beta).toBeUndefined();
      expect(readSaved().plugins?.entries.alpha).toBeDefined();
    });

    it('deletes a copied runtime directory, including nested files and links', async () => {
      const target = runtimePlugin('alpha');
      fs.mkdirSync(path.join(target, 'nested'), { recursive: true });
      fs.writeFileSync(path.join(target, 'file.txt'), 'a');
      fs.writeFileSync(path.join(target, 'nested', 'inner.txt'), 'b');
      fs.symlinkSync('file.txt', path.join(target, 'link.txt'));
      setPlugins({
        installedPlugins: ['alpha'],
        entries: { alpha: { version: '1.2.3', source: 'local' } },
      });

      await service.uninstallPlugin('alpha');
      expect(fs.existsSync(target)).toBe(false);
      expect(readSaved().plugins?.entries.alpha).toBeUndefined();
    });

    it('unlinks a runtime path that is a file', async () => {
      fs.mkdirSync(service.runtimeDir(), { recursive: true });
      fs.writeFileSync(runtimePlugin('alpha'), 'file');
      setPlugins({ installedPlugins: ['alpha'] });

      await service.uninstallPlugin('alpha');
      expect(fs.existsSync(runtimePlugin('alpha'))).toBe(false);
    });

    it('drops state when the runtime directory is already gone', async () => {
      setPlugins({
        installedPlugins: ['alpha', 'beta'],
        activePlugins: ['alpha'],
        entries: {
          alpha: { version: '1.2.3', source: 'local' },
          beta: { version: '2.0.0', source: 'local', config: { title: 'B' } },
        },
      });

      await service.uninstallPlugin('beta');
      expect(readSaved().plugins?.installedPlugins).toEqual(['alpha']);
      expect(readSaved().plugins?.activePlugins).toEqual(['alpha']);
      expect(readSaved().plugins?.entries.beta).toBeUndefined();
      expect(readSaved().plugins?.entries.alpha).toBeDefined();
    });

    it('stops removal if the runtime path disappears before delete', async () => {
      const target = runtimePlugin('alpha');
      const realExists = fs.existsSync.bind(fs);
      let seen = 0;
      jest.spyOn(fs, 'existsSync').mockImplementation((targetPath) => {
        if (path.resolve(String(targetPath)) === path.resolve(target)) {
          seen += 1;
          return seen === 1;
        }
        return realExists(targetPath);
      });
      setPlugins({ installedPlugins: ['alpha'] });

      await service.uninstallPlugin('alpha');
      expect(seen).toBeGreaterThanOrEqual(2);
      expect(readSaved().plugins?.installedPlugins).toEqual([]);
    });
  });

  describe('updatePluginConfig', () => {
    it('uses a fallback message when validation does not explain the failure', async () => {
      setPlugins({ installedPlugins: ['alpha'] });
      jest.mocked(pluginExtension.validatePluginSettings).mockReturnValue({ valid: false, errors: null });
      await expect(service.updatePluginConfig('alpha', { title: 'x' })).rejects.toThrow('Invalid plugin configuration');
    });

    it('rejects a plugin that is not installed', async () => {
      await expect(service.updatePluginConfig('beta', { title: 'Hello' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.updatePluginConfig('beta', { title: 'Hello' })).rejects.toThrow(
        'Plugin "beta" is not installed'
      );
    });

    it('rejects arbitrary config when the plugin has no schema and accepts an empty object', async () => {
      setPlugins({ installedPlugins: ['alpha'] });
      await expect(service.updatePluginConfig('alpha', { title: 'x' })).rejects.toThrow(
        'Plugin has no configurable settings'
      );
      expect(settingRepository.save).not.toHaveBeenCalled();

      const state = await service.updatePluginConfig('alpha', {});
      expect(state.entries.alpha).toMatchObject({ version: '0.0.0', source: 'local', config: {} });
    });

    it('validates config against the runtime schema', async () => {
      await service.installPlugin('beta');
      await expect(service.updatePluginConfig('beta', { title: 1 })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.updatePluginConfig('beta', [] as unknown as Record<string, unknown>)).rejects.toThrow(
        'Plugin config must be a JSON object'
      );
      await expect(
        service.updatePluginConfig('beta', JSON.parse('{"__proto__":{"x":1}}') as Record<string, unknown>)
      ).rejects.toThrow('Invalid config key "__proto__"');
      expect(readSaved().plugins?.entries.beta.config).toBeUndefined();

      const state = await service.updatePluginConfig('beta', { title: 'Hello' });
      expect(state.entries.beta.config).toEqual({ title: 'Hello' });
      expect(state.entries.beta.version).toBe('2.0.0');
    });

    it('encrypts a new AI Assist key and strips admin-only fields', async () => {
      writePlugin('ai-assist', aiManifest);
      await service.installPlugin('ai-assist');
      const saved = readSaved();
      delete saved.plugins?.entries['ai-assist'];
      row.globalSetting = JSON.stringify(saved);

      await service.updatePluginConfig('ai-assist', {
        apiKey: 'sk-new-key-9876',
        model: 'gpt-4o-mini',
        apiKeyHint: '9876',
        apiKeyConfigured: true,
      });

      const entry = readSaved().plugins?.entries['ai-assist'];
      expect(entry).toMatchObject({ version: '0.0.0', source: 'local' });
      expect(entry?.config?.model).toBe('gpt-4o-mini');
      expect(entry?.config?.apiKeyHint).toBeUndefined();
      expect(entry?.config?.apiKeyConfigured).toBeUndefined();
      expect(entry?.config?.apiKey).not.toBe('sk-new-key-9876');
      expect(decryptAiSecret(String(entry?.config?.apiKey))).toBe('sk-new-key-9876');
    });

    it('keeps the previous AI Assist key when the form leaves it blank', async () => {
      writePlugin('ai-assist', aiManifest);
      await service.installPlugin('ai-assist');
      const saved = readSaved();
      saved.plugins!.entries['ai-assist'].config = { apiKey: 'sk-old-key-1234', model: 'old' };
      row.globalSetting = JSON.stringify(saved);

      await service.updatePluginConfig('ai-assist', { apiKey: '  ', model: 'gpt-4o-mini' });

      const config = readSaved().plugins?.entries['ai-assist'].config;
      expect(String(config?.apiKey).startsWith('enc:v1:')).toBe(true);
      expect(decryptAiSecret(String(config?.apiKey))).toBe('sk-old-key-1234');
      expect(config?.model).toBe('gpt-4o-mini');
    });

    it('stores an empty AI Assist key when none was saved before', async () => {
      writePlugin('ai-assist', aiManifest);
      await service.installPlugin('ai-assist');
      await service.updatePluginConfig('ai-assist', { apiKey: '' });
      expect(readSaved().plugins?.entries['ai-assist'].config).toEqual({ apiKey: '' });
    });
  });

  describe('ensureDefaultPlugins', () => {
    it('returns immediately once defaults have been seeded', async () => {
      writePlugin('ai-assist', aiManifest);
      setPlugins({ pluginDefaultsSeeded: true, installedPlugins: ['alpha'] });
      await service.ensureDefaultPlugins();
      expect(settingRepository.save).not.toHaveBeenCalled();
      expect(readSaved().plugins?.installedPlugins).toEqual(['alpha']);
    });

    it('does not install AI Assist when the site already has plugin state', async () => {
      writePlugin('ai-assist', aiManifest);

      setPlugins({ installedPlugins: ['alpha'] });
      await service.ensureDefaultPlugins();
      expect(readSaved().plugins?.installedPlugins).toEqual(['alpha']);
      expect(readSaved().plugins?.activePlugins).toEqual([]);
      expect(readSaved().pluginDefaultsSeeded).toBe(true);

      setPlugins({ activePlugins: ['alpha'] });
      await service.ensureDefaultPlugins();
      expect(readSaved().plugins?.installedPlugins).toEqual([]);
      expect(readSaved().plugins?.activePlugins).toEqual(['alpha']);

      setPlugins({ entries: { alpha: { version: '1.0.0', source: 'local' } } });
      await service.ensureDefaultPlugins();
      expect(readSaved().plugins?.installedPlugins).toEqual([]);
      expect(readSaved().plugins?.entries.alpha).toMatchObject({ version: '1.0.0' });
      expect(fs.existsSync(runtimePlugin('ai-assist'))).toBe(false);
      expect(readSaved().pluginDefaultsSeeded).toBe(true);
    });

    it('marks a fresh site as seeded when the AI Assist template is missing', async () => {
      row.globalSetting = '{';
      await service.ensureDefaultPlugins();
      expect(readSaved()).toEqual({ pluginDefaultsSeeded: true });
    });

    it('installs and activates AI Assist on a fresh site', async () => {
      writePlugin('ai-assist', aiManifest);
      row.globalSetting = '';
      await service.ensureDefaultPlugins();

      const saved = readSaved();
      expect(saved.pluginDefaultsSeeded).toBe(true);
      expect(saved.plugins?.installedPlugins).toEqual(['ai-assist']);
      expect(saved.plugins?.activePlugins).toEqual(['ai-assist']);
      expect(saved.plugins?.entries['ai-assist'].version).toBe('4.0.0');
      expect(saved.plugins?.entries['ai-assist'].activatedAt).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
      expect(fs.lstatSync(runtimePlugin('ai-assist')).isSymbolicLink()).toBe(true);
    });
  });

  describe('load errors and plugin context', () => {
    it('builds a plugin context and writes through the service logger', async () => {
      const manifest = { id: 'alpha', name: 'Alpha', version: '1.2.3' };
      const empty = await service.createPluginContext('alpha', manifest);
      expect(empty).toMatchObject({ id: 'alpha', version: '1.2.3', config: {} });
      empty.logger.log('hello');
      empty.logger.warn('careful');
      empty.logger.error('boom');
      expect(logSpy).toHaveBeenCalledWith('[alpha] hello');
      expect(warnSpy).toHaveBeenCalledWith('[alpha] careful');
      expect(errorSpy).toHaveBeenCalledWith('[alpha] boom');

      setPlugins({
        entries: { alpha: { version: '1.2.3', source: 'local', config: { title: 'T' } } },
      });
      const withConfig = await service.createPluginContext('alpha', manifest);
      expect(withConfig.config).toEqual({ title: 'T' });
    });

    it('records a load error on a new or existing entry', async () => {
      await service.recordLoadError('alpha', 'first');
      expect(readSaved().plugins?.entries.alpha).toMatchObject({
        version: '0.0.0',
        source: 'local',
        loadError: 'first',
      });

      setPlugins({
        entries: { alpha: { version: '9.0.0', source: 'npm', config: { a: 1 } } },
      });
      await service.recordLoadError('alpha', 'second');
      expect(readSaved().plugins?.entries.alpha).toMatchObject({
        version: '9.0.0',
        source: 'npm',
        config: { a: 1 },
        loadError: 'second',
      });
    });

    it('clears a load error and ignores entries that have none', async () => {
      await service.clearLoadError('alpha');
      setPlugins({ entries: { alpha: { version: '1.0.0', source: 'local' } } });
      await service.clearLoadError('alpha');
      expect(settingRepository.save).not.toHaveBeenCalled();

      setPlugins({
        entries: { alpha: { version: '1.0.0', source: 'local', loadError: 'boom', config: { a: 1 } } },
      });
      await service.clearLoadError('alpha');
      expect(readSaved().plugins?.entries.alpha.loadError).toBeUndefined();
      expect(readSaved().plugins?.entries.alpha).toMatchObject({
        version: '1.0.0',
        source: 'local',
        config: { a: 1 },
      });
    });
  });
});
