import Link from 'next/link';
import type { CSSProperties } from 'react';
import { BookOpen, House } from 'lucide-react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { HeroBackdrop } from '@/components/home/hero-backdrop';
import { UndoPatch } from '@/components/not-found/undo-patch';
import { baseOptions } from '@/lib/layout.shared';
import { localePath, type Locale } from '@/lib/locale';

const DEPTH = 9;

const copy = {
  en: {
    eyebrow: 'ERROR 404 · NOTHING AT THIS POSITION',
    title: 'This page was undone.',
    body: 'Every change in Travels has a way back, and so does this one. The page you asked for is not here: it may have moved, or the link may be out of date.',
    undo: 'Travel back',
    home: 'Home',
    docs: 'Documentation',
  },
  zh: {
    eyebrow: 'ERROR 404 · 此位置没有任何内容',
    title: '这个页面被撤销了。',
    body: 'Travels 中的每一次改动都可以撤销，这个页面也不例外。你请求的页面不在这里：它可能已被移动，或者链接已经过期。',
    undo: '回到上一页',
    home: '首页',
    docs: '文档',
  },
} as const;

export function NotFoundPage({ locale }: { locale: Locale }) {
  const options = baseOptions(locale);
  const text = copy[locale];
  const homeHref = localePath(locale, '/');
  const docsHref = localePath(locale, '/docs');

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
          <p className="section-eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="nf-copy">{text.body}</p>
          <UndoPatch path="/this-page" label={text.undo} homeHref={homeHref} />
          <div className="nf-links">
            <Link href={homeHref} className="button button-secondary">
              <House size={17} aria-hidden="true" /> {text.home}
            </Link>
            <Link href={docsHref} className="button button-secondary">
              <BookOpen size={17} aria-hidden="true" /> {text.docs}
            </Link>
          </div>
        </section>
      </div>
    </HomeLayout>
  );
}
