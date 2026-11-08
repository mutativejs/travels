import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { BookOpen, House } from 'lucide-react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { HeroBackdrop } from '@/components/home/hero-backdrop';
import { UndoPatch } from '@/components/not-found/undo-patch';
import { baseOptions } from '@/lib/layout.shared';

export const metadata: Metadata = {
  title: 'Page not found',
};

const DEPTH = 9;

export default function NotFound() {
  const options = baseOptions();
  return (
    <HomeLayout {...options} nav={{ ...options.nav, transparentMode: 'top' }}>
      <div className="home-page nf-page">
        <section className="nf-hero">
          <HeroBackdrop />
          <div className="nf-digits" aria-hidden="true">
            {Array.from({ length: DEPTH }, (_, layer) => (
              <span key={layer} className="nf-layer" style={{ '--layer': layer } as CSSProperties}>
                404
              </span>
            ))}
          </div>
          <p className="section-eyebrow">ERROR 404 · NOTHING AT THIS POSITION</p>
          <h1>This page was undone.</h1>
          <p className="nf-copy">
            Every change in Travels has a way back, and so does this one. The
            page you asked for is not here: it may have moved, or the link may
            be out of date.
          </p>
          <UndoPatch path="/this-page" />
          <div className="nf-links">
            <Link href="/" className="button button-secondary">
              <House size={17} aria-hidden="true" /> Home
            </Link>
            <Link href="/docs" className="button button-secondary">
              <BookOpen size={17} aria-hidden="true" /> Documentation
            </Link>
          </div>
        </section>
      </div>
    </HomeLayout>
  );
}
