import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Brand } from '@/components/brand';
import { LocaleSwitch } from '@/components/locale/locale-switch';
import type { Locale } from './locale';
import { repositoryUrl } from './shared';

const copy = {
  en: {
    home: '/',
    documentation: 'Documentation',
    api: 'API Reference',
    examples: 'Examples',
  },
  zh: {
    home: '/zh',
    documentation: '文档',
    api: 'API 参考',
    examples: '示例',
  },
} as const;

export function baseOptions(locale: Locale = 'en'): BaseLayoutProps {
  const text = copy[locale];

  return {
    nav: {
      title: <Brand />,
      url: text.home,
    },
    links: [
      { text: text.documentation, url: locale === 'zh' ? '/zh/docs' : '/docs' },
      {
        text: text.api,
        url: locale === 'zh' ? '/zh/docs/api-reference' : '/docs/api-reference',
      },
      {
        text: text.examples,
        url:
          locale === 'zh' ? '/zh/docs/resources/examples' : '/docs/resources/examples',
      },
      { type: 'custom', children: <LocaleSwitch locale={locale} /> },
    ],
    githubUrl: repositoryUrl,
    // The custom switch above is clearer than an icon-only locale menu, so
    // suppress the layout's automatic language selector.
    i18n: false,
  };
}
