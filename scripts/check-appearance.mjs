// Browser-only preference checks against the isolated synthetic demo.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const tools = process.env.UI_QA_TOOLS;
const output = process.env.UI_OUTPUT_DIR;
if (!tools || !output) throw new Error('Set UI_QA_TOOLS and UI_OUTPUT_DIR.');
const requireTool = createRequire(resolve(tools, 'package.json'));
const { chromium } = requireTool('playwright');
const axePath = requireTool.resolve('axe-core/axe.min.js');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:3000';
const key = 'lease-loop-appearance-v1';
const results = [];
const browser = await chromium.launch();
await mkdir(output, { recursive: true });

async function run(name, options, work) {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydration|did not match/i.test(message.text()))
      errors.push(message.text());
  });
  try {
    await work(page, context);
    assert.deepEqual(errors, [], 'Browser errors');
    results.push({ name, passed: true });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.error('FAIL ' + name + ': ' + String(error));
    await page
      .screenshot({ path: resolve(output, name + '-failure.png'), fullPage: true })
      .catch(() => {});
  } finally {
    await context.close();
  }
}

async function price(page, locale = 'en') {
  await page.goto(base + '/' + locale + '/lease/ebike-003');
  await page.locator('#demo-customer').selectOption('cust-aino');
  await page.locator('#demo-date').fill('2026-11-05');
  await page.locator('#term-select').selectOption('36');
  await page.locator('#down').fill('0');
  await page.locator('#start').fill('2026-11-05');
  await page.locator('.price-headline').waitFor();
}

async function choose(page, design, mode) {
  if (!(await page.locator('.appearance').evaluate((el) => el.open)))
    await page.locator('.appearance-trigger').click();
  await page.locator(`input[name="appearance-design"][value="${design}"]`).check();
  await page.locator(`input[name="appearance-mode"][value="${mode}"]`).check();
  await page.locator('.appearance-trigger').press('Escape');
}

async function theme(page, design, mode, resolved) {
  const backgrounds = {
    green: { light: 'rgb(247, 248, 241)', dark: 'rgb(14, 32, 26)' },
    northfina: { light: 'rgb(255, 255, 255)', dark: 'rgb(8, 15, 33)' },
  };
  // Poll the rendered cascade as well as attributes: inherited custom properties
  // can settle on the next frame after changing color-scheme. No fixed sleep.
  await page.waitForFunction(
    ({ design, mode, resolved, background }) => {
      const root = globalThis.document.documentElement;
      const data = root.dataset;
      return (
        data.design === design &&
        data.mode === mode &&
        data.theme === resolved &&
        globalThis.getComputedStyle(root).colorScheme === resolved &&
        globalThis.getComputedStyle(globalThis.document.body).backgroundColor === background
      );
    },
    { design, mode, resolved, background: backgrounds[design][resolved] }
  );
  if (design === 'northfina') {
    const font = await page.evaluate(
      () => globalThis.getComputedStyle(globalThis.document.body).fontFamily
    );
    assert.match(font, /Zalando/i);
  }
}

async function reflow(page) {
  const size = await page.evaluate(() => {
    const root = globalThis.document.documentElement;
    return [root.clientWidth, root.scrollWidth];
  });
  assert.ok(size[1] <= size[0] + 1, 'Horizontal overflow: ' + size.join('/'));
}

async function audit(page, name) {
  await page.addScriptTag({ path: axePath });
  const report = await page.evaluate(() =>
    globalThis.axe.run(globalThis.document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
  );
  await writeFile(resolve(output, name + '-axe.json'), JSON.stringify(report, null, 2));
  assert.equal(
    report.violations.length,
    0,
    JSON.stringify(
      report.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      }))
    )
  );
}

