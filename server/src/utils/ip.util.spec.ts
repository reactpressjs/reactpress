describe('getClientIP', () => {
  let getClientIP: typeof import('./ip.util').getClientIP;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('node-ip2region', () => ({
      create: () => ({ btreeSearchSync: jest.fn() }),
    }));
    ({ getClientIP } = require('./ip.util'));
  });

  it('prefers x-real-ip then x-forwarded-for', () => {
    expect(getClientIP({ headers: { 'x-real-ip': '1.2.3.4' } })).toBe('1.2.3.4');
    expect(getClientIP({ headers: { 'x-forwarded-for': '5.6.7.8' } })).toBe('5.6.7.8');
  });

  it('falls back to connection and socket addresses', () => {
    expect(
      getClientIP({
        headers: {},
        connection: { remoteAddress: '::ffff:9.9.9.9' },
      })
    ).toBe('9.9.9.9');
    expect(
      getClientIP({
        headers: {},
        socket: { remoteAddress: '10.0.0.1' },
      })
    ).toBe('10.0.0.1');
    expect(
      getClientIP({
        headers: {},
        connection: { socket: { remoteAddress: '11.0.0.1' } },
      })
    ).toBe('11.0.0.1');
  });

  it('returns empty string when no ip is found', () => {
    expect(getClientIP({ headers: {} })).toBe('');
  });
});

describe('parseIp', () => {
  const mockBtreeSearchSync = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    mockBtreeSearchSync.mockReset();
    jest.doMock('node-ip2region', () => ({
      create: () => ({ btreeSearchSync: mockBtreeSearchSync }),
    }));
  });

  it('formats region and filters zero segments', () => {
    mockBtreeSearchSync.mockReturnValue({ region: '中国|0|北京|0|电信' });
    const { parseIp } = require('./ip.util');
    expect(parseIp('1.1.1.1')).toBe('中国 北京 电信');
  });

  it('returns empty string on lookup failure', () => {
    mockBtreeSearchSync.mockImplementation(() => {
      throw new Error('lookup failed');
    });
    const { parseIp } = require('./ip.util');
    expect(parseIp('bad')).toBe('');
  });
});
