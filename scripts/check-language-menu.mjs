// Real browser checks for the language disclosure, using the isolated demo only.
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
const results = [];
const names = ['English', 'Suomi', 'Svenska', 'Eesti'];
const browser = await chromium.launch();
await mkdir(output, { recursive: true });

async function run(name, options, work) {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  try {
    await work(page);
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

async function appearance(page, design, mode) {
  await page.locator('.appearance-trigger').click();
  await page.locator(`input[name="appearance-design"][value="${design}"]`).check();
  await page.locator(`input[name="appearance-mode"][value="${mode}"]`).check();
  await page.locator('.appearance-trigger').press('Escape');
  await page.waitForFunction(
    ({ design, mode }) => {
      const { dataset } = globalThis.document.documentElement;
      return dataset.design === design && dataset.theme === mode;
    },
    { design, mode }
  );
}

async function focused(page, locale) {
  const link = page.locator(`a[lang="${locale}"]`);
  assert.equal(await link.evaluate((element) => element.matches(':focus')), true);
}

async function fits(page) {
  const bounds = await page.locator('.language-menu').boundingBox();
  assert.ok(bounds, 'Open menu must be visible');
  const width = page.viewportSize().width;
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Menu leaves viewport');
  const dimensions = await page.evaluate(() => {
    const root = globalThis.document.documentElement;
    return [root.clientWidth, root.scrollWidth];
  });
  assert.ok(dimensions[1] <= dimensions[0] + 1, 'Horizontal page overflow');
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
      report.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
      }))
    )
  );
}

