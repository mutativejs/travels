import type { Metadata } from 'next';
import {
  DocsPageContent,
  generateDocsMetadata,
} from '@/components/docs-page-content';
import { source } from '@/lib/source';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  return <DocsPageContent locale="en" slug={params.slug} />;
}

export function generateStaticParams() {
  return source.getPages('en').map((page) => ({ slug: page.slugs }));
}

export async function generateMetadata(
  props: PageProps<'/docs/[[...slug]]'>,
): Promise<Metadata> {
  const params = await props.params;
  return generateDocsMetadata('en', params.slug);
}
