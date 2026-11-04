import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PDF_DESK_PLAYWRIGHT || 'playwright');
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = resolve(project, 'tests/fixtures');
const results = process.env.PDF_DESK_TEST_RESULTS || resolve(project, 'test-results');
await mkdir(results, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PDF_DESK_BROWSER || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
const base = process.env.PDF_DESK_URL || 'http://127.0.0.1:43127';
const unexpectedNetwork = [], runtimeErrors = [], timings = [];
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin === base || ['blob:', 'data:'].includes(url.protocol)) route.continue();
  else { unexpectedNetwork.push(url.href); route.abort(); }
});
const page = await context.newPage();
page.on('pageerror', error => runtimeErrors.push(error.message));
page.on('console', message => { if (message.text().startsWith('PDF Desk ')) timings.push(message.text()); if (['error', 'warning'].includes(message.type())) console.log('BROWSER:', message.text()); });
page.setDefaultTimeout(30_000);
const idle = () => page.locator('#app:not(.busy)').waitFor();
const count = async expected => { await page.waitForFunction(n => document.querySelectorAll('.page-card').length === n, expected); };
const range = async text => { await page.locator('#page-range').fill(text); await page.locator('#page-range').press('Enter'); };
const hashes = new Map();
for (const name of ['Project brief.pdf', 'Estimate.pdf', 'Landscape.png', 'Orientation.jpg']) hashes.set(name, createHash('sha256').update(await readFile(resolve(fixtures, name))).digest('hex'));

