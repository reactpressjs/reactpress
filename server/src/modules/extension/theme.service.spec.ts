import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Setting } from '../setting/setting.entity';
import { SettingService } from '../setting/setting.service';
import { ThemeService } from './theme.service';
import {
  findThemeCatalogEntry,
  readThemeCatalogEntries,
  readThemesPackageMeta,
  resolveThemeCatalogInstallSpec,
} from './theme-registry.bridge';

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    spawn: jest.fn(() => ({ unref: jest.fn() })),
  };
});

jest.mock('./theme-registry.bridge', () => ({
  findThemeCatalogEntry: jest.fn(),
  loadThemeRegistry: jest.fn(() => ({
    catalogEntryToManifest: (entry: {
      id: string;
      name: string;
      version: string;
      description?: string;
      tags?: string[];
    }) => ({
      id: entry.id,
      name: entry.name,
      version: entry.version,
      description: entry.description,
      tags: entry.tags,
    }),
  })),
  readThemeCatalogEntries: jest.fn(),
  readThemesPackageMeta: jest.fn(),
  resolveThemeCatalogInstallSpec: jest.fn(),
}));

const spawnMock = spawn as unknown as jest.Mock;

const INSTALLER_SOURCE = `'use strict';
const fs = require('fs');
const path = require('path');

async function installThemeFromNpm(root, npmSpec, opts) {
  const reactpressDir = path.join(root, '.reactpress');
  fs.mkdirSync(reactpressDir, { recursive: true });
  fs.writeFileSync(
    path.join(reactpressDir, 'last-install.json'),
    JSON.stringify({
      root,
      npmSpec,
      skipDependencies: !!(opts && opts.skipDependencies),
    })
  );
  const controlPath = path.join(reactpressDir, 'install-control.json');
  const control = fs.existsSync(controlPath) ? JSON.parse(fs.readFileSync(controlPath, 'utf8')) : {};
  if (control.mode === 'throw-error') {
    throw new Error(control.message == null ? 'install failed' : control.message);
  }
  if (control.mode === 'throw-string') {
    throw 'plain failure';
  }
  const themeId = control.themeId || 'shop';
  if (control.mode !== 'skip-materialize') {
    const runtime = path.join(root, '.reactpress', 'runtime', themeId);
    fs.mkdirSync(runtime, { recursive: true });
    fs.writeFileSync(
      path.join(runtime, 'theme.json'),
      JSON.stringify({
        id: themeId,
        name: control.name || 'Shop',
        version: control.version || '2.0.0',
        description: control.description,
        tags: control.tags,
      })
    );
  }
  return { themeId, npmSpec };
}

module.exports = { installThemeFromNpm };
`;

const ENV_KEYS = [
  'REACTPRESS_ORIGINAL_CWD',
  'REACTPRESS_MONOREPO_ROOT',
  'NODE_ENV',
  'REACTPRESS_SKIP_CLIENT_RESTART',
  'REACTPRESS_THEME_RUNTIME_COPY',
  'REACTPRESS_THEME_RUNTIME_SYMLINK',
  'REACTPRESS_PREVIEW_PORT',
  'NGINX_ENTRY_URL',
  'REACTPRESS_NGINX_ENTRY_URL',
  'NGINX_PORT',
  'CLIENT_SITE_URL',
] as const;

type CatalogEntry = {
  id: string;
  name: string;
  version: string;
  npm: string;
  description?: string;
  author?: string;
  tags?: string[];
  featured?: boolean;
  dependency?: { name: string; version: string };
  themeUri?: string;
  previewUrl?: string;
  requires?: string;
};

const helloManifest = {
  id: 'hello-world',
  name: 'Hello World',
  version: '1.0.0',
  description: 'Starter theme',
  author: 'ReactPress',
  tags: ['starter'],
  cover: 'images/custom-cover.svg',
  appearance: {
    sections: [
      {
        id: 'colors',
        title: 'Colors',
        settings: [
          { id: 'primaryColor', type: 'color', label: 'Primary', default: '#112233' },
          { id: 'accentColor', type: 'color', label: 'Accent', default: '#abcdef' },
        ],
      },
    ],
  },
  options: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string', default: 'Hello' },
    },
  },
};

