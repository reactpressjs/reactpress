import Translate, { translate } from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { THEME_STARTER_DEMO_URL } from '@site/src/constants/deploy';
import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

import SectionAccent from '../SectionAccent';
import SpotSurface from '../SpotSurface';
import sectionStyles from '../section.module.css';
import { useReveal } from '../useReveal';
import styles from './styles.module.css';

type Score = {
  value: number;
  label: string;
  accent: string;
};

type Metric = {
  label: string;
  value: string;
};

const scores: Score[] = [
  {
    value: 95,
    label: translate({ message: 'Performance', id: 'home.proof.score.performance' }),
    accent: '#0ea5b4',
  },
  {
    value: 100,
    label: translate({ message: 'Accessibility', id: 'home.proof.score.accessibility' }),
    accent: '#22c55e',
  },
  {
    value: 100,
    label: translate({ message: 'Best Practices', id: 'home.proof.score.practices' }),
    accent: '#41d1ff',
  },
  {
    value: 100,
    label: translate({ message: 'SEO', id: 'home.proof.score.seo' }),
    accent: '#087ea4',
  },
];

const metrics: Metric[] = [
  {
    label: translate({ message: 'LCP', id: 'home.proof.metric.lcp' }),
    value: '1.0s',
  },
  {
    label: translate({ message: 'FCP', id: 'home.proof.metric.fcp' }),
    value: '0.4s',
  },
  {
    label: translate({ message: 'CLS', id: 'home.proof.metric.cls' }),
    value: '0',
  },
  {
    label: translate({ message: 'TBT', id: 'home.proof.metric.tbt' }),
    value: '150ms',
  },
];

const points = [
  translate({
    message: 'SSR themes for crawlable HTML out of the box',
    id: 'home.proof.point.ssr',
  }),
  translate({
    message: 'Sitemap, Open Graph, and meta ready for search',
    id: 'home.proof.point.seo',
  }),
  translate({
    message: 'Core Web Vitals tuned for real readers',
    id: 'home.proof.point.cwv',
  }),
];

const RING = 2 * Math.PI * 42;

function ScoreRing({ value, label, accent, active, delay }: Score & { active: boolean; delay: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 900;
    const kickoff = delay * 1000;

    const tick = (now: number) => {
      const elapsed = now - start - kickoff;
      if (elapsed < 0) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, value, delay]);

  const offset = RING - (RING * Math.min(display, 100)) / 100;

  return (
    <div className={styles.score} style={{ '--score-accent': accent } as React.CSSProperties}>
      <svg className={styles.ring} viewBox="0 0 100 100" aria-hidden>
        <circle className={styles.ringTrack} cx="50" cy="50" r="42" />
        <circle
          className={styles.ringValue}
          cx="50"
          cy="50"
          r="42"
          stroke={accent}
          strokeDasharray={RING}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={styles.scoreInner}>
        <span className={styles.scoreValue}>{display}</span>
        <span className={styles.scoreLabel}>{label}</span>
      </div>
    </div>
  );
}

export default function Proof() {
  const lighthousePng = useBaseUrl('/img/blog/lighthouse.png');
  const { ref, visible } = useReveal<HTMLElement>({ threshold: 0.2 });

  return (
    <section
      ref={ref}
      id="home-proof"
      className={clsx(
        sectionStyles.section,
        sectionStyles.reveal,
        visible && sectionStyles.revealed,
        visible && styles.active
      )}
      aria-labelledby="home-proof-heading"
    >
      <div className={sectionStyles.inner}>
        <div className={styles.panel}>
          <div
            className={clsx(styles.copy, sectionStyles.revealItem)}
            style={{ '--reveal-index': 0 } as React.CSSProperties}
          >
            <p className={sectionStyles.eyebrow}>
              <Translate id="home.proof.eyebrow">Performance</Translate>
            </p>
            <h2 id="home-proof-heading" className={styles.heading}>
              <Translate id="home.proof.title">Built for readers — and for SEO</Translate>
            </h2>
            <p className={styles.subheading}>
              <Translate id="home.proof.subtitle">
                SSR themes ship with solid Core Web Vitals so content is fast to load and ready to rank.
              </Translate>
            </p>
            <SectionAccent active={visible} className={styles.copyAccent} />

            <ul className={styles.points}>
              {points.map((point) => (
                <li key={point} className={styles.point}>
                  <span className={styles.pointMark} aria-hidden />
                  {point}
                </li>
              ))}
            </ul>

            <div className={styles.metrics}>
              {metrics.map((metric) => (
                <div key={metric.label} className={styles.metric}>
                  <span className={styles.metricLabel}>{metric.label}</span>
                  <span className={styles.metricValue}>{metric.value}</span>
                </div>
              ))}
            </div>

            <div className={styles.links}>
              <a className={styles.linkPrimary} href={THEME_STARTER_DEMO_URL} target="_blank" rel="noopener noreferrer">
                <Translate id="home.proof.demo">Live Demo</Translate>
              </a>
            </div>
          </div>

          <div
            className={clsx(styles.visual, sectionStyles.revealItem)}
            style={{ '--reveal-index': 1 } as React.CSSProperties}
          >
            <SpotSurface as="div" className={styles.scoreCard}>
              <div className={styles.scoreGlow} aria-hidden />
              <p className={styles.scoreEyebrow}>
                <Translate id="home.proof.score.eyebrow">Lighthouse · production theme</Translate>
              </p>
              <div
                className={styles.scoreGrid}
                role="list"
                aria-label={translate({ message: 'Lighthouse scores', id: 'home.proof.score.aria' })}
              >
                {scores.map((score, index) => (
                  <div key={score.label} role="listitem">
                    <ScoreRing {...score} active={visible} delay={0.12 + index * 0.08} />
                  </div>
                ))}
              </div>
              <figure className={styles.figure}>
                <div className={styles.imageFrame}>
                  <img
                    className={styles.image}
                    src={lighthousePng}
                    alt={translate({
                      message:
                        'Lighthouse report showing Performance 95 and perfect Accessibility, Best Practices, and SEO scores',
                      id: 'home.proof.lighthouse.alt',
                    })}
                    width={800}
                    height={450}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption className={styles.caption}>
                  <Translate id="home.proof.lighthouse">SSR themes built for SEO performance.</Translate>
                </figcaption>
              </figure>
            </SpotSurface>
          </div>
        </div>
      </div>
    </section>
  );
}
