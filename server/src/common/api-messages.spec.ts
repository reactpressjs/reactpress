import { ApiMsg } from './api-messages';

describe('ApiMsg', () => {
  it('exports non-empty English strings for every key', () => {
    const entries = Object.entries(ApiMsg);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, value] of entries) {
      expect(typeof key).toBe('string');
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('includes expected auth messages', () => {
    expect(ApiMsg.AUTH_FAILED).toBe('Authentication failed');
    expect(ApiMsg.INVALID_CREDENTIALS).toBe('Invalid username or password');
  });
});
