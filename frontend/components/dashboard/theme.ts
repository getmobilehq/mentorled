'use client';

import { useEffect, useRef, useState } from 'react';

/** One colour per track, used consistently across bars, badges and avatars. */
export const TRACKS: Record<string, { label: string; color: string; soft: string; text: string }> = {
  product_manager: { label: 'Product Management', color: '#8b5cf6', soft: 'bg-violet-100 dark:bg-violet-500/15', text: 'text-violet-700 dark:text-violet-300' },
  product_designer: { label: 'Product Design', color: '#ec4899', soft: 'bg-pink-100 dark:bg-pink-500/15', text: 'text-pink-700 dark:text-pink-300' },
  frontend: { label: 'Frontend', color: '#0ea5e9', soft: 'bg-sky-100 dark:bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300' },
  qa: { label: 'QA / Testing', color: '#f59e0b', soft: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300' },
  backend: { label: 'Backend', color: '#10b981', soft: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300' },
  project_manager: { label: 'Project Management', color: '#6366f1', soft: 'bg-indigo-100 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-300' },
};

export const trackMeta = (track?: string | null) =>
  (track && TRACKS[track]) || {
    label: track ? track.replace(/_/g, ' ') : 'Unassigned',
    color: '#94a3b8',
    soft: 'bg-slate-100 dark:bg-slate-500/15',
    text: 'text-slate-700 dark:text-slate-300',
  };

export const OUTCOME_COLORS: Record<string, string> = {
  Accepted: '#10b981',
  Shortlisted: '#0ea5e9',
  'In review': '#f59e0b',
  'Not selected': '#f43f5e',
  Withdrawn: '#94a3b8',
};

/** Animate a number from 0 to `target` (eased); re-animates when target changes. */
export function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValue(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const initial = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(initial + (target - initial) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