describe('ThemeService', () => {
  let root: string;
  let extraDirs: string[];
  let moduleRef: TestingModule;
  let service: ThemeService;
  let row: Setting;
  let repository: { save: jest.Mock };
  let catalog: CatalogEntry[];
  let unref: jest.Mock;
  const previousEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  function writeJson(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
  }

  function writeTheme(
    relDir: string,
    manifest: Record<string, unknown>,
    files: Record<string, string> = {},
    base = root
  ): string {
    const dir = path.join(base, relDir);
    writeJson(path.join(dir, 'theme.json'), manifest);
    for (const [name, content] of Object.entries(files)) {
      const full = path.join(dir, name);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    return dir;
  }

  function installerFile(targetRoot: string): string {
    return path.join(targetRoot, 'cli', 'lib', 'theme-install.js');
  }

  function writeInstaller(targetRoot: string): void {
    const file = installerFile(targetRoot);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, INSTALLER_SOURCE);
    forgetInstaller();
  }

  function forgetInstaller(): void {
    const suffix = `${path.sep}cli${path.sep}lib${path.sep}theme-install.js`;
    for (const key of Object.keys(require.cache)) {
      if (key.endsWith(suffix)) delete require.cache[key];
    }
  }

  function writeControl(control: Record<string, unknown>): void {
    writeJson(path.join(root, '.reactpress', 'install-control.json'), control);
  }

  function readLastInstall(): { root: string; npmSpec: string; skipDependencies: boolean } {
    return JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'last-install.json'), 'utf8'));
  }

  function readGlobalTheme(): {
    activeTheme: string;
    installedThemes: string[];
    previewThemeId?: string;
    mods: Record<string, Record<string, string>>;
  } {
    return JSON.parse(row.globalSetting).theme;
  }

  function resetEnv(site = root, mono = site): void {
    process.env.REACTPRESS_ORIGINAL_CWD = site;
    process.env.REACTPRESS_MONOREPO_ROOT = mono;
    process.env.NODE_ENV = 'test';
    delete process.env.REACTPRESS_SKIP_CLIENT_RESTART;
    delete process.env.REACTPRESS_THEME_RUNTIME_COPY;
    delete process.env.REACTPRESS_THEME_RUNTIME_SYMLINK;
    delete process.env.REACTPRESS_PREVIEW_PORT;
    delete process.env.NGINX_ENTRY_URL;
    delete process.env.REACTPRESS_NGINX_ENTRY_URL;
    delete process.env.NGINX_PORT;
    delete process.env.CLIENT_SITE_URL;
  }

  function restoreEnv(): void {
    for (const key of ENV_KEYS) {
      const value = previousEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  beforeAll(() => {
    for (const key of ENV_KEYS) previousEnv[key] = process.env[key];
  });

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-theme-svc-'));
    extraDirs = [];
    resetEnv();
    writeInstaller(root);
    fs.writeFileSync(path.join(root, 'tsconfig.base.json'), '{"files":[]}\n');
    writeTheme('themes/hello-world', helloManifest, {
      'cover.png': 'PNG',
      'locales/en.json': JSON.stringify({ 'theme.name': 'Hello' }),
      'locales/zh.json': JSON.stringify({ 'theme.name': '你好' }),
    });

    catalog = [
      {
        id: 'shop',
        name: 'Shop',
        version: '2.0.0',
        npm: '@acme/theme-shop',
        featured: true,
        description: 'Shop theme',
        tags: ['store'],
        dependency: { name: '@acme/theme-shop', version: '2.0.0' },
        themeUri: 'https://example.test/shop',
        previewUrl: 'https://example.test/shop/preview',
      },
      {
        id: 'plain',
        name: 'Plain',
        version: '0.1.0',
        npm: '@acme/plain',
        description: 'Plain theme',
        tags: ['misc'],
      },
      {
        id: 'official-pack',
        name: 'Official Pack',
        version: '1.2.0',
        npm: '@acme/official-pack',
        tags: ['官方'],
      },
    ];

    (readThemeCatalogEntries as jest.Mock).mockImplementation(() => catalog);
    (findThemeCatalogEntry as jest.Mock).mockImplementation(
      (id: string) => catalog.find((entry) => entry.id === id) ?? null
    );
    (readThemesPackageMeta as jest.Mock).mockReturnValue({
      bundled: ['hello-world', 'missing-local'],
      catalog: ['shop', 'plain', 'official-pack'],
    });
    (resolveThemeCatalogInstallSpec as jest.Mock).mockImplementation((input: string) => {
      if (input === 'shop' || input === '@acme/theme-shop') return '@acme/theme-shop@2.0.0';
      return null;
    });

    row = {
      id: 'setting-1',
      globalSetting: JSON.stringify({
        theme: {
          activeTheme: 'hello-world',
          installedThemes: ['hello-world'],
          mods: {
            'hello-world': { primaryColor: '#111111', tagline: 'keep' },
          },
        },
      }),
      systemUrl: 'http://blog.test',
    } as Setting;

    repository = { save: jest.fn(async (saved: Setting) => saved) };
    unref = jest.fn();
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => ({ unref }));

    moduleRef = await Test.createTestingModule({
      providers: [
        ThemeService,
        { provide: getRepositoryToken(Setting), useValue: repository },
        { provide: SettingService, useValue: { getSettingRow: jest.fn(async () => row) } },
      ],
    }).compile();
    service = moduleRef.get(ThemeService);
  });

  afterEach(async () => {
    await moduleRef?.close();
    jest.restoreAllMocks();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    for (const dir of extraDirs) fs.rmSync(dir, { recursive: true, force: true });
    restoreEnv();
  });

  it('reads theme state and tolerates an empty or corrupt global setting', async () => {
    await expect(service.getThemeState()).resolves.toMatchObject({
      activeTheme: 'hello-world',
      installedThemes: ['hello-world'],
      mods: { 'hello-world': { primaryColor: '#111111', tagline: 'keep' } },
    });

    row.globalSetting = '{';
    await expect(service.getThemeState()).resolves.toMatchObject({
      activeTheme: 'hello-world',
      installedThemes: ['hello-world'],
      mods: {},
    });

    row.globalSetting = '';
    await expect(service.getThemeState()).resolves.toMatchObject({ activeTheme: 'hello-world' });
  });

  it('lists local, installed, and catalog themes', async () => {
    const theme = JSON.parse(row.globalSetting);
    theme.theme.installedThemes = ['hello-world', 'plain'];
    row.globalSetting = JSON.stringify(theme);

    writeTheme(path.join('.reactpress', 'runtime', 'branded'), {
      id: 'branded',
      name: 'Branded',
      version: '1.0.0',
      tags: ['Official'],
    });
    writeTheme(path.join('.reactpress', 'runtime', 'community'), {
      id: 'community',
      name: 'Community',
      version: '1.0.0',
      tags: ['community'],
    });
    writeJson(path.join(root, '.reactpress', 'themes.lock.json'), {
      themes: {
        'branded': {
          source: 'npm',
          spec: '@acme/branded@1.0.0',
          resolvedVersion: '1.0.0',
          packageName: '@acme/branded',
          installedAt: '2026-01-01T00:00:00.000Z',
        },
        'hello-world': { source: 'local', spec: 'file:themes/hello-world' },
        'nospec': { source: 'npm' },
      },
    });

    const items = await service.listThemes();
    const names = items.map((item) => item.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

    expect(items.find((item) => item.id === 'hello-world')).toEqual(
      expect.objectContaining({
        source: 'local',
        installed: true,
        active: true,
        official: true,
        coverUrl: '/api/extension/themes/hello-world/cover',
        npm: undefined,
      })
    );
    expect(items.find((item) => item.id === 'shop')).toEqual(
      expect.objectContaining({
        source: 'npm',
        installed: false,
        official: true,
        catalog: expect.objectContaining({ featured: true, npm: '@acme/theme-shop' }),
      })
    );
    expect(items.find((item) => item.id === 'plain')).toEqual(
      expect.objectContaining({ source: 'npm', installed: true, official: false })
    );
    expect(items.find((item) => item.id === 'official-pack')).toEqual(
      expect.objectContaining({ source: 'npm', official: true })
    );
    expect(items.find((item) => item.id === 'branded')).toEqual(
      expect.objectContaining({
        source: 'installed',
        installed: true,
        official: true,
        npm: expect.objectContaining({ spec: '@acme/branded@1.0.0', packageName: '@acme/branded' }),
        catalog: { npm: '@acme/branded@1.0.0' },
      })
    );
    expect(items.find((item) => item.id === 'community')).toEqual(
      expect.objectContaining({ source: 'installed', official: false, catalog: undefined, npm: undefined })
    );
    expect(items.find((item) => item.id === 'missing-local')).toBeUndefined();
    expect(service.getThemeCatalog()).toBe(catalog);
  });

  it('overlays template appearance onto a runtime install and attaches catalog npm metadata', async () => {
    writeTheme(path.join('.reactpress', 'runtime', 'hello-world'), {
      id: 'hello-world',
      name: 'Hello Runtime',
      version: '9.9.9',
    });
    writeTheme(path.join('.reactpress', 'runtime', 'shop'), {
      id: 'shop',
      name: 'Shop Runtime',
      version: '2.0.0',
    });
    writeJson(path.join(root, '.reactpress', 'themes.lock.json'), {
      themes: {
        shop: { source: 'npm', spec: '@acme/theme-shop@2.0.0', resolvedVersion: '2.0.0' },
      },
    });

    const items = await service.listThemes();
    const hello = items.find((item) => item.id === 'hello-world');
    expect(hello).toEqual(expect.objectContaining({ source: 'installed', name: 'Hello Runtime', version: '9.9.9' }));
    expect(hello?.appearance?.sections?.[0]?.settings?.[0]?.default).toBe('#112233');
    expect(hello?.options).toEqual(expect.objectContaining({ type: 'object' }));
    expect(items.find((item) => item.id === 'shop')?.catalog).toEqual(
      expect.objectContaining({
        featured: true,
        previewUrl: 'https://example.test/shop/preview',
        npm: '@acme/theme-shop',
      })
    );
  });

  it('lists symlink themes and recovers from bad manifests and a corrupt npm lock', async () => {
    const runtime = path.join(root, '.reactpress', 'runtime');
    writeTheme('themes/link-src', { id: 'link-theme', name: 'Link Theme', version: '1.0.0' });
    fs.mkdirSync(runtime, { recursive: true });
    fs.symlinkSync(
      path.relative(runtime, path.join(root, 'themes', 'link-src')),
      path.join(runtime, 'link-theme'),
      'dir'
    );
    fs.writeFileSync(path.join(runtime, 'notes.txt'), 'ignore');
    fs.writeFileSync(path.join(runtime, 'file-target.txt'), 'file');
    fs.symlinkSync('file-target.txt', path.join(runtime, 'file-link'));
    fs.symlinkSync('missing-target', path.join(runtime, 'broken'));
    fs.mkdirSync(path.join(runtime, 'bad-json'));
    fs.writeFileSync(path.join(runtime, 'bad-json', 'theme.json'), '{');
    writeJson(path.join(runtime, 'partial', 'theme.json'), { description: 'fallback' });
    fs.mkdirSync(path.join(runtime, 'stringy'));
    fs.writeFileSync(path.join(runtime, 'stringy', 'theme.json'), JSON.stringify('hello'));
    fs.writeFileSync(path.join(root, '.reactpress', 'themes.lock.json'), '{');

    const items = await service.listThemes();
    const ids = items.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(['link-theme', 'partial', 'stringy', 'hello-world', 'shop']));
    expect(ids).not.toContain('bad-json');
    expect(ids).not.toContain('broken');
    expect(items.find((item) => item.id === 'partial')?.name).toBe('partial');
    expect(items.find((item) => item.id === 'stringy')?.name).toBe('stringy');
    expect(items.find((item) => item.id === 'link-theme')?.npm).toBeUndefined();
  });

  it('returns a listed theme and rejects unknown ids', async () => {
    await expect(service.getTheme('hello-world')).resolves.toEqual(
      expect.objectContaining({ id: 'hello-world', active: true, source: 'local' })
    );
    await expect(service.getTheme('plain')).resolves.toEqual(
      expect.objectContaining({ source: 'npm', installed: false })
    );
    await expect(service.getTheme('missing-theme')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('still lists catalog themes when the themes directory is missing', async () => {
    fs.rmSync(path.join(root, 'themes'), { recursive: true, force: true });
    const items = await service.listThemes();
    expect(items.map((item) => item.id).sort()).toEqual(['official-pack', 'plain', 'shop']);
    await expect(service.getTheme('hello-world')).rejects.toThrow('Theme "hello-world" not found');
  });

  it('reads admin locale files and rejects invalid or missing themes', async () => {
    await expect(service.getThemeAdminLocale('hello-world', 'en')).resolves.toEqual({
      themeId: 'hello-world',
      locale: 'en',
      messages: { 'theme.name': 'Hello' },
    });
    await expect(service.getThemeAdminLocale('hello-world', 'zh')).resolves.toEqual({
      themeId: 'hello-world',
      locale: 'zh',
      messages: { 'theme.name': '你好' },
    });
    await expect(service.getThemeAdminLocale('hello-world', 'english')).resolves.toEqual({
      themeId: 'hello-world',
      locale: 'en',
      messages: { 'theme.name': 'Hello' },
    });

    writeTheme(path.join('.reactpress', 'runtime', 'hello-world'), helloManifest, {
      'locales/en.json': JSON.stringify({ 'theme.name': 'Runtime' }),
    });
    await expect(service.getThemeAdminLocale('hello-world', 'en')).resolves.toEqual(
      expect.objectContaining({ messages: { 'theme.name': 'Hello' } })
    );

    fs.rmSync(path.join(root, 'themes', 'hello-world', 'locales'), { recursive: true, force: true });
    await expect(service.getThemeAdminLocale('hello-world', 'not-a-locale')).resolves.toEqual({
      themeId: 'hello-world',
      locale: 'en',
      messages: { 'theme.name': 'Runtime' },
    });

    writeTheme(
      path.join('.reactpress', 'runtime', 'runtime-only'),
      {
        id: 'runtime-only',
        name: 'Runtime Only',
        version: '1.0.0',
      },
      {
        'locales/en.json': '[]',
      }
    );
    await expect(service.getThemeAdminLocale('runtime-only', 'en')).resolves.toEqual({
      themeId: 'runtime-only',
      locale: 'en',
      messages: {},
    });

    fs.writeFileSync(path.join(root, '.reactpress', 'runtime', 'runtime-only', 'locales', 'en.json'), '{');
    await expect(service.getThemeAdminLocale('runtime-only', 'en')).resolves.toEqual(
      expect.objectContaining({ messages: {} })
    );

    await expect(service.getThemeAdminLocale('../bad', 'en')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getThemeAdminLocale('missing-theme', 'en')).rejects.toBeInstanceOf(NotFoundException);
    fs.mkdirSync(path.join(root, 'themes', 'starter'));
    await expect(service.getThemeAdminLocale('starter', 'en')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns configuration schema and merged configuration', async () => {
    await expect(service.getThemeConfigurationSchema('hello-world')).resolves.toEqual({
      themeId: 'hello-world',
      schema: expect.objectContaining({ type: 'object' }),
    });
    await expect(service.getThemeConfiguration('hello-world')).resolves.toEqual({
      themeId: 'hello-world',
      configuration: { title: 'Hello' },
    });

    const stored = JSON.parse(row.globalSetting);
    stored.config = { 'hello-world': { title: 'Saved' } };
    row.globalSetting = JSON.stringify(stored);
    await expect(service.getThemeConfiguration('hello-world')).resolves.toEqual({
      themeId: 'hello-world',
      configuration: { title: 'Saved' },
    });

    writeTheme('themes/noschema', { id: 'noschema', name: 'No Schema', version: '1.0.0' });
    await expect(service.getThemeConfigurationSchema('noschema')).resolves.toEqual({
      themeId: 'noschema',
      schema: null,
    });
    await expect(service.getThemeConfiguration('noschema')).resolves.toEqual({
      themeId: 'noschema',
      configuration: {},
    });

    writeTheme('themes/twentytwentyfive', { id: 'twentytwentyfive', name: 'TTF', version: '1.0.0' });
    const preset = await service.getThemeConfigurationSchema('twentytwentyfive');
    expect(preset.schema).toEqual(expect.objectContaining({ title: 'Twenty Twenty-Five', type: 'object' }));

    await expect(service.getThemeConfigurationSchema('nope')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getThemeConfiguration('nope')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getThemeConfigurationSchema('Bad Id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getThemeConfiguration(`a${'b'.repeat(64)}`)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('patches, replaces, and rejects theme configuration', async () => {
    const patched = await service.updateThemeConfiguration('hello-world', { title: 'Saved' });
    expect(patched).toEqual({ themeId: 'hello-world', configuration: { title: 'Saved' } });
    expect(JSON.parse(row.globalSetting)).toEqual(
      expect.objectContaining({
        theme: expect.objectContaining({ activeTheme: 'hello-world' }),
        config: { 'hello-world': { title: 'Saved' } },
      })
    );

    const replaced = await service.updateThemeConfiguration('hello-world', { title: 'Ignored' }, { replace: true });
    expect(replaced.configuration).toEqual({ title: 'Saved' });

    repository.save.mockClear();
    await expect(service.updateThemeConfiguration('hello-world', { title: 1, extra: true })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(repository.save).not.toHaveBeenCalled();

    writeTheme('themes/strict-theme', {
      id: 'strict-theme',
      name: 'Strict',
      version: '1.0.0',
      options: {
        type: 'object',
        additionalProperties: false,
        required: ['title'],
        properties: { title: { type: 'string' } },
      },
    });
    await expect(
      service.updateThemeConfiguration('strict-theme', {}, { replace: true, locale: 'en' })
    ).rejects.toBeInstanceOf(BadRequestException);

    writeTheme('themes/noschema', { id: 'noschema', name: 'No Schema', version: '1.0.0' });
    await expect(service.updateThemeConfiguration('noschema', { title: 'x' })).rejects.toThrow(
      'does not declare options schema'
    );
    await expect(service.updateThemeConfiguration('missing-theme', {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.updateThemeConfiguration('..', {})).rejects.toBeInstanceOf(BadRequestException);

    writeTheme('themes/twentytwentyfive', { id: 'twentytwentyfive', name: 'TTF', version: '1.0.0' });
    const preset = await service.updateThemeConfiguration(
      'twentytwentyfive',
      { header: { navLinks: 'nope' } },
      { replace: true, locale: 'en' }
    );
    expect(preset.themeId).toBe('twentytwentyfive');
    expect(preset.configuration).toEqual(
      expect.objectContaining({ header: expect.any(Object), nav: expect.any(Object) })
    );
  });

  it('symlinks a template into the runtime and records it as installed', async () => {
    const dest = path.join(root, '.reactpress', 'runtime', 'hello-world');
    fs.mkdirSync(path.join(dest, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'plain.txt'), 'old');
    fs.writeFileSync(path.join(dest, 'nested', 'a.txt'), 'old');
    fs.symlinkSync('plain.txt', path.join(dest, 'rel-link'));

    const state = await service.installTheme('hello-world');
    expect(state.installedThemes).toEqual(['hello-world']);
    expect(state.activeTheme).toBe('hello-world');
    expect(fs.lstatSync(dest).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(dest)).toBe(path.relative(path.dirname(dest), path.join(root, 'themes', 'hello-world')));
    expect(fs.existsSync(path.join(dest, 'plain.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(root, '.reactpress', 'runtime', 'tsconfig.base.json'), 'utf8')).toBe(
      '{"files":[]}\n'
    );
    expect(fs.existsSync(path.join(root, '.reactpress', 'last-install.json'))).toBe(false);

    await service.installTheme('hello-world');
    expect(readGlobalTheme().installedThemes).toEqual(['hello-world']);
  });

  it('copies a template in production and when runtime copy is forced', async () => {
    const base = path.join(root, 'themes', 'hello-world');
    fs.mkdirSync(path.join(base, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(base, 'assets', 'logo.txt'), 'logo');
    fs.symlinkSync('theme.json', path.join(base, 'alias.json'));
    fs.symlinkSync('assets', path.join(base, 'linked-dir'), 'dir');
    fs.mkdirSync(path.join(base, 'node_modules', 'left-pad'), { recursive: true });
    fs.writeFileSync(path.join(base, 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;\n');
    for (const skip of ['.next', '.git', 'dist', '.turbo', 'coverage', '.reactpress', '.cache']) {
      fs.mkdirSync(path.join(base, skip), { recursive: true });
      fs.writeFileSync(path.join(base, skip, 'skip.txt'), 'nope');
    }
    fs.writeFileSync(path.join(base, 'package-lock.json'), '{}');

    process.env.REACTPRESS_THEME_RUNTIME_COPY = '1';
    await service.installTheme('hello-world');

    const dest = path.join(root, '.reactpress', 'runtime', 'hello-world');
    expect(fs.statSync(dest).isDirectory()).toBe(true);
    expect(fs.lstatSync(dest).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(path.join(dest, 'assets', 'logo.txt'), 'utf8')).toBe('logo');
    expect(fs.readlinkSync(path.join(dest, 'alias.json'))).toBe('theme.json');
    expect(fs.lstatSync(path.join(dest, 'linked-dir')).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(path.join(dest, 'node_modules'))).toBe(path.relative(dest, path.join(base, 'node_modules')));
    for (const skip of ['.next', '.git', 'dist', '.turbo', 'coverage', '.reactpress', '.cache', 'package-lock.json']) {
      expect(fs.existsSync(path.join(dest, skip))).toBe(false);
    }

    writeTheme('themes/bare', { id: 'bare', name: 'Bare', version: '1.0.0' });
    await service.installTheme('bare');
    expect(fs.existsSync(path.join(root, '.reactpress', 'runtime', 'bare', 'node_modules'))).toBe(false);

    const realModules = path.join(root, 'tmp-modules');
    fs.mkdirSync(realModules);
    writeTheme('themes/pnpm-theme', { id: 'pnpm-theme', name: 'Pnpm', version: '1.0.0' });
    fs.symlinkSync(realModules, path.join(root, 'themes', 'pnpm-theme', 'node_modules'), 'dir');
    await service.installTheme('pnpm-theme');
    expect(fs.lstatSync(path.join(root, '.reactpress', 'runtime', 'pnpm-theme', 'node_modules')).isSymbolicLink()).toBe(
      true
    );
  });

  it('keeps a symlink when runtime symlink mode is set and copies when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REACTPRESS_THEME_RUNTIME_COPY = '1';
    process.env.REACTPRESS_THEME_RUNTIME_SYMLINK = '1';
    await service.installTheme('hello-world');
    expect(fs.lstatSync(path.join(root, '.reactpress', 'runtime', 'hello-world')).isSymbolicLink()).toBe(true);

    writeTheme('themes/folio', { id: 'folio', name: 'Folio', version: '1.0.0' });
    delete process.env.REACTPRESS_THEME_RUNTIME_SYMLINK;
    delete process.env.REACTPRESS_THEME_RUNTIME_COPY;
    await service.installTheme('folio');
    const dest = path.join(root, '.reactpress', 'runtime', 'folio');
    expect(fs.statSync(dest).isDirectory()).toBe(true);
    expect(fs.lstatSync(dest).isSymbolicLink()).toBe(false);
  });

  it('skips copying tsconfig.base.json when the site has none', async () => {
    fs.rmSync(path.join(root, 'tsconfig.base.json'));
    await service.installTheme('hello-world');
    expect(fs.existsSync(path.join(root, '.reactpress', 'runtime', 'tsconfig.base.json'))).toBe(false);
    expect(fs.lstatSync(path.join(root, '.reactpress', 'runtime', 'hello-world')).isSymbolicLink()).toBe(true);
  });

  it('rejects invalid, reserved, and unknown template installs', async () => {
    await expect(service.installTheme('../evil')).rejects.toThrow('Invalid theme id');
    await expect(service.installTheme(`a${'b'.repeat(64)}`)).rejects.toThrow('Invalid theme id');
    await expect(service.installTheme(`a${'b'.repeat(63)}`)).rejects.toThrow('not found');

    fs.mkdirSync(path.join(root, 'themes', 'starter'), { recursive: true });
    writeJson(path.join(root, 'themes', 'starter', 'theme.json'), {
      id: 'starter',
      name: 'Starter',
      version: '1.0.0',
    });
    await expect(service.installTheme('starter')).rejects.toThrow('Theme template "starter" not found');
    await expect(service.installTheme('ghost')).rejects.toThrow('Theme template "ghost" not found');
  });

  it('installs a catalog theme through the npm installer without invoking npm', async () => {
    const state = await service.installTheme('shop');
    expect(state.activeTheme).toBe('hello-world');
    expect(state.installedThemes).toEqual(['hello-world', 'shop']);
    expect(readLastInstall()).toEqual({
      root,
      npmSpec: '@acme/theme-shop@2.0.0',
      skipDependencies: false,
    });
    expect(
      JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'runtime', 'shop', 'theme.json'), 'utf8'))
    ).toEqual(expect.objectContaining({ id: 'shop', name: 'Shop' }));
  });

  it('installs an explicit npm spec and records skipDependencies', async () => {
    writeControl({ themeId: 'npm-theme', name: 'NPM Theme', version: '3.1.0' });
    const saved = await service.installThemeFromNpm('  @other/pkg@1.0.0  ', { skipDependencies: true });
    expect(saved).toEqual(
      expect.objectContaining({
        themeId: 'npm-theme',
        npmSpec: '@other/pkg@1.0.0',
        activeTheme: 'hello-world',
      })
    );
    expect(saved.installedThemes).toContain('npm-theme');
    expect(readLastInstall()).toEqual({
      root,
      npmSpec: '@other/pkg@1.0.0',
      skipDependencies: true,
    });
    expect(fs.existsSync(path.join(root, '.reactpress', 'runtime', 'npm-theme', 'theme.json'))).toBe(true);
  });

  it('does not duplicate an npm theme that is already installed', async () => {
    const theme = JSON.parse(row.globalSetting);
    theme.theme.installedThemes = ['hello-world', 'shop'];
    row.globalSetting = JSON.stringify(theme);
    await service.installThemeFromNpm('shop');
    expect(readGlobalTheme().installedThemes.filter((id) => id === 'shop')).toEqual(['shop']);
  });

  it('resolves the installer from the monorepo root', async () => {
    const mono = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-theme-mono-'));
    extraDirs.push(mono);
    fs.rmSync(path.join(root, 'cli'), { recursive: true, force: true });
    writeInstaller(mono);
    process.env.REACTPRESS_MONOREPO_ROOT = mono;

    const saved = await service.installThemeFromNpm('shop');
    expect(saved.themeId).toBe('shop');
    expect(saved.npmSpec).toBe('@acme/theme-shop@2.0.0');
    expect(fs.existsSync(path.join(root, '.reactpress', 'runtime', 'shop', 'theme.json'))).toBe(true);
  });

  it('rejects npm installs that cannot run', async () => {
    await expect(service.installThemeFromNpm('   ')).rejects.toThrow('npm spec is required');
    await expect(service.installThemeFromNpm(undefined as never)).rejects.toThrow('npm spec is required');

    fs.rmSync(path.join(root, 'cli'), { recursive: true, force: true });
    await expect(service.installThemeFromNpm('@x/y')).rejects.toThrow('Theme npm installer is not available');

    writeInstaller(root);
    fs.writeFileSync(installerFile(root), 'module.exports = {};\n');
    await expect(service.installThemeFromNpm('@x/y')).rejects.toThrow('installThemeFromNpm is not a function');
  });

  it('turns installer failures into bad requests', async () => {
    writeControl({ mode: 'throw-error', message: 'network down' });
    await expect(service.installThemeFromNpm('shop')).rejects.toThrow('network down');
    expect(readLastInstall().npmSpec).toBe('@acme/theme-shop@2.0.0');

    writeControl({ mode: 'throw-error', message: '' });
    await expect(service.installThemeFromNpm('shop')).rejects.toThrow('Failed to install theme from npm');

    writeControl({ mode: 'throw-string' });
    await expect(service.installThemeFromNpm('@other/pkg')).rejects.toThrow('plain failure');
  });

  it('activates a template, rewrites dev manifests, and leaves production restart idle in tests', async () => {
    const previewPath = path.join(root, '.reactpress', 'preview-theme.json');
    writeJson(previewPath, { activeTheme: 'other' });

    const saved = await service.activateTheme('hello-world');
    expect(saved).toEqual(expect.objectContaining({ activeTheme: 'hello-world', siteUrl: 'http://blog.test' }));
    expect(saved.installedThemes).toEqual(['hello-world']);
    expect(fs.existsSync(previewPath)).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'active-theme.json'), 'utf8'))).toEqual(
      expect.objectContaining({
        activeTheme: 'hello-world',
        themeDir: path.join('themes', 'hello-world'),
      })
    );
    expect(spawnMock).not.toHaveBeenCalled();

    const writeSpy = jest.spyOn(fs, 'writeFileSync');
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-01-15T00:00:00.000Z');
    await service.activateTheme('hello-world');
    const firstWrites = writeSpy.mock.calls.filter((call) => String(call[0]).endsWith('active-theme.json')).length;
    await service.activateTheme('hello-world');
    const secondWrites = writeSpy.mock.calls.filter((call) => String(call[0]).endsWith('active-theme.json')).length;
    expect(secondWrites).toBe(firstWrites);

    fs.writeFileSync(path.join(root, '.reactpress', 'active-theme.json'), '{');
    await service.activateTheme('hello-world');
    expect(JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'active-theme.json'), 'utf8')).activeTheme).toBe(
      'hello-world'
    );

    await service.installTheme('hello-world');
    await service.activateTheme('hello-world');
    expect(JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'active-theme.json'), 'utf8')).themeDir).toBe(
      path.join('.reactpress', 'runtime', 'hello-world')
    );
  });

  it('activates legacy theme locations and an npm catalog theme', async () => {
    writeTheme(path.join('themes', 'starter', 'old-starter'), {
      id: 'old-starter',
      name: 'Old Starter',
      version: '1.0.0',
    });
    writeTheme(path.join('themes', 'bundled', 'old-bundled'), {
      id: 'old-bundled',
      name: 'Old Bundled',
      version: '1.0.0',
    });
    writeTheme(path.join('themes', 'core', 'old-core'), { id: 'old-core', name: 'Old Core', version: '1.0.0' });
    writeTheme(path.join('themes', 'runtime', 'old-runtime'), {
      id: 'old-runtime',
      name: 'Old Runtime',
      version: '1.0.0',
    });
    writeTheme(path.join('templates', 'old-theme'), { id: 'old-theme', name: 'Old Theme', version: '1.0.0' });

    await service.activateTheme('old-starter');
    expect(JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'active-theme.json'), 'utf8')).themeDir).toBe(
      path.join('themes', 'starter', 'old-starter')
    );
    await service.activateTheme('old-bundled');
    expect(JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'active-theme.json'), 'utf8')).themeDir).toBe(
      path.join('themes', 'bundled', 'old-bundled')
    );
    await service.activateTheme('old-core');
    await service.activateTheme('old-runtime');
    expect(JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'active-theme.json'), 'utf8')).themeDir).toBe(
      path.join('themes', 'runtime', 'old-runtime')
    );
    await service.activateTheme('old-theme');
    expect(JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'active-theme.json'), 'utf8')).themeDir).toBe(
      path.join('templates', 'old-theme')
    );

    const theme = JSON.parse(row.globalSetting);
    theme.theme.installedThemes = [];
    row.globalSetting = JSON.stringify(theme);
    const activated = await service.activateTheme('shop');
    expect(activated.activeTheme).toBe('shop');
    expect(activated.installedThemes).toContain('shop');
    expect(activated.previewThemeId).toBe('shop');
    expect(fs.existsSync(path.join(root, '.reactpress', 'runtime', 'shop', 'theme.json'))).toBe(true);
  });

  it('fails activation when the npm installer does not materialize the theme', async () => {
    writeControl({ mode: 'skip-materialize', themeId: 'shop' });
    await expect(service.activateTheme('shop')).rejects.toThrow('Theme "shop" not found');
    expect(readGlobalTheme().installedThemes).toContain('shop');
  });

  it('rejects activation of an unknown or invalid theme', async () => {
    await expect(service.activateTheme('ghost')).rejects.toThrow('Theme "ghost" not found');
    await expect(service.activateTheme('Bad Id')).rejects.toThrow('Invalid theme id');
  });

  it('restarts the production client unless restart is skipped or the CLI is missing', async () => {
    const cliBin = path.join(root, 'cli', 'bin', 'reactpress.js');
    fs.mkdirSync(path.dirname(cliBin), { recursive: true });
    fs.writeFileSync(cliBin, '// stub\n');
    process.env.NODE_ENV = 'production';

    await service.activateTheme('hello-world');
    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      [cliBin, 'client', 'restart', '--pm2'],
      expect.objectContaining({
        cwd: root,
        detached: true,
        stdio: 'ignore',
        env: expect.objectContaining({ REACTPRESS_ORIGINAL_CWD: root }),
      })
    );
    expect(unref).toHaveBeenCalled();

    spawnMock.mockClear();
    process.env.REACTPRESS_SKIP_CLIENT_RESTART = '1';
    await service.activateTheme('hello-world');
    expect(spawnMock).not.toHaveBeenCalled();

    delete process.env.REACTPRESS_SKIP_CLIENT_RESTART;
    fs.rmSync(cliBin);
    await service.activateTheme('hello-world');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('publishes the active theme and resolves the site URL', async () => {
    await expect(service.getActiveThemePublic()).resolves.toEqual({
      activeTheme: 'hello-world',
      themeDir: path.join('themes', 'hello-world'),
      siteUrl: 'http://blog.test',
    });

    fs.rmSync(path.join(root, 'themes', 'hello-world'), { recursive: true, force: true });
    await expect(service.getActiveThemePublic()).resolves.toEqual({
      activeTheme: 'hello-world',
      themeDir: null,
      siteUrl: 'http://blog.test',
    });

    row.systemUrl = '';
    process.env.CLIENT_SITE_URL = 'http://client.test';
    expect((await service.getActiveThemePublic()).siteUrl).toBe('http://client.test');

    delete process.env.CLIENT_SITE_URL;
    expect((await service.getActiveThemePublic()).siteUrl).toBe('http://localhost:3001');

    process.env.NGINX_PORT = '8088';
    expect((await service.getActiveThemePublic()).siteUrl).toBe('http://localhost:8088');

    process.env.REACTPRESS_NGINX_ENTRY_URL = 'http://entry.test';
    expect((await service.getActiveThemePublic()).siteUrl).toBe('http://entry.test');

    process.env.NGINX_ENTRY_URL = 'http://nginx.test/';
    expect((await service.getActiveThemePublic()).siteUrl).toBe('http://nginx.test/');
  });

  it('updates mods, deleting keys whose value is empty', async () => {
    const saved = await service.updateThemeMods('hello-world', {
      primaryColor: '#ffffff',
      accentColor: '',
      tagline: 'keep',
    });
    expect(saved.mods['hello-world']).toEqual({ primaryColor: '#ffffff', tagline: 'keep' });
    expect(saved.previewThemeId).toBe('hello-world');
    expect(readGlobalTheme().activeTheme).toBe('hello-world');
  });

  it('starts and ends a preview session against another theme', async () => {
    writeTheme('themes/folio', { id: 'folio', name: 'Folio', version: '1.0.0', description: 'Folio theme' });
    fs.mkdirSync(path.join(root, '.reactpress'), { recursive: true });
    fs.writeFileSync(path.join(root, '.reactpress', 'preview-pool.json'), '{');
    fs.writeFileSync(path.join(root, '.reactpress', 'active-theme.json'), '{');

    const started = await service.beginPreviewSession('folio');
    expect(started.activeTheme).toBe('hello-world');
    expect(started.previewThemeId).toBe('folio');
    expect(started.siteUrl).toBe('http://blog.test');
    expect(started.previewSiteUrl).toBe('http://blog.test:3003/');
    expect(readGlobalTheme().activeTheme).toBe('hello-world');
    expect(JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'preview-theme.json'), 'utf8'))).toEqual(
      expect.objectContaining({
        activeTheme: 'folio',
        themeDir: path.join('themes', 'folio'),
      })
    );
    expect(JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'preview-pool.json'), 'utf8')).folio).toEqual(
      expect.objectContaining({ port: '3003', url: 'http://blog.test:3003/' })
    );
    expect(fs.readFileSync(path.join(root, '.reactpress', 'active-theme.json'), 'utf8')).toBe('{');

    process.env.REACTPRESS_PREVIEW_PORT = '3999';
    const customPort = await service.beginPreviewSession('folio');
    expect(customPort.previewSiteUrl).toBe('http://blog.test:3999/');

    row.systemUrl = 'not a url';
    const fallback = await service.beginPreviewSession('folio');
    expect(fallback.previewSiteUrl).toBe('http://127.0.0.1:3999/');

    const ended = await service.endPreviewSession();
    expect(ended.previewThemeId).toBe('hello-world');
    expect(ended.siteUrl).toBe('not a url');
    expect(fs.existsSync(path.join(root, '.reactpress', 'preview-theme.json'))).toBe(false);
    await service.endPreviewSession();
  });

  it('uses the local dev theme when it differs from the database and clears same-theme previews', async () => {
    writeTheme('themes/folio', { id: 'folio', name: 'Folio', version: '1.0.0' });
    writeJson(path.join(root, '.reactpress', 'active-theme.json'), { activeTheme: 'folio' });
    writeJson(path.join(root, '.reactpress', 'preview-theme.json'), { activeTheme: 'hello-world' });

    const sameAsDev = await service.beginPreviewSession('folio');
    expect(sameAsDev.activeTheme).toBe('folio');
    expect(sameAsDev.previewSiteUrl).toBeUndefined();
    expect(fs.existsSync(path.join(root, '.reactpress', 'preview-theme.json'))).toBe(false);
    expect(readGlobalTheme().activeTheme).toBe('hello-world');

    writeJson(path.join(root, '.reactpress', 'active-theme.json'), { activeTheme: '' });
    const emptyId = await service.beginPreviewSession('folio');
    expect(emptyId.activeTheme).toBe('hello-world');
    expect(emptyId.previewSiteUrl).toBe('http://blog.test:3003/');

    writeJson(path.join(root, '.reactpress', 'active-theme.json'), { activeTheme: 12 });
    const numericId = await service.beginPreviewSession('hello-world');
    expect(numericId.activeTheme).toBe('hello-world');
    expect(numericId.previewSiteUrl).toBeUndefined();

    await expect(service.beginPreviewSession('Bad Id')).rejects.toThrow('Invalid theme id');
    await expect(service.beginPreviewSession('ghost')).rejects.toThrow('Theme "ghost" not found');
  });

  it('materializes a catalog theme when a preview session starts', async () => {
    const started = await service.beginPreviewSession('shop');
    expect(started.previewThemeId).toBe('shop');
    expect(started.previewSiteUrl).toBe('http://blog.test:3003/');
    expect(fs.existsSync(path.join(root, '.reactpress', 'runtime', 'shop', 'theme.json'))).toBe(true);
    expect(readGlobalTheme().installedThemes).toContain('shop');
  });

  it('resolves cover files, manifest covers, and legacy directories', () => {
    expect(service.getCoverPath('hello-world')).toBe(path.join(root, 'themes', 'hello-world', 'cover.png'));
    expect(service.getCoverPath('missing-theme')).toBeNull();

    writeTheme(
      'themes/cover-jpg',
      { id: 'cover-jpg', name: 'JPG', version: '1.0.0' },
      {
        'cover.jpg': 'jpg',
        'cover.jpeg': 'jpeg',
      }
    );
    expect(service.getCoverPath('cover-jpg')).toBe(path.join(root, 'themes', 'cover-jpg', 'cover.jpg'));

    writeTheme('themes/cover-webp', { id: 'cover-webp', name: 'Webp', version: '1.0.0' }, { 'cover.webp': 'webp' });
    expect(service.getCoverPath('cover-webp')).toBe(path.join(root, 'themes', 'cover-webp', 'cover.webp'));

    writeTheme(
      'themes/cover-manifest',
      { id: 'cover-manifest', name: 'Manifest', version: '1.0.0', cover: 'images/hero.svg' },
      { 'images/hero.svg': '<svg />' }
    );
    expect(service.getCoverPath('cover-manifest')).toBe(
      path.join(root, 'themes', 'cover-manifest', 'images', 'hero.svg')
    );

    writeTheme('themes/cover-missing', {
      id: 'cover-missing',
      name: 'Missing',
      version: '1.0.0',
      cover: 'images/missing.png',
    });
    expect(service.getCoverPath('cover-missing')).toBeNull();

    writeTheme(
      path.join('.reactpress', 'runtime', 'old-runtime'),
      {
        id: 'old-runtime',
        name: 'Runtime',
        version: '1.0.0',
      },
      { 'cover.png': 'runtime' }
    );
    writeTheme(
      path.join('themes', 'runtime', 'old-runtime'),
      {
        id: 'old-runtime',
        name: 'Legacy',
        version: '1.0.0',
      },
      { 'cover.jpg': 'legacy' }
    );
    expect(service.getCoverPath('old-runtime')).toBe(
      path.join(root, '.reactpress', 'runtime', 'old-runtime', 'cover.png')
    );

    writeTheme(
      path.join('themes', 'starter', 'old-starter'),
      {
        id: 'old-starter',
        name: 'Starter',
        version: '1.0.0',
      },
      { 'cover.jpeg': 'starter' }
    );
    expect(service.getCoverPath('old-starter')).toBe(path.join(root, 'themes', 'starter', 'old-starter', 'cover.jpeg'));
    writeTheme(
      path.join('templates', 'old-theme'),
      { id: 'old-theme', name: 'Old', version: '1.0.0' },
      {
        'cover.webp': 'old',
      }
    );
    expect(service.getCoverPath('old-theme')).toBe(path.join(root, 'templates', 'old-theme', 'cover.webp'));
  });

  it('builds placeholder covers from theme appearance, the catalog, or the id', () => {
    expect(service.buildPlaceholderCoverSvg('hello-world')).toContain('#112233');
    expect(service.buildPlaceholderCoverSvg('hello-world')).toContain('Hello World');
    expect(service.buildPlaceholderCoverSvg('shop')).toContain('Shop');
    expect(service.buildPlaceholderCoverSvg('missing-theme')).toContain('missing-theme');
  });

  it('builds preview html from mods and falls back to saved mods', async () => {
    const html = service.buildPreviewHtml('hello-world', {
      primaryColor: '#010101',
      accentColor: '#020202',
      backgroundColor: '#030303',
      displayTitle: 'Custom Title',
      displayTagline: 'Custom Tag',
      darkMode: 'yes',
      backgroundImage: 'http://cdn.test/a"b.png',
      additionalCss: '.hero{color:red}',
    });
    expect(html).toContain('data-rp-dark="true"');
    expect(html).toContain('#010101');
    expect(html).toContain('#020202');
    expect(html).toContain('#1a1a1a');
    expect(html).toContain('Custom Title');
    expect(html).toContain('Custom Tag');
    expect(html).toContain('a\\"b.png');
    expect(html).toContain('.hero{color:red}');
    expect(html).toContain('Hello World');

    expect(service.buildPreviewHtml('hello-world', { darkMode: '1' })).toContain('data-rp-dark');
    expect(service.buildPreviewHtml('hello-world', { darkMode: 'true' })).toContain('data-rp-dark');
    const light = service.buildPreviewHtml('missing-theme', { darkMode: '0', backgroundColor: '#eeeeee' });
    expect(light).not.toContain('data-rp-dark');
    expect(light).toContain('#eeeeee');
    expect(light).toContain('#2271b1');
    expect(light).toContain('Theme preview');
    expect(light).toContain('missing-theme');

    await expect(service.getPreviewMods('hello-world', { primaryColor: '#abc' })).resolves.toEqual({
      primaryColor: '#abc',
    });
    await expect(service.getPreviewMods('hello-world', {})).resolves.toEqual({
      primaryColor: '#111111',
      tagline: 'keep',
    });
    await expect(service.getPreviewMods('missing-theme')).resolves.toEqual({});
  });

  it('stores and resolves preview drafts', () => {
    const { token } = service.createPreviewDraft({
      themeId: 'hello-world',
      mods: { primaryColor: '#123456' },
      configuration: { title: 'Draft' },
    });
    expect(token).toHaveLength(32);
    expect(service.resolvePreviewDraft(token)).toEqual({
      themeId: 'hello-world',
      mods: { primaryColor: '#123456' },
      configuration: { title: 'Draft' },
    });
    expect(service.resolvePreviewDraft('missing')).toBeNull();
    expect(service.resolvePreviewDraft('   ')).toBeNull();
  });

  it('ensures a default theme and syncs the dev manifest', async () => {
    repository.save.mockClear();
    await service.ensureDefaultTheme();
    expect(repository.save).not.toHaveBeenCalled();
    expect(JSON.parse(fs.readFileSync(path.join(root, '.reactpress', 'active-theme.json'), 'utf8')).activeTheme).toBe(
      'hello-world'
    );

    const missing = JSON.parse(row.globalSetting);
    missing.theme.activeTheme = 'gone';
    row.globalSetting = JSON.stringify(missing);
    await service.ensureDefaultTheme();
    expect(readGlobalTheme().activeTheme).toBe('hello-world');
    expect(readGlobalTheme().previewThemeId).toBe('hello-world');

    fs.rmSync(path.join(root, 'themes', 'hello-world'), { recursive: true, force: true });
    writeTheme('themes/folio', { id: 'folio', name: 'Folio', version: '1.0.0' });
    const installed = JSON.parse(row.globalSetting);
    installed.theme.activeTheme = 'gone';
    installed.theme.installedThemes = ['folio'];
    row.globalSetting = JSON.stringify(installed);
    await service.ensureDefaultTheme();
    expect(readGlobalTheme().activeTheme).toBe('folio');

    fs.rmSync(path.join(root, 'themes', 'folio'), { recursive: true, force: true });
    writeTheme('themes/bundled-only', { id: 'bundled-only', name: 'Bundled Only', version: '1.0.0' });
    (readThemesPackageMeta as jest.Mock).mockReturnValue({ bundled: ['bundled-only'], catalog: [] });
    const bundled = JSON.parse(row.globalSetting);
    bundled.theme.activeTheme = 'gone';
    bundled.theme.installedThemes = [];
    row.globalSetting = JSON.stringify(bundled);
    await service.ensureDefaultTheme();
    expect(readGlobalTheme().activeTheme).toBe('bundled-only');

    fs.rmSync(path.join(root, 'themes'), { recursive: true, force: true });
    (readThemesPackageMeta as jest.Mock).mockReturnValue({ bundled: [], catalog: [] });
    const empty = JSON.parse(row.globalSetting);
    empty.theme.activeTheme = '';
    empty.theme.installedThemes = [];
    row.globalSetting = JSON.stringify(empty);
    await service.ensureDefaultTheme();
    expect(readGlobalTheme().activeTheme).toBe('hello-world');
    expect(readGlobalTheme().installedThemes).toContain('hello-world');
  });

  it('links a monorepo runtime theme into the site and falls back when symlink fails', async () => {
    const mono = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-theme-mono-'));
    extraDirs.push(mono);
    process.env.REACTPRESS_MONOREPO_ROOT = mono;
    writeTheme(
      path.join('.reactpress', 'runtime', 'linked-theme'),
      { id: 'linked-theme', name: 'Linked', version: '1.0.0' },
      { 'cover.png': 'MONO' },
      mono
    );

    expect(service.getCoverPath('linked-theme')).toBe(
      path.join(root, '.reactpress', 'runtime', 'linked-theme', 'cover.png')
    );
    expect(fs.lstatSync(path.join(root, '.reactpress', 'runtime', 'linked-theme')).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(path.join(root, '.reactpress', 'runtime', 'tsconfig.base.json'), 'utf8')).toBe(
      '{"files":[]}\n'
    );
    expect(service.getCoverPath('linked-theme')).toBe(
      path.join(root, '.reactpress', 'runtime', 'linked-theme', 'cover.png')
    );

    fs.rmSync(path.join(root, '.reactpress', 'runtime', 'linked-theme'));
    const symlink = fs.symlinkSync.bind(fs);
    jest.spyOn(fs, 'symlinkSync').mockImplementation(((
      target: fs.PathLike,
      dest: fs.PathLike,
      type?: fs.symlink.Type
    ) => {
      if (String(dest).endsWith(`${path.sep}linked-theme`)) {
        throw new Error('EPERM');
      }
      return symlink(target, dest, type);
    }) as typeof fs.symlinkSync);

    expect(service.getCoverPath('linked-theme')).toBe(
      path.join(mono, '.reactpress', 'runtime', 'linked-theme', 'cover.png')
    );
  });

  it('reads a monorepo theme directory and skips unsafe dev manifests', async () => {
    const mono = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-theme-mono-'));
    extraDirs.push(mono);
    process.env.REACTPRESS_MONOREPO_ROOT = mono;
    fs.writeFileSync(path.join(root, 'tsconfig.base.json'), '{"files":[]}\n');
    writeTheme(
      path.join('themes', 'dir-theme'),
      { id: 'dir-theme', name: 'Dir Theme', version: '1.0.0' },
      { 'cover.png': 'DIR' },
      mono
    );
    fs.mkdirSync(path.join(mono, 'themes'), { recursive: true });
    fs.writeFileSync(path.join(mono, 'themes', 'not-dir'), 'file');
    fs.mkdirSync(path.join(mono, 'themes', 'starter'), { recursive: true });
    fs.writeFileSync(path.join(mono, 'themes', 'starter', 'cover.png'), 'nope');

    expect(service.getCoverPath('dir-theme')).toBe(path.join(mono, 'themes', 'dir-theme', 'cover.png'));
    expect(service.getCoverPath('not-dir')).toBeNull();
    expect(service.getCoverPath('starter')).toBeNull();

    const saved = await service.activateTheme('dir-theme');
    expect(saved.activeTheme).toBe('dir-theme');
    expect(fs.existsSync(path.join(root, '.reactpress', 'active-theme.json'))).toBe(false);

    writeTheme(
      path.join('.reactpress', 'runtime', 'site-first'),
      { id: 'site-first', name: 'Site', version: '1.0.0' },
      { 'cover.png': 'SITE' }
    );
    writeTheme(
      path.join('.reactpress', 'runtime', 'site-first'),
      { id: 'site-first', name: 'Mono', version: '9.0.0' },
      { 'cover.png': 'MONO' },
      mono
    );
    expect(service.getCoverPath('site-first')).toBe(
      path.join(root, '.reactpress', 'runtime', 'site-first', 'cover.png')
    );
  });

  it('ignores a manifest whose name is not a string', async () => {
    writeTheme('themes/bad-manifest', { id: 'bad-manifest', name: 1 });
    expect(service.getCoverPath('bad-manifest')).toBeNull();
    const themes = await service.listThemes();
    expect(themes.some((theme) => theme.id === 'bad-manifest')).toBe(false);
  });

  it('reuses an existing site runtime link for a monorepo theme', () => {
    const mono = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-theme-mono-'));
    extraDirs.push(mono);
    process.env.REACTPRESS_MONOREPO_ROOT = mono;
    writeTheme(
      path.join('.reactpress', 'runtime', 'linked-theme'),
      { id: 'linked-theme', name: 'Linked', version: '1.0.0' },
      { 'cover.png': 'MONO' },
      mono
    );
    expect(service.getCoverPath('linked-theme')).toBe(
      path.join(root, '.reactpress', 'runtime', 'linked-theme', 'cover.png')
    );

    const exists = fs.existsSync.bind(fs);
    let skipped = false;
    jest.spyOn(fs, 'existsSync').mockImplementation((target) => {
      const value = String(target);
      if (
        !skipped &&
        value.startsWith(root) &&
        value.endsWith(`${path.sep}.reactpress${path.sep}runtime${path.sep}linked-theme`)
      ) {
        skipped = true;
        return false;
      }
      return exists(target);
    });

    expect(service.getCoverPath('linked-theme')).toBe(
      path.join(root, '.reactpress', 'runtime', 'linked-theme', 'cover.png')
    );
    expect(skipped).toBe(true);
  });

  it('installs a template that is not visible to the first directory lookup', async () => {
    writeTheme('themes/folio', { id: 'folio', name: 'Folio', version: '1.0.0' });
    const exists = fs.existsSync.bind(fs);
    let hidden = false;
    jest.spyOn(fs, 'existsSync').mockImplementation((target) => {
      if (!hidden && String(target).endsWith(`${path.sep}themes${path.sep}folio`)) {
        hidden = true;
        return false;
      }
      return exists(target);
    });

    const saved = await service.activateTheme('folio');
    expect(saved.activeTheme).toBe('folio');
    expect(fs.existsSync(path.join(root, '.reactpress', 'runtime', 'folio', 'theme.json'))).toBe(true);
    expect(hidden).toBe(true);
  });

  it('resolves preview urls from a port-only pool entry and from the preview port', async () => {
    writeTheme('themes/folio', { id: 'folio', name: 'Folio', version: '1.0.0' });
    const writeFile = fs.writeFileSync.bind(fs);
    let poolBody = JSON.stringify({ folio: { port: '4100' } });
    jest.spyOn(fs, 'writeFileSync').mockImplementation((file, data, options) => {
      if (String(file).endsWith('preview-pool.json')) {
        return writeFile(file, poolBody, options);
      }
      return writeFile(file, data, options);
    });

    const byPort = await service.beginPreviewSession('folio');
    expect(byPort.previewSiteUrl).toBe('http://blog.test:4100/');

    poolBody = JSON.stringify({ folio: { url: 'http://preview.test:9' } });
    const trimmed = await service.beginPreviewSession('folio');
    expect(trimmed.previewSiteUrl).toBe('http://preview.test:9/');

    row.systemUrl = 'not a url';
    poolBody = JSON.stringify({ folio: { port: '4101' } });
    const badSite = await service.beginPreviewSession('folio');
    expect(badSite.previewSiteUrl).toBe('http://127.0.0.1:4101/');

    row.systemUrl = 'http://blog.test';
    poolBody = JSON.stringify({ folio: { url: 'ftp://nope' } });
    const fromEnv = await service.beginPreviewSession('folio');
    expect(fromEnv.previewSiteUrl).toBe('http://blog.test:3003/');

    row.systemUrl = 'not a url';
    poolBody = JSON.stringify({ folio: {} });
    const envFallback = await service.beginPreviewSession('folio');
    expect(envFallback.previewSiteUrl).toBe('http://127.0.0.1:3003/');
  });
});
