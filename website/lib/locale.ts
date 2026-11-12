import { basePath } from './assets';

export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeHtmlLanguages: Record<Locale, string> = {
  en: 'en',
  zh: 'zh-CN',
};

export function isLocale(value: string | undefined): value is Locale {
  return value === 'en' || value === 'zh';
}

/** Remove the deployment base path so route rewriting only deals in app paths. */
export function stripBasePath(pathname: string) {
  if (!basePath) return pathname || '/';
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
  return pathname || '/';
}

export function localeFromPathname(pathname: string): Locale {
  const path = stripBasePath(pathname);
  return path === '/zh' || path.startsWith('/zh/') ? 'zh' : 'en';
}

/** Prefix an app-relative path such as `/docs/quick-start`. */
export function localePath(locale: Locale, path: string) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return clean === '/' ? '/zh' : `/zh${clean}`;
}
