import Link from '@docusaurus/Link';
import { translate } from '@docusaurus/Translate';
import Translate from '@docusaurus/Translate';
import { IconDesktop, IconPlugins, IconRocket, IconThemes } from '@site/src/components/Home/icons';
import clsx from 'clsx';
import React from 'react';

import SectionAccent from '../SectionAccent';
import sectionStyles from '../section.module.css';
import { useReveal } from '../useReveal';
import { useSpotlight } from '../useSpotlight';
import styles from './styles.module.css';

type HubItem = {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  to: string;
  cta: string;
};

const items: HubItem[] = [
  {
    Icon: IconThemes,
    title: translate({ message: 'Themes', id: 'home.ecosystem.themes.title' }),
    description: translate({
      message: 'Install Next.js SSR themes from npm — swap looks without rewriting your CMS.',
      id: 'home.ecosystem.themes.desc',
    }),
    to: '/themes',
    cta: translate({ message: 'Explore themes', id: 'home.ecosystem.themes.cta' }),
  },
  {
    Icon: IconPlugins,
    title: translate({ message: 'Plugins', id: 'home.ecosystem.plugins.title' }),
    description: translate({
      message: 'Extend Admin and API with Hooks — SEO, summaries, image pipelines, and AI Assist.',
      id: 'home.ecosystem.plugins.desc',
    }),
    to: '/plugins',
    cta: translate({ message: 'Explore plugins', id: 'home.ecosystem.plugins.cta' }),
  },
  {
    Icon: IconRocket,
    title: translate({ message: 'Templates', id: 'home.ecosystem.templates.title' }),
    description: translate({
      message: 'Start faster with theme-starter scaffolds and production-ready site templates.',
      id: 'home.ecosystem.templates.desc',
    }),
    to: '/themes/#templates',
    cta: translate({ message: 'Browse templates', id: 'home.ecosystem.templates.cta' }),
  },
  {
    Icon: IconDesktop,
    title: translate({ message: 'Best practices', id: 'home.ecosystem.guides.title' }),
    description: translate({
      message: 'Guides for SEO, self-hosting, Headless APIs, and shipping modern React sites.',
      id: 'home.ecosystem.guides.desc',
    }),
    to: '/best-practices',
    cta: translate({ message: 'Read guides', id: 'home.ecosystem.guides.cta' }),
  },
];

function EcosystemCard({ item, index }: { item: HubItem; index: number }) {
  const { ref, onPointerMove, onPointerEnter, onPointerLeave } = useSpotlight<HTMLAnchorElement>({
    tilt: true,
    maxTilt: 7,
  });

  return (
    <Link
      ref={ref}
      className={clsx(styles.card, sectionStyles.spot, sectionStyles.tilt, sectionStyles.revealItem)}
      to={item.to}
      style={{ '--reveal-index': index } as React.CSSProperties}
      onPointerMove={onPointerMove}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <span className={styles.borderDraw} aria-hidden />
      <span className={styles.iconWrap} aria-hidden>
        <item.Icon className={styles.icon} />
      </span>
      <h3 className={styles.cardTitle}>{item.title}</h3>
      <p className={styles.cardDesc}>{item.description}</p>
      <span className={styles.cta}>
        {item.cta}
        <span className={styles.ctaArrow} aria-hidden>
          →
        </span>
      </span>
    </Link>
  );
}

export default function Ecosystem() {
  const { ref, visible } = useReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      id="home-ecosystem"
      className={clsx(
        sectionStyles.section,
        sectionStyles.reveal,
        visible && sectionStyles.revealed,
        visible && styles.active
      )}
      aria-labelledby="home-ecosystem-heading"
    >
      <div className={sectionStyles.inner}>
        <header className={clsx(sectionStyles.header, sectionStyles.revealHeader)}>
          <p className={sectionStyles.eyebrow}>
            <Translate id="home.ecosystem.eyebrow">Ecosystem</Translate>
          </p>
          <h2 id="home-ecosystem-heading" className={sectionStyles.heading}>
            <Translate id="home.ecosystem.title">Themes, plugins, and guides — one hub</Translate>
          </h2>
          <p className={sectionStyles.subheading}>
            <Translate id="home.ecosystem.subtitle">
              Extend the core when you need more — themes, plugins, templates, and guides in one place.
            </Translate>
          </p>
          <SectionAccent active={visible} />
        </header>
        <div className={styles.grid}>
          {items.map((item, index) => (
            <EcosystemCard key={item.to} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
