'use client';

import SearchDialog from '@/components/search';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { I18nProviderProps } from 'fumadocs-ui/contexts/i18n';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { isLocale, localizePath, type Locale } from '@/lib/locale';

type ProviderProps = {
  locale: Locale;
  i18n: Omit<I18nProviderProps, 'children'>;
  children: ReactNode;
};

export function Provider({ locale, i18n, children }: ProviderProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <RootProvider
      i18n={{
        ...i18n,
        onLocaleChange(value) {
          const next = isLocale(value) ? value : locale;
          router.push(localizePath(pathname, next));
        },
      }}
      search={{ SearchDialog }}
    >
      {children}
    </RootProvider>
  );
}
