import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Setting } from './setting.entity';
import { SettingService } from './setting.service';

describe('SettingService', () => {
  let service: SettingService;
  let repository: jest.Mocked<Pick<Repository<Setting>, 'find' | 'findOne' | 'create' | 'save' | 'merge' | 'remove'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  const baseRow = (): Setting =>
    ({
      id: 's1',
      systemTitle: '',
      globalSetting: '',
      i18n: '',
      createAt: new Date('2020-01-01'),
      updateAt: new Date('2020-01-01'),
    }) as Setting;

  beforeEach(async () => {
    repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((row) => row as Setting),
      save: jest.fn(async (row) => row),
      merge: jest.fn((old, patch) => ({ ...old, ...patch }) as Setting),
      remove: jest.fn(async (rows) => rows),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'CLIENT_SITE_URL') return 'http://localhost:3001';
        if (key === 'REACTPRESS_LANG') return 'en';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingService,
        { provide: getRepositoryToken(Setting), useValue: repository },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(SettingService);
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getSettingRow / ensureSettingRow', () => {
    it('creates an empty row when none exist', async () => {
      repository.find.mockResolvedValue([]);
      const row = await service.getSettingRow();
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(row).toBeDefined();
    });

    it('merges duplicate rows and removes extras', async () => {
      const sparse = baseRow();
      const rich = {
        ...baseRow(),
        id: 's2',
        systemTitle: 'Site',
        globalSetting: '{"theme":{"activeTheme":"hello-world"}}',
        i18n: '{"en":{}}',
      } as Setting;
      repository.find.mockResolvedValue([sparse, rich]);

      const row = await service.getSettingRow();
      expect(repository.remove).toHaveBeenCalledWith([sparse]);
      expect(row.systemTitle).toBe('Site');
    });

    it('fills blank fields on the winning row from duplicates', async () => {
      const winner = {
        ...baseRow(),
        id: 's2',
        systemTitle: 'Site',
        globalSetting: '{"theme":{"activeTheme":"hello-world"}}',
        i18n: '{"en":{}}',
        systemUrl: '',
      } as Setting;
      const donor = { ...baseRow(), id: 's1', systemUrl: 'http://kept.test' } as Setting;
      repository.find.mockResolvedValue([donor, winner]);

      const row = await service.getSettingRow();
      expect(row.systemUrl).toBe('http://kept.test');
      expect(row.systemTitle).toBe('Site');
    });
  });

  describe('initI18n', () => {
    it('persists merged i18n when changed', async () => {
      repository.find.mockResolvedValue([baseRow()]);
      await service.initI18n();
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ i18n: expect.any(String) }));
    });

    it('recovers from invalid i18n JSON and persists defaults', async () => {
      const row = baseRow();
      row.i18n = '{bad json';
      repository.find.mockResolvedValue([row]);
      await expect(service.initI18n()).resolves.toBeUndefined();
      expect(repository.save).toHaveBeenCalled();
    });

    it('skips writing when stored i18n already matches the merge', async () => {
      const row = baseRow();
      repository.find.mockResolvedValue([row]);
      await service.initI18n();
      repository.save.mockClear();
      await service.initI18n();
      expect(repository.save).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('[SettingService] i18n already up to date');
    });

    it('rethrows after logging an initI18n failure', async () => {
      repository.find.mockResolvedValue([baseRow()]);
      repository.save.mockRejectedValue(new Error('save failed'));
      await expect(service.initI18n()).rejects.toThrow('save failed');
      expect(console.error).toHaveBeenCalledWith('[SettingService] Error in initI18n:', expect.any(Error));
    });
  });

  describe('initGlobalConfig', () => {
    it('writes merged theme globalSetting', async () => {
      repository.find.mockResolvedValue([baseRow()]);
      await service.initGlobalConfig();
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ globalSetting: expect.any(String) }));
    });

    it('handles invalid globalSetting JSON', async () => {
      const row = baseRow();
      row.globalSetting = '{oops';
      repository.find.mockResolvedValue([row]);
      await service.initGlobalConfig();
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('initSystemSettings', () => {
    it('seeds empty system fields', async () => {
      repository.find.mockResolvedValue([baseRow()]);
      await service.initSystemSettings();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          systemUrl: 'http://localhost:3001',
          systemTitle: 'ReactPress',
        })
      );
    });

    it('skips when all fields already populated', async () => {
      const row = {
        ...baseRow(),
        systemTitle: 'Custom',
        systemSubTitle: 'Sub',
        systemLogo: '/logo.png',
        systemFavicon: '/favicon.png',
        systemNoticeInfo: '[]',
        seoKeyword: 'k',
        seoDesc: 'd',
        baiduAnalyticsId: '',
        googleAnalyticsId: '',
        systemUrl: 'http://site.test',
        adminSystemUrl: 'http://site.test/admin/',
      } as Setting;
      repository.find.mockResolvedValue([row]);
      await service.initSystemSettings();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('migrateLegacyAppearance', () => {
    it('no-ops without globalSetting and id', async () => {
      repository.find.mockResolvedValue([baseRow()]);
      await service.migrateLegacyAppearance();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('ignores invalid globalSetting JSON', async () => {
      const row = baseRow();
      row.globalSetting = '{oops';
      repository.find.mockResolvedValue([row]);
      await expect(service.migrateLegacyAppearance()).resolves.toBeUndefined();
    });
  });

  describe('initThemeConfigurations', () => {
    it('seeds theme config when globalSetting exists', async () => {
      const row = baseRow();
      row.globalSetting = JSON.stringify({ theme: { activeTheme: 'twentytwentyfive' } });
      repository.find.mockResolvedValue([row]);
      await service.initThemeConfigurations();
      expect(repository.save).toHaveBeenCalled();
    });

    it('ignores invalid globalSetting JSON', async () => {
      const row = baseRow();
      row.globalSetting = '{oops';
      repository.find.mockResolvedValue([row]);
      await expect(service.initThemeConfigurations()).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('returns empty object when row lookup fails', async () => {
      repository.find.mockRejectedValue(new Error('db down'));
      await expect(service.findAll(false, false)).resolves.toEqual({});
    });

    it('returns raw row for admin', async () => {
      const row = { ...baseRow(), systemTitle: 'Admin View' } as Setting;
      repository.find.mockResolvedValue([row]);
      const result = await service.findAll(false, true);
      expect(result.systemTitle).toBe('Admin View');
    });

    it('returns public view for guests', async () => {
      const row = {
        ...baseRow(),
        systemTitle: 'Public',
        smtpPass: 'secret',
        globalSetting: JSON.stringify({ theme: { activeTheme: 'hello-world' } }),
      } as Setting;
      repository.find.mockResolvedValue([row]);
      const result = await service.findAll(false, false);
      expect(result.systemTitle).toBe('Public');
      expect((result as Setting).smtpPass).toBeUndefined();
    });

    it('returns the effective row for internal callers', async () => {
      const row = { ...baseRow(), systemTitle: 'Internal', systemUrl: 'http://site.test' } as Setting;
      repository.find.mockResolvedValue([row]);
      const result = await service.findAll(true, false);
      expect(result.systemTitle).toBe('Internal');
      expect(result.systemUrl).toBe('http://site.test');
    });
  });

  describe('update', () => {
    it('ignores empty patches and blank smtpPass', async () => {
      repository.find.mockResolvedValue([{ ...baseRow(), smtpPass: 'old' } as Setting]);
      const result = await service.update({ smtpPass: '   ' } as Partial<Setting>);
      expect(repository.merge).not.toHaveBeenCalled();
      expect(result.smtpPass).toBe('old');
    });

    it('merges allowed system fields', async () => {
      const old = baseRow();
      repository.find.mockResolvedValue([old]);
      await service.update({ systemTitle: 'New Title', unknownField: 'x' } as never);
      expect(repository.merge).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('runs initializers without throwing', async () => {
      repository.find.mockResolvedValue([baseRow()]);
      service.onModuleInit();
      await new Promise((resolve) => setImmediate(resolve));
    });

    it('logs when initialization fails', async () => {
      repository.find.mockRejectedValue(new Error('db down'));
      service.onModuleInit();
      await new Promise((resolve) => setImmediate(resolve));
      expect(console.error).toHaveBeenCalledWith('[SettingService] initialization failed:', expect.any(Error));
    });
  });
});
