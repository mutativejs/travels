'use client';

import { useEffect } from 'react';
import './reveal-effects.css';

const STAGGER_MS = 90;

/**
 * Fades homepage sections in as they scroll into view. `[data-reveal]`
 * reveals the element itself and `[data-reveal="stagger"]` reveals its
 * children one after another. Content that is already on screen when the
 * page loads is left alone, so nothing visible ever disappears.
 */
export function RevealEffects() {
  useEffect(() => {
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    const fold = window.innerHeight * 0.92;
    const targets = new Map<Element, HTMLElement[]>();
    for (const element of document.querySelectorAll<HTMLElement>('.home-page [data-reveal]')) {
      if (element.getBoundingClientRect().top < fold) continue;
      const items =
        element.dataset.reveal === 'stagger'
          ? Array.from(element.children).filter(
              (child): child is HTMLElement => child instanceof HTMLElement
            )
          : [element];
      items.forEach((item, index) => {
        item.style.setProperty('--reveal-delay', `${index * STAGGER_MS}ms`);
        item.classList.add('reveal-pending');
      });
      targets.set(element, items);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          for (const item of targets.get(entry.target) ?? []) {
            item.classList.replace('reveal-pending', 'reveal-in');
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    for (const element of targets.keys()) observer.observe(element);

    return () => {
      observer.disconnect();
      for (const items of targets.values()) {
        for (const item of items) item.classList.remove('reveal-pending', 'reveal-in');
      }
    };
  }, []);

  return null;
}
