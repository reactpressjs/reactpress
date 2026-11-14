import { ConfigService } from '@nestjs/config';

import { createTypeOrmOptions } from './typeorm-options';

function mockConfigService(getImpl: (key: string, defaultValue?: unknown) => unknown): ConfigService {
  return { get: jest.fn(getImpl) } as unknown as ConfigService;
}

describe('createTypeOrmOptions', () => {
  const prevNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
  });

  it('returns sqlite options with default database', () => {
    const cs = mockConfigService((key, def) => {
      if (key === 'DB_TYPE') return 'sqlite';
      if (key === 'DB_DATABASE') return undefined;
      return def;
    });
    const opts = createTypeOrmOptions(cs);
    expect(opts.type).toBe('sqlite');
    expect((opts as { database: string }).database).toBe('reactpress.db');
    expect(opts.synchronize).toBe(true);
  });

  it('honors DB_SYNCHRONIZE overrides', () => {
    const cases: Array<[unknown, boolean]> = [
      [true, true],
      ['true', true],
      ['1', true],
      [false, false],
      ['false', false],
      ['0', false],
    ];
    for (const [raw, expected] of cases) {
      const cs = mockConfigService((key) => {
        if (key === 'DB_TYPE') return 'mysql';
        if (key === 'DB_SYNCHRONIZE') return raw;
        return undefined;
      });
      expect(createTypeOrmOptions(cs).synchronize).toBe(expected);
    }
  });

  it('defaults synchronize for mysql based on NODE_ENV', () => {
    process.env.NODE_ENV = 'production';
    const prod = mockConfigService((key, def) => (key === 'DB_TYPE' ? 'mysql' : def));
    expect(createTypeOrmOptions(prod).synchronize).toBe(false);

    process.env.NODE_ENV = 'development';
    const dev = mockConfigService((key, def) => (key === 'DB_TYPE' ? 'mysql' : def));
    expect(createTypeOrmOptions(dev).synchronize).toBe(true);
  });

  it('returns mysql connection defaults', () => {
    const cs = mockConfigService((key, def) => {
      if (key === 'DB_TYPE') return 'MySQL';
      return def;
    });
    const opts = createTypeOrmOptions(cs);
    expect(opts.type).toBe('mysql');
    expect((opts as { host: string }).host).toBe('0.0.0.0');
    expect((opts as { port: number }).port).toBe(3306);
    expect((opts as { charset: string }).charset).toBe('utf8mb4');
  });
});
