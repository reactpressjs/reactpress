import Link from '@docusaurus/Link';
import { translate } from '@docusaurus/Translate';
import Translate from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';
import CliCommandBlock from '@site/src/components/CliCommandBlock';
import { THEME_STARTER_DEMO_URL, THEME_STARTER_REPO_URL, VERCEL_DEPLOY_URL } from '@site/src/constants/deploy';
import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

import Magnetic from '../Magnetic';
import SectionAccent from '../SectionAccent';
import SpotSurface from '../SpotSurface';
import sectionStyles from '../section.module.css';
import { useReveal } from '../useReveal';
import styles from './styles.module.css';

type Path = 'deploy' | 'local';

function pathFromHash(): Path {
  if (typeof window === 'undefined') {
    return 'deploy';
  }
  return window.location.hash === '#quickstart-local' ? 'local' : 'deploy';
}

type Step = {
  n: string;
  title: string;
  detail: string;
  code?: string;
};

const steps: Step[] = [
  {
    n: '01',
    title: translate({ message: 'Install CLI', id: 'home.quickstart.step1.title' }),
    detail: translate({
      message: 'Node.js 20+ required.',
      id: 'home.quickstart.step1.detail',
    }),
    code: 'npm install -g reactpressjs',
  },
  {
    n: '02',
    title: translate({ message: 'Create a site', id: 'home.quickstart.step2.title' }),
    detail: translate({
      message: 'Any empty folder works.',
      id: 'home.quickstart.step2.detail',
    }),
    code: 'mkdir my-site && cd my-site',
  },
  {
    n: '03',
    title: translate({ message: 'Initialize', id: 'home.quickstart.step3.title' }),
    detail: translate({
      message: 'Starts API, Admin, and theme automatically.',
      id: 'home.quickstart.step3.detail',
    }),
    code: 'reactpress init',
  },
];

type Endpoint = {
  label: string;
  href: string;
};

const endpoints: Endpoint[] = [
  {
    label: translate({ message: 'Site', id: 'home.quickstart.endpoint.site' }),
    href: 'http://localhost:3001',
  },
  {
    label: translate({ message: 'Admin', id: 'home.quickstart.endpoint.admin' }),
    href: 'http://localhost:3001/admin/',
  },
  {
    label: translate({ message: 'API', id: 'home.quickstart.endpoint.api' }),
    href: 'http://127.0.0.1:3002/api',
  },
];

