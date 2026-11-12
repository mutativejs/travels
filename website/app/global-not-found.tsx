'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { LanguageSelect } from 'fumadocs-ui/layouts/shared/slots/language-select';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { BookOpen, House, Languages } from 'lucide-react';
import { Brand } from '@/components/brand';
import { HeroBackdrop } from '@/components/home/hero-backdrop';
import { UndoPatch } from '@/components/not-found/undo-patch';
import { getI18nUI } from '@/lib/i18n-ui';
import { isLocale, localeFromPathname, localePath, type Locale } from '@/lib/locale';
import './global.css';

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

export default function GlobalNotFound() {
  const [locale, setLocale] = useState<Locale>('en');
  const router = useRouter();

  useEffect(() => {
    const next = localeFromPathname(window.location.pathname);
    setLocale(next);
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
    document.title = next === 'zh' ? '页面未找到 — Travels' : '404 — Travels';
  }, []);

  const text = copy[locale];
  const homeHref = locale === 'zh' ? '/zh' : '/';
  const docsHref = locale === 'zh' ? '/zh/docs' : '/docs';

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>404 — Travels</title>
        <meta name="robots" content="noindex" />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <div className="nf-global-top">
          <Link href={homeHref} className="nf-global-brand">
            <Brand compact />
          </Link>
          <RootProvider
            i18n={{
              ...getI18nUI(locale),
              onLocaleChange(next) {
                if (isLocale(next)) router.push(localePath(next, '/'));
              },
            }}
            search={{ enabled: false }}
            theme={{ enabled: false }}
          >
            <LanguageSelect>
              <Languages className="size-5" aria-hidden="true" />
            </LanguageSelect>
          </RootProvider>
        </div>
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
      </body>
    </html>
  );
}
