import { filterByWhitelist } from './query-whitelist.util';

describe('filterByWhitelist', () => {
  it('returns empty object for unknown entity', () => {
    expect(filterByWhitelist('unknown', { title: 'x' })).toEqual({});
  });

  it('keeps only whitelisted article fields and strips pagination meta', () => {
    const result = filterByWhitelist('article', {
      title: 'Hello',
      page: 1,
      pageSize: 10,
      status: 1,
      pass: true,
      notAllowed: 'nope',
    });
    expect(result).toEqual({ title: 'Hello' });
  });

  it('filters comment fields', () => {
    const result = filterByWhitelist('comment', { name: 'Bob', evil: 'x' });
    expect(result).toEqual({ name: 'Bob' });
  });

  it('filters file, page, and knowledge entities', () => {
    expect(filterByWhitelist('file', { filename: 'a.png', extra: 1 })).toEqual({ filename: 'a.png' });
    expect(filterByWhitelist('page', { path: '/about' })).toEqual({ path: '/about' });
    expect(filterByWhitelist('knowledge', { summary: 's' })).toEqual({ summary: 's' });
  });
});
