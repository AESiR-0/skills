'use client';
// REVIEW ONLY — delete with review-window.js once the client has chosen.
import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('review:change', onChange);
  return () => window.removeEventListener('review:change', onChange);
};

/**
 * The live pick for one review-window group, for variants that change markup rather than CSS.
 *
 * `fallback` must be the group's default (its first option, or its `default`): the default
 * writes no attribute, and the server, production and the first client render all see the
 * fallback — so hydration always matches and the switch happens after it.
 *
 *   const hero = useReview('hero', 'film');
 */
export function useReview<T extends string>(id: string, fallback: T): T {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute(`data-${id}`) as T | null) ?? fallback,
    () => fallback,
  );
}
