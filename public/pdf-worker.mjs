import { PDFDocument } from './vendor/pdf-lib.mjs';
import { readPdf, describePages, buildPdf } from './pdf-service.mjs';
import { MAX_BYTES } from './core.mjs';
const sources = new Map();

async function imagePdf(bytes, type, width, height) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type }), { imageOrientation: 'from-image' });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const normalized = new Uint8Array(await (await canvas.convertToBlob({ type: type === 'image/jpeg' ? 'image/jpeg' : 'image/png', quality: 0.98 })).arrayBuffer());
    const pdf = await PDFDocument.create();
    const image = type === 'image/jpeg' ? await pdf.embedJpg(normalized) : await pdf.embedPng(normalized);
    const page = pdf.addPage([width, height]);
    const scale = Math.min(width / bitmap.width, height / bitmap.height);
    const w = bitmap.width * scale, h = bitmap.height * scale;
    page.drawImage(image, { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h });
    return { pdf, bytes: await pdf.save() };
  } finally { bitmap?.close(); }
}
self.onmessage = async event => {
  const { requestId, action, ...payload } = event.data;
  try {
    if (action === 'import') {
      const { id, bytes, name, size, width, height } = payload;
      if ([...sources.values()].reduce((sum, source) => sum + source.size, 0) + size > MAX_BYTES) throw new Error('The combined source-file limit is 100 MB. Start a new document to release its files.');
      const data = new Uint8Array(bytes);
      const isPdf = /\.pdf$/i.test(name), isPng = /\.png$/i.test(name), isJpeg = /\.jpe?g$/i.test(name);
      if (!isPdf && !isPng && !isJpeg) throw new Error('Choose a PDF, JPEG or PNG file.');
      let source;
      if (isPdf) source = { pdf: await readPdf(data), bytes: data, name, size };
      else source = { ...await imagePdf(data, isPng ? 'image/png' : 'image/jpeg', width, height), name, size };
      sources.set(id, source);
      const preview = source.bytes.slice();
      self.postMessage({ requestId, result: { pages: describePages(source.pdf), preview: preview.buffer } }, [preview.buffer]);
    } else if (action === 'export') {
      const bytes = await buildPdf(payload.pages, sources, (done, total) => self.postMessage({ requestId, progress: { done, total } }));
      self.postMessage({ requestId, result: bytes.buffer }, [bytes.buffer]);
    } else if (action === 'collect') {
      const keep = new Set(payload.ids); for (const id of sources.keys()) if (!keep.has(id)) sources.delete(id);
      self.postMessage({ requestId, result: true });
    } else if (action === 'reset') { sources.clear(); self.postMessage({ requestId, result: true }); }
    else throw new Error('Unknown document operation.');
  } catch (error) {
    let message = error.message || 'The document operation could not be completed.';
    if (/encrypted|password/i.test(message)) message = 'Password-protected and encrypted PDFs are not supported. Use an unencrypted copy.';
    else if (action === 'import' && !/100 MB|Choose a|no pages/.test(message)) message = 'This file could not be read. It may be damaged or use an unsupported format. Try a fresh PDF, JPEG or PNG copy.';
    self.postMessage({ requestId, error: message });
  }
};
