'use client';

import { Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * The missing page as a JSON Patch. "Travel back" flips the card to the
 * inverse patch, then returns to the previous page, or home when there is
 * no previous page in this tab.
 */
export function UndoPatch({
  path,
  label = 'Travel back',
  homeHref = '/',
}: {
  path: string;
  label?: string;
  homeHref?: string;
}) {
  const router = useRouter();
  const [undone, setUndone] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  function travelBack() {
    setUndone(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = window.setTimeout(
      () => {
        if (window.history.length > 1) router.back();
        else router.push(homeHref);
      },
      reduced ? 0 : 750
    );
  }

  return (
    <div className="nf-undo">
      <div className={`nf-patch${undone ? ' is-undone' : ''}`} aria-live="polite">
        <div className="nf-patch-face nf-patch-front" aria-hidden={undone}>
          <span className="nf-patch-label">patches[0]</span>
          <code>
            {'{ '}
            <span className="nf-key">&quot;op&quot;</span>: <span className="nf-remove">&quot;remove&quot;</span>,{' '}
            <span className="nf-key">&quot;path&quot;</span>: <span className="nf-path">&quot;{path}&quot;</span>
            {' }'}
          </code>
        </div>
        <div className="nf-patch-face nf-patch-back" aria-hidden={!undone}>
          <span className="nf-patch-label">inversePatches[0]</span>
          <code>
            {'{ '}
            <span className="nf-key">&quot;op&quot;</span>: <span className="nf-add">&quot;add&quot;</span>,{' '}
            <span className="nf-key">&quot;path&quot;</span>: <span className="nf-path">&quot;{path}&quot;</span>
            {' }'}
          </code>
        </div>
      </div>
      <button type="button" className="button button-primary nf-back" onClick={travelBack}>
        <Undo2 size={17} aria-hidden="true" /> {label}
      </button>
    </div>
  );
}
