import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(websiteRoot, '..');
const artifactsDir = resolve(websiteRoot, 'artifacts');
const port = 7100;
const origin = `http://127.0.0.1:${port}`;
const basePath = process.env.VALIDATE_BASE_PATH ?? '';
const baseUrl = `${origin}${basePath}`;

await mkdir(artifactsDir, { recursive: true });

const serverLog = createWriteStream(resolve(artifactsDir, 'development-server.log'));
const server = spawn(
  'pnpm',
  ['--dir', 'website', 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
  {
    cwd: repositoryRoot,
    detached: true,
    env: { ...process.env, BASE_PATH: '' },
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
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (serverExited) throw new Error('The development server exited before becoming ready.');
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
    } catch {
      // Next.js may still be compiling.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`The development server did not become ready at ${baseUrl}.`);
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

const browserErrors = [];
const failedRequests = [];
const checks = [];

function observe(page, name) {
  page.on('pageerror', (error) => browserErrors.push(`${name}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`${name}: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? 'unknown error';
    if (reason !== 'net::ERR_ABORTED') {
      failedRequests.push(`${name}: ${request.method()} ${request.url()} — ${reason}`);
    }
  });
}

async function checkNoOverflow(page, name) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.document <= dimensions.viewport + 1,
    `${name} overflows horizontally: ${JSON.stringify(dimensions)}`,
  );
}

async function checkRoute(request, path, expectedText) {
  const response = await request.get(`${baseUrl}${path}`);
  assert.equal(response.status(), 200, `${path} should return 200`);
  const body = await response.text();
  assert.ok(body.length > 100, `${path} should return a substantive response`);
  if (expectedText) assert.ok(body.includes(expectedText), `${path} should include ${expectedText}`);
  checks.push(`${path}: 200`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    permissions: ['clipboard-read', 'clipboard-write'],
    reducedMotion: 'reduce',
  });
  const page = await desktop.newPage();
  observe(page, 'desktop');

  let response = await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  assert.match(await page.title(), /Travels/);
  const heading = page.getByRole('heading', { level: 1 });
  assert.match((await heading.innerText()).replace(/\s+/g, ' '), /Every change\. A way back\./);
  await page.getByRole('link', { name: 'Get started', exact: true }).waitFor({ state: 'visible' });
  const logo = page.locator('header img.brand-logo').first();
  await logo.waitFor({ state: 'visible' });
  assert.ok(await logo.evaluate((image) => image.complete && image.naturalWidth > 0), 'The brand logo must load.');
  await checkNoOverflow(page, 'Desktop home');
  await page.screenshot({ path: resolve(artifactsDir, 'home-desktop.png'), fullPage: true });
  checks.push('Desktop home, hero, logo, and CTA');

  const copyButton = page.getByRole('button', { name: 'Copy', exact: true }).first();
  await copyButton.click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'pnpm add travels mutative');
  checks.push('Install command copy');

  const searchButton = page.getByRole('button', { name: /search/i }).first();
  await searchButton.click();
  const searchInput = page.locator('input[placeholder]').last();
  await searchInput.waitFor({ state: 'visible' });
  await searchInput.fill('transaction');
  await page.getByText('Transactions', { exact: false }).first().waitFor({ state: 'visible', timeout: 15_000 });
  checks.push('Static search finds Transactions');
  await page.keyboard.press('Escape');

  const themeButton = page.locator('button[aria-label*="theme" i]').first();
  await themeButton.waitFor({ state: 'visible' });
  await themeButton.click();
  await page.locator('html.dark').waitFor({ state: 'attached' });
  await page.waitForTimeout(750);
  await page.screenshot({ path: resolve(artifactsDir, 'home-dark.png'), fullPage: true });
  checks.push('Dark theme toggle');
  await themeButton.click();
  await page.locator('html:not(.dark)').waitFor({ state: 'attached' });
  await page.waitForTimeout(750);

  response = await page.goto(`${baseUrl}/docs/getting-started/quick-start/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await page.getByRole('heading', { name: 'Quick Start', level: 1 }).waitFor({ state: 'visible' });
  assert.ok(await page.locator('pre').count() > 0, 'Quick Start should contain code examples.');
  assert.ok(await page.locator('aside').count() > 0, 'Docs sidebar should be present.');
  await page.getByRole('link', { name: 'Installation', exact: true }).first().waitFor({ state: 'visible' });
  await checkNoOverflow(page, 'Desktop documentation');
  await page.screenshot({ path: resolve(artifactsDir, 'quick-start-desktop.png'), fullPage: false });
  checks.push('Quick Start content, navigation, and code');

  response = await page.goto(`${baseUrl}/docs/api-reference/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await page.getByRole('heading', { name: 'API Reference', level: 1 }).waitFor({ state: 'visible' });
  assert.ok((await page.locator('main').innerText()).includes('createTravels'));
  await page.screenshot({ path: resolve(artifactsDir, 'api-reference-desktop.png'), fullPage: false });
  checks.push('Generated API Reference');

  await checkRoute(page.request, '/llms.txt', 'Travels');
  await checkRoute(page.request, '/llms-full.txt', 'Quick Start');
  await checkRoute(page.request, '/llms.mdx/docs/getting-started/quick-start/content.md', 'createTravels');
  await checkRoute(page.request, '/api/search?query=transaction', 'Transactions');
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const mobilePage = await mobile.newPage();
  observe(mobilePage, 'mobile');
  response = await mobilePage.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await mobilePage.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' });
  await checkNoOverflow(mobilePage, 'Mobile home');
  await mobilePage.screenshot({ path: resolve(artifactsDir, 'home-mobile.png'), fullPage: true });

  const mobileMenu = mobilePage.locator('button[aria-label*="menu" i], button[aria-label*="navigation" i]').first();
  await mobileMenu.waitFor({ state: 'visible' });
  await mobileMenu.click();
  await mobilePage.getByRole('link', { name: 'Documentation', exact: true }).last().waitFor({ state: 'visible' });
  await mobilePage.keyboard.press('Escape');
  checks.push('Mobile home and navigation');

  response = await mobilePage.goto(`${baseUrl}/docs/getting-started/quick-start/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await mobilePage.getByRole('heading', { name: 'Quick Start', level: 1 }).waitFor({ state: 'visible' });
  await checkNoOverflow(mobilePage, 'Mobile documentation');
  await mobilePage.screenshot({ path: resolve(artifactsDir, 'quick-start-mobile.png'), fullPage: false });
  const docsMenu = mobilePage.locator('button[aria-label*="sidebar" i], button[aria-label*="menu" i], button[aria-label*="navigation" i]').first();
  await docsMenu.waitFor({ state: 'visible' });
  await docsMenu.click();
  await mobilePage.getByRole('link', { name: 'Quick Start', exact: true }).last().waitFor({ state: 'visible' });
  checks.push('Mobile documentation and navigation');
  await mobile.close();

  assert.deepEqual(browserErrors, [], `Browser errors:\n${browserErrors.join('\n')}`);
  assert.deepEqual(failedRequests, [], `Failed requests:\n${failedRequests.join('\n')}`);

  const report = {
    status: 'passed',
    baseUrl,
    checks,
    browserErrors,
    failedRequests,
  };
  await writeFile(resolve(artifactsDir, 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Passed ${checks.length} browser checks. Screenshots: ${artifactsDir}`);
} catch (error) {
  await writeFile(
    resolve(artifactsDir, 'validation-failure.txt'),
    `${error.stack ?? error}\n\nBrowser errors:\n${browserErrors.join('\n')}\n\nFailed requests:\n${failedRequests.join('\n')}\n`,
  );
  throw error;
} finally {
  if (browser) await browser.close();
  await stopServer();
  serverLog.end();
}
