'use client';

import SearchDialog from '@/components/search';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { I18nProviderProps } from 'fumadocs-ui/contexts/i18n';
import type { ReactNode } from 'react';

type ProviderProps = {
  i18n: Omit<I18nProviderProps, 'children'>;
  children: ReactNode;
};

export function Provider({ i18n, children }: ProviderProps) {
  return (
    <RootProvider i18n={i18n} search={{ SearchDialog }}>
      {children}
    </RootProvider>
  );
}
