import { readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';

const docs = new URL('../../docs/', import.meta.url);
const pages = new URL('../content/docs/', import.meta.url);
const guides = new Map([
  ['advanced-patterns.md', 'guides/advanced-patterns'],
  ['compatibility.md', 'reference/compatibility'],
  ['controlled-journal.md', 'guides/controlled-journal'],
  ['migration-guide.md', 'migration/index'],
  ['mutable-mode.md', 'guides/mutable-mode'],
  ['persistence-integrations.md', 'persistence/storage-adapters'],
  ['release-checklist.md', 'resources/release-checklist'],
  ['testing.md', 'resources/testing'],
]);

function websiteLink(filename, link, href, suffix = '') {
  if (href.startsWith('/')) return link;
  const path = posix.join('docs', posix.dirname(filename), href);
  if (path === 'README.md') return `](/docs${suffix})`;
  if (path.startsWith('docs/')) {
    const slug = guides.get(path.slice('docs/'.length));
    if (slug) return `](/docs/${slug.replace(/\/index$/, '')}${suffix})`;
  } else if (path !== '..' && !path.startsWith('../')) {
    return `](https://github.com/mutativejs/travels/blob/main/${path}${suffix})`;
  }
  return link;
}

for (const [filename, slug] of guides) {
  const page = new URL(`${slug}.mdx`, pages);
  const original = readFileSync(page, 'utf8');
  const current = original.replace(/\r\n/g, '\n');
  const header = current.match(/^---\n[\s\S]*?\n---\n/);
  if (!header) throw new Error(`Missing frontmatter in ${slug}.mdx`);
  const markdown = readFileSync(new URL(filename, docs), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/^# [^\n]+\n+/, '');
  // Keep code samples literal when translating repository links to site routes.
  const body = markdown.split(/(^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$)/m)
    .map((part, i) => i % 2 ? part : part.replace(
      /\]\(([^?#():\s]+)([?#][^()\s]*)?\)/g,
      (link, href, suffix) => websiteLink(filename, link, href, suffix)
    ))
    .join('');
  const expected = `${header[0]}\n${body}`;
  if (expected === current) continue;
  if (process.argv.includes('--write')) {
    const newline = original.startsWith('---\r\n') ? '\r\n' : '\n';
    writeFileSync(page, expected.replace(/\n/g, newline));
  } else {
    console.error(`${slug}.mdx differs from docs/${filename}. Run pnpm --dir website docs:sync.`);
    process.exitCode = 1;
  }
}
