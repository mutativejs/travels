import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentRoot = join(websiteRoot, 'content/docs');
const errors = [];

function filesUnder(directory, extensions) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path, extensions);
    return entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });
}

function docsPageExists(url) {
  const clean = url.split('#')[0].split('?')[0].replace(/\/$/, '');
  if (!clean.startsWith('/docs')) return true;
  const slug = clean.slice('/docs'.length).replace(/^\//, '');
  const target = join(contentRoot, slug);
  return existsSync(`${target}.mdx`) || existsSync(join(target, 'index.mdx'));
}

const contentFiles = filesUnder(contentRoot, ['.mdx']);
for (const file of contentFiles) {
  const source = readFileSync(file, 'utf8');
  const relative = file.slice(websiteRoot.length + 1);

  if (/Hello World|My App|Your first document|Lorem ipsum/.test(source)) {
    errors.push(`${relative}: template placeholder text remains`);
  }
  if (/[㐀-鿿]/.test(source)) {
    errors.push(`${relative}: non-English CJK text detected`);
  }

  for (const match of source.matchAll(/\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    if (target.startsWith('/docs')) {
      if (!docsPageExists(target)) errors.push(`${relative}: broken docs link ${target}`);
    } else if (!target.startsWith('/') && /\.mdx?(?:#|$)/.test(target)) {
      const path = resolve(dirname(file), target.split('#')[0]);
      if (!existsSync(path)) errors.push(`${relative}: broken relative link ${target}`);
    }
  }
}

for (const file of filesUnder(contentRoot, ['meta.json'])) {
  const meta = JSON.parse(readFileSync(file, 'utf8'));
  for (const page of meta.pages ?? []) {
    if (typeof page !== 'string' || page.startsWith('---')) continue;
    const target = join(dirname(file), page);
    if (!existsSync(`${target}.mdx`) && !existsSync(`${target}.json`) && !existsSync(target)) {
      errors.push(`${file.slice(websiteRoot.length + 1)}: missing navigation item ${page}`);
    }
  }
}

for (const file of filesUnder(join(websiteRoot, 'app'), ['.tsx']).concat(filesUnder(join(websiteRoot, 'components'), ['.tsx']))) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/href\s*[:=]\s*['"](\/docs[^'"]*)['"]/g)) {
    if (!docsPageExists(match[1])) {
      errors.push(`${file.slice(websiteRoot.length + 1)}: broken docs link ${match[1]}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Checked ${contentFiles.length} documentation pages: links, navigation, and language are valid.`);
