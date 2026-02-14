'use client';

import { useRef, useCallback, useEffect } from 'react';

const NEAR_BOTTOM_THRESHOLD = 100;

/**
 * Hook that manages auto-scrolling for a scrollable container.
 *
 * Auto-scrolls to bottom when content changes, but only if the user
 * is already near the bottom. Stops auto-scrolling when the user
 * scrolls up, and resumes when they scroll back to the bottom.
 */
export function useAutoScroll(deps: unknown[]) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleScroll = useCallback(() => {
    isNearBottomRef.current = isNearBottom();
  }, [isNearBottom]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      // Wait for DOM updates to complete before scrolling
      const rafId = requestAnimationFrame(() => {
        scrollToBottom();
      });
      
      return () => cancelAnimationFrame(rafId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { scrollRef, handleScroll, scrollToBottom };
}
