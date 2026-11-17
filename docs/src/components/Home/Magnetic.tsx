import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, type CSSProperties, type PropsWithChildren } from 'react';

import styles from './magnetic.module.css';

type MagneticProps = PropsWithChildren<{
  className?: string;
  /** Pull strength 0–1. Default 0.36 */
  strength?: number;
  /** Max translate in px. Default 14 */
  max?: number;
}>;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Spring-pulls a child toward the pointer for tactile CTA feel. */
export default function Magnetic({ children, className, strength = 0.36, max = 14 }: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const active = useRef(false);

  const tick = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    current.current.x += (target.current.x - current.current.x) * 0.18;
    current.current.y += (target.current.y - current.current.y) * 0.18;
    el.style.setProperty('--mx', `${current.current.x.toFixed(2)}px`);
    el.style.setProperty('--my', `${current.current.y.toFixed(2)}px`);

    const settled =
      Math.abs(target.current.x - current.current.x) < 0.05 && Math.abs(target.current.y - current.current.y) < 0.05;
    if (!settled || active.current) {
      raf.current = requestAnimationFrame(tick);
    } else {
      raf.current = 0;
      current.current.x = target.current.x;
      current.current.y = target.current.y;
      el.style.setProperty('--mx', `${current.current.x}px`);
      el.style.setProperty('--my', `${current.current.y}px`);
    }
  }, []);

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

  const onMove = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      if (prefersReducedMotion()) {
        return;
      }
      const el = ref.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      target.current.x = Math.max(-max, Math.min(max, dx * strength));
      target.current.y = Math.max(-max, Math.min(max, dy * strength));
      active.current = true;
      el.dataset.pull = 'on';
      ensureTick();
    },
    [ensureTick, max, strength]
  );

  const onLeave = useCallback(() => {
    target.current.x = 0;
    target.current.y = 0;
    active.current = false;
    const el = ref.current;
    if (el) {
      delete el.dataset.pull;
    }
    ensureTick();
  }, [ensureTick]);

  return (
    <span
      ref={ref}
      className={clsx(styles.magnetic, className)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ '--mx': '0px', '--my': '0px' } as CSSProperties}
    >
      {children}
    </span>
  );
}
