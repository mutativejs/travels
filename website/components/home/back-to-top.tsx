'use client';

import { Undo2 } from 'lucide-react';

/** Scrolls back to the top of the page: the homepage's own undo. */
export function BackToTop({ label = 'Back to top' }: { label?: string }) {
  return (
    <button
      type="button"
      className="back-to-top"
      onClick={() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      }}
    >
      <Undo2 size={14} aria-hidden="true" /> {label}
    </button>
  );
}
