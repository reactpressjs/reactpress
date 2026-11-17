import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

type SpotlightOptions = {
  disabled?: boolean;
  /** Enable 3D tilt via --tilt-x / --tilt-y. Default false. */
  tilt?: boolean;
  /** Max tilt degrees. Default 9. */
  maxTilt?: number;
};

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Pointer spotlight (+ optional spring 3D tilt) via CSS vars:
 * --spot-x / --spot-y (%), --tilt-x / --tilt-y (deg)
 */
export function useSpotlight<T extends HTMLElement = HTMLDivElement>(options: SpotlightOptions = {}) {
  const { disabled = false, tilt = false, maxTilt = 9 } = options;
  const ref = useRef<T>(null);
  const frame = useRef(0);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const current = useRef({ x: 50, y: 40, rx: 0, ry: 0 });
  const target = useRef({ x: 50, y: 40, rx: 0, ry: 0 });
  const hovering = useRef(false);

  const apply = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.style.setProperty('--spot-x', `${current.current.x.toFixed(2)}%`);
    el.style.setProperty('--spot-y', `${current.current.y.toFixed(2)}%`);
    if (tilt) {
      el.style.setProperty('--tilt-x', `${current.current.rx.toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${current.current.ry.toFixed(2)}deg`);
    }
  }, [tilt]);

  const tick = useCallback(() => {
    const ease = hovering.current ? 0.22 : 0.14;
    current.current.x += (target.current.x - current.current.x) * ease;
    current.current.y += (target.current.y - current.current.y) * ease;
    current.current.rx += (target.current.rx - current.current.rx) * ease;
    current.current.ry += (target.current.ry - current.current.ry) * ease;
    apply();

    const settled =
      Math.abs(target.current.x - current.current.x) < 0.08 &&
      Math.abs(target.current.y - current.current.y) < 0.08 &&
      Math.abs(target.current.rx - current.current.rx) < 0.02 &&
      Math.abs(target.current.ry - current.current.ry) < 0.02;

    if (!settled || hovering.current) {
      frame.current = requestAnimationFrame(tick);
    } else {
      frame.current = 0;
      current.current = { ...target.current };
      apply();
    }
  }, [apply]);

  const ensureTick = useCallback(() => {
    if (!frame.current) {
      frame.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  useEffect(
    () => () => {
      if (frame.current) {
        cancelAnimationFrame(frame.current);
      }
    },
    []
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<T>) => {
      if (disabled || prefersReducedMotion()) {
        return;
      }
      const el = ref.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return;
      }
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      pending.current = { x, y };
      target.current.x = x;
      target.current.y = y;
      if (tilt) {
        target.current.rx = ((y - 50) / 50) * -maxTilt;
        target.current.ry = ((x - 50) / 50) * maxTilt;
      }
      ensureTick();
    },
    [disabled, ensureTick, maxTilt, tilt]
  );

  const onPointerEnter = useCallback(
    (event: ReactPointerEvent<T>) => {
      if (disabled) {
        return;
      }
      const el = ref.current;
      if (!el) {
        return;
      }
      hovering.current = true;
      el.dataset.spot = 'on';
      if (tilt) {
        el.dataset.tilt = 'on';
      }
      onPointerMove(event);
    },
    [disabled, onPointerMove, tilt]
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    hovering.current = false;
    delete el.dataset.spot;
    delete el.dataset.tilt;
    target.current.rx = 0;
    target.current.ry = 0;
    pending.current = null;
    ensureTick();
  }, [ensureTick]);

  return { ref, onPointerMove, onPointerEnter, onPointerLeave };
}
