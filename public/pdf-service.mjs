import { PDFDocument, degrees } from './vendor/pdf-lib.mjs';

export async function readPdf(bytes) {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
  if (pdf.isEncrypted) throw new Error('Password-protected and encrypted PDFs are not supported.');
  if (!pdf.getPageCount()) throw new Error('This PDF has no pages.');
  return pdf;
}
export function describePages(pdf) {
  return pdf.getPages().map((page, index) => ({ index, width: page.getWidth(), height: page.getHeight(), rotation: ((page.getRotation().angle % 360) + 360) % 360 }));
}
export async function buildPdf(pages, sources, onProgress = () => {}) {
  if (!pages.length) throw new Error('Add at least one page before saving.');
  const output = await PDFDocument.create();
  output.setProducer('PDF Desk'); output.setCreator('PDF Desk');
  const copied = new Map();
  // Copy each unique source page once, then clone its dictionary for duplicates.
  // Sharing streams and resources avoids embedding a whole document repeatedly.
  const bySource = new Map();
  for (const page of pages) if (page.sourceId) { if (!bySource.has(page.sourceId)) bySource.set(page.sourceId, new Set()); bySource.get(page.sourceId).add(page.index); }
  for (const [sourceId, indices] of bySource) {
    const source = sources.get(sourceId);
    if (!source) throw new Error('A source document is missing. Reopen the document and try again.');
    const pdf = source.pdf ?? await readPdf(source.bytes);
    const indexList = [...indices];
    const originals = await output.copyPages(pdf, indexList);
    indexList.forEach((index, i) => copied.set(`${sourceId}:${index}`, originals[i]));
  }
  const used = new Set();
  for (let i = 0; i < pages.length; i++) {
    const record = pages[i];
    let page;
    if (!record.sourceId) page = output.addPage([record.width, record.height]);
    else {
      const key = `${record.sourceId}:${record.index}`;
      const original = copied.get(key);
      if (!used.has(key)) { page = output.addPage(original); used.add(key); }
      else {
        const { PDFPage } = await import('./vendor/pdf-lib.mjs');
        const node = original.node.clone(output.context);
        const ref = output.context.register(node);
        page = output.addPage(PDFPage.of(node, ref, output));
      }
    }
    page.setRotation(degrees(record.rotation));
    if (i % 20 === 0 || i === pages.length - 1) { onProgress(i + 1, pages.length); await new Promise(resolve => setTimeout(resolve, 0)); }
  }
  return output.save({ addDefaultPage: false, objectsPerTick: 30 });
}
