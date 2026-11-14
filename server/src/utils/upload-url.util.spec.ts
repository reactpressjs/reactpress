import type { ConfigService } from '@nestjs/config';

import { resolveServerSiteUrl, resolveUploadBaseUrl, rewriteBrokenUploadUrl } from './upload-url.util';

function mockConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key in values) return values[key];
      return defaultValue;
    }),
  } as unknown as ConfigService;
}

describe('upload URL helpers', () => {
  it('resolveServerSiteUrl trims trailing slash or uses default', () => {
    expect(resolveServerSiteUrl(mockConfig({ SERVER_SITE_URL: 'https://api.example.com/' }))).toBe(
      'https://api.example.com'
    );
    expect(resolveServerSiteUrl(mockConfig({}))).toBe('http://localhost:3002');
    expect(resolveServerSiteUrl(mockConfig({ SERVER_SITE_URL: '   ' }))).toBe('http://localhost:3002');
  });

  it('resolveUploadBaseUrl prefers SERVER_PUBLIC_UPLOAD_URL', () => {
    expect(
      resolveUploadBaseUrl(
        mockConfig({
          SERVER_PUBLIC_UPLOAD_URL: 'https://cdn.example.com/uploads/',
          SERVER_SITE_URL: 'https://api.example.com',
        })
      )
    ).toBe('https://cdn.example.com/uploads');
    expect(resolveUploadBaseUrl(mockConfig({ SERVER_SITE_URL: 'https://api.example.com' }))).toBe(
      'https://api.example.com/public/uploads'
    );
  });

  it('rewriteBrokenUploadUrl fixes undefined upload paths', () => {
    expect(rewriteBrokenUploadUrl(null, 'https://site/public/uploads')).toBe('');
    expect(rewriteBrokenUploadUrl(undefined, 'https://site/public/uploads')).toBe('');
    expect(rewriteBrokenUploadUrl('https://ok/file', 'https://site/public/uploads')).toBe('https://ok/file');
    expect(rewriteBrokenUploadUrl('undefined/public/uploads/foo.png', 'https://site/public/uploads')).toBe(
      'https://site/public/uploads/foo.png'
    );
    expect(rewriteBrokenUploadUrl('undefined/other', 'https://site/public/uploads')).toBe('https://site/other');
  });
});
