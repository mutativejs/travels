'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Languages } from 'lucide-react';
import {
  isLocale,
  localeHtmlLanguages,
  localeNames,
  locales,
  localizePath,
  type Locale,
} from '@/lib/locale';

export function LocaleSwitch({ locale, path }: { locale: Locale; path?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="locale-switch">
      <Languages size={15} aria-hidden="true" />
      <select
        aria-label={locale === 'zh' ? '选择语言' : 'Choose a language'}
        value={locale}
        onChange={(event) => {
          const target = event.currentTarget.value;
          if (isLocale(target)) router.push(localizePath(path ?? pathname, target));
        }}
      >
        {locales.map((code) => (
          <option key={code} value={code} lang={localeHtmlLanguages[code]}>
            {localeNames[code]}
          </option>
        ))}
      </select>
      <ChevronDown size={13} aria-hidden="true" />
    </label>
  );
}
