import * as path from 'path';

function loadUploadModule() {
  jest.resetModules();
  const existsSync = jest.fn();
  const mkdirSync = jest.fn();
  const writeFileSync = jest.fn();
  const readFileSync = jest.fn();
  const unlinkSync = jest.fn();
  jest.doMock('fs', () => ({
    existsSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    unlinkSync,
  }));
  const { LocalUpload } = require('./upload.util') as { LocalUpload: typeof import('./upload.util').LocalUpload };
  return { LocalUpload, existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync };
}

describe('LocalUpload', () => {
  const prevUploadDir = process.env.REACTPRESS_UPLOAD_DIR;

  afterEach(() => {
    if (prevUploadDir === undefined) delete process.env.REACTPRESS_UPLOAD_DIR;
    else process.env.REACTPRESS_UPLOAD_DIR = prevUploadDir;
  });

  it('uses REACTPRESS_UPLOAD_DIR when set', () => {
    process.env.REACTPRESS_UPLOAD_DIR = '/var/uploads';
    const { LocalUpload, existsSync, writeFileSync } = loadUploadModule();
    existsSync.mockReturnValue(true);
    const upload = new LocalUpload();
    upload.putFile('a/b.txt', Buffer.from('data'));
    expect(writeFileSync).toHaveBeenCalledWith(path.join('/var/uploads', 'a/b.txt'), Buffer.from('data'));
  });

  it('creates nested directories before writing', () => {
    const { LocalUpload, existsSync, mkdirSync, writeFileSync } = loadUploadModule();
    existsSync.mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValueOnce(true);
    const upload = new LocalUpload();
    upload.putFile('deep/nested/file.txt', Buffer.from('x'));
    expect(mkdirSync).toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalled();
  });

  it('reads and deletes files', () => {
    const { LocalUpload, existsSync, readFileSync, unlinkSync } = loadUploadModule();
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(Buffer.from('payload'));
    const upload = new LocalUpload();
    expect(upload.getFile('f.txt')).toEqual(Buffer.from('payload'));
    upload.deleteFile('f.txt');
    expect(unlinkSync).toHaveBeenCalled();
  });

  it('throws when reading a missing file', () => {
    const { LocalUpload, existsSync } = loadUploadModule();
    existsSync.mockReturnValue(false);
    const upload = new LocalUpload();
    expect(() => upload.getFile('missing.txt')).toThrow('File not found');
  });

  it('no-ops delete when file is missing', () => {
    const { LocalUpload, existsSync, unlinkSync } = loadUploadModule();
    existsSync.mockReturnValue(false);
    const upload = new LocalUpload();
    upload.deleteFile('missing.txt');
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it('writes when parent upload dirs already exist', () => {
    process.env.REACTPRESS_UPLOAD_DIR = '/var/up';
    const { LocalUpload, existsSync, writeFileSync } = loadUploadModule();
    existsSync.mockImplementation((p: string) => p === '/var' || p === '/var/up');
    const upload = new LocalUpload();
    upload.putFile('orphan.txt', Buffer.from('x'));
    expect(writeFileSync).toHaveBeenCalled();
  });
});
