/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Head from '@docusaurus/Head';
import { translate } from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Home from '@site/src/components/Home';
import { SOCIAL_CARD, socialCardUrl } from '@site/src/seo/social';
import Layout from '@theme/Layout';

const Index = () => {
  const { siteConfig } = useDocusaurusContext();
  const canonicalUrl = `${siteConfig.url}${siteConfig.baseUrl}`.replace(/\/?$/, '/');
  const title = translate({
    id: 'home.meta.title',
    message: 'ReactPress — Write with Focus. Publish with Joy.',
  });
  const description = translate({
    message:
      'ReactPress is a self-hosted publishing platform to write, manage, and publish — all in one place. Themes, plugins, desktop app, and one CLI. Live in about 60 seconds.',
    id: 'home.meta.description',
  });
  const imageUrl = socialCardUrl(siteConfig.url);

  return (
    <Layout description={description} wrapperClassName="homepage">
      <Head>
        <title>{title}</title>
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:secure_url" content={imageUrl} />
        <meta property="og:image:type" content={SOCIAL_CARD.type} />
        <meta property="og:image:width" content={String(SOCIAL_CARD.width)} />
        <meta property="og:image:height" content={String(SOCIAL_CARD.height)} />
        <meta property="og:image:alt" content={SOCIAL_CARD.alt} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />
        <meta name="twitter:image:alt" content={SOCIAL_CARD.alt} />
        <meta name="description" content={description} />
      </Head>
      <Home />
    </Layout>
  );
};

export default Index;
