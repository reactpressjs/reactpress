import { translate } from '@docusaurus/Translate';
import Translate from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';
import clsx from 'clsx';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

import styles from './styles.module.css';

type SlideId = 'usage' | 'demo' | 'desktop';

type Slide = {
  id: SlideId;
  src: string;
  label: string;
  caption: string;
};

const AUTO_MS = 6500;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return reduced;
}

export default function HeroCarousel() {
  const usageSrc = useBaseUrl('/img/blog/usage.gif');
  const demoSrc = useBaseUrl('/img/blog/demo.gif');
  const desktopSrc = useBaseUrl('/img/blog/desktop.gif');
  const labelId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const slides: Slide[] = [
    {
      id: 'usage',
      src: usageSrc,
      label: translate({
        message: 'CLI — live in ~60 seconds',
        id: 'home.hero.slide.usage.label',
      }),
      caption: translate({
        message: 'Install the CLI, run init, and Site + Admin + API come up together.',
        id: 'home.hero.slide.usage.caption',
      }),
    },
    {
      id: 'demo',
      src: demoSrc,
      label: translate({
        message: 'Published site — the reader experience',
        id: 'home.hero.slide.demo.label',
      }),
      caption: translate({
        message: 'A real Next.js theme blog: archives, tags, and SEO-ready pages out of the box.',
        id: 'home.hero.slide.demo.caption',
      }),
    },
    {
      id: 'desktop',
      src: desktopSrc,
      label: translate({
        message: 'Admin & desktop — write locally',
        id: 'home.hero.slide.desktop.label',
      }),
      caption: translate({
        message: 'Sign in to manage content, or write offline in the desktop app with local SQLite.',
        id: 'home.hero.slide.desktop.caption',
      }),
    },
  ];

  const count = slides.length;
  const active = slides[index] ?? slides[0];

  const goTo = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    if (paused || reducedMotion || count < 2) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, AUTO_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, count]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goNext();
    }
  };

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start == null || end == null) {
      return;
    }
    const delta = end - start;
    if (Math.abs(delta) < 48) {
      return;
    }
    if (delta > 0) {
      goPrev();
    } else {
      goNext();
    }
  };

  return (
    <div
      className={styles.carousel}
      role="region"
      aria-roledescription="carousel"
      aria-labelledby={labelId}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      tabIndex={0}
    >
      <p id={labelId} className={styles.srOnly}>
        <Translate id="home.hero.carousel.aria">ReactPress product tour</Translate>
      </p>

      <div className={styles.mediaGlow} aria-hidden />

      <div className={styles.mediaFrame}>
        <div className={styles.slideViewport}>
          {slides.map((slide, slideIndex) => (
            <div
              key={slide.id}
              className={clsx(styles.slide, slideIndex === index && styles.slideActive)}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slideIndex + 1} / ${count}: ${slide.label}`}
              aria-hidden={slideIndex !== index}
            >
              <img
                className={styles.mediaImage}
                src={slide.src}
                alt=""
                width={1440}
                height={810}
                loading={slideIndex === 0 ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
              />
            </div>
          ))}
        </div>

        <div className={styles.carouselChrome}>
          <button
            type="button"
            className={styles.carouselNav}
            onClick={goPrev}
            aria-label={translate({ message: 'Previous slide', id: 'home.hero.carousel.prev' })}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
              <path
                d="M12.5 4.5 7 10l5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div
            className={styles.carouselDots}
            role="tablist"
            aria-label={translate({ message: 'Slides', id: 'home.hero.carousel.dots' })}
          >
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={slideIndex === index}
                aria-label={slide.label}
                className={clsx(styles.carouselDot, slideIndex === index && styles.carouselDotActive)}
                onClick={() => goTo(slideIndex)}
              />
            ))}
          </div>

          <button
            type="button"
            className={styles.carouselNav}
            onClick={goNext}
            aria-label={translate({ message: 'Next slide', id: 'home.hero.carousel.next' })}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
              <path
                d="M7.5 4.5 13 10l-5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.carouselMeta}>
        <p className={styles.carouselLabel}>{active.label}</p>
        <p className={styles.mediaCaption}>{active.caption}</p>
      </div>
    </div>
  );
}
