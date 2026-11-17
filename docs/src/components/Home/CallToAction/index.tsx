import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import Magnetic from '@site/src/components/Home/Magnetic';
import { VERCEL_DEPLOY_URL } from '@site/src/constants/deploy';
import clsx from 'clsx';
import React from 'react';

import SectionAccent from '../SectionAccent';
import sectionStyles from '../section.module.css';
import { useReveal } from '../useReveal';
import { useSpotlight } from '../useSpotlight';
import styles from './styles.module.css';

function VercelIcon() {
  return (
    <svg className={styles.deployIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1L15 14H1L8 1z" />
    </svg>
  );
}

function CallToAction() {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const spot = useSpotlight<HTMLDivElement>();

  return (
    <div id="home-cta" ref={ref} className={clsx(styles.wrapper, visible && styles.active)}>
      <div
        ref={spot.ref}
        className={clsx(styles.interactive, sectionStyles.spot)}
        onPointerMove={spot.onPointerMove}
        onPointerEnter={spot.onPointerEnter}
        onPointerLeave={spot.onPointerLeave}
      >
        <div className={styles.background} />
        <div className={styles.glow} aria-hidden />
        <div className={styles.orbit} aria-hidden>
          <span />
          <span />
        </div>
        <div className={styles.container}>
          <header className={styles.header}>
            <h2 className={styles.title}>
              <Translate id="home.call.feature">Write with focus. Publish with joy.</Translate>
            </h2>
            <p className={styles.subtitle}>
              <Translate id="home.call.subtitle">
                Start with the docs, or deploy a theme when you are ready to ship.
              </Translate>
            </p>
            <SectionAccent active={visible} />
          </header>
          <div className={styles.footerCta}>
            <Magnetic>
              <Link className={styles.primaryButton} to="/docs/intro">
                <Translate id="home.call.cta">Explore the full documentation</Translate>
              </Link>
            </Magnetic>
            <Magnetic strength={0.22} max={8}>
              <a className={styles.deployButton} href={VERCEL_DEPLOY_URL} target="_blank" rel="noopener noreferrer">
                <VercelIcon />
                <Translate id="home.call.deploy">Deploy</Translate>
              </a>
            </Magnetic>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CallToAction;
