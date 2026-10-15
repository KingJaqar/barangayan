import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<form><select aria-label="Native"><option value="a">Alpha</option><option value="b">Beta</option></select><input aria-label="Text"><button>Submit</button></form>');
  await page.evaluate(() => { window.submits = 0; document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); window.submits++; }); });
  const native = page.getByRole('combobox');
  await native.focus(); await page.keyboard.press('Enter');
  const first = await page.evaluate(() => window.submits);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  const result = { closedEnterSubmits: first, selectedValue: await native.inputValue(), selectionEnterSubmits: await page.evaluate(() => window.submits) };
  await page.getByRole('textbox').focus(); await page.keyboard.press('Enter');
  result.textEnterSubmits = await page.evaluate(() => window.submits);
  fs.writeFileSync(path.resolve(import.meta.dirname, '../../../../plans/evidence/admin-dropdown-ui/native-enter-results.json'), JSON.stringify(result, null, 2));
  console.log(result);
} finally { await browser.close(); }
