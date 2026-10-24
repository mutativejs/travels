import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const output = resolve(repositoryRoot, 'website/out');
const destination = resolve(repositoryRoot, 'docs-site');

if (!existsSync(output)) {
  throw new Error('Website output not found. Run the Fumadocs build first.');
}

rmSync(destination, { recursive: true, force: true });
cpSync(output, destination, { recursive: true });
writeFileSync(resolve(destination, '.nojekyll'), '');
console.log('Synced Fumadocs static export to docs-site/.');
