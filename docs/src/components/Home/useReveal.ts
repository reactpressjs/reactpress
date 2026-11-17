import { useEffect, useRef, useState } from 'react';

type RevealOptions = {
  /** Fraction of element that must be visible. Default 0.18 */
  threshold?: number;
  /** Bottom rootMargin so reveal starts slightly before fully in view */
  rootMargin?: string;
};

/**
 * One-shot IntersectionObserver reveal for homepage sections.
 * Respects prefers-reduced-motion (shows content immediately).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options: RevealOptions = {}) {
  const { threshold = 0.14, rootMargin = '0px 0px -8% 0px' } = options;
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, visible]);

  return { ref, visible };
}
