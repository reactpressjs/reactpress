import { isLocalApiQuiet } from './local-api-quiet.util';

describe('isLocalApiQuiet', () => {
  const prev = process.env.REACTPRESS_LOCAL_API_QUIET;

  afterEach(() => {
    if (prev === undefined) delete process.env.REACTPRESS_LOCAL_API_QUIET;
    else process.env.REACTPRESS_LOCAL_API_QUIET = prev;
  });

  it('returns true when REACTPRESS_LOCAL_API_QUIET is 1', () => {
    process.env.REACTPRESS_LOCAL_API_QUIET = '1';
    expect(isLocalApiQuiet()).toBe(true);
  });

  it('returns false when unset or other values', () => {
    delete process.env.REACTPRESS_LOCAL_API_QUIET;
    expect(isLocalApiQuiet()).toBe(false);
    process.env.REACTPRESS_LOCAL_API_QUIET = '0';
    expect(isLocalApiQuiet()).toBe(false);
  });
});
