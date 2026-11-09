import type { Metadata } from 'next';
import {
  DocsPageContent,
  generateDocsMetadata,
} from '@/components/docs-page-content';
import { source } from '@/lib/source';

export default async function Page(props: PageProps<'/zh/docs/[[...slug]]'>) {
  const params = await props.params;
  return <DocsPageContent locale="zh" slug={params.slug} />;
}

export function generateStaticParams() {
  return source.getPages('zh').map((page) => ({ slug: page.slugs }));
}

export async function generateMetadata(
  props: PageProps<'/zh/docs/[[...slug]]'>,
): Promise<Metadata> {
  const params = await props.params;
  return generateDocsMetadata('zh', params.slug);
}
