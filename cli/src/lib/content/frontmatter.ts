// @ts-nocheck

/**
 * Minimal YAML-like frontmatter parser for ReactPress Markdown posts.
 * Supports simple scalars and inline string arrays: tags: [a, b]
 */

function stripQuotes(value) {
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineArray(raw) {
  const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!inner.trim()) return [];
  return inner.split(',').map((part) => stripQuotes(part.trim())).filter(Boolean);
}

function parseFrontmatterValue(raw) {
  const value = String(raw).trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    return parseInlineArray(value);
  }
  return stripQuotes(value);
}

/**
 * @param {string} markdown
 * @returns {{ attributes: Record<string, unknown>, body: string }}
 */
function parseMarkdownFrontmatter(markdown) {
  const text = String(markdown || '').replace(/^\uFEFF/, '');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { attributes: {}, body: text.trim() };
  }

  const attributes = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const raw = trimmed.slice(idx + 1);
    attributes[key] = parseFrontmatterValue(raw);
  }

  return { attributes, body: match[2].replace(/^\r?\n/, '') };
}

module.exports = {
  parseMarkdownFrontmatter,
  parseFrontmatterValue,
};
