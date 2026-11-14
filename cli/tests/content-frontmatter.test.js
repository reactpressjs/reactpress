const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseMarkdownFrontmatter, slugify } = require('../out/lib/content');

describe('content frontmatter', () => {
  it('parses title, tags array, and body', () => {
    const md = `---
title: Hello World
slug: hello-world
tags: [react, cms]
category: Engineering
summary: A short summary
---

# Hello World

Body paragraph.
`;
    const { attributes, body } = parseMarkdownFrontmatter(md);
    assert.equal(attributes.title, 'Hello World');
    assert.equal(attributes.slug, 'hello-world');
    assert.deepEqual(attributes.tags, ['react', 'cms']);
    assert.equal(attributes.category, 'Engineering');
    assert.match(body, /Body paragraph/);
  });

  it('returns full text as body when frontmatter is missing', () => {
    const { attributes, body } = parseMarkdownFrontmatter('# Only body\n');
    assert.deepEqual(attributes, {});
    assert.equal(body, '# Only body');
  });

  it('slugifies labels for tag/category values', () => {
    assert.equal(slugify('Hello World'), 'hello-world');
    assert.equal(slugify('  ReactPress  '), 'reactpress');
  });
});
