import * as path from 'path';

function loadProjectRoot(existsSync: jest.Mock) {
  jest.resetModules();
  jest.doMock('fs', () => ({ existsSync }));
  return require('./project-root.util') as typeof import('./project-root.util');
}

describe('resolveProjectRoot', () => {
  const prevCwd = process.env.REACTPRESS_ORIGINAL_CWD;
  const cwd = '/tmp/reactpress-app';

  afterEach(() => {
    if (prevCwd === undefined) delete process.env.REACTPRESS_ORIGINAL_CWD;
    else process.env.REACTPRESS_ORIGINAL_CWD = prevCwd;
    jest.restoreAllMocks();
  });

  it('returns REACTPRESS_ORIGINAL_CWD when set', () => {
    process.env.REACTPRESS_ORIGINAL_CWD = '/preset/root';
    const { resolveProjectRoot } = loadProjectRoot(jest.fn());
    expect(resolveProjectRoot()).toBe('/preset/root');
  });

  it('walks parents until themes directory exists', () => {
    delete process.env.REACTPRESS_ORIGINAL_CWD;
    jest.spyOn(process, 'cwd').mockReturnValue(cwd);
    const existsSync = jest.fn((p: string) => p === path.join(cwd, 'themes'));
    const { resolveProjectRoot } = loadProjectRoot(existsSync);
    expect(resolveProjectRoot()).toBe(cwd);
    expect(process.env.REACTPRESS_ORIGINAL_CWD).toBe(cwd);
  });

  it('returns cwd when no themes folder is found', () => {
    delete process.env.REACTPRESS_ORIGINAL_CWD;
    jest.spyOn(process, 'cwd').mockReturnValue(cwd);
    const { resolveProjectRoot } = loadProjectRoot(jest.fn().mockReturnValue(false));
    expect(resolveProjectRoot()).toBe(cwd);
  });
});

describe('resolveMonorepoRoot', () => {
  const prevRoot = process.env.REACTPRESS_MONOREPO_ROOT;
  const cwd = '/tmp/repo/server';

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.REACTPRESS_MONOREPO_ROOT;
    else process.env.REACTPRESS_MONOREPO_ROOT = prevRoot;
    jest.restoreAllMocks();
  });

  it('returns REACTPRESS_MONOREPO_ROOT when set', () => {
    process.env.REACTPRESS_MONOREPO_ROOT = '/mono';
    const { resolveMonorepoRoot } = loadProjectRoot(jest.fn());
    expect(resolveMonorepoRoot()).toBe('/mono');
  });

  it('walks parents until theme-registry exists', () => {
    delete process.env.REACTPRESS_MONOREPO_ROOT;
    jest.spyOn(process, 'cwd').mockReturnValue(cwd);
    const marker = path.join(cwd, 'cli', 'out', 'lib', 'theme-registry.js');
    const { resolveMonorepoRoot } = loadProjectRoot(jest.fn((p: string) => p === marker));
    expect(resolveMonorepoRoot()).toBe(cwd);
    expect(process.env.REACTPRESS_MONOREPO_ROOT).toBe(cwd);
  });

  it('returns cwd when marker not found', () => {
    delete process.env.REACTPRESS_MONOREPO_ROOT;
    jest.spyOn(process, 'cwd').mockReturnValue(cwd);
    const { resolveMonorepoRoot } = loadProjectRoot(jest.fn().mockReturnValue(false));
    expect(resolveMonorepoRoot()).toBe(cwd);
  });
});
