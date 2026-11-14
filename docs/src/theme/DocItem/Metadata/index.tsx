import React, { type ReactNode } from 'react';
import Head from '@docusaurus/Head';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { socialCardUrl } from '@site/src/seo/social';
import { buildTechArticleJsonLd } from '@site/src/seo/structuredData';
import DocItemMetadata from '@theme-original/DocItem/Metadata';

export default function DocItemMetadataWrapper(): ReactNode {
  const { metadata, frontMatter, assets } = useDoc();
  const { siteConfig, i18n } = useDocusaurusContext();
  const imageUrl = socialCardUrl(siteConfig.url);
  const pageImage = assets.image ?? frontMatter.image;
  const absoluteImage = typeof pageImage === 'string' && /^https?:\/\//.test(pageImage) ? pageImage : imageUrl;
  const pageUrl = `${siteConfig.url}${metadata.permalink}`.replace(/([^:]\/)\/+/g, '$1');
  const title = metadata.title;
  const description = metadata.description ?? siteConfig.tagline;
  const fullTitle = `${title} ${siteConfig.titleDelimiter} ${siteConfig.title}`;
  const dateModified = metadata.lastUpdatedAt
    ? new Date(metadata.lastUpdatedAt as string | number).toISOString()
    : undefined;

  return (
    <>
      <DocItemMetadata />
      <Head>
        <meta name="twitter:title" content={fullTitle} />
        <meta name="twitter:description" content={description} />
        <script type="application/ld+json">
          {JSON.stringify(
            buildTechArticleJsonLd({
              url: pageUrl.endsWith('/') ? pageUrl : `${pageUrl}/`,
              headline: title,
              description,
              imageUrl: absoluteImage,
              locale: i18n.currentLocale,
              dateModified,
            })
          )}
        </script>
      </Head>
    </>
  );
}