try {
  for (const locale of ['en', 'fi', 'sv', 'et']) {
    for (const mode of ['light', 'dark']) {
      for (const width of [320, 1280]) {
        const name = `northfina-${locale}-${mode}-${width}`;
        await run(
          name,
          { colorScheme: mode === 'light' ? 'dark' : 'light', viewport: { width, height: 900 } },
          async (page) => {
            await price(page, locale);
            await choose(page, 'northfina', mode);
            await theme(page, 'northfina', mode, mode);
            await page.evaluate(() => globalThis.document.fonts.ready);
            assert.match(await page.locator('.price-headline').innerText(), /134[.,]66/);
            await reflow(page);
            await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
            await audit(page, name);
            await page.goto(base + '/' + locale);
            await theme(page, 'northfina', mode, mode);
            assert.equal(await page.locator('.catalogue-card').count(), 30);
            await reflow(page);
            if (width === 320) {
              await audit(page, name + '-catalogue');
              await page.screenshot({
                path: resolve(output, name + '-catalogue.png'),
                fullPage: true,
              });
            }
            await page.locator('.appearance-trigger').click();
            await reflow(page);
            await audit(page, name + '-controls');
            if (locale === 'en' && width === 1280)
              await page.screenshot({ path: resolve(output, name + '-switcher.png') });
          }
        );
      }
    }
  }

  await run(
    'appearance-state-and-system',
    { colorScheme: 'dark', viewport: { width: 1280, height: 900 } },
    async (page, context) => {
      await price(page);
      await page.locator('#down').fill('100');
      await page.locator('#term-select').selectOption('24');
      const initialPrice = await page.locator('.price-headline').innerText();
      let writes = 0;
      page.on('request', (request) => {
        if (request.method() !== 'GET') writes += 1;
      });
      for (const design of ['northfina', 'green']) {
        await choose(page, design, 'light');
        await theme(page, design, 'light', 'light');
        await page.emulateMedia({ colorScheme: 'light' });
        await choose(page, design, 'dark');
        await theme(page, design, 'dark', 'dark');
        await choose(page, design, 'system');
        await theme(page, design, 'system', 'light');
        await page.emulateMedia({ colorScheme: 'dark' });
        await theme(page, design, 'system', 'dark');
        assert.equal(await page.locator('.price-headline').innerText(), initialPrice);
      }
      assert.equal(writes, 0, 'Appearance must not write financial records.');
      await choose(page, 'northfina', 'dark');
      await page.reload();
      await page.locator('#down').waitFor();
      await theme(page, 'northfina', 'dark', 'dark');
      assert.equal(await page.locator('#down').inputValue(), '100');
      await page.locator('header nav a[lang="fi"]').click();
      await page.locator('#down').waitFor();
      await theme(page, 'northfina', 'dark', 'dark');
      assert.equal(await page.locator('#term-select').inputValue(), '24');
      const other = await context.newPage();
      await other.goto(base + '/en');
      await choose(other, 'green', 'light');
      await theme(page, 'green', 'light', 'light');
      await other.evaluate((key) => globalThis.localStorage.removeItem(key), key);
      await theme(page, 'green', 'system', 'dark');
    }
  );

  await run(
    'appearance-keyboard-and-zoom',
    { viewport: { width: 320, height: 900 } },
    async (page) => {
      await price(page);
      await page.locator('.appearance-trigger').focus();
      await page.keyboard.press('Enter');
      const green = page.locator('input[name="appearance-design"][value="green"]');
      await green.focus();
      await green.press('ArrowRight');
      await theme(page, 'northfina', 'system', 'light');
      await reflow(page);
      const focused = await page.evaluate(() =>
        globalThis.document.activeElement?.getAttribute('value')
      );
      assert.equal(focused, 'northfina');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.appearance').getAttribute('open'), null);
      assert.equal(
        await page
          .locator('.appearance-trigger')
          .evaluate((el) => el === globalThis.document.activeElement),
        true
      );
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.addStyleTag({ content: 'html { font-size: 200%; }' });
      await reflow(page);
      await page.locator('.appearance-trigger').click();
      await reflow(page);
      await audit(page, 'northfina-enlarged-controls');
      await page.screenshot({ path: resolve(output, 'northfina-enlarged.png'), fullPage: true });
      await page.emulateMedia({ forcedColors: 'active' });
      await reflow(page);
      await page.screenshot({
        path: resolve(output, 'northfina-forced-colours.png'),
        fullPage: true,
      });
    }
  );

  await run(
    'appearance-blocked-storage',
    { viewport: { width: 390, height: 844 } },
    async (page, context) => {
      await context.addInitScript(() => {
        Object.defineProperty(globalThis, 'localStorage', {
          get() {
            throw new Error('Storage blocked for test');
          },
        });
      });
      await page.goto(base + '/en');
      await choose(page, 'northfina', 'dark');
      await theme(page, 'northfina', 'dark', 'dark');
      await page.locator('.appearance-trigger').click();
      assert.equal(await page.locator('.appearance [role="status"]').count(), 1);
      await audit(page, 'blocked-storage-controls');
    }
  );

  await run('appearance-corrupt-storage', { colorScheme: 'dark' }, async (page, context) => {
    await context.addInitScript((key) => globalThis.localStorage.setItem(key, 'broken json'), key);
    await page.goto(base + '/en');
    await theme(page, 'green', 'system', 'dark');
    await choose(page, 'northfina', 'light');
    await theme(page, 'northfina', 'light', 'light');
  });

  await run('appearance-before-react', { colorScheme: 'dark' }, async (page, context) => {
    await context.addInitScript(
      ({ key }) =>
        globalThis.localStorage.setItem(
          key,
          JSON.stringify({ design: 'northfina', mode: 'light' })
        ),
      { key }
    );
    await context.route('**/_next/static/**/*.js', (route) => route.abort());
    await page.goto(base + '/en', { waitUntil: 'domcontentloaded' });
    await theme(page, 'northfina', 'light', 'light');
    assert.equal(await page.locator('.catalogue-card').count(), 30);
  });
} finally {
  await browser.close();
  await writeFile(
    resolve(output, 'appearance-summary.json'),
    JSON.stringify({ revision: process.env.GITHUB_SHA, results }, null, 2)
  );
}
const failed = results.filter((item) => !item.passed);
if (failed.length) throw new Error(`${failed.length} appearance checks failed.`);
console.log(
  `All ${results.length} appearance checks passed; manual assistive testing remains necessary.`
);
