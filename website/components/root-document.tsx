import { JetBrains_Mono, Manrope } from 'next/font/google';
import type { ReactNode } from 'react';
import { Provider } from '@/components/provider';
import { getI18nUI } from '@/lib/i18n-ui';
import type { Locale } from '@/lib/locale';
import { htmlLanguage } from '@/lib/metadata';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

/**
 * Shared root document for both locale roots.
 *
 * Chinese content uses a native CJK font stack instead of downloading a
 * multi-megabyte webfont; the Latin brand font still leads for mixed text.
 */
export function RootDocument({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html
      lang={htmlLanguage(locale)}
      className={`${manrope.variable} ${jetBrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col antialiased">
        <Provider locale={locale} i18n={getI18nUI(locale)}>
          {children}
        </Provider>
      </body>
    </html>
  );
}
