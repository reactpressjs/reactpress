import { buildThemePlaceholderCoverSvg } from './theme-placeholder-cover';

describe('buildThemePlaceholderCoverSvg', () => {
  it('builds svg with defaults and escapes unsafe name characters', () => {
    const svg = buildThemePlaceholderCoverSvg({
      id: 'my-theme',
      name: 'Demo <script>',
      version: '1.0.0',
      primary: '#112233',
      accent: 'not-a-color',
    });
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('stop-color="#112233"');
    expect(svg).toContain('v1.0.0');
    expect(svg).not.toContain('not-a-color');
  });

  it('truncates long names and sanitizes id for gradient refs', () => {
    const longName = 'A'.repeat(60);
    const svg = buildThemePlaceholderCoverSvg({
      id: 'bad id!',
      name: longName,
    });
    expect(svg).toContain('…');
    expect(svg).toContain('id="badid-bg"');
    expect(svg).not.toContain('>v');
  });

  it('uses id as name fallback and omits version badge when version missing', () => {
    const svg = buildThemePlaceholderCoverSvg({ id: 'solo' });
    expect(svg).toContain('>solo<');
    expect(svg).not.toMatch(/font-size="11"[^>]*>v/);
  });

  it('escapes quotes in version and name', () => {
    const svg = buildThemePlaceholderCoverSvg({
      id: 't',
      name: `O'Brien`,
      version: `"2"`,
    });
    expect(svg).toContain('&#39;');
    expect(svg).toContain('&quot;');
  });
});
