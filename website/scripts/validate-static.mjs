import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
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

  const historyStack = page.getByRole('group', { name: 'Travels history stack' });
  const historySlider = historyStack.getByRole('slider', { name: 'History position' });
  const startPosition = Number(await historySlider.inputValue());
  await historyStack.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(Number(await historySlider.inputValue()), startPosition - 1);
  checks.push('Production hero history stack');

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

  response = await page.goto(`${baseUrl}/zh/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  await page.getByRole('heading', { name: /每一次改动/ }).waitFor({ state: 'visible' });
  await page.screenshot({ path: resolve(artifactsDir, 'production-home-zh.png') });
  await page.locator('header').getByRole('button', { name: '选择语言' }).click();
  const languages = page.getByRole('dialog');
  await languages.getByRole('button', { name: 'English', exact: true }).click();
  await page.waitForURL(`${baseUrl}/`);
  await page.getByRole('heading', { name: /Every change/ }).waitFor({ state: 'visible' });
  checks.push('Production Chinese home, language attributes, and prefixed switch');

  response = await page.goto(`${baseUrl}/zh/docs/getting-started/quick-start/`, {
    waitUntil: 'networkidle',
  });
  assert.equal(response.status(), 200);
  await page.getByRole('heading', { name: '快速开始', level: 1 }).waitFor({ state: 'visible' });
  assert.ok((await page.locator('pre').count()) > 0);
  await page.locator('#nd-sidebar').getByRole('button', { name: '选择语言' }).click();
  await languages.getByRole('button', { name: 'English', exact: true }).click();
  await page.waitForURL(`${baseUrl}/docs/getting-started/quick-start/`);
  await page.getByRole('heading', { name: 'Quick Start', level: 1 }).waitFor({ state: 'visible' });
  checks.push('Production Chinese documentation and prefixed language switch');

  await checkRoute(page.request, '/zh/llms.txt', '快速开始');
  await checkRoute(page.request, '/zh/llms-full.txt', '快速开始');
  await checkRoute(
    page.request,
    '/zh/llms.mdx/docs/getting-started/quick-start/content.md',
    '快速开始',
  );
  await checkRoute(page.request, '/zh/docs/api-reference/', 'API 参考');

  for (const [path, canonical, fallback] of [
    ['/docs/getting-started/quick-start/', '/docs/getting-started/quick-start/', false],
    ['/zh/docs/getting-started/quick-start/', '/zh/docs/getting-started/quick-start/', false],
    ['/docs/api-reference/functions/createTravels/', '/docs/api-reference/functions/createTravels/', false],
    ['/zh/docs/api-reference/functions/createTravels/', '/docs/api-reference/functions/createTravels/', true],
  ]) {
    await page.goto(baseUrl + path);
    assert.equal(await page.locator('meta[name="robots"][content*="noindex" i]').count(), Number(fallback), path);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),
      'https://mutativejs.github.io/travels' + canonical);
  }
  checks.push('Only Chinese fallback pages request noindex and canonicalize to English');

  const { version } = createRequire(import.meta.url)('travels/package.json');
  const restoreReference = await page.request.get(baseUrl + '/llms.mdx/docs/api-reference/type-aliases/RestoreTravelsOptions/content.md');
  assert.equal(restoreReference.status(), 200);
  const referenceText = await restoreReference.text();
  assert.ok(referenceText.includes(`/blob/v${version}/src/restoreTravels.ts#L`));
  if (version === '3.0.1') assert.doesNotMatch(referenceText, /### validation/);
  checks.push('Restore API reference matches the published package and release tag');

  for (const prefix of ['', '/zh']) {
    for (const [slug, filename] of [
      ['api-reference/type-aliases/RestoreTravelsOptions', 'src/restoreTravels.ts'],
      ['getting-started/quick-start', `website/content/docs${prefix}/getting-started/quick-start.mdx`],
    ]) {
      await page.goto(`${baseUrl}${prefix}/docs/${slug}/`);
      await page.getByRole('button', { name: prefix ? '打开' : 'Open', exact: true }).click();
      const href = await page.getByRole('dialog').getByRole('link', { name: /GitHub/i }).getAttribute('href');
      const generated = slug.startsWith('api-reference/');
      const expectedRef = generated ? 'v' + version : 'main';
      assert.equal(new URL(href).pathname, `/mutativejs/travels/blob/${expectedRef}/${filename}`);
      if (generated) {
        assert.match(new URL(href).hash, /^#L\d+$/);
        const peer = page.locator('#nd-page .prose a').filter({ hasText: 'TravelsOptions' }).first();
        assert.equal(await peer.getAttribute('href'), `${basePath}${prefix}/docs/api-reference/type-aliases/TravelsOptions/`);
      }
    }
  }
  checks.push('GitHub actions link to release sources or tracked guide files in both languages');

  const missing = await page.request.get(`${baseUrl}/zh/docs/does-not-exist/`);
  assert.equal(missing.status(), 404);
  await checkRoute(page.request, '/404.html', 'Travels');
  checks.push('Production Chinese 404 and LLM routes');

  await page.goto(`${baseUrl}/404.html`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Choose a language' }).click();
  await languages.getByRole('button', { name: '简体中文', exact: true }).click();
  await page.waitForURL(`${baseUrl}/zh/`);
  await page.getByRole('heading', { name: /每一次改动/ }).waitFor({ state: 'visible' });
  checks.push('Production 404 language switch opens the localized home');

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
