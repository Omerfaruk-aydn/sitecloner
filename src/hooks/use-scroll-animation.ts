'use client';

import { useInView } from 'react-intersection-observer';
import type { Variants } from 'framer-motion';
interface ScrollAnimationOptions {
  threshold?: number;
  triggerOnce?: boolean;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  duration?: number;
  ease?: string | number[];
}

export function useScrollAnimation(options: ScrollAnimationOptions = {}) {
  const {
    threshold = 0.15,
    triggerOnce = true,
    delay = 0,
    direction = 'up',
    distance = 32,
    duration = 0.8,
    ease = [0.16, 1, 0.3, 1],
  } = options;

  const { ref, inView } = useInView({ threshold, triggerOnce });

  const directionMap: Record<string, { y?: number; x?: number }> = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {},
  };

  const variants: Variants = {
    hidden: { opacity: 0, ...directionMap[direction] },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: { duration, ease, delay },
    },
  };

  return { ref, inView, variants };
}
