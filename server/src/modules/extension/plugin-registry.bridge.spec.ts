import * as fs from 'fs';
import * as path from 'path';

import { readPluginsPackageMeta } from './plugin-registry.bridge';

describe('plugin-registry.bridge', () => {
  const root = '/fake-project';
  const pluginsDir = path.join(root, 'plugins');
  let existsSpy: jest.SpyInstance;
  let readFileSpy: jest.SpyInstance;
  let readdirSpy: jest.SpyInstance;

  beforeEach(() => {
    existsSpy = jest.spyOn(fs, 'existsSync');
    readFileSpy = jest.spyOn(fs, 'readFileSync');
    readdirSpy = jest.spyOn(fs, 'readdirSync');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns empty local list when plugins directory is missing', () => {
    existsSpy.mockImplementation((p) => p !== pluginsDir);
    expect(readPluginsPackageMeta(root)).toEqual({ local: [] });
  });

  it('merges package.json registry with discovered plugin folders', () => {
    existsSpy.mockImplementation((target) => {
      const s = String(target);
      if (s === pluginsDir) return true;
      if (s.endsWith(path.join('plugins', 'package.json'))) return true;
      if (s.endsWith(path.join('ai-assist', 'plugin.json'))) return true;
      if (s.endsWith(path.join('comments', 'plugin.json'))) return true;
      return false;
    });
    readFileSpy.mockImplementation((target) => {
      const s = String(target);
      if (s.endsWith(path.join('plugins', 'package.json'))) {
        return JSON.stringify({ reactpress: { local: ['ai-assist', 'BAD_ID!!'] } });
      }
      if (s.endsWith(path.join('ai-assist', 'plugin.json'))) {
        return '{}';
      }
      if (s.endsWith(path.join('comments', 'plugin.json'))) {
        return '{}';
      }
      return '{}';
    });
    readdirSpy.mockReturnValue([
      { name: 'ai-assist', isDirectory: () => true },
      { name: 'comments', isDirectory: () => true },
      { name: 'skip-file', isDirectory: () => false },
      { name: 'no-manifest', isDirectory: () => true },
    ] as fs.Dirent[]);

    expect(readPluginsPackageMeta(root)).toEqual({ local: ['ai-assist', 'comments'] });
  });

  it('ignores corrupt package.json', () => {
    existsSpy.mockReturnValue(true);
    readFileSpy.mockImplementation((target) => {
      if (String(target).endsWith('package.json')) return '{broken';
      return '{}';
    });
    readdirSpy.mockReturnValue([{ name: 'hello', isDirectory: () => true }] as fs.Dirent[]);
    existsSpy.mockImplementation((target) => {
      const s = String(target);
      if (s.endsWith(path.join('hello', 'plugin.json'))) return true;
      return true;
    });
    expect(readPluginsPackageMeta(root).local).toEqual(['hello']);
  });
});
