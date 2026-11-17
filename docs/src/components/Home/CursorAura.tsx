import React, { useEffect, useRef } from 'react';

import styles from './cursorAura.module.css';

/** Dual soft page-level glow that lags behind the cursor. Desktop only. */
export default function CursorAura() {
  const coreRef = useRef<HTMLDivElement>(null);
  const softRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const core = coreRef.current;
    const soft = softRef.current;
    if (!core || !soft) {
      return;
    }

    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) {
      core.style.display = 'none';
      soft.style.display = 'none';
      return;
    }

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x;
    let cy = y;
    let sx = x;
    let sy = y;
    let raf = 0;
    let visible = false;

    const tick = () => {
      cx += (x - cx) * 0.16;
      cy += (y - cy) * 0.16;
      sx += (x - sx) * 0.07;
      sy += (y - sy) * 0.07;
      core.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      soft.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (!visible) {
        visible = true;
        core.dataset.on = '1';
        soft.dataset.on = '1';
      }
    };

    const onLeave = () => {
      visible = false;
      delete core.dataset.on;
      delete soft.dataset.on;
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <>
      <div ref={softRef} className={styles.soft} aria-hidden />
      <div ref={coreRef} className={styles.core} aria-hidden />
    </>
  );
}
