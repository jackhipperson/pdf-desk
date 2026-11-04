import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, degrees } from '../public/vendor/pdf-lib.mjs';
import { buildPdf, readPdf, describePages } from '../public/pdf-service.mjs';

async function fixture() {
  const document = await PDFDocument.create(); const font = await document.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) { const page = document.addPage([300 + i * 100, 500]); page.drawText(`Original page ${i + 1}`, { x: 25, y: 400, font, size: 16 }); }
  document.getPage(1).setRotation(degrees(90));
  const bytes = await document.save();
  return { bytes, pdf: await readPdf(bytes) };
}
test('source page dimensions and inherited rotation are described', async () => { const source = await fixture(); const pages = describePages(source.pdf); assert.deepEqual(pages.map(p => [p.width, p.height, p.rotation]), [[300, 500, 0], [400, 500, 90], [500, 500, 0]]); });
test('export merges, reorders, duplicates, rotates and inserts a blank page without mutating inputs', async () => {
  const a = await fixture(), b = await fixture(); const before = a.bytes.slice();
  const sources = new Map([['a', a], ['b', b]]);
  const records = [{ sourceId: 'a', index: 2, rotation: 180 }, { sourceId: 'b', index: 1, rotation: 90 }, { sourceId: 'a', index: 2, rotation: 270 }, { sourceId: null, width: 612, height: 792, rotation: 0 }];
  const result = await buildPdf(records, sources); const reopened = await readPdf(result);
  assert.equal(reopened.getPageCount(), 4); assert.deepEqual(reopened.getPages().map(p => p.getRotation().angle), [180, 90, 270, 0]);
  assert.deepEqual(reopened.getPages().map(p => [p.getWidth(), p.getHeight()]), [[500, 500], [400, 500], [500, 500], [612, 792]]);
  assert.deepEqual(a.bytes, before); assert.equal(a.pdf.getPage(2).getRotation().angle, 0);
});
test('selected-page export omits unselected pages', async () => { const source = await fixture(); const result = await buildPdf([{ sourceId: 'a', index: 1, rotation: 90 }], new Map([['a', source]])); assert.equal((await readPdf(result)).getPageCount(), 1); });
test('export refuses missing source and empty documents', async () => { await assert.rejects(buildPdf([], new Map())); await assert.rejects(buildPdf([{ sourceId: 'missing', index: 0, rotation: 0 }], new Map())); });
test('duplicate exports share resources and do not balloon file size', async () => { const source = await fixture(); const sourceMap = new Map([['a', source]]); const one = await buildPdf([{ sourceId: 'a', index: 0, rotation: 0 }], sourceMap); const many = await buildPdf(Array.from({ length: 100 }, (_, i) => ({ sourceId: 'a', index: 0, rotation: i % 4 * 90 })), sourceMap); assert.equal((await readPdf(many)).getPageCount(), 100); assert(many.length < one.length + 30_000); });
