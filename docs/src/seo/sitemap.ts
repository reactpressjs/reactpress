import { localeFromPathname, localeNeutralPathKey, shouldExcludeFromSitemap } from './paths';

type SitemapLink = {
  lang: string;
  hreflang?: string;
  url: string;
};

type SitemapItemInput = {
  url: string;
  changefreq?: string;
  priority?: number;
  lastmod?: string | null;
  links?: SitemapLink[];
};

function applyPriorityRules(item: SitemapItemInput): SitemapItemInput {
  const pathname = new URL(item.url).pathname;
  const key = localeNeutralPathKey(pathname);

  if (key === '/') {
    return { ...item, priority: 1.0, changefreq: 'daily' };
  }
  if (key === '/docs/intro') {
    return { ...item, priority: 0.9 };
  }
  if (
    key === '/docs/getting-started/first-site' ||
    key === '/docs/getting-started/installation' ||
    key === '/docs/getting-started/what-is-reactpress' ||
    key === '/docs/getting-started/build-nextjs-blog-in-60-seconds' ||
    key === '/docs/getting-started/reactpress-vs-wordpress' ||
    key === '/docs/getting-started/self-hosted-cms-for-react' ||
    key === '/docs/tutorial-basics/create-a-post'
  ) {
    return { ...item, priority: 0.85, changefreq: 'weekly' };
  }
  if (key === '/themes' || key === '/plugins' || key === '/best-practices') {
    return { ...item, priority: 0.88, changefreq: 'weekly' };
  }
  if (key === '/about' || key === '/contact') {
    return { ...item, priority: 0.6, changefreq: 'monthly' };
  }
  if (key === '/docs/developer-guide/headless-api') {
    return { ...item, priority: 0.75 };
  }
  if (
    key === '/blog/why-react-still-doesnt-have-wordpress-reactpress-4' ||
    key === '/blog/reactpress-vs-strapi-payload-headless-cms' ||
    key === '/blog/self-hosted-nextjs-cms-blog-guide' ||
    key === '/blog/wordpress-alternatives-for-react-developers-2026' ||
    key === '/blog/nextjs-blog-seo-checklist-reactpress'
  ) {
    return { ...item, priority: 0.85, changefreq: 'monthly' };
  }
  if (key === '/blog') {
    return { ...item, priority: 0.75, changefreq: 'weekly' };
  }
  if (key === '/blog/changelog') {
    return { ...item, priority: 0.8 };
  }

  return item;
}

/** Map an en URL to zh (or zh to en) using the site's i18n URL scheme. */
export function toAlternateLocaleUrl(url: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '');
  const pathname = new URL(url).pathname;

  if (pathname === '/zh' || pathname === '/zh/') {
    return `${base}/`;
  }
  if (pathname.startsWith('/zh/')) {
    const enPath = pathname.slice(3) || '/';
    if (enPath === '/') {
      return `${base}/`;
    }
    return `${base}${enPath}`;
  }
  if (pathname === '/') {
    return `${base}/zh/`;
  }
  // Preserve trailing-slash style from the source URL.
  return `${base}/zh${pathname}`;
}

function buildHreflangLinks(itemUrl: string, siteUrl: string): SitemapLink[] {
  const locale = localeFromPathname(new URL(itemUrl).pathname);
  const enUrl = locale === 'en' ? itemUrl : toAlternateLocaleUrl(itemUrl, siteUrl);
  const zhUrl = locale === 'zh' ? itemUrl : toAlternateLocaleUrl(itemUrl, siteUrl);

  // Docusaurus sitemap emits `lang` as the hreflang attribute value.
  return [
    { lang: 'en', url: enUrl },
    { lang: 'zh-Hans', url: zhUrl },
    { lang: 'x-default', url: enUrl },
  ];
}

/**
 * Filter low-value routes, apply priority rules, and inject en/zh/x-default hreflang
 * alternates. Docusaurus builds one sitemap per locale, so alternates are derived
 * from the URL pattern (/… ↔ /zh/…).
 */
export function enhanceSitemapItems(items: SitemapItemInput[], siteUrl: string): SitemapItemInput[] {
  return items
    .filter((item) => !shouldExcludeFromSitemap(item.url))
    .map(applyPriorityRules)
    .map((item) => ({
      ...item,
      links: buildHreflangLinks(item.url, siteUrl),
    }));
}
