import { OssClient } from './oss-client';

class TestOssClient extends OssClient {
  async putFile(filepath: string, buffer: Buffer): Promise<string> {
    return `https://example/${filepath}/${buffer.length}`;
  }

  async getFile(filepath: string): Promise<Buffer> {
    return Buffer.from(filepath);
  }

  async deleteFile(url: string): Promise<void> {
    void url;
  }
}

describe('OssClient', () => {
  it('stores config from constructor', () => {
    const config = { region: 'cn-hangzhou' };
    const client = new TestOssClient(config);
    expect(client.config).toBe(config);
  });

  it('delegates to concrete implementations', async () => {
    const client = new TestOssClient({});
    await expect(client.putFile('a.txt', Buffer.from('hi'))).resolves.toBe('https://example/a.txt/2');
    await expect(client.getFile('path')).resolves.toEqual(Buffer.from('path'));
    await expect(client.deleteFile('https://x')).resolves.toBeUndefined();
  });
});
