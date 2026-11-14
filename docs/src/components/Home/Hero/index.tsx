import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import Logo from '@site/src/components/Home/Logo';
import { VERCEL_DEPLOY_URL } from '@site/src/constants/deploy';
import { buildGitHubReleaseTagUrl } from '@site/src/npm/packageVersions';
import { useReactPressVersions } from '@site/src/npm/useReactPressVersions';
import clsx from 'clsx';
import React from 'react';
import GitHubButton from 'react-github-btn';

import HeroCarousel from './HeroCarousel';
import styles from './styles.module.css';

function VercelIcon() {
  return (
    <svg className={styles.deployIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1L15 14H1L8 1z" />
    </svg>
  );
}

function Hero() {
  const { latest } = useReactPressVersions();

  return (
    <header className={styles.container}>
      <div className={styles.mesh} aria-hidden>
        <span className={styles.orb1} />
        <span className={styles.orb2} />
        <span className={styles.orb3} />
        <span className={styles.gridLines} />
      </div>

      <div className={styles.shell}>
        <div className={styles.intro}>
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
                    {char}
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
              A self-hosted publishing platform — write, manage, and publish in one place. Not another Headless CMS to
              assemble.
            </Translate>
          </p>

          <div className={styles.actions}>
            <div className={styles.buttonContainer}>
              <a href={VERCEL_DEPLOY_URL} target="_blank" rel="noopener noreferrer" className={styles.deployButton}>
                <VercelIcon />
                <Translate id="home.hero.deploy">Deploy</Translate>
              </a>
              <Link className={styles.primaryButton} to="/docs/getting-started/first-site">
                <Translate id="home.hero.intro">Get Started</Translate>
              </Link>
              <a
                href="https://blog.gaoredu.com"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.secondaryButton}
              >
                <Translate id="home.hero.try">Live Demo</Translate>
              </a>
            </div>

            <p className={styles.localHint}>
              <Translate id="home.hero.localHint">Prefer the terminal?</Translate>{' '}
              <a className={styles.localHintLink} href="#quickstart-local">
                <Translate id="home.hero.localHintLink">Install locally in ~60s</Translate>
              </a>
            </p>
          </div>
        </div>

        <div className={styles.mediaStage}>
          <HeroCarousel />
        </div>
      </div>
    </header>
  );
}

export default Hero;