try {
  for (const design of ['green', 'northfina']) {
    for (const mode of ['light', 'dark']) {
      for (const width of [320, 1280]) {
        for (const locale of ['en', 'fi', 'sv', 'et']) {
          const name = `language-${design}-${mode}-${width}-${locale}`;
          await run(
            name,
            { colorScheme: mode === 'light' ? 'dark' : 'light', viewport: { width, height: 900 } },
            async (page) => {
              await page.goto(base + '/' + locale);
              await appearance(page, design, mode);
              const trigger = page.locator('.language-trigger');
              const menu = page.locator('.language-disclosure');
              const links = menu.locator('a[lang]');
              assert.equal(await links.first().isVisible(), false);
              assert.match(await trigger.innerText(), new RegExp(locale.toUpperCase()));
              await trigger.click();
              assert.equal(await menu.evaluate((element) => element.open), true);
              assert.deepEqual(await links.allTextContents(), names);
              const active = menu.locator('[aria-current="page"]');
              assert.equal(await active.count(), 1);
              assert.equal(await active.getAttribute('lang'), locale);
              for (const link of await links.all()) {
                const box = await link.boundingBox();
                assert.ok(box && box.height >= 44, 'Language target is too small');
              }
              await fits(page);
              await audit(page, name);
              if (locale === 'en') {
                await page.evaluate(() => globalThis.document.fonts.ready);
                await page.screenshot({ path: resolve(output, name + '.png') });
              }
              await page.locator('.footer-note').click();
              assert.equal(await menu.evaluate((element) => element.open), false);
              // Opening one header panel closes the other without losing the pointer click.
              await page.locator('.appearance-trigger').click();
              await trigger.click();
              assert.equal(await page.locator('.appearance').evaluate((el) => el.open), false);
              assert.equal(await menu.evaluate((element) => element.open), true);
              await page.locator('.appearance-trigger').click();
              assert.equal(await menu.evaluate((element) => element.open), false);
              assert.equal(await page.locator('.appearance').evaluate((el) => el.open), true);
            }
          );
        }
      }
    }
  }

  for (const design of ['green', 'northfina']) {
    await run(
      `language-keyboard-${design}`,
      { viewport: { width: 320, height: 900 } },
      async (page) => {
        await page.goto(base + '/en');
        await appearance(page, design, 'dark');
        const trigger = page.locator('.language-trigger');
        const menu = page.locator('.language-disclosure');
        await trigger.focus();
        await trigger.press('Space');
        await page.keyboard.press('Tab');
        await focused(page, 'en');
        await page.keyboard.press('ArrowDown');
        await focused(page, 'fi');
        await page.keyboard.press('End');
        await focused(page, 'et');
        await page.keyboard.press('Home');
        await page.keyboard.press('Escape');
        assert.equal(await menu.evaluate((element) => element.open), false);
        assert.equal(await trigger.evaluate((element) => element.matches(':focus')), true);
        await trigger.press('ArrowUp');
        await focused(page, 'et');
        await page.keyboard.press('Tab');
        assert.equal(await menu.evaluate((element) => element.open), false);
        await trigger.press('Enter');
        await trigger.press('Shift+Tab');
        assert.equal(await menu.evaluate((element) => element.open), false);
        await trigger.click();
        await page.locator('a[lang="en"]').click();
        assert.equal(await menu.evaluate((element) => element.open), false);
        await trigger.click();
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.addStyleTag({ content: 'html { font-size: 200%; }' });
        await fits(page);
        await audit(page, `language-enlarged-${design}`);
        await page.emulateMedia({ forcedColors: 'active' });
        await fits(page);
        // Use actual keyboard navigation: programmatic .focus() alone does not
        // guarantee :focus-visible after a pointer interaction in Chromium.
        await page.locator('a[lang="en"]').focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        const outline = await page.locator('a[lang="en"]').evaluate((el) => {
          const style = globalThis.getComputedStyle(el);
          return [el.matches(':focus-visible'), style.outlineStyle, style.outlineWidth];
        });
        assert.deepEqual(outline, [true, 'solid', '3px']);
      }
    );
  }

  await run('language-route-query-and-draft', {}, async (page) => {
    await page.goto(base + '/en/lease/ebike-003?source=language-check#main');
    await page.locator('#demo-customer').selectOption('cust-aino');
    await page.locator('#demo-date').fill('2026-11-05');
    await page.locator('#term-select').selectOption('24');
    await page.locator('#down').fill('100');
    await appearance(page, 'northfina', 'dark');
    let writes = 0;
    page.on('request', (request) => {
      if (request.method() !== 'GET') writes += 1;
    });
    for (const locale of ['fi', 'sv', 'et', 'en']) {
      await page.locator('.language-trigger').click();
      const link = page.locator(`.language-menu a[lang="${locale}"]`);
      await page.waitForFunction(
        (locale) =>
          globalThis.document
            .querySelector(`.language-menu a[lang="${locale}"]`)
            ?.getAttribute('href') === `/${locale}/lease/ebike-003?source=language-check#main`,
        locale
      );
      await link.click();
      await page.waitForURL(`**/${locale}/lease/ebike-003?source=language-check#main`);
      await page.locator('#down').waitFor();
      assert.equal(await page.locator('#down').inputValue(), '100');
      assert.equal(await page.locator('#term-select').inputValue(), '24');
      await page.waitForFunction(
        () =>
          globalThis.document.documentElement.dataset.design === 'northfina' &&
          globalThis.document.documentElement.dataset.theme === 'dark'
      );
      assert.equal(await page.locator('.language-disclosure').evaluate((el) => el.open), false);
    }
    assert.equal(writes, 0, 'Language navigation must not create financial records');
  });

  await run('language-without-javascript', { javaScriptEnabled: false }, async (page) => {
    await page.goto(base + '/en');
    await page.locator('.language-trigger').click();
    await page.locator('.language-menu a[lang="fi"]').click();
    await page.waitForURL('**/fi');
    assert.equal(await page.locator('html').getAttribute('lang'), 'fi');
  });
} finally {
  await browser.close();
  await writeFile(
    resolve(output, 'language-summary.json'),
    JSON.stringify({ revision: process.env.GITHUB_SHA, results }, null, 2)
  );
}
const failed = results.filter((result) => !result.passed);
if (failed.length) throw new Error(`${failed.length} language menu checks failed.`);
console.log(`All ${results.length} language menu checks passed.`);
