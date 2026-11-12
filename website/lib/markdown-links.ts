import { createProcessor } from '@mdx-js/mdx';
import { visit } from 'unist-util-visit';

const processor = createProcessor();

/** Change link destinations while preserving authored Markdown, including code examples. */
export function rewriteMarkdownLinks(markdown: string, resolve: (href: string) => string) {
  const edits: { start: number; end: number; value: string }[] = [];
  visit(processor.parse(markdown), (node) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    if (node.type === 'link' || node.type === 'definition') {
      const value = resolve(node.url);
      if (value === node.url) return;
      const lastChild = node.type === 'link' ? node.children.at(-1) : undefined;
      const afterLabel = lastChild?.position?.end.offset ?? start;
      const suffix = markdown.slice(afterLabel, end);
      const destination = /(?:\]\(|\]:)\s*<?/.exec(suffix);
      if (!destination) return;
      const offset = afterLabel + destination.index + destination[0].length;
      if (markdown.startsWith(node.url, offset)) edits.push({ start: offset, end: offset + node.url.length, value });
    } else if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      for (const attr of node.attributes) {
        if (attr.type !== 'mdxJsxAttribute' || attr.name !== 'href' || typeof attr.value !== 'string') continue;
        const value = resolve(attr.value);
        if (value === attr.value || !attr.position) continue;
        const start = attr.position.start.offset!;
        const end = attr.position.end.offset!;
        edits.push({ start, end, value: `href="${value}"` });
      }
    }
  });
  for (const edit of edits.reverse()) {
    markdown = markdown.slice(0, edit.start) + edit.value + markdown.slice(edit.end);
  }
  return markdown;
}
