import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Brand } from '@/components/brand';
import { repositoryUrl } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Brand />,
    },
    links: [
      { text: 'Documentation', url: '/docs' },
      { text: 'API Reference', url: '/docs/api-reference' },
      { text: 'Examples', url: '/docs/resources/examples' },
    ],
    githubUrl: repositoryUrl,
  };
}
