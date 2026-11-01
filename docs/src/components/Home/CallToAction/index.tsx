import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import { VERCEL_DEPLOY_URL } from '@site/src/constants/deploy';
import React from 'react';

import styles from './styles.module.css';

function VercelIcon() {
  return (
    <svg className={styles.deployIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1L15 14H1L8 1z" />
    </svg>
  );
}

function CallToAction() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.background} />
      <div className={styles.container}>
        <header className={styles.header}>
          <h2 className={styles.title}>
            <Translate id="home.call.feature">Write with focus. Publish with joy.</Translate>
          </h2>
          <p className={styles.subtitle}>
            <Translate id="home.call.subtitle">
              Deploy in one click, explore the docs, or open a Live Demo and feel the stack.
            </Translate>
          </p>
        </header>
        <div className={styles.footerCta}>
          <a className={styles.deployButton} href={VERCEL_DEPLOY_URL} target="_blank" rel="noopener noreferrer">
            <VercelIcon />
            <Translate id="home.call.deploy">Deploy</Translate>
          </a>
          <Link className={styles.primaryButton} to="/docs/intro">
            <Translate id="home.call.cta">Explore the full documentation</Translate>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CallToAction;
