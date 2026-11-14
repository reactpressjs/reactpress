import { parseUserAgent } from './ua.util';

describe('parseUserAgent', () => {
  const chromeUa =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  it('parses browser, engine, os, and device fields', () => {
    const result = parseUserAgent(chromeUa);
    expect(result.data.browser).toContain('Chrome');
    expect(result.data.engine).toBeTruthy();
    expect(result.data.os).toContain('Mac');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('returns sparse device data for desktop ua', () => {
    const result = parseUserAgent(chromeUa);
    expect(typeof result.data.device).toBe('string');
  });

  it('handles empty user agent', () => {
    const result = parseUserAgent('');
    expect(result.data.browser).toBe('');
    expect(result.text).toBe('');
  });
});
