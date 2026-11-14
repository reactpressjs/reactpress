import { resolveInstallLocale } from './install-locale';

describe('resolveInstallLocale', () => {
  const prevLang = process.env.LANG;
  const prevRp = process.env.REACTPRESS_LANG;

  afterEach(() => {
    if (prevLang === undefined) delete process.env.LANG;
    else process.env.LANG = prevLang;
    if (prevRp === undefined) delete process.env.REACTPRESS_LANG;
    else process.env.REACTPRESS_LANG = prevRp;
  });

  it('uses explicit raw argument first', () => {
    expect(resolveInstallLocale('zh_CN')).toBe('zh');
    expect(resolveInstallLocale('en-US')).toBe('en');
  });

  it('falls back to REACTPRESS_LANG then LANG', () => {
    delete process.env.REACTPRESS_LANG;
    process.env.LANG = 'zh_CN.UTF-8';
    expect(resolveInstallLocale()).toBe('zh');
  });

  it('defaults to en when no locale hints match zh', () => {
    delete process.env.REACTPRESS_LANG;
    delete process.env.LANG;
    expect(resolveInstallLocale()).toBe('en');
  });
});
