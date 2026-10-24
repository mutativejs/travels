import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(websiteRoot, '..');
const artifactsDir = resolve(websiteRoot, 'artifacts');
const staticRoot = resolve(artifactsDir, 'static-root');
const port = 7100;
const basePath = '/travels';
const baseUrl = `http://127.0.0.1:${port}${basePath}`;

await mkdir(artifactsDir, { recursive: true });
await rm(staticRoot, { recursive: true, force: true });
await mkdir(staticRoot, { recursive: true });
await symlink(resolve(repositoryRoot, 'docs-site'), resolve(staticRoot, 'travels'), 'dir');

const serverLog = createWriteStream(resolve(artifactsDir, 'production-server.log'));
const server = spawn(
  'pnpm',
  ['--dir', 'website', 'exec', 'serve', 'artifacts/static-root', '--listen', String(port), '--no-clipboard'],
  {
    cwd: repositoryRoot,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
server.stdout.pipe(serverLog, { end: false });
server.stderr.pipe(serverLog, { end: false });

let serverExited = false;
server.once('exit', () => {
  serverExited = true;
});

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (serverExited) throw new Error('The static server exited before becoming ready.');
    try {
      const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
    } catch {
      // The static server may still be starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`The static server did not become ready at ${baseUrl}.`);
}

async function stopServer() {
  if (!server.pid || serverExited) return;
  const exited = new Promise((resolveExit) => server.once('exit', resolveExit));
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  await Promise.race([
    exited,
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5000)),
  ]);
  if (!serverExited) {
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}

const errors = [];
const failedRequests = [];
const badResponses = [];
const checks = [];

function observe(page) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? 'unknown error';
    if (reason !== 'net::ERR_ABORTED') failedRequests.push(`${request.url()} — ${reason}`);
  });
  page.on('response', (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });
}

async function checkRoute(request, path, expectedText) {
  const response = await request.get(`${baseUrl}${path}`);
  assert.equal(response.status(), 200, `${path} should return 200`);
  const body = await response.text();
  assert.ok(body.includes(expectedText), `${path} should include ${expectedText}`);
  checks.push(`${basePath}${path}: 200`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  observe(page);

  let response = await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' });
  const logo = page.locator('header img.brand-logo').first();
  assert.ok(await logo.evaluate((image) => image.complete && image.naturalWidth > 0));
  assert.ok((await logo.getAttribute('src')).startsWith(`${basePath}/`));
  const ctaHref = await page.getByRole('link', { name: 'Get started', exact: true }).getAttribute('href');
  assert.equal(ctaHref, `${basePath}/docs/getting-started/quick-start/`);
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  assert.equal(ogImage, 'https://mutativejs.github.io/travels/og-image.png');
  await page.screenshot({ path: resolve(artifactsDir, 'production-home.png'), fullPage: false });
  checks.push('Production home, prefixed logo, CTA, assets, and social image');

  await page.getByRole('button', { name: /search/i }).first().click();
  const input = page.locator('input[placeholder]').last();
  await input.fill('transaction');
  await page.getByText('Transactions', { exact: false }).first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.keyboard.press('Escape');
  checks.push('Production static search');

  response = await page.goto(`${baseUrl}/docs/getting-started/quick-start/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await page.getByRole('heading', { name: 'Quick Start', level: 1 }).waitFor({ state: 'visible' });
  assert.ok(await page.locator('pre').count() > 0);
  checks.push('Production documentation route');

  await checkRoute(page.request, '/llms.txt', 'Travels');
  await checkRoute(page.request, '/llms-full.txt', 'Quick Start');
  await checkRoute(page.request, '/llms.mdx/docs/getting-started/quick-start/content.md', 'createTravels');
  await checkRoute(page.request, '/api/search', 'Transactions');

  await page.waitForTimeout(500);
  assert.deepEqual(errors, [], `Browser errors:\n${errors.join('\n')}`);
  assert.deepEqual(failedRequests, [], `Failed requests:\n${failedRequests.join('\n')}`);
  assert.deepEqual(badResponses, [], `Unsuccessful responses:\n${badResponses.join('\n')}`);

  await writeFile(
    resolve(artifactsDir, 'static-validation-report.json'),
    `${JSON.stringify({ status: 'passed', baseUrl, checks, errors, failedRequests, badResponses }, null, 2)}\n`,
  );
  console.log(`Passed ${checks.length} production checks at ${baseUrl}.`);
  await context.close();
} catch (error) {
  await writeFile(
    resolve(artifactsDir, 'static-validation-failure.txt'),
    `${error.stack ?? error}\n\nBrowser errors:\n${errors.join('\n')}\n\nFailed requests:\n${failedRequests.join('\n')}\n\nBad responses:\n${badResponses.join('\n')}\n`,
  );
  throw error;
} finally {
  if (browser) await browser.close();
  await stopServer();
  serverLog.end();
  await rm(staticRoot, { recursive: true, force: true });
}