function VercelIcon() {
  return (
    <svg className={styles.deployIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1L15 14H1L8 1z" />
    </svg>
  );
}

export default function QuickStart() {
  const [path, setPath] = useState<Path>('deploy');
  const demoGif = useBaseUrl('/img/blog/demo.gif');
  const { ref, visible } = useReveal<HTMLElement>();

  useEffect(() => {
    const syncFromHash = () => {
      const next = pathFromHash();
      setPath(next);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const selectPath = (next: Path) => {
    setPath(next);
    const hash = next === 'local' ? '#quickstart-local' : '#quickstart';
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash);
    }
  };

  return (
    <section
      id="quickstart"
      ref={ref}
      className={clsx(
        sectionStyles.section,
        sectionStyles.bandB,
        sectionStyles.reveal,
        visible && sectionStyles.revealed
      )}
      aria-labelledby="home-quickstart-heading"
      aria-label={translate({ message: 'Quick start', id: 'home.quickstart.aria' })}
    >
      <div id="quickstart-local" className={styles.localAnchor} aria-hidden />
      <div className={sectionStyles.inner}>
        <header className={clsx(sectionStyles.header, sectionStyles.revealHeader)}>
          <p className={sectionStyles.eyebrow}>
            <Translate id="home.quickstart.eyebrow">How to start</Translate>
          </p>
          <h2 id="home-quickstart-heading" className={sectionStyles.heading}>
            <Translate id="home.quickstart.title">From zero to a live site in ~60 seconds</Translate>
          </h2>
          <p className={sectionStyles.subheading}>
            <Translate id="home.quickstart.desc">
              One-click cloud deploy, or three local commands with embedded SQLite. No Docker required.
            </Translate>
          </p>
          <SectionAccent active={visible} />
        </header>

        <div
          className={styles.pathSwitch}
          role="tablist"
          aria-label={translate({ message: 'Start path', id: 'home.quickstart.path.aria' })}
          data-path={path}
        >
          <span className={styles.pathThumb} aria-hidden />
          <button
            type="button"
            role="tab"
            aria-selected={path === 'deploy'}
            className={path === 'deploy' ? styles.pathActive : styles.pathTab}
            onClick={() => selectPath('deploy')}
          >
            <Translate id="home.quickstart.path.deploy">One-click Deploy</Translate>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={path === 'local'}
            className={path === 'local' ? styles.pathActive : styles.pathTab}
            onClick={() => selectPath('local')}
          >
            <Translate id="home.quickstart.path.local">Install locally</Translate>
          </button>
        </div>

        {path === 'deploy' ? (
          <div
            className={clsx(styles.deployPane, sectionStyles.revealItem)}
            style={{ '--reveal-index': 0 } as React.CSSProperties}
            role="tabpanel"
          >
            <SpotSurface as="div" className={styles.deployCard}>
              <div className={styles.deployCopy}>
                <h3 className={styles.deployTitle}>
                  <Translate id="home.quickstart.deploy.title">Ship a theme site on Vercel</Translate>
                </h3>
                <p className={styles.deployDesc}>
                  <Translate id="home.quickstart.deploy.desc">
                    Clone the Theme Starter and deploy in one click. Connect your ReactPress API when you are ready.
                  </Translate>
                </p>
                <div className={styles.deployActions}>
                  <Magnetic>
                    <a
                      className={styles.deployButton}
                      href={VERCEL_DEPLOY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <VercelIcon />
                      <Translate id="home.quickstart.vercel">Deploy to Vercel</Translate>
                    </a>
                  </Magnetic>
                  <Magnetic strength={0.2} max={8}>
                    <a
                      className={styles.deploySecondary}
                      href={THEME_STARTER_DEMO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Translate id="home.quickstart.deploy.demo">Theme Demo</Translate>
                    </a>
                  </Magnetic>
                </div>
                <p className={styles.deployMeta}>
                  <Translate id="home.quickstart.deploy.meta">Based on</Translate>{' '}
                  <a href={THEME_STARTER_REPO_URL} target="_blank" rel="noopener noreferrer">
                    reactpress-theme-starter
                  </a>
                </p>
              </div>
              <a
                className={styles.deployVisual}
                href={THEME_STARTER_DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={translate({
                  message: 'Open theme demo',
                  id: 'home.quickstart.deploy.demo',
                })}
              >
                <div className={styles.deployBrowser} aria-hidden>
                  <span className={styles.deployDot} />
                  <span className={styles.deployDot} />
                  <span className={styles.deployDot} />
                  <span className={styles.deployUrl}>demo.reactpress.cc</span>
                </div>
                <img
                  className={styles.deployGif}
                  src={demoGif}
                  alt={translate({
                    message: 'ReactPress theme site demo — homepage with posts, tags, and reading list',
                    id: 'home.quickstart.deploy.gif.alt',
                  })}
                  width={640}
                  height={400}
                  loading="lazy"
                  decoding="async"
                />
                <p className={styles.deployVisualLabel}>
                  <Translate id="home.quickstart.deploy.visual">Click → clone → live</Translate>
                </p>
              </a>
            </SpotSurface>
          </div>
        ) : (
          <div className={styles.localPane} role="tabpanel">
            <ol className={styles.steps}>
              {steps.map((step, index) => (
                <SpotSurface
                  key={step.n}
                  as="li"
                  className={clsx(styles.step, sectionStyles.revealItem)}
                  tilt={false}
                  style={{ '--reveal-index': index } as React.CSSProperties}
                >
                  <span className={styles.stepNum} aria-hidden>
                    {step.n}
                  </span>
                  <div className={styles.stepBody}>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                    <p className={styles.stepDetail}>{step.detail}</p>
                    {step.code ? <code className={styles.code}>{step.code}</code> : null}
                  </div>
                  {index < steps.length - 1 ? <span className={styles.stepConnector} aria-hidden /> : null}
                </SpotSurface>
              ))}
            </ol>

            <div
              className={clsx(styles.cliWrap, sectionStyles.revealItem)}
              style={{ '--reveal-index': 3 } as React.CSSProperties}
            >
              <CliCommandBlock variant="section" showHint animate />
            </div>

            <div
              className={clsx(styles.after, sectionStyles.revealItem)}
              style={{ '--reveal-index': 4 } as React.CSSProperties}
            >
              <p className={styles.afterLabel}>
                <Translate id="home.quickstart.after">Then open</Translate>
              </p>
              <div className={styles.endpoints}>
                {endpoints.map((ep) => (
                  <a key={ep.href} className={styles.endpoint} href={ep.href} target="_blank" rel="noopener noreferrer">
                    <span className={styles.endpointLabel}>{ep.label}</span>
                    <span className={styles.endpointUrl}>{ep.href}</span>
                  </a>
                ))}
              </div>
              <p className={styles.hint}>
                <Translate id="home.quickstart.hint">
                  Stuck? Run reactpress doctor — or follow the first-site guide.
                </Translate>
              </p>
              <div className={styles.links}>
                <Link className={styles.linkPrimary} to="/docs/getting-started/first-site">
                  <Translate id="home.quickstart.guide">5-minute first site</Translate>
                </Link>
                <Link className={styles.linkSecondary} to="/docs/getting-started/build-nextjs-blog-in-60-seconds">
                  <Translate id="home.quickstart.sixty">60-second Next.js blog</Translate>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
