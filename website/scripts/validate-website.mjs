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

  const historyStack = page.getByRole('group', { name: 'Travels history stack' });
  const historySlider = historyStack.getByRole('slider', { name: 'History position' });
  const startPosition = Number(await historySlider.inputValue());
  await historyStack.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(Number(await historySlider.inputValue()), startPosition - 1, 'Undo should step the hero timeline back.');
  await page.keyboard.press('Control+Shift+KeyZ');
  assert.equal(Number(await historySlider.inputValue()), startPosition, 'The redo shortcut should restore the step.');
  await historyStack.getByRole('button', { name: 'Apply a new edit' }).click();
  assert.equal(Number(await historySlider.inputValue()), startPosition + 1, 'A new edit should extend the timeline.');
  checks.push('Hero history stack undo, redo shortcut, and new edit');

  const playground = page.getByRole('group', { name: 'Travels playground' });
  const playgroundSlider = playground.getByRole('slider', { name: 'Playground history position' });
  const scene = playground.getByRole('application', { name: /Block builder/ });
  const startingScene = await scene.getAttribute('aria-label');
  await scene.focus();
  await page.keyboard.press('Enter');
  assert.equal(await playgroundSlider.inputValue(), '1', 'Placing a block should archive one playground step.');
  assert.match(await playground.getByRole('tabpanel').innerText(), /add\s+\/columns\/x3y4/, 'The recorded patch should be listed.');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => document.querySelector('input[aria-label="Playground history position"]')?.value === '1',
    null,
    { timeout: 10_000 },
  );
  assert.match(await playground.locator('.pg-persist-status').innerText(), /Restored 1 step/);
  await playground.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await playgroundSlider.inputValue(), '0', 'Undo should remove the placed block.');
  await playground.getByRole('button', { name: 'Redo', exact: true }).click();
  await playground.getByRole('button', { name: 'Reset playground' }).click();
  assert.equal(await playgroundSlider.inputValue(), '0');
  assert.equal(await playgroundSlider.getAttribute('max'), '0');
  assert.equal(await scene.getAttribute('aria-label'), startingScene);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await playgroundSlider.getAttribute('max'), '0');
  assert.equal(await scene.getAttribute('aria-label'), startingScene);
  checks.push('Reset after a reload clears history and persists the starting scene');
  await checkNoOverflow(page, 'Desktop home after playground use');
  checks.push('Playground block placement, patch inspector, reload restore, and undo');

  const limitedStorage = await desktop.newPage();
  await limitedStorage.addInitScript(() => {
    const setItem = window.Storage.prototype.setItem;
    window.Storage.prototype.setItem = function (key, value) {
      if (key === 'travels:playground:history' && !window.sessionStorage.getItem('quota-restored')) {
        throw new window.DOMException('Storage is full', 'QuotaExceededError');
      }
      setItem.call(this, key, value);
    };
  });
  await limitedStorage.goto(baseUrl + '/', { waitUntil: 'networkidle' });
  const limitedGame = limitedStorage.getByRole('group', { name: 'Travels playground' });
  const limitedStatus = limitedGame.locator('.pg-persist-status');
  await limitedGame.getByRole('application', { name: /Block builder/ }).press('Enter');
  assert.equal(await limitedGame.getByRole('slider').inputValue(), '1');
  assert.match(await limitedStatus.innerText(), /Browser storage could not be updated/);
  await limitedStorage.evaluate(() => window.sessionStorage.setItem('quota-restored', '1'));
  await limitedGame.getByRole('application', { name: /Block builder/ }).press('Enter');
  await limitedGame.getByText(/saved in this browser/).waitFor();
  await limitedStorage.reload({ waitUntil: 'networkidle' });
  assert.equal(await limitedGame.getByRole('slider').inputValue(), '2');
  await limitedStorage.close();
  checks.push('Storage quota failure keeps editing available and a successful retry survives reload');

  const walkthrough = page.getByRole('group', { name: 'Quick start walkthrough' });
  await walkthrough.getByRole('button', { name: 'Run to step 3: back()' }).click();
  assert.match(await walkthrough.locator('.cw-result').innerText(), /getPosition\(\)\s+0/);
  assert.match(await walkthrough.locator('.cw-result').innerText(), /'Untitled'/);
  checks.push('Quick start walkthrough runs back()');

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

  response = await page.goto(`${baseUrl}/zh/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  await page.getByRole('heading', { name: /每一次改动/ }).waitFor({ state: 'visible' });
  await checkNoOverflow(page, 'Desktop Chinese home');
  await page.screenshot({ path: resolve(artifactsDir, 'home-zh-desktop.png'), fullPage: true });
  await page.locator('header').getByRole('button', { name: '选择语言' }).click();
  const languages = page.getByRole('dialog');
  await languages.getByRole('button', { name: '简体中文', exact: true }).waitFor({ state: 'visible' });
  await languages.getByRole('button', { name: 'English', exact: true }).click();
  await page.waitForURL(`${baseUrl}/`);
  checks.push('Chinese home, locale switching, and typography');

  response = await page.goto(`${baseUrl}/zh/docs/getting-started/quick-start/`, {
    waitUntil: 'networkidle',
  });
  assert.equal(response.status(), 200);
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  await page.getByRole('heading', { name: '快速开始', level: 1 }).waitFor({ state: 'visible' });
  assert.ok((await page.locator('pre').count()) > 0, 'Chinese Quick Start should contain code examples.');
  await page.getByRole('link', { name: '安装', exact: true }).first().waitFor({ state: 'visible' });
  await checkNoOverflow(page, 'Desktop Chinese documentation');
  await page.screenshot({ path: resolve(artifactsDir, 'quick-start-zh-desktop.png') });
  checks.push('Chinese Quick Start content, navigation, and code');

  response = await page.goto(`${baseUrl}/zh/docs/api-reference/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await page.getByRole('heading', { name: 'API 参考', level: 1 }).waitFor({ state: 'visible' });
  checks.push('Chinese API Reference');

  response = await page.goto(`${baseUrl}/zh/docs/api-reference/functions/createTravels/`, {
    waitUntil: 'networkidle',
  });
  assert.equal(response.status(), 200);
  await page.getByText('此页尚未提供中文译文').waitFor({ state: 'visible' });
  checks.push('Chinese API fallback notice');

  await checkRoute(page.request, '/zh/llms.txt', '快速开始');
  await checkRoute(page.request, '/zh/llms-full.txt', '快速开始');
  await checkRoute(
    page.request,
    '/zh/llms.mdx/docs/getting-started/quick-start/content.md',
    '快速开始',
  );
  await checkRoute(page.request, `/api/search?query=${encodeURIComponent('事务')}&locale=zh`, 'transactions');

  response = await page.goto(`${baseUrl}/zh/docs/getting-started/quick-start/`, {
    waitUntil: 'networkidle',
  });
  const sidebarLanguage = page.locator('#nd-sidebar').getByRole('button', { name: '选择语言' });
  assert.equal(await sidebarLanguage.innerText(), '简体中文');
  await sidebarLanguage.click();
  await languages.getByRole('button', { name: 'English', exact: true }).click();
  await page.waitForURL(`${baseUrl}/docs/getting-started/quick-start/`);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  checks.push('Chinese to English docs switch preserves the page');

  const missing = await page.request.get(`${baseUrl}/zh/docs/this-page-is-missing/`);
  assert.equal(missing.status(), 404, 'Unknown Chinese documentation should return 404');
  checks.push('Chinese 404 status');

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
  const mobileLanguage = mobilePage.locator('header').getByRole('button', { name: 'Choose a language' });
  for (const width of [320, 640, 390]) {
    await mobilePage.setViewportSize({ width, height: 844 });
    await mobileLanguage.waitFor({ state: 'visible' });
    await checkNoOverflow(mobilePage, `Mobile navigation at ${width}px`);
  }
  await mobileLanguage.click();
  const mobileLanguages = mobilePage.getByRole('dialog');
  await mobileLanguages.getByRole('button', { name: '简体中文', exact: true }).click();
  await mobilePage.waitForURL(`${baseUrl}/zh/`);
  await mobilePage.getByRole('heading', { name: /每一次改动/ }).waitFor({ state: 'visible' });
  checks.push('Mobile home navigation and language switch');

  response = await mobilePage.goto(`${baseUrl}/docs/getting-started/quick-start/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await mobilePage.getByRole('heading', { name: 'Quick Start', level: 1 }).waitFor({ state: 'visible' });
  await checkNoOverflow(mobilePage, 'Mobile documentation');
  await mobilePage.screenshot({ path: resolve(artifactsDir, 'quick-start-mobile.png'), fullPage: false });
  const docsMenu = mobilePage.locator('button[aria-label*="sidebar" i], button[aria-label*="menu" i], button[aria-label*="navigation" i]').first();
  await docsMenu.waitFor({ state: 'visible' });
  await docsMenu.click();
  await mobilePage.getByRole('link', { name: 'Quick Start', exact: true }).last().waitFor({ state: 'visible' });
  await mobilePage.locator('#nd-sidebar-mobile').getByRole('button', { name: 'Choose a language' }).click();
  await mobileLanguages.getByRole('button', { name: '简体中文', exact: true }).click();
  await mobilePage.waitForURL(`${baseUrl}/zh/docs/getting-started/quick-start/`);
  await mobilePage.getByRole('heading', { name: '快速开始', level: 1 }).waitFor({ state: 'visible' });
  checks.push('Mobile documentation, navigation, and language switch');

  response = await mobilePage.goto(`${baseUrl}/zh/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await mobilePage.getByRole('heading', { name: /每一次改动/ }).waitFor({ state: 'visible' });
  await checkNoOverflow(mobilePage, 'Mobile Chinese home');
  const mobileMenuZh = mobilePage
    .locator('button[aria-label*="菜单" i], button[aria-label*="menu" i], button[aria-label*="navigation" i]')
    .first();
  await mobileMenuZh.waitFor({ state: 'visible' });
  await mobileMenuZh.click();
  await mobilePage.getByRole('link', { name: '文档', exact: true }).last().waitFor({ state: 'visible' });
  await mobilePage.keyboard.press('Escape');
  checks.push('Mobile Chinese home and navigation');

  response = await mobilePage.goto(`${baseUrl}/zh/docs/getting-started/quick-start/`, {
    waitUntil: 'networkidle',
  });
  assert.equal(response.status(), 200);
  await mobilePage.getByRole('heading', { name: '快速开始', level: 1 }).waitFor({ state: 'visible' });
  await checkNoOverflow(mobilePage, 'Mobile Chinese documentation');
  await mobilePage.screenshot({ path: resolve(artifactsDir, 'quick-start-zh-mobile.png') });
  checks.push('Mobile Chinese documentation');
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
