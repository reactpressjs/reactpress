/**
 * Post-build SEO guardrails for the docs site.
 * Fails the build when canonical host / trailing-slash / sitemap / OG signals drift.
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
const SOCIAL_CARD = `${EXPECTED_HOST}/img/reactpress-social-card.png`;

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

function assertSocialCardMeta(html, label) {
  assert.match(html, new RegExp(`property="og:image" content="${SOCIAL_CARD}"`));
  assert.match(html, /property="og:image:width" content="800"/);
  assert.match(html, /property="og:image:height" content="242"/);
  assert.match(html, new RegExp(`name="twitter:image" content="${SOCIAL_CARD}"`));
  assert.equal(
    html.includes('/zh/img/reactpress-social-card.png'),
    false,
    `${label} must not locale-prefix the social card path`
  );
}

function main() {
  const socialCardPath = path.join(docsRoot, 'static', 'img', 'reactpress-social-card.png');
  assert.ok(
    fs.existsSync(socialCardPath),
    'missing docs/static/img/reactpress-social-card.png — run pnpm export:brand'
  );
  // PNG IHDR width/height are big-endian u32 at offsets 16 and 20.
  const png = fs.readFileSync(socialCardPath);
  assert.equal(png.toString('ascii', 1, 4), 'PNG', 'social card must be a PNG');
  const cardWidth = png.readUInt32BE(16);
  const cardHeight = png.readUInt32BE(20);
  assert.equal(cardWidth, 800, `social card width must be 800 wordmark (got ${cardWidth}) — run pnpm export:brand`);
  assert.equal(cardHeight, 242, `social card height must be 242 wordmark (got ${cardHeight}) — run pnpm export:brand`);

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
  assertSocialCardMeta(home, 'index.html');
  assertNoApexHost(home, 'index.html');

  const docSample = read(path.join(outDir, 'docs', 'developer-guide', 'headless-api', 'index.html'));
  assert.match(docSample, new RegExp(`rel="canonical" href="${EXPECTED_HOST}/docs/developer-guide/headless-api/"`));
  assert.match(docSample, /hreflang="zh-Hans"/);
  assert.match(docSample, /"@type":"TechArticle"/);
  assertSocialCardMeta(docSample, 'headless-api');
  assertNoApexHost(docSample, 'headless-api');

  const zhHome = read(path.join(outDir, 'zh', 'index.html'));
  assertSocialCardMeta(zhHome, 'zh/index.html');
  assertNoApexHost(zhHome, 'zh/index.html');

  const tagsSamplePath = path.join(outDir, 'blog', 'tags', 'nextjs', 'index.html');
  if (fs.existsSync(tagsSamplePath)) {
    const tagsHtml = read(tagsSamplePath);
    assert.match(tagsHtml, /name="robots" content="noindex,\s*follow"/);
  }

  console.log(`verify-seo: ok (${EXPECTED_HOST}, OG wordmark 800×242, trailingSlash, no apex host)`);
}

main();
