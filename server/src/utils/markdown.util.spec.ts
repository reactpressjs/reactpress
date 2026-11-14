import { marked } from './markdown.util';

describe('marked', () => {
  it('renders headings with anchors and table of contents', () => {
    const input = '# Hello World\n\n## Section Two\n\nparagraph';
    const { html, toc } = marked(input);
    expect(html).toContain('id="heading-0"');
    expect(html).toContain('id="heading-1"');
    const parsed = JSON.parse(toc) as Array<{ id: string; text: string }>;
    expect(parsed).toHaveLength(2);
    expect(parsed[0].text).toBe('Hello World');
  });

  it('highlights known and unknown languages in fenced blocks', () => {
    const jsBlock = '```javascript\nconst x = 1;\n```';
    const plainBlock = '```nonsense-lang\nfoo();\n```';
    const { html: jsHtml } = marked(jsBlock);
    const { html: unknownHtml } = marked(plainBlock);
    expect(jsHtml).toContain('hljs');
    expect(unknownHtml).toContain('hljs');
  });

  it('returns empty toc for content without headings', () => {
    const { html, toc } = marked('Just **bold** text.');
    expect(html).toContain('<strong>bold</strong>');
    expect(JSON.parse(toc)).toEqual([]);
  });

  it('renders the initial heading anchor before toc replacement', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Marked = require('marked') as (src: string) => string;
      require('./markdown.util');
      const html = Marked('# Hello World');
      expect(html).toContain('name="hello-world"');
      expect(html).toContain('class="anchor"');
    });
  });
});
