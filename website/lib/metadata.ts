import type { Metadata } from 'next';
import { assetPath } from './assets';
import { localeHtmlLanguages, type Locale } from './locale';

const siteUrl = new URL(process.env.SITE_URL ?? 'http://localhost:7100');
const metadataBase = new URL(siteUrl.origin);

const copy = {
  en: {
    title: 'Travels — Every change. A way back.',
    description:
      'Patch-based undo/redo for modern applications. Compact history, durable persistence, atomic transactions, and framework-agnostic state integration.',
    keywords: [
      'undo redo',
      'time travel',
      'JSON Patch',
      'state history',
      'persistence',
      'Mutative',
      'TypeScript',
    ],
    openGraphLocale: 'en_US',
    openGraphAlternateLocale: 'zh_CN',
  },
  zh: {
    title: 'Travels — 每一次改动，都可撤销。',
    description:
      '为现代应用打造的基于补丁的撤销/重做。紧凑的历史记录、可靠的持久化、原子事务，以及与框架无关的状态集成。',
    keywords: [
      '撤销重做',
      '时间旅行',
      'JSON Patch',
      '状态历史',
      '持久化',
      'Mutative',
      'TypeScript',
    ],
    openGraphLocale: 'zh_CN',
    openGraphAlternateLocale: 'en_US',
  },
} as const;

export function createRootMetadata(locale: Locale): Metadata {
  const text = copy[locale];
  const canonical = locale === 'zh' ? '/zh' : '/';
  const enPath = assetPath('/');
  const zhPath = assetPath('/zh');

  return {
    metadataBase,
    title: {
      default: text.title,
      template: '%s — Travels',
    },
    description: text.description,
    applicationName: 'Travels',
    keywords: [...text.keywords],
    alternates: {
      canonical: assetPath(canonical),
      languages: {
        en: enPath,
        'zh-CN': zhPath,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Travels',
      locale: text.openGraphLocale,
      alternateLocale: [text.openGraphAlternateLocale],
      title: text.title,
      description: text.description,
      images: [{ url: assetPath('/og-image.png'), width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: text.title,
      description: text.description,
      images: [assetPath('/og-image.png')],
    },
  };
}

export function createDocsMetadata(
  locale: Locale,
  page: {
    slugs: string[];
    url: string;
    data: { title: string; description?: string };
  },
  imageUrl: string,
  fallback: boolean,
): Metadata {
  const slug = page.slugs.join('/');
  const enPath = assetPath(`/docs${slug ? `/${slug}` : ''}`);
  const zhPath = assetPath(`/zh/docs${slug ? `/${slug}` : ''}`);
  const canonical = locale === 'zh' && !fallback ? zhPath : enPath;
  const text = copy[fallback ? 'en' : locale];

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical,
      languages: {
        en: enPath,
        'zh-CN': zhPath,
      },
    },
    robots: fallback ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'article',
      locale: text.openGraphLocale,
      alternateLocale: [text.openGraphAlternateLocale],
      title: page.data.title,
      description: page.data.description,
      url: canonical,
      images: [imageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.data.title,
      description: page.data.description,
      images: [imageUrl],
    },
  };
}

export function htmlLanguage(locale: Locale) {
  return localeHtmlLanguages[locale];
}
