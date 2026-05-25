'use client';

import { useState, useEffect, useCallback } from 'react';

interface CursorState {
  x: number;
  y: number;
  isHovering: boolean;
  isClicking: boolean;
}

export function useCursor() {
  const [cursor, setCursor] = useState<CursorState>({
    x: 0,
    y: 0,
    isHovering: false,
    isClicking: false,
  });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setCursor(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
  }, []);

  const handleMouseOver = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive =
      target.tagName === 'A' ||
      target.tagName === 'BUTTON' ||
      target.getAttribute('role') === 'button' ||
      target.classList.contains('cursor-pointer');
    setCursor(prev => ({ ...prev, isHovering: isInteractive }));
  }, []);

  const handleMouseDown = useCallback(() => {
    setCursor(prev => ({ ...prev, isClicking: true }));
  }, []);

  const handleMouseUp = useCallback(() => {
    setCursor(prev => ({ ...prev, isClicking: false }));
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseOver, handleMouseDown, handleMouseUp]);

  return cursor;
}
