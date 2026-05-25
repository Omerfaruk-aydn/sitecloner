'use client';

import { useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import type { RefObject } from 'react';

export function useParallax(
  targetRef: RefObject<HTMLElement | null>,
  speed: number = 0.5
): MotionValue<number> {
  const { scrollYProgress } = useScroll({
    target: targetRef as RefObject<HTMLElement>,
    offset: ['start end', 'end start'],
  });
  return useTransform(scrollYProgress, [0, 1], [speed * -100, speed * 100]);
}
