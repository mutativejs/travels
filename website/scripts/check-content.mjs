import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentRoot = join(websiteRoot, 'content/docs');
const chineseRoot = join(contentRoot, 'zh');
const errors = [];

function filesUnder(directory, extensions) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path, extensions);
    return entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });
}

function pagePath(root, slug) {
  const target = join(root, slug);
  return [`${target}.mdx`, join(target, 'index.mdx')];
}

/**
 * A Chinese page exists when it has a translation, or when the source page can
 * fall back to English. The fallback is what makes every generated API page
 * reachable under `/zh/docs` without duplicating TypeDoc output.
 */
function docsPageExists(url, locale) {
  const clean = url.split('#')[0].split('?')[0].replace(/\/$/, '');
  const prefix = locale === 'zh' ? '/zh/docs' : '/docs';
  if (!clean.startsWith(prefix)) return true;
  const slug = clean.slice(prefix.length).replace(/^\//, '');
  const roots = locale === 'zh' ? [chineseRoot, contentRoot] : [contentRoot];
  return roots.some((root) => pagePath(root, slug).some((candidate) => existsSync(candidate)));
}

function localeOf(file) {
  return file.startsWith(`${chineseRoot}/`) ? 'zh' : 'en';
}

function isApiPage(file) {
  return file.startsWith(`${join(contentRoot, 'api-reference')}/`) ||
    file.startsWith(`${join(chineseRoot, 'api-reference')}/`);
}

function count(source, pattern) {
  return (source.match(pattern) ?? []).length;
}

const contentFiles = filesUnder(contentRoot, ['.mdx']);

// Every hand-written English page needs a Chinese translation, and every
// hand-written Chinese page needs an English source. Generated API pages are
// intentionally allowed to fall back to the canonical English source.
const englishHandwritten = contentFiles.filter((file) => localeOf(file) === 'en' && !isApiPage(file));
const chineseHandwritten = contentFiles.filter((file) => localeOf(file) === 'zh' && !isApiPage(file));

for (const file of englishHandwritten) {
  const relative = file.slice(contentRoot.length + 1);
  if (!existsSync(join(chineseRoot, relative))) {
    errors.push(`${relative}: missing Chinese translation at content/docs/zh/${relative}`);
    continue;
  }
  const english = readFileSync(file, 'utf8');
  const chinese = readFileSync(join(chineseRoot, relative), 'utf8');
  if (count(english, /```/g) !== count(chinese, /```/g)) {
    errors.push(`${relative}: translated page has a different number of code fences`);
  }
  const mdxComponents = /<(Callout|Card|Tabs|Tab|Steps|Step)\b/g;
  if (count(english, mdxComponents) !== count(chinese, mdxComponents)) {
    errors.push(`${relative}: translated page has a different number of MDX components`);
  }
}

for (const file of chineseHandwritten) {
  const relative = file.slice(chineseRoot.length + 1);
  if (!existsSync(join(contentRoot, relative))) {
    errors.push(`${relative}: Chinese page has no English source at content/docs/${relative}`);
  }
}

for (const file of contentFiles) {
  const source = readFileSync(file, 'utf8');
  const relative = file.slice(websiteRoot.length + 1);
  const locale = localeOf(file);

  if (/Hello World|My App|Your first document|Lorem ipsum/.test(source)) {
    errors.push(`${relative}: template placeholder text remains`);
  }
  if (locale === 'en' && /[\u3400-\u9fff]/.test(source)) {
    errors.push(`${relative}: non-English CJK text detected`);
  }
  if (locale === 'zh' && !/[\u3400-\u9fff]/.test(source)) {
    errors.push(`${relative}: Chinese page contains no Chinese text`);
  }

  for (const match of source.matchAll(/\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    if (target.startsWith('/zh/docs')) {
      if (locale !== 'zh') {
        errors.push(`${relative}: English page links to Chinese docs ${target}`);
      } else if (!docsPageExists(target, 'zh')) {
        errors.push(`${relative}: broken Chinese docs link ${target}`);
      }
    } else if (target.startsWith('/docs')) {
      if (locale === 'zh') {
        errors.push(`${relative}: Chinese page links to English docs ${target}`);
      } else if (!docsPageExists(target, 'en')) {
        errors.push(`${relative}: broken docs link ${target}`);
      }
    } else if (!target.startsWith('/') && /\.mdx?(?:#|$)/.test(target)) {
      const path = resolve(dirname(file), target.split('#')[0]);
      if (!existsSync(path)) errors.push(`${relative}: broken relative link ${target}`);
    }
  }
}

for (const file of filesUnder(contentRoot, ['meta.json'])) {
  const meta = JSON.parse(readFileSync(file, 'utf8'));
  const isChineseApiMeta = file.startsWith(`${join(chineseRoot, 'api-reference')}/`);
  for (const page of meta.pages ?? []) {
    if (typeof page !== 'string' || page.startsWith('---')) continue;
    const target = join(dirname(file), page);
    const local = [`${target}.mdx`, `${target}.json`, target].some((candidate) => existsSync(candidate));
    if (local) continue;

    if (isChineseApiMeta) {
      const englishTarget = join(contentRoot, 'api-reference', file.slice(join(chineseRoot, 'api-reference').length + 1, -'/meta.json'.length), page);
      const fallback = [`${englishTarget}.mdx`, join(englishTarget, 'index.mdx')].some((candidate) => existsSync(candidate));
      if (fallback) continue;
    }

    errors.push(`${file.slice(websiteRoot.length + 1)}: missing navigation item ${page}`);
  }
}

const appFiles = filesUnder(join(websiteRoot, 'app'), ['.tsx']).concat(
  filesUnder(join(websiteRoot, 'components'), ['.tsx']),
  filesUnder(join(websiteRoot, 'lib'), ['.tsx', '.ts']),
);
for (const file of appFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(?:href\s*[:=]\s*|url:\s*)['"](\/(?:zh\/)?docs[^'"]*)['"]/g)) {
    const target = match[1];
    const locale = target.startsWith('/zh/docs') ? 'zh' : 'en';
    if (!docsPageExists(target, locale)) {
      errors.push(`${file.slice(websiteRoot.length + 1)}: broken docs link ${target}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(
  `Checked ${contentFiles.length} documentation pages (${englishHandwritten.length} English guides, ${chineseHandwritten.length} Chinese guides): links, navigation, translation coverage, and language are valid.`,
);
