import path from 'node:path';
import { chromium } from 'playwright';
import { preview } from './preview.mjs';

const evidence = path.resolve(import.meta.dirname, '../../../../plans/evidence/admin-dropdown-ui');
const server = await preview({ screens: path.resolve(import.meta.dirname, '../table-browse/record-fixture.jsx'), reference: path.join(import.meta.dirname, 'reference.tsx') }, { baseline: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  for (const width of [390, 1440]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['screens', 'reference']) {
      await page.goto(`${server.url}/${name}`);
      await page.evaluate(({ dark }) => { document.documentElement.classList.toggle('dark', dark); document.documentElement.style.setProperty('--accent', '#a855f7'); }, { dark });
      if (name === 'reference') { await page.getByRole('combobox').click(); }
      else {
        await page.getByLabel('Sort by').waitFor();
      }
      await page.screenshot({ path: path.join(evidence, `before-${name}-${width}-${dark ? 'dark' : 'light'}.png`) });
      if (name === 'screens' && width === 1440) {
        await page.locator('tbody tr').first().locator('td').filter({ hasText: 'Submitted' }).first().click();
        await page.getByRole('combobox', { name: 'Edit Status' }).waitFor();
        await page.screenshot({ path: path.join(evidence, `before-inline-${dark ? 'dark' : 'light'}.png`) });
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'View Details', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Edit', exact: true }).click();
        await page.screenshot({ path: path.join(evidence, `before-drawer-${dark ? 'dark' : 'light'}.png`) });
      }
    }
  }
} finally { await browser.close(); await server.close(); }