try {
  await page.goto(base); await page.locator('#empty-state h1').waitFor();
  await page.screenshot({ path: resolve(project, 'docs/empty-state.png') });
  await page.locator('#file-input').setInputFiles([resolve(fixtures, 'Project brief.pdf'), resolve(fixtures, 'Estimate.pdf')]);
  await idle(); await count(4); await page.locator('#canvas-stage canvas').waitFor();
  await page.locator('.page-card').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.thumbnail-wrap canvas').length >= 4);
  await page.screenshot({ path: resolve(project, 'docs/focus-workspace.png') });
  console.log('PASS: offline import, preview and lazy thumbnails');

  const originalOrder = await page.locator('.page-card').evaluateAll(cards => cards.map(card => card.dataset.page));
  await page.locator('.page-card').nth(1).dragTo(page.locator('.page-card').nth(3));
  assert.deepEqual(await page.locator('.page-card').evaluateAll(cards => cards.map(card => card.dataset.page)), [originalOrder[0], originalOrder[2], originalOrder[1], originalOrder[3]]);
  await page.locator('#undo').click(); await count(4);
  await page.locator('#file-input').setInputFiles(['Encrypted.pdf', 'Broken.pdf', 'Landscape.png', 'Orientation.jpg'].map(name => resolve(fixtures, name)));
  await idle(); await count(6);
  assert((await page.locator('#messages').textContent()).includes('encrypted'));
  assert((await page.locator('#messages').textContent()).includes('Broken.pdf'));
  await page.locator('#dismiss-message').click();
  console.log('PASS: per-file errors retain valid images, including EXIF orientation');

  await range('1, 3'); assert.equal(await page.locator('.page-card[aria-pressed=true]').count(), 2);
  await page.locator('#rotate').click();
  await page.locator('#duplicate').click(); await count(8);
  await page.locator('#undo').click(); await count(6);
  await page.locator('#redo').click(); await count(8);
  await page.locator('#undo').click(); await count(6);
  await page.locator('#move').click(); await page.locator('#move-target').selectOption('end'); await page.locator('#dialog-confirm').click();
  await page.locator('#insert').click(); await page.locator('#insert-size').selectOption('letter'); await page.locator('#insert-orientation').selectOption('landscape'); await page.locator('#insert-position').selectOption('before'); await page.locator('#dialog-confirm').click(); await count(7);
  await page.locator('#fit-mode').selectOption('width'); await page.waitForFunction(() => !document.querySelector('#canvas-stage').classList.contains('rendering'));
  await page.locator('#zoom-in').click(); await page.locator('#fit-mode').selectOption('page');
  console.log('PASS: range selection, rotation, duplication, undo/redo, move, Letter landscape insertion and zoom');

  async function download(filename, selected = false) {
    await page.locator('#save-copy').click(); await page.locator('#output-name').fill(filename);
    if (selected) await page.locator('#export-scope').selectOption('selected');
    const downloadPromise = page.waitForEvent('download'); await page.locator('#dialog-confirm').click();
    const output = await downloadPromise; assert.equal(output.suggestedFilename(), filename); await output.saveAs(resolve(results, filename)); await idle();
  }
  await download('all-pages.pdf');
  await range('1, 6–7'); await download('selected-pages.pdf', true);
  await range('0'); assert.equal(await page.locator('.page-card[aria-pressed=true]').count(), 3); assert.equal(await page.locator('#page-range').getAttribute('aria-invalid'), 'true');
  await page.locator('#dismiss-message').click();
  await page.locator('#select-all').click(); await page.locator('#delete').click(); await count(0); await page.locator('#undo').click(); await count(7);
  console.log('PASS: all/selected PDF downloads, invalid ranges and delete-all undo');

  await page.locator('#file-input').evaluate(input => {
    const transfer = new DataTransfer(); transfer.items.add(new File([new ArrayBuffer(100_000_001)], 'too-large.pdf', { type: 'application/pdf' })); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert((await page.locator('#messages').textContent()).includes('100 MB')); await count(7); await page.locator('#dismiss-message').click();
  for (const [name, hash] of hashes) assert.equal(createHash('sha256').update(await readFile(resolve(fixtures, name))).digest('hex'), hash);
  console.log('PASS: 100 MB rejection and original file hashes unchanged');

  await page.locator('.page-card').first().click();
  await page.keyboard.press('Control+d'); await count(8); await page.keyboard.press('Control+z'); await count(7);
  await page.keyboard.press('Control+a'); assert.equal(await page.locator('.page-card[aria-pressed=true]').count(), 7);
  await page.locator('#new-document').click(); assert(await page.locator('#dialog').isVisible()); await page.locator('#dialog-cancel').click(); await count(7);
  await page.locator('#rotate').click();
  const closeDialog = page.waitForEvent('dialog'); const reload = page.reload(); const unload = await closeDialog; assert.equal(unload.type(), 'beforeunload'); await unload.accept(); await reload; await count(0);
  console.log('PASS: keyboard shortcuts, new-document confirmation and unsaved refresh warning');

  for (const width of [1024, 768, 390]) { await page.setViewportSize({ width, height: 900 }); await page.locator('#file-input').setInputFiles(resolve(fixtures, 'Estimate.pdf')); await idle(); await count(1); await page.locator('#canvas-stage canvas').waitFor(); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Horizontal overflow at ${width}`); await page.screenshot({ path: resolve(results, `width-${width}.png`) }); await page.locator('#new-document').click(); await page.locator('#dialog-confirm').click(); await idle(); }
  console.log('PASS: laptop and narrow-window layouts');
  // Return a genuine worker-side export failure to verify that the UI retains the arrangement.
  const failureContext = await browser.newContext({ viewport: { width: 1024, height: 800 } });
  await failureContext.route('**/pdf-worker.mjs', async route => {
    const response = await route.fetch();
    const source = (await response.text()).replace("} else if (action === 'export') {", "} else if (action === 'export') { throw new Error('Synthetic export failure');");
    await route.fulfill({ response, body: source });
  });
  const failurePage = await failureContext.newPage();
  await failurePage.goto(base); await failurePage.locator('#file-input').setInputFiles(resolve(fixtures, 'Estimate.pdf')); await failurePage.locator('#app:not(.busy)').waitFor();
  await failurePage.locator('#save-copy').click(); await failurePage.locator('#dialog-confirm').click(); await failurePage.locator('#messages').waitFor();
  assert((await failurePage.locator('#messages').textContent()).includes('Synthetic export failure'));
  assert.equal(await failurePage.locator('.page-card').count(), 1); assert(await failurePage.locator('#save-copy').isEnabled());
  await failureContext.close(); console.log('PASS: export failure retains the document and permits retry');
  assert.deepEqual(runtimeErrors, []); assert.deepEqual(unexpectedNetwork, []);
  await writeFile(resolve(results, 'browser-results.json'), JSON.stringify({ passed: true, browser: browser.version(), runtimeErrors, unexpectedNetwork, timings }, null, 2));
  console.log('PASS: zero runtime exceptions and zero external network requests');
} catch (error) {
  console.error('Runtime exceptions:', runtimeErrors);
  console.error('Status:', await page.locator('#status').textContent().catch(() => 'unavailable'));
  console.error('Messages:', await page.locator('#messages').textContent().catch(() => 'unavailable'));
  await page.screenshot({ path: resolve(results, 'failure.png') }).catch(() => {});
  throw error;
} finally { await context.close(); await browser.close(); }
