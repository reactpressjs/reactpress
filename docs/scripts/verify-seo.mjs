/**
 * Post-build SEO guardrails for the docs site.
 * Fails the build when canonical host / trailing-slash / sitemap signals drift.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.join(__dirname, '..');
const outDir = process.argv[2] ?? path.join(docsRoot, 'build');
const EXPECTED_HOST = 'https://www.reactpress.cc';
const FORBIDDEN_HOST = 'https://reactpress.cc';

function read(filePath) {
  assert.ok(fs.existsSync(filePath), `missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function assertNoApexHost(content, label) {
  assert.equal(
    content.includes(`${FORBIDDEN_HOST}/`) || content.includes(`${FORBIDDEN_HOST}"`),
    false,
    `${label} must not emit apex host ${FORBIDDEN_HOST} (use ${EXPECTED_HOST})`
  );
}

function main() {
  const robots = read(path.join(outDir, 'robots.txt'));
  assert.match(robots, /Sitemap:\s*https:\/\/www\.reactpress\.cc\/sitemap\.xml/);
  assert.match(robots, /Sitemap:\s*https:\/\/www\.reactpress\.cc\/zh\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Sitemap:\s*https:\/\/reactpress\.cc\//);

  const sitemap = read(path.join(outDir, 'sitemap.xml'));
  assert.match(sitemap, new RegExp(`<loc>${EXPECTED_HOST}/</loc>`));
  assert.match(sitemap, /hreflang="zh-Hans"/);
  assert.match(sitemap, /hreflang="x-default"/);
  assert.equal(sitemap.includes('/blog/tags'), false, 'sitemap must exclude blog tags');
  assertNoApexHost(sitemap, 'sitemap.xml');

  const zhSitemap = read(path.join(outDir, 'zh', 'sitemap.xml'));
  assert.match(zhSitemap, new RegExp(`<loc>${EXPECTED_HOST}/zh/</loc>`));
  assertNoApexHost(zhSitemap, 'zh/sitemap.xml');

  const home = read(path.join(outDir, 'index.html'));
  assert.match(home, new RegExp(`rel="canonical" href="${EXPECTED_HOST}/"`));
  assert.equal(home.includes('FAQPage'), false, 'homepage must not emit FAQPage JSON-LD');
  assertNoApexHost(home, 'index.html');

  const docSample = read(path.join(outDir, 'docs', 'developer-guide', 'headless-api', 'index.html'));
  assert.match(docSample, new RegExp(`rel="canonical" href="${EXPECTED_HOST}/docs/developer-guide/headless-api/"`));
  assert.match(docSample, /hreflang="zh-Hans"/);
  assertNoApexHost(docSample, 'headless-api');

  const tagsSamplePath = path.join(outDir, 'blog', 'tags', 'nextjs', 'index.html');
  if (fs.existsSync(tagsSamplePath)) {
    const tagsHtml = read(tagsSamplePath);
    assert.match(tagsHtml, /name="robots" content="noindex,\s*follow"/);
  }

  console.log(`verify-seo: ok (${EXPECTED_HOST}, trailingSlash, no apex host)`);
}

main();
