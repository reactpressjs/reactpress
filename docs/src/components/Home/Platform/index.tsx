import { translate } from '@docusaurus/Translate';
import Translate from '@docusaurus/Translate';
import { IconLayers, IconPen, IconRocket } from '@site/src/components/Home/icons';
import React from 'react';

import styles from './styles.module.css';

type Pillar = {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: 'build' | 'manage' | 'extend';
};

const pillars: Pillar[] = [
  {
    Icon: IconPen,
    title: translate({ message: 'Write', id: 'home.platform.build.title' }),
    description: translate({
      message: 'Stay in flow with a focused editor — Markdown, media, and structure without ceremony.',
      id: 'home.platform.build.desc',
    }),
    accent: 'build',
  },
  {
    Icon: IconLayers,
    title: translate({ message: 'Manage', id: 'home.platform.manage.title' }),
    description: translate({
      message: 'One CMS for posts, pages, comments, SEO, themes, and plugins — self-hosted on your terms.',
      id: 'home.platform.manage.desc',
    }),
    accent: 'manage',
  },
  {
    Icon: IconRocket,
    title: translate({ message: 'Publish', id: 'home.platform.extend.title' }),
    description: translate({
      message: 'Ship beautiful Next.js sites, extend with plugins, or go headless — from CLI to Vercel.',
      id: 'home.platform.extend.desc',
    }),
    accent: 'extend',
  },
];

export default function Platform() {
  return (
    <section className={styles.section} aria-labelledby="home-platform-heading">
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <Translate id="home.platform.eyebrow">Core value</Translate>
        </p>
        <h2 id="home-platform-heading" className={styles.heading}>
          <Translate id="home.platform.title">Write. Manage. Publish.</Translate>
        </h2>
        <p className={styles.subheading}>
          <Translate id="home.platform.subtitle">
            A self-hosted publishing platform that keeps writing joyful and shipping simple — for creators and React
            developers alike.
          </Translate>
        </p>
      </header>
      <div className={styles.grid}>
        {pillars.map((pillar, index) => (
          <article
            key={pillar.title}
            className={styles.card}
            data-accent={pillar.accent}
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            <span className={styles.step} aria-hidden>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className={styles.iconWrap} aria-hidden>
              <pillar.Icon className={styles.icon} />
            </span>
            <h3 className={styles.cardTitle}>{pillar.title}</h3>
            <p className={styles.cardDesc}>{pillar.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
