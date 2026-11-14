import React from 'react';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useLocation } from '@docusaurus/router';
import Root from '@theme-original/Root';
import type { Props } from '@theme/Root';
import { Analytics } from '@vercel/analytics/react';
import ContactFloat from '@site/src/components/ContactFloat';
import { isBlogPostPath, isDocPath, isFaqDocPath, shouldNoIndexPath } from '@site/src/seo/paths';
import { SOCIAL_CARD, socialCardUrl } from '@site/src/seo/social';
import { buildFaqPageJsonLd, FAQ_ENTRIES_EN, FAQ_ENTRIES_ZH } from '@site/src/seo/structuredData';

function withTrailingSlash(pathname: string): string {
  if (pathname.endsWith('/') || pathname === '') {
    return pathname || '/';
  }
  return `${pathname}/`;
}

function RouteSeoHead(): React.JSX.Element {
  const { pathname } = useLocation();
  const { siteConfig, i18n } = useDocusaurusContext();
  const noIndex = shouldNoIndexPath(pathname);
  const faqPage = isFaqDocPath(pathname);
  const articleSurface = isDocPath(pathname) || isBlogPostPath(pathname);
  const imageUrl = socialCardUrl(siteConfig.url);
  const pageUrl = `${siteConfig.url}${withTrailingSlash(pathname)}`.replace(/([^:]\/)\/+/g, '$1');
  const faqEntries = i18n.currentLocale === 'zh' ? FAQ_ENTRIES_ZH : FAQ_ENTRIES_EN;

  return (
    <Head>
      {/* Locale-neutral absolute OG/Twitter image (overrides Docusaurus `/zh/img/...`). */}
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:type" content={SOCIAL_CARD.type} />
      <meta property="og:image:width" content={String(SOCIAL_CARD.width)} />
      <meta property="og:image:height" content={String(SOCIAL_CARD.height)} />
      <meta property="og:image:alt" content={SOCIAL_CARD.alt} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={SOCIAL_CARD.alt} />
      {articleSurface ? <meta property="og:type" content="article" /> : null}
      {articleSurface ? <meta property="og:url" content={pageUrl} /> : null}
      {noIndex ? <meta name="robots" content="noindex, follow" /> : null}
      {faqPage ? (
        <script type="application/ld+json">{JSON.stringify(buildFaqPageJsonLd(faqEntries, pageUrl))}</script>
      ) : null}
    </Head>
  );
}

export default function RootWrapper(props: Props): React.JSX.Element {
  return (
    <>
      <Root {...props} />
      <ContactFloat />
      <RouteSeoHead />
      <Analytics />
    </>
  );
}
