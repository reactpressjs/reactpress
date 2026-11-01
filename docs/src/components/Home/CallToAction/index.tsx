import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import Features from '@site/src/components/Features';
import React from 'react';

import styles from './styles.module.css';

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
              Self-hosted writing, management, and publishing — themes, plugins, and a desktop app when you need them.
            </Translate>
          </p>
        </header>
        <Features />
        <div className={styles.footerCta}>
          <Link className={styles.primaryButton} to="/docs/intro">
            <Translate id="home.call.cta">Explore the full documentation</Translate>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CallToAction;
