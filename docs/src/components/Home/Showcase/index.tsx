import Translate, { translate } from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { SHOWCASE_SITES, SHOWCASE_SUBMIT_URL, type ShowcaseKind } from '@site/src/constants/showcase';
import clsx from 'clsx';
import React from 'react';

import SectionAccent from '../SectionAccent';
import SpotSurface from '../SpotSurface';
import sectionStyles from '../section.module.css';
import { useReveal } from '../useReveal';
import styles from './styles.module.css';

function kindBadge(kind: ShowcaseKind): string {
  switch (kind) {
    case 'dogfood':
      return translate({
        id: 'home.showcase.badge.dogfood',
        message: 'Official dogfood',
      });
    case 'theme-demo':
      return translate({
        id: 'home.showcase.badge.themeDemo',
        message: 'Theme demo',
      });
    default:
      return translate({
        id: 'home.showcase.badge.community',
        message: 'Community',
      });
  }
}

function siteCopy(id: string): { title: string; description: string } {
  switch (id) {
    case 'gaoredu':
      return {
        title: translate({
          id: 'home.showcase.gaoredu.title',
          message: 'gaoredu.com',
        }),
        description: translate({
          id: 'home.showcase.gaoredu.desc',
          message: 'Maintainer production site — content, theme, and SEO running on ReactPress day to day.',
        }),
      };
    case 'theme-starter':
      return {
        title: translate({
          id: 'home.showcase.themeStarter.title',
          message: 'Theme Starter',
        }),
        description: translate({
          id: 'home.showcase.themeStarter.desc',
          message: 'Official Next.js starter live — search, comments, knowledge base layout, and SSR SEO patterns.',
        }),
      };
    default:
      return { title: id, description: '' };
  }
}

function ShowcaseCard({
  site,
  copy,
  index,
}: {
  site: (typeof SHOWCASE_SITES)[number];
  copy: { title: string; description: string };
  index: number;
}) {
  const iconSrc = useBaseUrl(site.icon);

  return (
    <SpotSurface
      as="a"
      className={clsx(styles.card, sectionStyles.revealItem)}
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ '--reveal-index': index } as React.CSSProperties}
    >
      <span className={styles.shine} aria-hidden />
      <div className={styles.cardTop}>
        <img className={styles.icon} src={iconSrc} alt="" width={40} height={40} loading="lazy" decoding="async" />
        <p className={styles.badge}>{kindBadge(site.kind)}</p>
      </div>
      <h3 className={styles.cardTitle}>{copy.title}</h3>
      <p className={styles.cardDesc}>{copy.description}</p>
      <span className={styles.host}>
        {site.name}
        <span className={styles.hostArrow} aria-hidden>
          →
        </span>
      </span>
    </SpotSurface>
  );
}

export default function Showcase() {
  const { ref, visible } = useReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      id="home-showcase"
      className={clsx(
        sectionStyles.section,
        sectionStyles.bandB,
        sectionStyles.reveal,
        visible && sectionStyles.revealed
      )}
      aria-labelledby="home-showcase-heading"
    >
      <div className={sectionStyles.inner}>
        <header className={clsx(sectionStyles.header, sectionStyles.revealHeader)}>
          <p className={sectionStyles.eyebrow}>
            <Translate id="home.showcase.eyebrow">Sites</Translate>
          </p>
          <h2 id="home-showcase-heading" className={sectionStyles.heading}>
            <Translate id="home.showcase.title">Sites powered by ReactPress</Translate>
          </h2>
          <p className={sectionStyles.subheading}>
            <Translate id="home.showcase.subtitle">
              Official dogfood and theme demo today — community sites after a short review.
            </Translate>
          </p>
          <SectionAccent active={visible} />
        </header>

        <div className={styles.grid}>
          {SHOWCASE_SITES.map((site, index) => {
            const copy = siteCopy(site.id);
            return <ShowcaseCard key={site.id} site={site} copy={copy} index={index} />;
          })}
        </div>

        <div
          className={clsx(styles.footer, sectionStyles.revealItem)}
          style={{ '--reveal-index': SHOWCASE_SITES.length } as React.CSSProperties}
        >
          <a className={styles.submit} href={SHOWCASE_SUBMIT_URL} target="_blank" rel="noopener noreferrer">
            <Translate id="home.showcase.submit">Submit your site</Translate>
          </a>
          <p className={styles.hint}>
            <Translate id="home.showcase.submitHint">
              Open the GitHub issue with your URL, use case, and a one-line story. We review before listing.
            </Translate>
          </p>
        </div>
      </div>
    </section>
  );
}
