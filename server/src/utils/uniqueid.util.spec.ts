describe('uniqueid', () => {
  it('returns the next nuid', () => {
    jest.resetModules();
    const next = jest.fn(() => 'mock-nuid-value');
    jest.doMock('nuid', () => ({ next }));
    const { uniqueid } = require('./uniqueid.util');
    expect(uniqueid()).toBe('mock-nuid-value');
    expect(next).toHaveBeenCalled();
  });
});
