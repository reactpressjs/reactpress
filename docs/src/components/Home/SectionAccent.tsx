import clsx from 'clsx';
import React from 'react';

import styles from './section.module.css';

/** Animated underline / sweep line under section headers. */
export default function SectionAccent({ className, active }: { className?: string; active?: boolean }) {
  return (
    <div className={clsx(styles.accent, active && styles.accentActive, className)} aria-hidden>
      <span className={styles.accentLine} />
      <span className={styles.accentDot} />
    </div>
  );
}
