/**
 * Homepage showcase — official / dogfood first; community sites added after Issue review.
 * Submissions: https://github.com/reactpressjs/reactpress/issues/5
 */

export const SHOWCASE_SUBMIT_URL = 'https://github.com/reactpressjs/reactpress/issues/5';

export type ShowcaseKind = 'dogfood' | 'theme-demo' | 'community';

export type ShowcaseSite = {
  id: string;
  /** Public site URL */
  url: string;
  /** Display hostname or short name (not translated) */
  name: string;
  kind: ShowcaseKind;
  /** Site favicon under /static/img/showcase */
  icon: string;
};

/** Curated list rendered on the homepage. Keep official entries first. */
export const SHOWCASE_SITES: ShowcaseSite[] = [
  {
    id: 'gaoredu',
    url: 'https://www.gaoredu.com/',
    name: 'gaoredu.com',
    kind: 'dogfood',
    icon: '/img/showcase/gaoredu.png',
  },
  {
    id: 'theme-starter',
    url: 'https://demo.reactpress.cc/',
    name: 'demo.reactpress.cc',
    kind: 'theme-demo',
    icon: '/img/showcase/theme-starter.png',
  },
];
