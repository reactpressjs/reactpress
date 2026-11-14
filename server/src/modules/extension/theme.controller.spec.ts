import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ThemeController } from './theme.controller';
import { ThemeService } from './theme.service';

describe('ThemeController', () => {
  let controller: ThemeController;
  let themeService: jest.Mocked<
    Pick<
      ThemeService,
      | 'getActiveThemePublic'
      | 'listThemes'
      | 'getThemeCatalog'
      | 'installThemeFromNpm'
      | 'createPreviewDraft'
      | 'resolvePreviewDraft'
      | 'endPreviewSession'
      | 'beginPreviewSession'
      | 'getCoverPath'
      | 'buildPlaceholderCoverSvg'
      | 'getPreviewMods'
      | 'buildPreviewHtml'
      | 'getThemeAdminLocale'
      | 'getThemeConfigurationSchema'
      | 'getThemeConfiguration'
      | 'updateThemeConfiguration'
      | 'getTheme'
      | 'installTheme'
      | 'activateTheme'
      | 'updateThemeMods'
    >
  >;

  function mockRes(): Response {
    return {
      sendFile: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;
  }

  beforeEach(async () => {
    themeService = {
      getActiveThemePublic: jest.fn(),
      listThemes: jest.fn(),
      getThemeCatalog: jest.fn(),
      installThemeFromNpm: jest.fn(),
      createPreviewDraft: jest.fn(),
      resolvePreviewDraft: jest.fn(),
      endPreviewSession: jest.fn(),
      beginPreviewSession: jest.fn(),
      getCoverPath: jest.fn(),
      buildPlaceholderCoverSvg: jest.fn(),
      getPreviewMods: jest.fn(),
      buildPreviewHtml: jest.fn(),
      getThemeAdminLocale: jest.fn(),
      getThemeConfigurationSchema: jest.fn(),
      getThemeConfiguration: jest.fn(),
      updateThemeConfiguration: jest.fn(),
      getTheme: jest.fn(),
      installTheme: jest.fn(),
      activateTheme: jest.fn(),
      updateThemeMods: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThemeController],
      providers: [{ provide: ThemeService, useValue: themeService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ThemeController);
  });

  it('delegates getActivePublic', async () => {
    const value = { activeTheme: 'hello-world', themeDir: 'themes/hello-world', siteUrl: 'http://blog.test' };
    themeService.getActiveThemePublic.mockResolvedValue(value);
    await expect(controller.getActivePublic()).resolves.toEqual(value);
  });

  it('delegates list', async () => {
    themeService.listThemes.mockResolvedValue([]);
    await expect(controller.list()).resolves.toEqual([]);
  });

  it('delegates catalog', () => {
    const catalog = [{ id: 'shop', name: 'Shop', version: '1.0.0', npm: '@acme/shop' }];
    themeService.getThemeCatalog.mockReturnValue(catalog as never);
    expect(controller.catalog()).toBe(catalog);
  });

  it('installs from npm with skipDependencies', () => {
    const pending = Promise.resolve({ themeId: 'shop' });
    themeService.installThemeFromNpm.mockReturnValue(pending as never);
    expect(controller.installFromNpm({ spec: ' @acme/shop ', skipDependencies: true })).toBe(pending);
    expect(themeService.installThemeFromNpm).toHaveBeenCalledWith(' @acme/shop ', { skipDependencies: true });
  });

  it('installs from npm with an empty spec when the body is missing', () => {
    themeService.installThemeFromNpm.mockResolvedValue({} as never);
    controller.installFromNpm(undefined as never);
    expect(themeService.installThemeFromNpm).toHaveBeenCalledWith('', { skipDependencies: false });
  });

  it('treats a non-boolean skipDependencies as false', () => {
    themeService.installThemeFromNpm.mockResolvedValue({} as never);
    controller.installFromNpm({ spec: '@acme/shop', skipDependencies: 'yes' as unknown as boolean });
    expect(themeService.installThemeFromNpm).toHaveBeenCalledWith('@acme/shop', { skipDependencies: false });
  });

  it('creates a preview draft from the body', () => {
    themeService.createPreviewDraft.mockReturnValue({ token: 'abc' });
    const body = {
      themeId: 'hello-world',
      mods: { primaryColor: '#111' },
      configuration: { title: 'Hello' },
    };
    expect(controller.createPreviewDraft(body)).toEqual({ token: 'abc' });
    expect(themeService.createPreviewDraft).toHaveBeenCalledWith(body);
  });

  it('creates a preview draft when the body is missing', () => {
    themeService.createPreviewDraft.mockReturnValue({ token: 'abc' });
    controller.createPreviewDraft(undefined as never);
    expect(themeService.createPreviewDraft).toHaveBeenCalledWith({
      themeId: undefined,
      mods: undefined,
      configuration: undefined,
    });
  });

  it('returns a stored preview draft', () => {
    const draft = { themeId: 'hello-world', mods: { primaryColor: '#111' }, configuration: { title: 'Hello' } };
    themeService.resolvePreviewDraft.mockReturnValue(draft);
    expect(controller.getPreviewDraft('token')).toEqual(draft);
  });

  it('returns an empty preview draft when the token is unknown', () => {
    themeService.resolvePreviewDraft.mockReturnValue(null);
    expect(controller.getPreviewDraft('missing')).toEqual({ mods: {}, configuration: {} });
  });

  it('delegates endPreviewSession', async () => {
    const value = { activeTheme: 'hello-world', siteUrl: 'http://blog.test' };
    themeService.endPreviewSession.mockResolvedValue(value as never);
    await expect(controller.endPreviewSession()).resolves.toEqual(value);
  });

  it('delegates beginPreviewSession', async () => {
    const value = { activeTheme: 'hello-world', siteUrl: 'http://blog.test', previewSiteUrl: 'http://blog.test:3003/' };
    themeService.beginPreviewSession.mockResolvedValue(value as never);
    await expect(controller.beginPreviewSession('folio')).resolves.toEqual(value);
    expect(themeService.beginPreviewSession).toHaveBeenCalledWith('folio');
  });

  it('sends a cover file when one exists', () => {
    const res = mockRes();
    themeService.getCoverPath.mockReturnValue('/tmp/cover.png');
    controller.cover('hello-world', res);
    expect(res.sendFile).toHaveBeenCalledWith('/tmp/cover.png');
    expect(themeService.buildPlaceholderCoverSvg).not.toHaveBeenCalled();
  });

  it('sends a placeholder cover when no image exists', () => {
    const res = mockRes();
    themeService.getCoverPath.mockReturnValue(null);
    themeService.buildPlaceholderCoverSvg.mockReturnValue('<svg />');
    controller.cover('hello-world', res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/svg+xml; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300');
    expect(res.send).toHaveBeenCalledWith('<svg />');
  });

  it('previews with mods from a trimmed draft token', async () => {
    const res = mockRes();
    themeService.resolvePreviewDraft.mockReturnValue({ mods: { primaryColor: '#111' } });
    themeService.getPreviewMods.mockResolvedValue({ primaryColor: '#111' });
    themeService.buildPreviewHtml.mockReturnValue('<html>draft</html>');

    await controller.preview(
      'hello-world',
      '  tok  ',
      encodeURIComponent(JSON.stringify({ primaryColor: '#222' })),
      res
    );

    expect(themeService.resolvePreviewDraft).toHaveBeenCalledWith('tok');
    expect(themeService.getPreviewMods).toHaveBeenCalledWith('hello-world', { primaryColor: '#111' });
    expect(themeService.buildPreviewHtml).toHaveBeenCalledWith('hello-world', { primaryColor: '#111' });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
    expect(res.send).toHaveBeenCalledWith('<html>draft</html>');
  });

  it('previews with an empty mod map when the draft has no mods', async () => {
    const res = mockRes();
    themeService.resolvePreviewDraft.mockReturnValue(null);
    themeService.getPreviewMods.mockResolvedValue({});
    themeService.buildPreviewHtml.mockReturnValue('<html></html>');

    await controller.preview('hello-world', 'missing', undefined, res);

    expect(themeService.getPreviewMods).toHaveBeenCalledWith('hello-world', {});
  });

  it('previews with mods parsed from the query string', async () => {
    const res = mockRes();
    const mods = { primaryColor: '#abc' };
    themeService.getPreviewMods.mockResolvedValue(mods);
    themeService.buildPreviewHtml.mockReturnValue('<html>query</html>');

    await controller.preview('hello-world', '   ', encodeURIComponent(JSON.stringify(mods)), res);

    expect(themeService.resolvePreviewDraft).not.toHaveBeenCalled();
    expect(themeService.getPreviewMods).toHaveBeenCalledWith('hello-world', mods);
    expect(res.send).toHaveBeenCalledWith('<html>query</html>');
  });

  it('ignores a mods query that is not valid JSON', async () => {
    const res = mockRes();
    themeService.getPreviewMods.mockResolvedValue({});
    themeService.buildPreviewHtml.mockReturnValue('<html></html>');

    await controller.preview('hello-world', undefined, 'not-json', res);
    expect(themeService.getPreviewMods).toHaveBeenCalledWith('hello-world', {});

    await controller.preview('hello-world', undefined, '%', res);
    expect(themeService.getPreviewMods).toHaveBeenLastCalledWith('hello-world', {});
  });

  it('previews saved mods when no token or query is provided', async () => {
    const res = mockRes();
    themeService.getPreviewMods.mockResolvedValue({ primaryColor: '#111111' });
    themeService.buildPreviewHtml.mockReturnValue('<html>saved</html>');

    await controller.preview('hello-world', undefined, undefined, res);

    expect(themeService.getPreviewMods).toHaveBeenCalledWith('hello-world', {});
    expect(res.send).toHaveBeenCalledWith('<html>saved</html>');
  });

  it('delegates getLocale', async () => {
    const value = { themeId: 'hello-world', locale: 'en', messages: { title: 'Hello' } };
    themeService.getThemeAdminLocale.mockResolvedValue(value);
    await expect(controller.getLocale('hello-world', 'en')).resolves.toEqual(value);
    expect(themeService.getThemeAdminLocale).toHaveBeenCalledWith('hello-world', 'en');
  });

  it('delegates getConfigurationSchema', async () => {
    const value = { themeId: 'hello-world', schema: null };
    themeService.getThemeConfigurationSchema.mockResolvedValue(value);
    await expect(controller.getConfigurationSchema('hello-world')).resolves.toEqual(value);
  });

  it('delegates getConfiguration', async () => {
    const value = { themeId: 'hello-world', configuration: { title: 'Hello' } };
    themeService.getThemeConfiguration.mockResolvedValue(value);
    await expect(controller.getConfiguration('hello-world')).resolves.toEqual(value);
  });

  it('patches configuration and replaces it when requested', () => {
    themeService.updateThemeConfiguration.mockResolvedValue({ themeId: 'hello-world', configuration: {} });
    controller.updateConfiguration('hello-world', { configuration: { title: 'Next' }, replace: true });
    expect(themeService.updateThemeConfiguration).toHaveBeenCalledWith(
      'hello-world',
      { title: 'Next' },
      { replace: true }
    );

    controller.updateConfiguration('hello-world', { configuration: { title: 'Next' } });
    expect(themeService.updateThemeConfiguration).toHaveBeenCalledWith(
      'hello-world',
      { title: 'Next' },
      { replace: false }
    );
  });

  it('updates configuration with an empty patch when the body is missing', () => {
    themeService.updateThemeConfiguration.mockResolvedValue({ themeId: 'hello-world', configuration: {} });
    controller.updateConfiguration('hello-world', undefined as never);
    expect(themeService.updateThemeConfiguration).toHaveBeenCalledWith('hello-world', {}, { replace: false });
  });

  it('delegates getOne', async () => {
    const value = { id: 'hello-world', name: 'Hello World' };
    themeService.getTheme.mockResolvedValue(value as never);
    await expect(controller.getOne('hello-world')).resolves.toEqual(value);
    expect(themeService.getTheme).toHaveBeenCalledWith('hello-world');
  });

  it('delegates install', async () => {
    themeService.installTheme.mockResolvedValue({ activeTheme: 'hello-world' } as never);
    await expect(controller.install('hello-world')).resolves.toEqual({ activeTheme: 'hello-world' });
    expect(themeService.installTheme).toHaveBeenCalledWith('hello-world');
  });

  it('delegates activate', async () => {
    themeService.activateTheme.mockResolvedValue({ activeTheme: 'folio', siteUrl: 'http://blog.test' });
    await expect(controller.activate('folio')).resolves.toEqual({
      activeTheme: 'folio',
      siteUrl: 'http://blog.test',
    });
    expect(themeService.activateTheme).toHaveBeenCalledWith('folio');
  });

  it('updates mods and defaults to an empty map', () => {
    themeService.updateThemeMods.mockResolvedValue({ activeTheme: 'hello-world' } as never);
    controller.updateMods('hello-world', { mods: { primaryColor: '#fff' } });
    expect(themeService.updateThemeMods).toHaveBeenCalledWith('hello-world', { primaryColor: '#fff' });

    controller.updateMods('hello-world', undefined as never);
    expect(themeService.updateThemeMods).toHaveBeenCalledWith('hello-world', {});
  });
});
