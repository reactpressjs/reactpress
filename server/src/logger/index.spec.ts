describe('logger index', () => {
  const prevLogDir = process.env.REACTPRESS_SERVER_LOG_DIR;

  afterEach(() => {
    if (prevLogDir === undefined) delete process.env.REACTPRESS_SERVER_LOG_DIR;
    else process.env.REACTPRESS_SERVER_LOG_DIR = prevLogDir;
  });

  function loadLogger() {
    jest.resetModules();
    const ensureDirSync = jest.fn();
    const configure = jest.fn();
    const getLogger = jest.fn(() => ({ info: jest.fn(), error: jest.fn() }));
    jest.doMock('fs-extra', () => ({ ensureDirSync }));
    jest.doMock('log4js', () => ({ configure, getLogger }));
    const mod = require('./index');
    return { mod, ensureDirSync, configure, getLogger };
  }

  it('configures log directories and exports loggers', () => {
    process.env.REACTPRESS_SERVER_LOG_DIR = '/tmp/reactpress-logs';
    const { mod, ensureDirSync, configure, getLogger } = loadLogger();
    expect(ensureDirSync).toHaveBeenCalledWith('/tmp/reactpress-logs');
    expect(ensureDirSync).toHaveBeenCalledWith(expect.stringContaining('request'));
    expect(configure).toHaveBeenCalled();
    expect(getLogger).toHaveBeenCalledWith('response');
    expect(getLogger).toHaveBeenCalledWith('error');
    expect(mod.responseLogger).toBeDefined();
    expect(mod.errorLogger).toBeDefined();
  });

  it('uses default log dir when env is blank', () => {
    process.env.REACTPRESS_SERVER_LOG_DIR = '   ';
    const { ensureDirSync } = loadLogger();
    expect(ensureDirSync).toHaveBeenCalledWith(expect.stringMatching(/logs$/));
  });
});
