// Runs against an isolated, seeded application, never a production database.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const tools = process.env.UI_QA_TOOLS;
const output = process.env.UI_OUTPUT_DIR;
if (!tools || !output) throw new Error('Set UI_QA_TOOLS and UI_OUTPUT_DIR.');
const requireTool = createRequire(resolve(tools, 'package.json'));
const { chromium } = requireTool('playwright');
const axePath = requireTool.resolve('axe-core/axe.min.js');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:3000';
const results = [];
const failures = [];
await mkdir(output, { recursive: true });

async function ready() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(base + '/en');
      if (response.ok) return;
    } catch {
      // The production server may still be starting.
    }
    await delay(1000);
  }
  throw new Error('Application did not become ready.');
}

async function run(name, work) {
  try {
    await work();
    results.push({ name, passed: true });
    console.log('PASS ' + name);
  } catch (error) {
    failures.push({ name, message: String(error) });
    results.push({ name, passed: false });
    console.error('FAIL ' + name + ': ' + String(error));
  }
}

async function openPrice(page, locale = 'en', asset = 'ebike-003') {
  await page.goto(base + '/' + locale + '/lease/' + asset);
  await page.locator('#demo-customer').selectOption('cust-aino');
  await page.locator('#down').waitFor();
  await page.locator('#demo-date').fill('2026-11-05');
  await page.locator('#down').waitFor();
  await page.locator('#term-select').selectOption('36');
  await page.locator('#down').fill('0');
  await page.locator('#start').fill('2026-11-05');
  await page.locator('.price-headline').waitFor();
}

async function reflow(page) {
  const dimensions = await page.evaluate(() => {
    const root = globalThis.document.documentElement;
    return { width: root.clientWidth, content: root.scrollWidth };
  });
  assert.ok(
    dimensions.content <= dimensions.width + 1,
    'Page overflows: ' + JSON.stringify(dimensions)
  );
}

async function audit(page, name) {
  await page.addScriptTag({ path: axePath });
  const report = await page.evaluate(async () =>
    globalThis.axe.run(globalThis.document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    })
  );
  await writeFile(resolve(output, name + '-axe.json'), JSON.stringify(report, null, 2));
  assert.equal(
    report.violations.length,
    0,
    JSON.stringify(
      report.violations.map((item) => ({
        id: item.id,
        impact: item.impact,
        nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
      }))
    )
  );
}

await ready();
const browser = await chromium.launch();
try {
  for (const locale of ['en', 'fi', 'sv', 'et']) {
    for (const colorScheme of ['light', 'dark']) {
      for (const width of [320, 1280]) {
        const name = [locale, colorScheme, width].join('-');
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          colorScheme,
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        await run(name, async () => {
          await openPrice(page, locale);
          assert.equal(await page.locator('html').getAttribute('lang'), locale);
          assert.match(await page.locator('.price-headline').innerText(), /134[.,]66/);
          assert.equal(await page.locator('.comparison-option').count(), 2);
          await reflow(page);
          await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
          await audit(page, name);
          if (width === 320) {
            await page.goto(base + '/' + locale);
            assert.equal(await page.locator('.catalogue-card').count(), 30);
            await reflow(page);
            await page.screenshot({
              path: resolve(output, name + '-catalogue.png'),
              fullPage: true,
            });
            await audit(page, name + '-catalogue');
          }
          assert.deepEqual(errors, []);
        });
        await context.close();
      }
    }
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  let quoteWrites = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/quotes'))
      quoteWrites += 1;
  });

  await run('keyboard-errors-comparison-and-locale', async () => {
    await openPrice(page);
    const slider = page.locator('#term');
    await slider.focus();
    await slider.press('ArrowLeft');
    assert.equal(await page.locator('#term-select').inputValue(), '24');
    const focus = await slider.evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    assert.equal(focus.width, '3px');
    assert.notEqual(focus.style, 'none');
    const summary = page.locator('.price-calculation details > summary');
    await summary.focus();
    await summary.press('Space');
    assert.equal(await page.locator('.price-calculation details').getAttribute('open'), '');
    await page.locator('#down').fill('invalid');
    await page.locator('#price-feedback').waitFor();
    assert.equal(await page.locator('#save-quote').isDisabled(), true);
    assert.equal(await page.locator('.price-summary').count(), 0);
    await page.locator('#down').fill('100');
    await page.locator('.price-summary').waitFor();
    await page.locator('.comparison-option').nth(1).locator('button').click();
    assert.equal(await page.locator('#term-select').inputValue(), '36');
    assert.equal(quoteWrites, 0, 'Changing comparison must not create an offer.');
    await page.locator('header nav a[lang="fi"]').click();
    await page.locator('#down').waitFor();
    assert.equal(await page.locator('#down').inputValue(), '100');
    assert.equal(await page.locator('#term-select').inputValue(), '36');
    await reflow(page);
  });

  await run('financing-band-warning', async () => {
    await openPrice(page, 'en', 'laptop-003');
    await page.locator('#down').fill('0.01');
    const warning = page.locator('#down-band-help');
    assert.match(await warning.innerText(), /2[.,]08/);
    assert.match(await page.locator('.price-headline').innerText(), /57[.,]25/);
    await reflow(page);
  });

  await run('large-amount-and-enlarged-text', async () => {
    await openPrice(page, 'en', 'farm-002');
    await page.locator('#term-select').selectOption('48');
    await page.locator('#down').fill('20000');
    await page.locator('.price-headline').waitFor();
    await page.setViewportSize({ width: 320, height: 900 });
    await reflow(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await reflow(page);
    await page.screenshot({ path: resolve(output, 'large-text.png'), fullPage: true });
  });

  await run('forced-colours-and-saving', async () => {
    await openPrice(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await reflow(page);
    await page.screenshot({ path: resolve(output, 'forced-colours.png'), fullPage: true });
    const response = page.waitForResponse(
      (item) =>
        item.request().method() === 'POST' && new URL(item.url()).pathname.endsWith('/quotes')
    );
    await page.locator('#save-quote').click();
    assert.ok((await response).ok());
    await page.locator('#save-quote').waitFor({ state: 'detached' });
    assert.match(await page.locator('.price-headline').innerText(), /134[.,]66/);
    assert.equal(quoteWrites, 1);
    await page.reload();
    await page.locator('.price-headline').waitFor();
    assert.match(await page.locator('.price-headline').innerText(), /134[.,]66/);
  });
  await context.close();
} finally {
  await browser.close();
  await writeFile(
    resolve(output, 'summary.json'),
    JSON.stringify({ results, failures, revision: process.env.GITHUB_SHA || null }, null, 2)
  );
}

if (failures.length) throw new Error(failures.length + ' UI checks failed. See summary.json.');
console.log(
  'All ' + results.length + ' UI checks passed. Manual assistive testing is still needed.'
);
