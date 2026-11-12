import { llms, loader } from 'fumadocs-core/source';
import { posix } from 'node:path';
import { rewriteMarkdownLinks } from './markdown-links';
import type { Locale } from './locale';
import { docsRoute, getPageMarkdownUrl } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { z } from 'zod';
import { i18n } from './i18n';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema.extend({ sourceUrl: z.url().optional() }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  i18n,
  plugins: [],
});

function markdownHref(href: string, locale?: string, dir?: string) {
  const path = href.split(/[?#]/, 1)[0];
  let target = path;
  if (/^(?!\/|\w+:).*\.mdx?$/.test(path)) {
    if (!path.startsWith('.')) target = './' + path;
  } else if (!/^\/(?:zh\/)?docs(?:\/|$)/.test(path)) {
    return href;
  }
  const match = source.getPageByHref(target, { language: locale, dir });
  return match ? getPageMarkdownUrl(match.page).url + href.slice(path.length) : href;
}

export const docsLlms = llms(source, {
  renderPage: async (page) => {
    const markdown = await page.data.getText('processed');
    const body = rewriteMarkdownLinks(markdown, href => markdownHref(href, page.locale, posix.dirname(page.path)));
    return `# ${page.data.title} (${getPageMarkdownUrl(page).url})\n\n${body}`;
  },
});

export function docsLlmIndex(locale: Locale) {
  // Fumadocs emits one Markdown list link per page. Page titles may contain
  // TypeScript generics, which are plain text here rather than JSX elements.
  return docsLlms.index(locale).replace(/\]\((\/(?:zh\/)?docs[^)\s]*)\)/g,
    (_, href) => `](${markdownHref(href, locale)})`);
}
