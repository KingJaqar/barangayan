// Actual production components with synthetic records and simulated saves only.
// Run from the repository root: node apps/admin-web/tests/content-workspace/edit-dialog-browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';

const root = path.resolve(import.meta.dirname, '../../../..');
const evidence = path.join(root, 'tmp/content-edit-dialog-checks');
fs.mkdirSync(evidence, { recursive: true });
const server = spawn(process.execPath, [path.join(import.meta.dirname, 'preview.mjs')], {
  cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, CONTENT_PREVIEW_PORT: '0', CONTENT_PREVIEW_WRITES: 'mock' },
});
const url = await new Promise((resolve, reject) => {
  server.stdout.on('data', data => { const match = data.toString().match(/UI preview: (http:\/\/\S+)/); if (match) resolve(match[1]); });
  server.stderr.on('data', data => process.stderr.write(data));
  server.on('error', reject);
  server.on('exit', code => reject(new Error(`Preview exited: ${code}`)));
});
const editors = [
  { screen: 'Services', title: 'Edit service', trigger: 'Edit service', fields: 23, table: 'document_types' },
  { screen: 'Announcements', title: 'Edit announcement', trigger: /^Edit Community/, fields: 5, table: 'announcements' },
  { screen: 'Waste Management', title: 'Edit collection zone', trigger: 'Edit', fields: 2, table: 'waste_zones' },
  { screen: 'Waste Management', title: 'Edit collection schedule', trigger: 'Edit', schedule: true, fields: 5, table: 'waste_collection_schedules' },
  { screen: 'Hub', title: 'Edit Hub entry', trigger: 'Edit Flood preparedness', fields: 10, table: 'emergency_information' },
  { screen: 'Evacuation Centers', title: 'Edit evacuation center', trigger: 'Edit Town Center Elementary School', fields: 10, table: 'evacuation_centers' },
  { screen: 'FAQ Content', title: 'Edit FAQ article', trigger: 'Edit', fields: 5, table: 'faq_articles' },
];
const scenarios = [
  { name: 'light-wide', width: 1280, height: 900, dark: false },
  { name: 'dark-wide', width: 1280, height: 900, dark: true },
  { name: 'dark-mobile', width: 390, height: 700, dark: true },
  { name: 'light-small', width: 320, height: 480, dark: false },
  { name: 'reduced-landscape', width: 740, height: 360, dark: true, reduced: true },
];
const report = { checks: [], errors: [], skipped: [], limitations: ['Synthetic records and simulated persistence; no authenticated routes or real database writes.'] };
let browser;
try {
  for (const [name, engine] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
    try { browser = await engine.launch(name === 'chromium' ? { channel: 'chrome', headless: true } : { headless: true }); }
    catch (error) { if (name === 'chromium') throw error; report.skipped.push(`${name}: ${error.message.split('\n')[0]}`); continue; }
    const page = await browser.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) report.errors.push(message.text()); });
    for (const scenario of name === 'chromium' ? scenarios : scenarios.slice(0, 1)) {
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.emulateMedia({ reducedMotion: scenario.reduced ? 'reduce' : 'no-preference' });
      await page.goto(url);
      await page.addScriptTag({ path: path.join(root, 'node_modules/axe-core/axe.min.js') });
      await page.evaluate(() => {
        window.__editDialogTransitions = [];
        document.addEventListener('transitionrun', event => {
          const target = event.target;
          if (!(target instanceof HTMLElement) || target.parentElement?.tagName !== 'DIALOG') return;
          window.__editDialogTransitions.push({
            part: target.tagName === 'SECTION' ? 'panel' : 'backdrop',
            property: event.propertyName, entering: target.dataset.visible === 'true',
          });
        }, true);
      });
      await page.getByLabel('Dark preview').setChecked(scenario.dark);
      await page.evaluate(dark => {
        document.documentElement.style.setProperty('--accent', dark ? '#6854b8' : '#0f6e5b');
        document.documentElement.style.setProperty('--font-app', dark ? 'Georgia, serif' : 'Arial, sans-serif');
      }, scenario.dark);
      for (const editor of editors) {
        await page.getByRole('combobox', { name: 'Screen preview' }).selectOption(editor.screen);
        if (editor.schedule) await page.getByRole('button', { name: /^Schedules/ }).click();
        else if (editor.screen === 'Waste Management') await page.getByRole('button', { name: /^Zones/ }).click();
        const trigger = page.getByRole('button', { name: editor.trigger, exact: typeof editor.trigger === 'string' }).first();
        await trigger.scrollIntoViewIfNeeded();
        const before = await trigger.boundingBox();
        await page.evaluate(() => { window.__editDialogTransitions = []; });
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: editor.title, exact: true });
        await dialog.waitFor();
        if (!scenario.reduced) await page.waitForTimeout(210);
        const entering = await page.evaluate(() => window.__editDialogTransitions.filter(event => event.entering));
        if (scenario.reduced) assert.deepEqual(entering, [], `${editor.title}: reduced motion skips entry transitions`);
        else {
          for (const [part, property] of [['panel', 'opacity'], ['panel', 'transform'], ['backdrop', 'opacity']]) {
            assert.ok(entering.some(event => event.part === part && event.property === property),
              `${editor.title}: ${part} ${property} animates on opening rather than snapping`);
          }
        }
        const geometry = await dialog.evaluate(element => {
          const panel = element.querySelector('section');
          const fields = element.querySelector('form > [data-edit-scroll]');
          const footer = element.querySelector('button[type=submit]');
          const rect = panel.getBoundingClientRect();
          const controls = [...element.querySelectorAll('input:not([type=hidden]), textarea, [role=combobox]')].filter(el => !el.matches('[data-admin-select-backing]'));
          return { rect: rect.toJSON(), footer: footer.getBoundingClientRect().toJSON(),
            overflow: fields.scrollWidth > fields.clientWidth + 1, scrollable: fields.scrollHeight > fields.clientHeight,
            controls: controls.length, focused: element.contains(document.activeElement) && document.activeElement !== element,
            surface: getComputedStyle(panel).backgroundColor, font: getComputedStyle(panel).fontFamily,
            transition: getComputedStyle(panel).transitionDuration,
            clipped: controls.filter(el => { const r = el.getBoundingClientRect(); return r.width > 1 && (r.left < rect.left || r.right > rect.right + 1); }).map(el => el.outerHTML),
          };
        });
        assert.ok(geometry.focused, `${editor.title}: initial focus`);
        assert.ok(geometry.controls >= editor.fields, `${editor.title}: controls remain available (${geometry.controls})`);
        assert.ok(!geometry.overflow && !geometry.clipped.length, `${editor.title}: no horizontal overflow: ${JSON.stringify(geometry.clipped)}`);
        assert.ok(geometry.rect.top >= 0 && geometry.rect.bottom <= scenario.height + 1, `${editor.title}: fits viewport`);
        assert.ok(Math.abs(geometry.rect.x + geometry.rect.width / 2 - scenario.width / 2) < 1, `${editor.title}: horizontally centered`);
        assert.ok(Math.abs(geometry.rect.y + geometry.rect.height / 2 - scenario.height / 2) < 1, `${editor.title}: vertically centered ${JSON.stringify(geometry.rect)}`);
        assert.ok(geometry.footer.bottom < scenario.height && geometry.footer.top > geometry.rect.top, `${editor.title}: visible actions`);
        assert.equal(geometry.surface, scenario.dark ? 'rgb(27, 29, 36)' : 'rgb(255, 255, 255)');
        assert.match(geometry.font, scenario.dark ? /Georgia/ : /Arial/);
        if (scenario.reduced) assert.equal(geometry.transition, '0s');
        if (scenario.name === 'light-wide' || scenario.name === 'dark-wide') {
          const violations = await dialog.evaluate(async el => {
            const result = await window.axe.run(el, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
            return result.violations.map(issue => ({ id: issue.id, help: issue.help, nodes: issue.nodes.map(node => node.html) }));
          });
          assert.deepEqual(violations, [], `${editor.title}: accessibility`);
        }
        const after = await trigger.boundingBox();
        assert.equal(before.height, after.height, 'Opening preserves the row layout');
        const close = dialog.getByRole('button', { name: 'Close edit dialog' });
        await close.focus(); await page.keyboard.press('Shift+Tab');
        assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), 'Reverse Tab stays inside');
        await page.keyboard.press('Tab');
        assert.ok(await close.evaluate(el => document.activeElement === el), 'Tab wraps back to close');
        const combo = dialog.getByRole('combobox').first();
        if (await combo.count() && await combo.isEnabled()) {
          await combo.click(); await page.getByRole('listbox').waitFor();
          await page.keyboard.press('Escape');
          assert.equal(await dialog.count(), 1, 'First Escape only dismisses dropdown');
          await page.getByRole('listbox').waitFor({ state: 'hidden' });
          await page.waitForTimeout(scenario.reduced ? 0 : 180);
          const bounds = await dialog.locator('section').first().boundingBox();
          assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= scenario.height + 1, 'Dropdown focus preserves viewport bounds');
        }
        if (name === 'chromium' && ['light-wide', 'dark-mobile'].includes(scenario.name)) {
          await dialog.locator('form > [data-edit-scroll]').evaluate(el => { el.scrollTop = 0; });
          await page.screenshot({ path: path.join(evidence, `${editor.title.replaceAll(' ', '-').toLowerCase()}-${scenario.name}.png`) });
        }
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        const exiting = await page.evaluate(() => window.__editDialogTransitions.filter(event => !event.entering));
        if (scenario.reduced) assert.deepEqual(exiting, [], `${editor.title}: reduced motion skips exit transitions`);
        else assert.ok(exiting.some(event => event.part === 'panel' && event.property === 'opacity'), `${editor.title}: closing still animates`);
        assert.equal(await trigger.evaluate(el => document.activeElement === el), true, 'Restores trigger focus');
        assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'Releases scroll lock');
        report.checks.push(`${name} / ${scenario.name} / ${editor.title}: layout, theme, focus, dropdown, Escape`);
      }
    }
    // Save/cancel/validation paths on all seven actual editors.
    if (name === 'chromium') {
      await page.setViewportSize({ width: 1100, height: 850 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(url);
      for (const editor of editors) {
        await page.getByRole('combobox', { name: 'Screen preview' }).selectOption(editor.screen);
        if (editor.schedule) await page.getByRole('button', { name: /^Schedules/ }).click();
        else if (editor.screen === 'Waste Management') await page.getByRole('button', { name: /^Zones/ }).click();
        const trigger = page.getByRole('button', { name: editor.trigger, exact: typeof editor.trigger === 'string' }).first();
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: editor.title, exact: true });
        const first = dialog.locator('input:not([type=hidden]),textarea').first();
        const original = await first.inputValue();
        await first.fill(editor.schedule ? '07:30' : 'Unsaved draft');
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await dialog.waitFor({ state: 'detached' });
        await trigger.click();
        assert.equal(await first.inputValue(), original, `${editor.title}: cancel discards draft`);
        await first.fill('');
        await dialog.locator('button[type=submit]').click();
        assert.ok(await first.evaluate(el => !el.checkValidity()), 'Required validation remains');
        await first.fill(original);
        // Legacy service fixtures need their existing required charter completed before saving.
        for (const field of await dialog.locator('textarea[required]').all()) {
          if (!(await field.inputValue())) await field.fill('Preview charter value');
        }
        await page.evaluate(() => { globalThis.__contentEditTest = { writes: [], fail: true, delay: 0 }; });
        await dialog.locator('button[type=submit]').click();
        await dialog.getByRole('alert').filter({ hasText: 'Preview save failed' }).waitFor();
        assert.equal(await dialog.count(), 1, `${editor.title}: save failure keeps form open`);
        await page.evaluate(() => { globalThis.__contentEditTest = { writes: [], fail: false, delay: 700 }; });
        await dialog.locator('button[type=submit]').click();
        await page.waitForFunction(() => document.querySelector('dialog form')?.getAttribute('aria-busy') === 'true');
        assert.ok(await dialog.getByRole('button', { name: 'Close edit dialog' }).isDisabled());
        assert.ok(await dialog.getByRole('button', { name: 'Cancel', exact: true }).isDisabled());
        await page.keyboard.press('Escape');
        assert.equal(await dialog.count(), 1, 'Saving blocks Escape dismissal');
        await dialog.waitFor({ state: 'detached' });
        const writes = await page.evaluate(() => globalThis.__contentEditTest.writes);
        assert.equal(writes.length, 1, 'Single save attempt');
        assert.equal(writes[0].table, editor.table, 'Original data destination');
        assert.equal(await trigger.evaluate(el => document.activeElement === el), true);
        report.checks.push(`${editor.title}: cancel reset, required validation, failed save, busy dismissal protection, successful save`);
      }
    }
    await browser.close(); browser = null;
  }
  assert.deepEqual(report.errors, [], 'No browser errors or warnings');
} catch (error) {
  report.errors.push(error.stack); process.exitCode = 1;
} finally {
  await browser?.close(); server.kill();
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
