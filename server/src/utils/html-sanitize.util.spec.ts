import { sanitizeHtml } from './html-sanitize.util';

describe('sanitizeHtml', () => {
  it('removes dangerous tags and their content', () => {
    const input = '<p>ok</p><script>alert(1)</script><iframe src="x"></iframe>';
    expect(sanitizeHtml(input)).toBe('<p>ok</p>');
  });

  it('removes self-closing dangerous tags', () => {
    expect(sanitizeHtml('<link rel="x" /><meta charset="utf-8" />')).toBe('');
  });

  it('strips event handlers', () => {
    const input = '<div onclick="evil()">x</div>';
    expect(sanitizeHtml(input)).toBe('<div >x</div>');
  });

  it('strips javascript: hrefs and bare javascript protocols', () => {
    const input = '<a href="javascript:alert(1)">x</a> javascript: void';
    const out = sanitizeHtml(input);
    expect(out).not.toContain('javascript:alert');
    expect(out).not.toContain('javascript:');
  });

  it('handles single-quoted event handlers', () => {
    expect(sanitizeHtml("<img onerror='bad()' src='a' />")).not.toContain('onerror');
  });
});
