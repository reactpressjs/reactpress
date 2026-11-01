import { translate } from '@docusaurus/Translate';
import Translate from '@docusaurus/Translate';
import React from 'react';

import styles from './styles.module.css';

type Pillar = {
  title: string;
  tagline: string;
  description: string;
  accent: 'build' | 'manage' | 'extend';
};

const pillars: Pillar[] = [
  {
    title: translate({ message: 'Write', id: 'home.platform.build.title' }),
    tagline: translate({ message: 'Focus first.', id: 'home.platform.build.tagline' }),
    description: translate({
      message: 'A calm editor for posts, pages, and media — stay in flow, not in tooling.',
      id: 'home.platform.build.desc',
    }),
    accent: 'build',
  },
  {
    title: translate({ message: 'Manage', id: 'home.platform.manage.title' }),
    tagline: translate({ message: 'One place.', id: 'home.platform.manage.tagline' }),
    description: translate({
      message: 'Content, SEO, themes, and plugins in one self-hosted CMS — on your terms.',
      id: 'home.platform.manage.desc',
    }),
    accent: 'manage',
  },
  {
    title: translate({ message: 'Publish', id: 'home.platform.extend.title' }),
    tagline: translate({ message: 'Ship with joy.', id: 'home.platform.extend.tagline' }),
    description: translate({
      message: 'Next.js themes, plugins, or Headless API — from CLI to a live site.',
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
          <Translate id="home.platform.eyebrow">What is ReactPress</Translate>
        </p>
        <h2 id="home-platform-heading" className={styles.heading}>
          <Translate id="home.platform.title">Write. Manage. Publish.</Translate>
        </h2>
        <p className={styles.subheading}>
          <Translate id="home.platform.subtitle">
            The whole publishing stack in one product — so creators and React developers ship without stitching five
            tools together.
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
            <h3 className={styles.cardTitle}>{pillar.title}</h3>
            <p className={styles.tagline}>{pillar.tagline}</p>
            <p className={styles.cardDesc}>{pillar.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
