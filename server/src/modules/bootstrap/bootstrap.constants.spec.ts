import {
  getHelloWorldSeed,
  getSystemSettingSeedDefaults,
  HELLO_WORLD_LEGACY_TITLES,
  HELLO_WORLD_SEED_MARKER,
} from './bootstrap.constants';

describe('bootstrap.constants', () => {
  it('exposes legacy Hello World titles and seed marker', () => {
    expect(HELLO_WORLD_LEGACY_TITLES).toContain('Hello World');
    expect(HELLO_WORLD_SEED_MARKER).toBe('reactpress-seed:v4');
  });

  it('getHelloWorldSeed prefixes markdown with locale marker', () => {
    const en = getHelloWorldSeed('en');
    expect(en.articleTitle).toBe('Hello World');
    expect(en.markdown).toContain(`<!-- ${HELLO_WORLD_SEED_MARKER}:en -->`);

    const zh = getHelloWorldSeed('zh');
    expect(zh.articleTitle).toBe('世界，您好！');
    expect(zh.markdown).toContain(`<!-- ${HELLO_WORLD_SEED_MARKER}:zh -->`);
  });

  it('getSystemSettingSeedDefaults returns site defaults per locale', () => {
    const en = getSystemSettingSeedDefaults('en');
    expect(en.systemTitle).toBe('ReactPress');
    expect(en.systemLogo).toBe('/logo.png');

    const zh = getSystemSettingSeedDefaults('zh');
    expect(zh.seoDesc).toContain('ReactPress');
  });
});
