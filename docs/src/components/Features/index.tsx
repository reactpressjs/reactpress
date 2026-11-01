import { translate } from '@docusaurus/Translate';
import Heading from '@theme/Heading';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
  accent: 1 | 2 | 3;
};

const FeatureList: FeatureItem[] = [
  {
    title: translate({ message: 'Writing & content', id: 'home.feature.content.title' }),
    Svg: require('@site/static/img/undraw_typewriter.svg').default,
    description: translate({
      message:
        'Create, organize, and publish from a focused Markdown editor — posts, pages, tags, comments, and media.',
      id: 'home.feature.content.desc',
    }),
    accent: 1,
  },
  {
    title: translate({ message: 'Zero-config setup', id: 'home.feature.zero.title' }),
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: translate({
      message: 'Three commands, embedded SQLite, no Docker by default — config and .env generated for you.',
      id: 'home.feature.zero.desc',
    }),
    accent: 2,
  },
  {
    title: translate({ message: 'Themes & plugins', id: 'home.feature.cli.title' }),
    Svg: require('@site/static/img/undraw_version_control.svg').default,
    description: translate({
      message: 'Swap Next.js SSR themes from npm and extend Admin/API with Hooks when you need more.',
      id: 'home.feature.cli.desc',
    }),
    accent: 3,
  },
  {
    title: translate({ message: 'Desktop app', id: 'home.feature.ui.title' }),
    Svg: require('@site/static/img/undraw_react.svg').default,
    description: translate({
      message: 'The same publishing experience on the desktop — local SQLite or sync to a remote API.',
      id: 'home.feature.ui.desc',
    }),
    accent: 1,
  },
  {
    title: translate({ message: 'Open integrations', id: 'home.feature.headless.title' }),
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: translate({
      message: 'REST APIs, access keys, and webhooks — wire ReactPress into CI, apps, or your own frontend.',
      id: 'home.feature.headless.desc',
    }),
    accent: 2,
  },
  {
    title: translate({ message: 'Multi-device', id: 'home.feature.i18n.title' }),
    Svg: require('@site/static/img/undraw_around_the_world.svg').default,
    description: translate({
      message: 'Bilingual UI out of the box — responsive layouts that feel native on desktop, tablet, and phone.',
      id: 'home.feature.i18n.desc',
    }),
    accent: 3,
  },
];

function Feature({ title, Svg, description, accent }: FeatureItem) {
  return (
    <div className={clsx('col col--4', styles.featureCol)}>
      <article className={clsx(styles.featureCard, styles[`accent${accent}`])}>
        <div className={styles.featureIcon}>
          <Svg className={styles.featureSvg} role="img" />
        </div>
        <Heading as="h3" className={styles.featureTitle}>
          {title}
        </Heading>
        <p className={styles.featureDesc}>{description}</p>
      </article>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
