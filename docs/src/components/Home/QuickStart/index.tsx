import Link from '@docusaurus/Link';
import { translate } from '@docusaurus/Translate';
import Translate from '@docusaurus/Translate';
import React from 'react';

import styles from './styles.module.css';

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
    code: 'npm install -g @fecommunity/reactpress',
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
    label: translate({ message: 'Website', id: 'home.quickstart.endpoint.site' }),
    href: 'http://localhost:3001',
  },
  {
    label: translate({ message: 'Admin', id: 'home.quickstart.endpoint.admin' }),
    href: 'http://localhost:3001/admin/',
  },
];

export default function QuickStart() {
  return (
    <section
      className={styles.section}
      aria-labelledby="home-quickstart-heading"
      aria-label={translate({ message: 'Quick start', id: 'home.quickstart.aria' })}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>
            <Translate id="home.quickstart.eyebrow">Get started in ~60 seconds</Translate>
          </p>
          <h2 id="home-quickstart-heading" className={styles.heading}>
            <Translate id="home.quickstart.title">From zero to a live site</Translate>
          </h2>
          <p className={styles.subheading}>
            <Translate id="home.quickstart.desc">
              Three commands. Embedded SQLite. No Docker. Default login is admin / admin — change it before going
              public.
            </Translate>
          </p>
        </header>

        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.n} className={styles.step} style={{ animationDelay: `${index * 0.07}s` }}>
              <span className={styles.stepNum} aria-hidden>
                {step.n}
              </span>
              <div className={styles.stepBody}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDetail}>{step.detail}</p>
                {step.code ? <code className={styles.code}>{step.code}</code> : null}
              </div>
            </li>
          ))}
        </ol>

        <div className={styles.after}>
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
            <a
              className={styles.linkSecondary}
              href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffecommunity%2Freactpress-theme-starter"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Translate id="home.quickstart.vercel">Deploy to Vercel</Translate>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
