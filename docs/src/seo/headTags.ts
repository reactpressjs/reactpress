import type { Tag } from '@docusaurus/types';
import { SOCIAL_CARD, TWITTER_SITE, socialCardUrl } from './social';
import { buildOrganizationGraph } from './structuredData';

/** Live production host (Cloudflare 301s apex → www). */
export const DEFAULT_SITE_URL = 'https://www.reactpress.cc';

const GOOGLE_ADSENSE_CLIENT = 'ca-pub-5349318179336721';

/**
 * Canonical site origin for Docusaurus `url`, sitemap, OG, and JSON-LD.
 * Apex `reactpress.cc` is rewritten to www so builds stay correct even when
 * stale DOCS_SITE_URL / CI vars still point at the redirecting host.
 */
export function getSiteUrl(): string {
  const raw = (process.env.DOCS_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/$/, '');
  if (raw === 'https://reactpress.cc' || raw === 'http://reactpress.cc') {
    return DEFAULT_SITE_URL;
  }
  return raw;
}

export function shouldEnableAdSense(): boolean {
  const flag = process.env.DOCS_ENABLE_ADSENSE?.trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') {
    return false;
  }
  // Opt-in only — keeps AdSense off docs pages unless explicitly enabled.
  return flag === '1' || flag === 'true' || flag === 'on';
}

/** Site-wide head tags. Per-page hreflang and og:locale are handled by Docusaurus i18n. */
export function buildGlobalHeadTags(siteUrl: string): Tag[] {
  const baseUrl = siteUrl.replace(/\/$/, '');
  const imageUrl = socialCardUrl(baseUrl);
  const tags: Tag[] = [
    {
      tagName: 'link',
      attributes: { rel: 'apple-touch-icon', href: `${baseUrl}/img/apple-touch-icon.png` },
    },
    { tagName: 'meta', attributes: { property: 'og:type', content: 'website' } },
    { tagName: 'meta', attributes: { property: 'og:site_name', content: 'ReactPress' } },
    { tagName: 'meta', attributes: { property: 'og:image', content: imageUrl } },
    {
      tagName: 'meta',
      attributes: { property: 'og:image:secure_url', content: imageUrl },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:image:type', content: SOCIAL_CARD.type },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:image:width', content: String(SOCIAL_CARD.width) },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:image:height', content: String(SOCIAL_CARD.height) },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:image:alt', content: SOCIAL_CARD.alt },
    },
    { tagName: 'meta', attributes: { name: 'twitter:card', content: 'summary_large_image' } },
    { tagName: 'meta', attributes: { name: 'twitter:site', content: TWITTER_SITE } },
    { tagName: 'meta', attributes: { name: 'twitter:image', content: imageUrl } },
    {
      tagName: 'meta',
      attributes: { name: 'twitter:image:alt', content: SOCIAL_CARD.alt },
    },
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify(buildOrganizationGraph(baseUrl)),
    },
  ];

  if (shouldEnableAdSense()) {
    tags.unshift({
      tagName: 'script',
      attributes: {
        async: 'true',
        src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${GOOGLE_ADSENSE_CLIENT}`,
        crossorigin: 'anonymous',
      },
    });
  }

  return tags;
}
