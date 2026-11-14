describe('AliyunOssClient', () => {
  const config = {
    region: 'oss-cn-hangzhou',
    accessKeyId: 'id',
    accessKeySecret: 'secret',
    bucket: 'bucket',
    https: true,
  };

  function loadClient(mocks: { put: jest.Mock; get: jest.Mock; del: jest.Mock; ctor: jest.Mock }) {
    jest.resetModules();
    jest.doMock('ali-oss', () => mocks.ctor);
    const { AliyunOssClient } = require('./aliyun-oss-client');
    return AliyunOssClient;
  }

  it('builds ali-oss client from config', async () => {
    const put = jest.fn().mockResolvedValue({ url: 'https://cdn.example/object.png' });
    const get = jest.fn();
    const del = jest.fn();
    const ctor = jest.fn(() => ({ put, get, delete: del }));
    const AliyunOssClient = loadClient({ put, get, del, ctor });
    const client = new AliyunOssClient(config);
    await client.putFile('dir/file.png', Buffer.from('img'));
    expect(ctor).toHaveBeenCalledWith({
      region: 'oss-cn-hangzhou',
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      bucket: 'bucket',
      secure: true,
    });
    expect(put).toHaveBeenCalledWith('dir/file.png', Buffer.from('img'));
  });

  it('gets and deletes objects', async () => {
    const put = jest.fn();
    const get = jest.fn().mockResolvedValue({ content: Buffer.from('bytes') });
    const del = jest.fn().mockResolvedValue(undefined);
    const ctor = jest.fn(() => ({ put, get, delete: del }));
    const AliyunOssClient = loadClient({ put, get, del, ctor });
    const client = new AliyunOssClient(config);
    await expect(client.getFile('dir/file.png')).resolves.toEqual(Buffer.from('bytes'));
    await client.deleteFile('https://cdn.example/object.png');
    expect(get).toHaveBeenCalledWith('dir/file.png');
    expect(del).toHaveBeenCalledWith('https://cdn.example/object.png');
  });
});
