import { HttpException } from '@nestjs/common';

import { ApiMsg } from '../common/api-messages';
import { AliyunOssClient } from './oss/aliyun-oss-client';
import { Oss } from './oss.util';

jest.mock('./oss/aliyun-oss-client', () => ({
  AliyunOssClient: jest.fn(),
}));

const MockAliyun = AliyunOssClient as unknown as jest.Mock;

describe('Oss', () => {
  const findAll = jest.fn();
  let putFile: jest.Mock;
  let getFile: jest.Mock;
  let deleteFile: jest.Mock;

  beforeEach(() => {
    findAll.mockReset();
    putFile = jest.fn().mockResolvedValue('https://oss/file');
    getFile = jest.fn().mockResolvedValue(Buffer.from('x'));
    deleteFile = jest.fn().mockResolvedValue(undefined);
    MockAliyun.mockReset();
    MockAliyun.mockImplementation(() => ({
      putFile,
      getFile,
      deleteFile,
    }));
  });

  function createOss() {
    return new Oss({ findAll } as never);
  }

  it('hasOssConfig returns true when settings parse succeeds', async () => {
    findAll.mockResolvedValue({ oss: JSON.stringify({ type: 'aliyun' }) });
    const oss = createOss();
    await expect(oss.hasOssConfig()).resolves.toBe(true);
  });

  it('hasOssConfig returns false on errors', async () => {
    findAll.mockRejectedValue(new Error('db'));
    const oss = createOss();
    await expect(oss.hasOssConfig()).resolves.toBe(false);
  });

  it('putFile, getFile, and deleteFile use aliyun client by default', async () => {
    findAll.mockResolvedValue({
      oss: JSON.stringify({ type: 'aliyun', bucket: 'b' }),
    });
    const oss = createOss();
    await expect(oss.putFile('a.png', Buffer.from('i'))).resolves.toBe('https://oss/file');
    await expect(oss.getFile('a.png')).resolves.toEqual(Buffer.from('x'));
    await oss.deleteFile('https://oss/file');
    expect(putFile).toHaveBeenCalled();
    expect(getFile).toHaveBeenCalled();
    expect(deleteFile).toHaveBeenCalled();
  });

  it('uses aliyun for unknown type', async () => {
    findAll.mockResolvedValue({ oss: JSON.stringify({ type: 'other' }) });
    const oss = createOss();
    await oss.putFile('x', Buffer.alloc(0));
    expect(MockAliyun).toHaveBeenCalled();
  });

  it('throws when oss config is missing', async () => {
    findAll.mockResolvedValue({ oss: JSON.stringify(null) });
    const oss = createOss();
    await expect(oss.putFile('x', Buffer.alloc(0))).rejects.toMatchObject({
      message: ApiMsg.OSS_CONFIG_INCOMPLETE,
    });
    await expect(oss.putFile('x', Buffer.alloc(0))).rejects.toBeInstanceOf(HttpException);
  });
});
