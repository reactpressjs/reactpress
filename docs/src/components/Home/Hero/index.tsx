import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import Logo from '@site/src/components/Home/Logo';
import Magnetic from '@site/src/components/Home/Magnetic';
import { buildGitHubReleaseTagUrl } from '@site/src/npm/packageVersions';
import { useReactPressVersions } from '@site/src/npm/useReactPressVersions';
import clsx from 'clsx';
import React, { useCallback, useEffect, useRef } from 'react';
import GitHubButton from 'react-github-btn';

import HeroVideo from './HeroVideo';
import styles from './styles.module.css';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function Hero() {
  const { latest } = useReactPressVersions();
  const rootRef = useRef<HTMLElement>(null);
  const target = useRef({ x: 0, y: 0, sx: 50, sy: 30 });
  const current = useRef({ x: 0, y: 0, sx: 50, sy: 30 });
  const raf = useRef(0);
  const hovering = useRef(false);

  const apply = useCallback(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    el.style.setProperty('--px', current.current.x.toFixed(3));
    el.style.setProperty('--py', current.current.y.toFixed(3));
    el.style.setProperty('--spot-x', `${current.current.sx.toFixed(1)}%`);
    el.style.setProperty('--spot-y', `${current.current.sy.toFixed(1)}%`);
  }, []);

  const tick = useCallback(() => {
    const ease = hovering.current ? 0.12 : 0.08;
    current.current.x += (target.current.x - current.current.x) * ease;
    current.current.y += (target.current.y - current.current.y) * ease;
    current.current.sx += (target.current.sx - current.current.sx) * ease;
    current.current.sy += (target.current.sy - current.current.sy) * ease;
    apply();

    const settled =
      Math.abs(target.current.x - current.current.x) < 0.001 &&
      Math.abs(target.current.y - current.current.y) < 0.001 &&
      Math.abs(target.current.sx - current.current.sx) < 0.05 &&
      Math.abs(target.current.sy - current.current.sy) < 0.05;

    if (!settled || hovering.current) {
      raf.current = requestAnimationFrame(tick);
    } else {
      raf.current = 0;
      current.current = { ...target.current };
      apply();
    }
  }, [apply]);

  const ensureTick = useCallback(() => {
    if (!raf.current) {
      raf.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  useEffect(
    () => () => {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
      }
    },
    []
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (prefersReducedMotion()) {
        return;
      }
      const el = rootRef.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      target.current.x = x;
      target.current.y = y;
      target.current.sx = (x + 0.5) * 100;
      target.current.sy = (y + 0.5) * 100;
      hovering.current = true;
      el.dataset.spot = 'on';
      ensureTick();
    },
    [ensureTick]
  );

  const onPointerLeave = useCallback(() => {
    hovering.current = false;
    target.current.x = 0;
    target.current.y = 0;
    target.current.sx = 50;
    target.current.sy = 30;
    const el = rootRef.current;
    if (el) {
      delete el.dataset.spot;
    }
    ensureTick();
  }, [ensureTick]);

  return (
    <header
      id="home-hero"
      ref={rootRef}
      className={clsx(styles.container, styles.interactive)}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ '--px': 0, '--py': 0, '--spot-x': '50%', '--spot-y': '30%' } as React.CSSProperties}
    >
      <div className={styles.mesh} aria-hidden>
        <span className={styles.orb1} />
        <span className={styles.orb2} />
        <span className={styles.orb3} />
        <span className={styles.gridLines} />
        <span className={styles.spotGlow} />
        <span className={styles.constellation} />
        <span className={styles.scanline} />
      </div>

      <div className={styles.shell}>
        <div className={clsx(styles.intro, styles.parallaxNear)}>
          <Logo className={styles.logo} />
          <div className={styles.titleRow}>
            <h1 className={styles.title} aria-label="ReactPress">
              <span className={styles.titleText} aria-hidden>
                {'ReactPress'.split('').map((char, index) => (
                  <span
                    key={`${char}-${index}`}
                    className={styles.titleChar}
                    style={{ '--char-index': index } as React.CSSProperties}
                  >
                    <span className={styles.titleCharInner}>{char}</span>
                  </span>
                ))}
              </span>
              <span className={styles.titleUnderline} aria-hidden />
            </h1>
            <div className={styles.versionTags} aria-label="package release version">
              <a
                className={clsx(styles.versionTag, styles.versionTagLatest)}
                href={buildGitHubReleaseTagUrl(latest)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.tagLabel}>
                  <Translate id="home.hero.version.tag.latest">latest</Translate>
                </span>
                <span className={styles.tagValue}>{latest}</span>
              </a>
            </div>
            <span className={styles.githubWrap}>
              <GitHubButton
                href="https://github.com/reactpressjs/reactpress"
                data-size="large"
                data-show-count="true"
                aria-label="Star reactpressjs/reactpress on GitHub"
              >
                Star
              </GitHubButton>
            </span>
          </div>
          <p className={styles.slogan}>
            <Translate id="theme.tagline">Write with Focus. Publish with Joy.</Translate>
          </p>
          <p className={styles.subTitle}>
            <Translate id="home.hero.subTitle">
              Publishing should not cost more than writing. Open-source, self-hosted publishing — one command, full
              stack.
            </Translate>
          </p>

          <div className={styles.actions}>
            <div className={styles.buttonContainer}>
              <Magnetic>
                <Link className={styles.primaryButton} to="/docs/getting-started/first-site">
                  <span className={styles.buttonShine} aria-hidden />
                  <Translate id="home.hero.intro">Get Started</Translate>
                </Link>
              </Magnetic>
              <Magnetic strength={0.24} max={9}>
                <a
                  href="https://demo.reactpress.cc/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.secondaryButton}
                >
                  <Translate id="home.hero.try">Live Demo</Translate>
                </a>
              </Magnetic>
            </div>

            <p className={styles.localHint}>
              <Translate id="home.hero.localHint">Prefer the terminal?</Translate>{' '}
              <a className={styles.localHintLink} href="#quickstart-local">
                <Translate id="home.hero.localHintLink">Install locally in ~60s</Translate>
              </a>
            </p>
          </div>
        </div>

        <div className={clsx(styles.mediaStage, styles.parallaxFar)}>
          <HeroVideo />
        </div>
      </div>
    </header>
  );
}

export default Hero;
