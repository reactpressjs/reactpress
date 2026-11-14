/** Docs OG / Twitter image — brand wordmark (`logo.png`), not a designed card. */
export const SOCIAL_CARD = {
  path: '/img/reactpress-social-card.png',
  width: 800,
  height: 242,
  type: 'image/png',
  alt: 'ReactPress — Write with Focus. Publish with Joy.',
} as const;

export const TWITTER_SITE = '@reactpre';

export function absoluteUrl(siteUrl: string, pathname = '/'): string {
  const base = siteUrl.replace(/\/$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}`.replace(/([^:]\/)\/+/g, '$1');
}

/** Always absolute + locale-neutral so zh pages do not emit `/zh/img/...`. */
export function socialCardUrl(siteUrl: string): string {
  return absoluteUrl(siteUrl, SOCIAL_CARD.path);
}
