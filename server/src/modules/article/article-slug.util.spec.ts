import { normalizeArticleSlug, slugifyArticle } from './article-slug.util';

describe('slugifyArticle', () => {
  it('trims, lowercases, and replaces spaces with hyphens', () => {
    expect(slugifyArticle('  Hello World  ')).toBe('hello-world');
  });

  it('keeps word characters, CJK, and hyphens', () => {
    expect(slugifyArticle('React 中文 Post!')).toBe('react-中文-post');
  });

  it('collapses repeated hyphens and trims edges', () => {
    expect(slugifyArticle('--foo---bar--')).toBe('foo-bar');
  });

  it('returns empty string for empty input', () => {
    expect(slugifyArticle('')).toBe('');
    expect(slugifyArticle(null as unknown as string)).toBe('');
  });
});

describe('normalizeArticleSlug', () => {
  it('returns null when slugify yields empty', () => {
    expect(normalizeArticleSlug('   !!!   ')).toBeNull();
    expect(normalizeArticleSlug(undefined)).toBeNull();
  });

  it('returns normalized slug when value is present', () => {
    expect(normalizeArticleSlug('My Post')).toBe('my-post');
  });
});
