'use client';

import { useInView } from 'react-intersection-observer';

interface UseScrollRevealOptions {
  /** Fraction of the element that must be visible to trigger (0–1). Default: 0.12 */
  threshold?: number;
  /** Shrinks the viewport for the trigger so elements reveal before reaching the edge. Default: '0px 0px -60px 0px' */
  rootMargin?: string;
  /** Whether to trigger only once (true) or every time element enters view (false). Default: true */
  once?: boolean;
  /** Delay in ms before the inView value updates (use sparingly — prefer CSS/JS transition delay). Default: 0 */
  delay?: number;
}

/**
 * Lenis-compatible scroll reveal hook.
 *
 * Use this instead of Framer Motion `whileInView` — Lenis smooth scroll
 * intercepts wheel events and breaks IntersectionObserver, causing elements
 * with `initial={{ opacity: 0 }}` to stay permanently invisible.
 *
 * @example
 * const { ref, inView } = useScrollReveal({ threshold: 0.1 });
 * <motion.div
 *   ref={ref}
 *   animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
 *   transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
 * />
 */
export function useScrollReveal(opts: UseScrollRevealOptions = {}) {
  const {
    threshold = 0.12,
    rootMargin = '0px 0px -60px 0px',
    once = true,
    delay = 0,
  } = opts;

  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce: once,
    delay,
  });

  return { ref, inView };
}
