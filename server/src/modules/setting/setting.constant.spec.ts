import { i18n, settings } from './setting.constant';

describe('setting.constant', () => {
  it('re-exports i18n messages from toolkit', () => {
    expect(i18n).toBeDefined();
    expect(typeof i18n).toBe('object');
  });

  it('exposes default global settings from toolkit', () => {
    expect(settings).toBeDefined();
    expect(typeof settings).toBe('object');
  });
});
