import { extractProtectedArticle } from './article.util';

describe('extractProtectedArticle', () => {
  it('removes content and html from the article object', () => {
    const article = { id: '1', title: 't', content: 'secret', html: '<p>x</p>' };
    extractProtectedArticle(article);
    expect(article).toEqual({ id: '1', title: 't' });
    expect('content' in article).toBe(false);
    expect('html' in article).toBe(false);
  });
});
