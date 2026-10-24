import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(websiteRoot, '..');
const temporaryOutput = join(websiteRoot, '.generated-api');
const targetRoot = join(websiteRoot, 'content/docs/api-reference');
const groups = ['functions', 'classes', 'interfaces', 'type-aliases', 'variables'];

rmSync(temporaryOutput, { recursive: true, force: true });

const result = spawnSync(
  'pnpm',
  [
    '--dir',
    repositoryRoot,
    'exec',
    'typedoc',
    '--plugin',
    'typedoc-plugin-markdown',
    '--out',
    temporaryOutput,
    '--readme',
    'none',
    'src/index.ts',
  ],
  { stdio: 'inherit', shell: false }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const descriptions = {
  createTravels: 'Create a state-owning timeline with automatic or manual archiving.',
  createPatchableTravels: 'Create a timeline constrained to the durable JSON-shaped state contract.',
  createTravelJournal: 'Record history for a runtime that already owns state and patches.',
  restoreTravels: 'Restore a complete validated Travels history snapshot.',
  restoreTravelJournal: 'Restore a controlled journal from a complete history snapshot.',
  isTravels: 'Detect a state-owning timeline created by this copy of Travels.',
  assertTravelHistoryEntryRecordable: 'Preflight a controlled patch pair before an external commit.',
  validateTravelPatches: 'Validate JSON Patch structure and retained patch values.',
  validateTravelHistoryEntry: 'Validate a forward and inverse history entry.',
  findStateCompatibilityIssues: 'Inspect state, patches, and metadata for persistence hazards.',
  Travels: 'Persistence namespace, serialized history, and core timeline types.',
};

function titleFromHeading(heading) {
  return heading
    .replace(/^# (Function|Class|Interface|Type Alias|Variable):\s*/, '')
    .replace(/\\</g, '<')
    .replace(/\\>/g, '>');
}

function plainName(title) {
  return title.replace(/\(.*/, '').replace(/<.*/, '');
}

function listMarkdownFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(path);
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  });
}

let pageCount = 0;
for (const group of groups) {
  const sourceDirectory = join(temporaryOutput, group);
  const files = listMarkdownFiles(sourceDirectory);
  const targetDirectory = join(targetRoot, group);
  rmSync(targetDirectory, { recursive: true, force: true });
  if (files.length === 0) continue;
  mkdirSync(targetDirectory, { recursive: true });

  const pages = [];
  for (const file of files) {
    const markdown = readFileSync(file, 'utf8');
    const lines = markdown.split('\n');
    const headingIndex = lines.findIndex((line) => /^# (Function|Class|Interface|Type Alias|Variable):/.test(line));
    if (headingIndex === -1) continue;

    const title = titleFromHeading(lines[headingIndex]);
    const name = plainName(title);
    const description = descriptions[name] ?? `Travels 3 API reference for ${name}.`;
    const body = lines
      .slice(headingIndex + 1)
      .join('\n')
      .replace(/^(?:\s|\*\*\*)+/, '')
      .replace(/\.md(?=[)#])/g, '.mdx')
      .replace(/\]\([^)]*globals\.mdx[^)]*\)/g, '](/docs/api-reference)')
      .replace(/\]\([^)]*README\.mdx[^)]*\)/g, '](/docs)');

    const relativePath = relative(sourceDirectory, file).replace(/\.md$/, '.mdx');
    const outputPath = join(targetDirectory, relativePath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(
      outputPath,
      `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n\n${body.trim()}\n`
    );
    pages.push(relativePath.replace(/\.mdx$/, '').replaceAll('\\', '/'));
    pageCount += 1;
  }

  const titles = {
    functions: 'Functions',
    classes: 'Classes',
    interfaces: 'Interfaces',
    'type-aliases': 'Type Aliases',
    variables: 'Variables',
  };
  pages.sort((a, b) => a.localeCompare(b));
  writeFileSync(
    join(targetDirectory, 'meta.json'),
    `${JSON.stringify({ title: titles[group], pages }, null, 2)}\n`
  );
}

writeFileSync(
  join(targetRoot, 'meta.json'),
  `${JSON.stringify({ title: 'API Reference', pages: ['index', ...groups.filter((group) => existsSync(join(targetRoot, group)))] }, null, 2)}\n`
);

rmSync(temporaryOutput, { recursive: true, force: true });
console.log(`Generated ${pageCount} Fumadocs API reference pages.`);
