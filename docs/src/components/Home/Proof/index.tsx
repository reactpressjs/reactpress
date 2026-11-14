import Translate from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';
import React from 'react';

import styles from './styles.module.css';

export default function Proof() {
  const lighthousePng = useBaseUrl('/img/blog/lighthouse.png');

  return (
    <section className={styles.section} aria-labelledby="home-proof-heading">
      <div className={styles.panel}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>
            <Translate id="home.proof.eyebrow">See it in action</Translate>
          </p>
          <h2 id="home-proof-heading" className={styles.heading}>
            <Translate id="home.proof.title">Built for readers — and for SEO</Translate>
          </h2>
          <p className={styles.subheading}>
            <Translate id="home.proof.subtitle">
              SSR themes ship with solid Core Web Vitals. Open a Live Demo or theme preview when you want to click
              around.
            </Translate>
          </p>
          <div className={styles.links}>
            <a
              className={styles.linkPrimary}
              href="https://blog.gaoredu.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Translate id="home.proof.demo">Live Demo</Translate>
            </a>
            <a
              className={styles.linkSecondary}
              href="https://demo.reactpress.cc/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Translate id="home.proof.themeDemo">Theme Demo</Translate>
            </a>
          </div>
        </div>

        <figure className={styles.figure}>
          <img
            className={styles.image}
            src={lighthousePng}
            alt=""
            width={800}
            height={450}
            loading="lazy"
            decoding="async"
          />
          <figcaption className={styles.caption}>
            <Translate id="home.proof.lighthouse">SSR themes built for SEO performance.</Translate>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
