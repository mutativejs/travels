import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import type { DocsLayoutProps } from 'fumadocs-ui/layouts/docs';
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

function baseOptions(locale: Locale): BaseLayoutProps {
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
    ],
    githubUrl: repositoryUrl,
    i18n: false,
  };
}

export function homeOptions(locale: Locale): BaseLayoutProps {
  const options = baseOptions(locale);
  return {
    ...options,
    nav: {
      ...options.nav,
      transparentMode: 'top',
      children: (
        <div className="order-last ms-2 shrink-0">
          <LocaleSwitch locale={locale} />
        </div>
      ),
    },
  };
}

export function docsOptions(locale: Locale): Omit<DocsLayoutProps, 'tree'> {
  return {
    ...baseOptions(locale),
    sidebar: {
      defaultOpenLevel: 1,
      collapsible: true,
      footer: <LocaleSwitch locale={locale} />,
    },
  };
}
