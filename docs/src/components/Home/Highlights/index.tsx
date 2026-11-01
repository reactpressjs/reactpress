import { translate } from '@docusaurus/Translate';
import Translate from '@docusaurus/Translate';
import { IconDesktop, IconLayers, IconPen, IconPlugins, IconThemes } from '@site/src/components/Home/icons';
import React from 'react';

import styles from './styles.module.css';

type HighlightItem = {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: 'teal' | 'cyan' | 'blue';
};

const items: HighlightItem[] = [
  {
    Icon: IconPen,
    title: translate({ message: 'Writing & content', id: 'home.highlight.writing.title' }),
    description: translate({
      message: 'Create, organize, and publish from a focused Markdown editor — posts, pages, tags, and media.',
      id: 'home.highlight.writing.desc',
    }),
    accent: 'teal',
  },
  {
    Icon: IconThemes,
    title: translate({ message: 'Themes', id: 'home.highlight.themes.title' }),
    description: translate({
      message: 'Customize the look with Next.js SSR themes from npm — starter scaffold and one-click catalog install.',
      id: 'home.highlight.themes.desc',
    }),
    accent: 'cyan',
  },
  {
    Icon: IconPlugins,
    title: translate({ message: 'Plugins', id: 'home.highlight.plugins.title' }),
    description: translate({
      message: 'Extend Admin and API with Hooks — SEO, auto-summary, image pipelines, and custom Admin slots.',
      id: 'home.highlight.plugins.desc',
    }),
    accent: 'blue',
  },
  {
    Icon: IconDesktop,
    title: translate({ message: 'Desktop app', id: 'home.highlight.desktop.title' }),
    description: translate({
      message: 'The same experience on the desktop — Electron with local SQLite, or sync to a remote API.',
      id: 'home.highlight.desktop.desc',
    }),
    accent: 'teal',
  },
  {
    Icon: IconLayers,
    title: translate({ message: 'Multi-device', id: 'home.highlight.multidevice.title' }),
    description: translate({
      message: 'Works on desktop, tablet, and mobile browsers — one publishing stack across every screen.',
      id: 'home.highlight.multidevice.desc',
    }),
    accent: 'cyan',
  },
];

export default function Highlights() {
  return (
    <section className={styles.section} aria-labelledby="home-highlights-heading">
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <Translate id="home.highlights.eyebrow">Why ReactPress</Translate>
        </p>
        <h2 id="home-highlights-heading" className={styles.heading}>
          <Translate id="home.highlights.title">Everything you need to publish</Translate>
        </h2>
        <p className={styles.subheading}>
          <Translate id="home.highlights.subtitle">
            Write with focus, manage in one place, and publish with joy — themes, plugins, and desktop when you need
            them.
          </Translate>
        </p>
      </header>
      <div className={styles.grid}>
        {items.map((item, index) => (
          <article
            key={item.title}
            className={styles.card}
            data-accent={item.accent}
            style={{ animationDelay: `${index * 0.06}s` }}
          >
            <span className={styles.iconWrap} aria-hidden>
              <item.Icon className={styles.icon} />
            </span>
            <h3 className={styles.cardTitle}>{item.title}</h3>
            <p className={styles.cardDesc}>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
