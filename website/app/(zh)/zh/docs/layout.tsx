import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { docsOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/zh/docs'>) {
  return (
    <DocsLayout tree={source.getPageTree('zh')} {...docsOptions('zh')}>
      {children}
    </DocsLayout>
  );
}
