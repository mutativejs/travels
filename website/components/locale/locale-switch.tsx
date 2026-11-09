'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Languages } from 'lucide-react';
import { localizePath, otherLocale, type Locale } from '@/lib/locale';

export function LocaleSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname() || '/';
  const target = otherLocale(locale);
  const label = target === 'zh' ? '中文' : 'English';
  const ariaLabel = target === 'zh' ? '切换到中文' : 'Switch to English';

  return (
    <Link href={localizePath(pathname, target)} className="locale-switch" aria-label={ariaLabel}>
      <Languages size={15} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
