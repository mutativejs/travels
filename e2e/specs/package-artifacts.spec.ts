import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('fixture imports the package ESM entry in a browser app', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('package-ready')).toHaveText('esm-ready:1');
});

test('the built package exposes a working CommonJS entry', () => {
  const script = `
    const { createTravels } = require('travels');
    const travels = createTravels({ count: 0 });
    travels.setState((draft) => { draft.count = 1; });
    travels.back();
    if (travels.getState().count !== 0) {
      throw new Error('CommonJS entry did not preserve undo behavior');
    }
  `;

  execFileSync(process.execPath, ['-e', script], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
});

test('npm pack includes publishable artifacts and excludes test sources', () => {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const [pack] = JSON.parse(output) as Array<{
    files: Array<{ path: string }>;
  }>;
  const files = pack.files.map((file) => file.path);

  expect(files).toContain('dist/index.esm.js');
  expect(files).toContain('dist/index.cjs');
  expect(files).toContain('dist/index.d.ts');
  expect(files).toContain('docs/persistence-integrations.md');
  expect(files).toContain('src/index.ts');
  expect(files).not.toContain('test/index.test.ts');
  expect(files).not.toContain('e2e/specs/package-artifacts.spec.ts');
});
