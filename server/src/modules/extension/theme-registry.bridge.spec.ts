import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('theme-registry.bridge', () => {
  let monoRoot: string;
  let prevMono: string | undefined;

  beforeEach(() => {
    jest.resetModules();
    monoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-theme-registry-'));
    const registryDir = path.join(monoRoot, 'cli', 'out', 'lib');
    fs.mkdirSync(registryDir, { recursive: true });
    fs.writeFileSync(
      path.join(registryDir, 'theme-registry.js'),
      `
      module.exports = {
        readThemeCatalog(root) {
          return { version: 1, themes: [{ id: 'catalog-theme', name: 'Catalog', version: '1.0.0', npm: '@x/y' }], source: root };
        },
        findCatalogTheme(_root, id) {
          return id === 'catalog-theme' ? { id: 'catalog-theme', name: 'Catalog', version: '1.0.0', npm: '@x/y' } : null;
        },
        resolveCatalogInstallSpec() { return '@x/y@1.0.0'; },
        catalogEntryToManifest(entry) { return entry; },
        readThemesPackageMeta() { return { bundled: ['hello-world'], catalog: ['catalog-theme'] }; },
        validateCatalogThemes() { return { catalog: [], missing: [] }; },
        buildAggregatedCatalog() { return { version: 1, themes: [] }; },
        validateBundledThemes() { return { bundled: [], missing: [] }; },
        OFFICIAL_THEME_STARTER_ID: 'hello-world',
        OFFICIAL_THEME_STARTER_SPEC: '@reactpressjs/theme-hello-world',
      };
      `
    );
    prevMono = process.env.REACTPRESS_MONOREPO_ROOT;
    process.env.REACTPRESS_MONOREPO_ROOT = monoRoot;
  });

  afterEach(() => {
    if (prevMono === undefined) delete process.env.REACTPRESS_MONOREPO_ROOT;
    else process.env.REACTPRESS_MONOREPO_ROOT = prevMono;
    fs.rmSync(monoRoot, { recursive: true, force: true });
  });

  it('loads registry and proxies catalog helpers', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bridge = require('./theme-registry.bridge') as typeof import('./theme-registry.bridge');
    const loaded = bridge.loadThemeRegistry();
    expect(loaded.OFFICIAL_THEME_STARTER_ID).toBe('hello-world');
    expect(bridge.loadThemeRegistry()).toBe(loaded);
    expect(bridge.readThemeCatalogEntries('/proj')).toHaveLength(1);
    expect(bridge.findThemeCatalogEntry('catalog-theme', '/proj')?.npm).toBe('@x/y');
    expect(bridge.resolveThemeCatalogInstallSpec('catalog-theme', '/proj')).toBe('@x/y@1.0.0');
    expect(bridge.readThemesPackageMeta('/proj').bundled).toContain('hello-world');
  });

  it('throws when registry script cannot be resolved', () => {
    fs.rmSync(path.join(monoRoot, 'cli'), { recursive: true, force: true });
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bridge = require('./theme-registry.bridge') as typeof import('./theme-registry.bridge');
    expect(() => bridge.loadThemeRegistry()).toThrow('Theme registry is not available');
  });

  it('loads a registry bundled beside the server package', () => {
    const serverSrc = path.join(__dirname, '..', '..', '..');
    const cliRoot = path.dirname(serverSrc);
    const registryFile = path.join(cliRoot, 'out', 'lib', 'theme-registry.js');
    fs.mkdirSync(path.dirname(registryFile), { recursive: true });
    fs.writeFileSync(registryFile, 'module.exports = { OFFICIAL_THEME_STARTER_ID: "bundled-starter" };\n');
    jest.resetModules();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bridge = require('./theme-registry.bridge') as typeof import('./theme-registry.bridge');
      expect(bridge.loadThemeRegistry().OFFICIAL_THEME_STARTER_ID).toBe('bundled-starter');
    } finally {
      fs.rmSync(registryFile, { force: true });
    }
  });

  it('accepts a sibling package named @reactpressjs/reactpress', () => {
    const serverSrc = path.join(__dirname, '..', '..', '..');
    const pkgPath = path.join(path.dirname(serverSrc), 'package.json');
    const realRead = fs.readFileSync.bind(fs);
    jest.spyOn(fs, 'readFileSync').mockImplementation(((file: fs.PathOrFileDescriptor, encoding?: unknown) => {
      if (String(file) === pkgPath) return JSON.stringify({ name: '@reactpressjs/reactpress' });
      return realRead(file, encoding as BufferEncoding);
    }) as typeof fs.readFileSync);
    jest.resetModules();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bridge = require('./theme-registry.bridge') as typeof import('./theme-registry.bridge');
      expect(bridge.loadThemeRegistry().OFFICIAL_THEME_STARTER_ID).toBe('hello-world');
    } finally {
      jest.restoreAllMocks();
    }
  });
});
