import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/zh/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree('zh')}
      {...baseOptions('zh')}
      sidebar={{ defaultOpenLevel: 1, collapsible: true }}
    >
      {children}
    </DocsLayout>
  );
}
