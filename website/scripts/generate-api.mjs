import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync, mkdtempSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(websiteRoot, '..');
const require = createRequire(import.meta.url);
const packageManifest = require.resolve('travels/package.json');
const packageRoot = dirname(packageManifest);
const { version } = require(packageManifest);
const entryPoint = join(packageRoot, 'src/index.ts');
const scratchRoot = join(websiteRoot, '.generated-api');
const targetRoot = join(websiteRoot, 'content/docs/api-reference');
const groups = ['functions', 'classes', 'interfaces', 'type-aliases', 'variables'];

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

function generatePages(temporaryOutput) {
  const output = new Map();
  let pageCount = 0;
  const activeGroups = [];
  for (const group of groups) {
    const sourceDirectory = join(temporaryOutput, group);
    const files = listMarkdownFiles(sourceDirectory);
    const targetDirectory = join(targetRoot, group);
    if (files.length === 0) continue;
    activeGroups.push(group);

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
      output.set(
        outputPath,
        `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(`Travels ${version}. ${description}`)}\n---\n\n${body.trim()}\n`
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
    output.set(
      join(targetDirectory, 'meta.json'),
      `${JSON.stringify({ title: titles[group], pages }, null, 2)}\n`
    );
  }

  output.set(
    join(targetRoot, 'meta.json'),
    `${JSON.stringify({ title: 'API Reference', pages: ['index', ...activeGroups] }, null, 2)}\n`
  );
  return { output, pageCount };
}

// Publish complete files so another check or a running dev server always
// sees readable pages. Remove obsolete entries only after navigation is ready.
function publishPages(output, workDir) {
  const staged = join(workDir, 'page.tmp');
  for (const [file, content] of output) {
    if (existsSync(file) && readFileSync(file, 'utf8') === content) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(staged, content);
    renameSync(staged, file);
  }
  for (const group of groups) {
    const directory = join(targetRoot, group);
    if (!existsSync(directory)) continue;
    for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const file = join(entry.parentPath, entry.name);
      if (!output.has(file)) rmSync(file, { force: true });
    }
  }
}

mkdirSync(scratchRoot, { recursive: true });
const workDir = mkdtempSync(join(scratchRoot, 'run-'));
try {
  const temporaryOutput = join(workDir, 'typedoc');
  const tsconfig = join(workDir, 'tsconfig.json');
  writeFileSync(tsconfig, JSON.stringify({
    extends: join(repositoryRoot, 'tsconfig.json'),
    compilerOptions: { types: ['node'] },
    files: [entryPoint],
    include: [],
  }));
  const result = spawnSync(
    process.execPath,
    [join(repositoryRoot, 'node_modules/typedoc/bin/typedoc'),
      '--plugin', 'typedoc-plugin-markdown', '--out', temporaryOutput,
      '--readme', 'none', '--tsconfig', tsconfig, '--basePath', packageRoot,
      '--disableGit', '--sourceLinkTemplate',
      `https://github.com/mutativejs/travels/blob/v${version}/{path}#L{line}`, entryPoint],
    { cwd: repositoryRoot, stdio: 'inherit' }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  } else {
    const { output, pageCount } = generatePages(temporaryOutput);
    publishPages(output, workDir);
    console.log(`Generated ${pageCount} API reference pages for travels@${version}.`);
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
