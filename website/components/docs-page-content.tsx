import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getMDXComponents } from '@/components/mdx';
import { source } from '@/lib/source';
import { createDocsMetadata } from '@/lib/metadata';
import type { Locale } from '@/lib/locale';
import { getPageImageUrl, getPageMarkdownUrl, gitConfig } from '@/lib/shared';

export async function DocsPageContent({
  locale,
  slug,
}: {
  locale: Locale;
  slug: string[] | undefined;
}) {
  const page = source.getPage(slug, locale);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;
  const editPath = page.absolutePath?.replace(/^content\/docs\//, '') ?? page.path;
  const translated = editPath.startsWith('zh/');

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/website/content/docs/${editPath}`}
        />
      </div>
      <DocsBody>
        {locale === 'zh' && !translated && (
          <div className="docs-fallback-note">
            此页尚未提供中文译文。以下内容由英文源码注释生成，API 名称与签名保持原样。
          </div>
        )}
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateDocsMetadata(
  locale: Locale,
  slug: string[] | undefined,
): Promise<Metadata> {
  const page = source.getPage(slug, locale);
  if (!page) notFound();

  const translated = page.absolutePath?.startsWith('content/docs/zh/') ?? false;
  return createDocsMetadata(locale, page, getPageImageUrl(page).url, translated);
}
