import { translate } from '@docusaurus/Translate';
import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';

import styles from './scrollRail.module.css';

type Section = {
  id: string;
  label: string;
};

const SECTIONS: Section[] = [
  { id: 'home-hero', label: translate({ id: 'home.rail.hero', message: 'Intro' }) },
  { id: 'home-platform', label: translate({ id: 'home.rail.platform', message: 'Platform' }) },
  { id: 'home-highlights', label: translate({ id: 'home.rail.highlights', message: 'Outcomes' }) },
  { id: 'quickstart', label: translate({ id: 'home.rail.quickstart', message: 'Start' }) },
  { id: 'home-proof', label: translate({ id: 'home.rail.proof', message: 'SEO' }) },
  { id: 'home-showcase', label: translate({ id: 'home.rail.showcase', message: 'Sites' }) },
  { id: 'home-ecosystem', label: translate({ id: 'home.rail.ecosystem', message: 'Hub' }) },
  { id: 'home-cta', label: translate({ id: 'home.rail.cta', message: 'Go' }) },
];

export default function ScrollRail() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [markerTop, setMarkerTop] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      setVisible(window.scrollY > 120);

      let current = SECTIONS[0].id;
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id);
        if (!el) {
          continue;
        }
        const top = el.getBoundingClientRect().top;
        if (top <= window.innerHeight * 0.38) {
          current = section.id;
        }
      }
      setActive(current);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const item = itemRefs.current[active];
    if (!list || !item) {
      return;
    }
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    setMarkerTop(itemRect.top - listRect.top + itemRect.height / 2);
  }, [active, visible]);

  return (
    <>
      <div className={clsx(styles.pageProgress, visible && styles.pageProgressOn)} aria-hidden>
        <div className={styles.pageProgressFill} style={{ transform: `scaleX(${progress})` }} />
      </div>
      <nav
        className={clsx(styles.rail, visible && styles.railVisible)}
        aria-label={translate({ id: 'home.rail.aria', message: 'Page sections' })}
      >
        <div className={styles.track} aria-hidden>
          <div className={styles.fill} style={{ transform: `scaleY(${progress})` }} />
        </div>
        <div className={styles.dotColumn}>
          <span className={styles.marker} style={{ top: `${markerTop}px` }} aria-hidden />
          <ul className={styles.list} ref={listRef}>
            {SECTIONS.map((section) => (
              <li
                key={section.id}
                ref={(node) => {
                  itemRefs.current[section.id] = node;
                }}
              >
                <a
                  className={clsx(styles.dot, active === section.id && styles.dotActive)}
                  href={`#${section.id}`}
                  aria-label={section.label}
                  aria-current={active === section.id ? 'true' : undefined}
                  data-label={section.label}
                />
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
