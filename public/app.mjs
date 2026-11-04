import * as pdfjs from './vendor/pdf.mjs';
import { History, MAX_BYTES, parseRange, pageDimensions, movePages, insertAt, safeFilename } from './core.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
const $ = id => document.getElementById(id);
const history = new History();
const sources = new Map();
const worker = new Worker(new URL('./pdf-worker.mjs', import.meta.url), { type: 'module' });
const requests = new Map();
let requestCounter = 0, busy = false, pendingImport = {}, autoTitle = true, workerFailed = false;
let fit = 'page', customZoom = 1, currentScale = 1, previewVersion = 0, previewTask = null, renderFrame = 0;
let viewKey = '', dialogSubmit = null, dragging = null;
const cards = new Map(), thumbnailQueue = [], thumbnailPending = new Set();
let thumbnailRunning = 0;
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newId = () => crypto.randomUUID();
const formatBytes = bytes => bytes < 1_000_000 ? `${(bytes / 1000).toFixed(0)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
const sourceBytes = () => [...sources.values()].reduce((sum, source) => sum + source.size, 0);
const activePage = () => history.pages.find(page => page.id === history.active);
const selectPages = () => history.pages.filter(page => history.selected.has(page.id));
const status = text => { $('status').replaceChildren(); const dot = document.createElement('span'); dot.className = 'status-dot'; $('status').append(dot, document.createTextNode(text)); };
function errors(messages) {
  const list = Array.isArray(messages) ? messages : [messages];
  $('messages').hidden = !list.length;
  $('message-content').replaceChildren();
  if (list.length === 1) $('message-content').textContent = list[0];
  else { const ul = document.createElement('ul'); for (const message of list) { const li = document.createElement('li'); li.textContent = message; ul.append(li); } $('message-content').append(ul); }
}
worker.onmessage = ({ data }) => {
  const request = requests.get(data.requestId); if (!request) return;
  if (data.progress) { request.progress?.(data.progress); return; }
  requests.delete(data.requestId); data.error ? request.reject(new Error(data.error)) : request.resolve(data.result);
};
worker.onerror = event => {
  workerFailed = true;
  for (const request of requests.values()) request.reject(new Error('The document worker stopped. Save any available copy, then refresh the app and reopen your files.'));
  requests.clear(); errors('The document worker stopped. Refresh PDF Desk and reopen your files.'); console.error(event.message);
};
function rpc(action, payload = {}, transfer = [], progress) {
  if (workerFailed) return Promise.reject(new Error('Refresh PDF Desk and reopen your files to restart its document worker.'));
  return new Promise((resolve, reject) => { const requestId = ++requestCounter; requests.set(requestId, { resolve, reject, progress }); worker.postMessage({ requestId, action, ...payload }, transfer); });
}
function setBusy(value) { busy = value; $('app').classList.toggle('busy', value); updateControls(); }
function updateControls() {
  for (const id of ['new-document', 'add-files', 'empty-add', 'insert', 'range-form', 'help']) { const el = $(id); if (el instanceof HTMLFormElement) for (const input of el.elements) input.disabled = busy; else el.disabled = busy; }
  $('document-title').disabled = busy;
  $('undo').disabled = busy || !history.past.length; $('redo').disabled = busy || !history.future.length;
  $('save-copy').disabled = busy || !history.pages.length;
  for (const button of document.querySelectorAll('.page-action')) button.disabled = busy || !history.selected.size;
  $('select-all').disabled = busy || !history.pages.length;
  const index = history.pages.findIndex(page => page.id === history.active);
  $('previous').disabled = busy || index <= 0; $('next').disabled = busy || index >= history.pages.length - 1;
  $('page-number').disabled = busy; $('fit-mode').disabled = busy;
  $('zoom-in').disabled = busy; $('zoom-out').disabled = busy;
  $('selection-count').textContent = `${history.selected.size} selected`;
  const bytes = sourceBytes();
  $('document-meta').textContent = `${sources.size ? `${sources.size} source ${sources.size === 1 ? 'file' : 'files'} · ${formatBytes(bytes)} of 100 MB` : 'No files added · Up to 100 MB combined'}${history.dirty ? ' · Unsaved changes' : history.pages.length ? ' · Copy exported' : ''}`;
  document.title = `${history.dirty ? '• ' : ''}${$('document-title').value || 'Untitled document'} — PDF Desk`;
  for (const card of cards.values()) card.disabled = busy;
}
async function collectSources() {
  const ids = history.retainedSources();
  for (const [id, source] of sources) if (!ids.has(id)) { source.destroyed = true; source.loading?.destroy(); sources.delete(id); }
  await rpc('collect', { ids: [...ids] }); updateControls();
}
function render() {
  updateControls();
  const hasPages = history.pages.length > 0;
  $('sidebar-empty').hidden = hasPages; $('empty-state').hidden = hasPages;
  $('preview-toolbar').hidden = !hasPages; $('canvas-stage').hidden = !hasPages;
  const live = new Set(history.pages.map(page => page.id));
  for (const [id, card] of cards) if (!live.has(id)) { observer.unobserve(card); card.remove(); cards.delete(id); }
  const orderedCards = [];
  history.pages.forEach((page, index) => {
    let card = cards.get(page.id);
    if (!card) {
      card = document.createElement('button'); card.type = 'button'; card.draggable = true; card.className = 'page-card'; card.dataset.page = page.id;
      card.innerHTML = '<span class="thumbnail-wrap"><span class="thumbnail-placeholder"></span></span><span class="page-card-meta"><strong></strong><small></small><span class="rotation"></span></span><span class="page-check" aria-hidden="true">✓</span><span class="drag-hint" aria-hidden="true">⋮⋮</span>';
      cards.set(page.id, card); observer.observe(card);
    }
    card.disabled = busy; card.classList.toggle('active', page.id === history.active); card.setAttribute('aria-pressed', String(history.selected.has(page.id)));
    if (page.id === history.active) card.setAttribute('aria-current', 'page'); else card.removeAttribute('aria-current');
    card.setAttribute('aria-label', `Page ${index + 1}, ${page.label}${history.selected.has(page.id) ? ', selected' : ''}`);
    card.querySelector('strong').textContent = `Page ${index + 1}`; card.querySelector('small').textContent = page.label;
    card.querySelector('.page-check').hidden = !history.selected.has(page.id);
    card.querySelector('.rotation').textContent = page.rotation ? `${page.rotation}°` : '';
    card.querySelector('.rotation').hidden = !page.rotation;
    orderedCards.push(card);
    if (card.dataset.thumbKey !== `${page.sourceId}:${page.index}:${page.rotation}`) queueThumbnail(page, card);
  });
  orderedCards.forEach((card, index) => { const position = $('page-list').children[index]; if (position !== card) $('page-list').insertBefore(card, position || null); });
  const index = history.pages.findIndex(page => page.id === history.active);
  $('page-number').value = index + 1; $('page-number').max = history.pages.length; $('page-total').textContent = `of ${history.pages.length}`;
  const page = activePage();
  $('page-details').textContent = page ? `${page.label}${page.sourceId ? ` · Source page ${page.index + 1}` : ''} · ${Math.round(page.width)} × ${Math.round(page.height)} pt${page.rotation ? ` · ${page.rotation}°` : ''}` : '';
  const key = page ? JSON.stringify([page.id, index, page.rotation, fit, customZoom]) : '';
  if (key !== viewKey) { viewKey = key; schedulePreview(); }
  if (!hasPages) { ++previewVersion; previewTask?.cancel(); $('canvas-stage').replaceChildren(); }
}
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { const page = history.pages.find(page => page.id === entry.target.dataset.page); if (page) queueThumbnail(page, entry.target, true); }
}, { root: $('page-list'), rootMargin: '150px' });

async function pdfDocument(sourceId) {
  const source = sources.get(sourceId); if (!source) throw new Error('The source document is no longer available.');
  if (!source.promise) {
    source.loading = pdfjs.getDocument({
      data: new Uint8Array(source.preview),
      cMapUrl: new URL('./vendor/cmaps/', import.meta.url).href, cMapPacked: true,
      standardFontDataUrl: new URL('./vendor/standard_fonts/', import.meta.url).href,
      wasmUrl: new URL('./vendor/wasm/', import.meta.url).href,
      iccUrl: new URL('./vendor/iccs/', import.meta.url).href,
      isEvalSupported: false, enableXfa: false,
    });
    source.preview = null;
    source.promise = source.loading.promise;
  }
  return source.promise;
}
function queueThumbnail(page, card, force = false) {
  const key = `${page.id}:${page.rotation}`;
  if (card.dataset.thumbKey === `${page.sourceId}:${page.index}:${page.rotation}` || thumbnailPending.has(key)) return;
  // Invisible thumbnails stay placeholders until they approach the sidebar viewport.
  if (!force) { const bounds = card.getBoundingClientRect(), root = $('page-list').getBoundingClientRect(); if (!card.isConnected || bounds.bottom < root.top - 150 || bounds.top > root.bottom + 150) return; }
  thumbnailPending.add(key); thumbnailQueue.push({ page, card, key }); drainThumbnails();
}
function drainThumbnails() {
  while (thumbnailRunning < 2 && thumbnailQueue.length) {
    const item = thumbnailQueue.shift(); thumbnailRunning++;
    drawThumbnail(item).catch(() => { if (item.card.isConnected) item.card.querySelector('.thumbnail-wrap').textContent = 'PDF'; }).finally(() => { thumbnailRunning--; thumbnailPending.delete(item.key); drainThumbnails(); });
  }
}
async function drawThumbnail({ page, card }) {
  if (!card.isConnected || !history.pages.some(p => p.id === page.id && p.rotation === page.rotation)) return;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  if (!page.sourceId) { const swapped = page.rotation % 180 !== 0; const w = swapped ? page.height : page.width, h = swapped ? page.width : page.height; const scale = Math.min(116 / w, 166 / h); canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale)); canvas.getContext('2d').fillStyle = '#fff'; canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height); }
  else {
    const document = await pdfDocument(page.sourceId), original = await document.getPage(page.index + 1);
    const base = original.getViewport({ scale: 1, rotation: page.rotation });
    const viewport = original.getViewport({ scale: Math.min(116 / base.width, 166 / base.height), rotation: page.rotation });
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await original.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  }
  if (!card.isConnected || !history.pages.some(p => p.id === page.id && p.rotation === page.rotation)) return;
  canvas.style.width = `${canvas.width / 2}px`; canvas.style.height = `${canvas.height / 2}px`;
  card.querySelector('.thumbnail-wrap').replaceChildren(canvas); card.dataset.thumbKey = `${page.sourceId}:${page.index}:${page.rotation}`;
}
function schedulePreview() { cancelAnimationFrame(renderFrame); renderFrame = requestAnimationFrame(() => drawPreview()); }
async function drawPreview() {
  const page = activePage(); if (!page) return;
  const generation = ++previewVersion; previewTask?.cancel(); previewTask = null;
  const stage = $('canvas-stage'), scroller = $('preview-scroll');
  stage.classList.add('rendering'); stage.setAttribute('aria-busy', 'true');
  try {
    let original;
    if (page.sourceId) original = await (await pdfDocument(page.sourceId)).getPage(page.index + 1);
    if (generation !== previewVersion) return;
    const rotated = page.rotation % 180 !== 0;
    const base = original ? original.getViewport({ scale: 1, rotation: page.rotation }) : { width: rotated ? page.height : page.width, height: rotated ? page.width : page.height };
    const narrow = scroller.clientWidth < 500, padding = narrow ? 40 : 90;
    const maxW = Math.max(80, scroller.clientWidth - padding), maxH = Math.max(120, scroller.clientHeight - 45);
    currentScale = fit === 'page' ? Math.min(maxW / base.width, maxH / base.height) : fit === 'width' ? maxW / base.width : customZoom;
    currentScale = Math.max(0.05, Math.min(4, currentScale));
    const cssW = base.width * currentScale, cssH = base.height * currentScale;
    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / (cssW * cssH)));
    const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `Preview of page ${history.pages.findIndex(p => p.id === page.id) + 1}, ${page.label}`);
    canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
    if (original) {
      const viewport = original.getViewport({ scale: currentScale * ratio, rotation: page.rotation });
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const task = original.render({ canvasContext: canvas.getContext('2d'), viewport }); previewTask = task; await task.promise;
    } else { canvas.width = Math.ceil(cssW * ratio); canvas.height = Math.ceil(cssH * ratio); canvas.getContext('2d').fillStyle = '#fff'; canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height); }
    if (generation !== previewVersion) return;
    stage.style.width = cssW + (narrow ? 30 : 72) > scroller.clientWidth ? `${cssW + (narrow ? 30 : 72)}px` : '100%';
    stage.replaceChildren(canvas); $('zoom-value').textContent = `${Math.round(currentScale * 100)}%`;
    $('fit-mode').value = fit;
  } catch (error) {
    if (error.name !== 'RenderingCancelledException' && generation === previewVersion) {
      stage.replaceChildren(); const message = document.createElement('p'); message.textContent = 'Preview unavailable. Try selecting the page again or reimporting the file.'; stage.append(message); errors(`${page.label}: ${error.message}`);
    }
  } finally { if (generation === previewVersion) { stage.classList.remove('rendering'); stage.setAttribute('aria-busy', 'false'); } }
}
new ResizeObserver(() => schedulePreview()).observe($('preview-scroll'));

function showDialog({ title, description, fields = '', confirm = 'Continue', submit, cancel = true }) {
  $('dialog-body').innerHTML = `<h2>${esc(title)}</h2>${description ? `<p>${esc(description)}</p>` : ''}${fields}`;
  $('dialog-confirm').textContent = confirm; $('dialog-cancel').hidden = !cancel;
  $('dialog-error').hidden = true; dialogSubmit = submit; $('dialog').showModal();
}
$('dialog-cancel').onclick = () => $('dialog').close();
$('dialog-form').addEventListener('submit', async event => {
  event.preventDefault(); $('dialog-error').hidden = true;
  try { await dialogSubmit?.(new FormData($('dialog-form'))); }
  catch (error) { $('dialog-error').textContent = error.message; $('dialog-error').hidden = false; }
});
const sizeFields = () => '<div class="field-row"><div><label for="insert-size">Page size</label><select id="insert-size" name="size"><option value="a4">A4</option><option value="letter">Letter</option><option value="match">Match selected page</option></select></div><div><label for="insert-orientation">Orientation</label><select id="insert-orientation" name="orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div></div>';
const positionField = () => `<label for="insert-position">Insert pages</label><select id="insert-position" name="position"><option value="end">At end of document</option><option value="before" ${history.active ? '' : 'disabled'}>Before selected page</option><option value="after" ${history.active ? '' : 'disabled'}>After selected page</option></select>`;
function openFiles(options = {}) { if (busy) return; pendingImport = { size: 'a4', orientation: 'portrait', position: 'end', ...options }; $('file-input').value = ''; $('file-input').click(); }
$('add-files').onclick = () => openFiles(); $('empty-add').onclick = () => openFiles();
$('file-input').onchange = () => { if ($('file-input').files.length) importFiles([...$('file-input').files], pendingImport); };
async function importFiles(files, options = {}) {
  if (busy || !files.length) return;
  options ||= {};
  errors([]);
  if (sourceBytes() + files.reduce((sum, file) => sum + file.size, 0) > MAX_BYTES) { errors('These files would exceed the 100 MB combined limit. Choose fewer or smaller files, or start a new document. Files retained by undo history count towards the limit.'); status('Import cancelled · Document unchanged'); return; }
  setBusy(true);
  const imported = [], failures = [], dimensions = pageDimensions(options.size || 'a4', options.orientation || 'portrait', activePage());
  const startTime = performance.now();
  try {
    for (let index = 0; index < files.length; index++) {
      const file = files[index]; status(`Adding ${file.name} (${index + 1} of ${files.length})…`);
      const id = newId();
      try {
        const bytes = await file.arrayBuffer();
        const result = await rpc('import', { id, bytes, name: file.name, size: file.size, width: dimensions[0], height: dimensions[1] }, [bytes]);
        sources.set(id, { name: file.name, size: file.size, preview: result.preview });
        for (const page of result.pages) imported.push({ ...page, id: newId(), sourceId: id, label: file.name });
      } catch (error) { failures.push(`${file.name}: ${error.message}`); }
    }
    if (imported.length) {
      const next = insertAt(history.pages, imported, options.position || 'end', history.active);
      history.commit(next, imported.map(page => page.id), imported[0].id);
      if (autoTitle) { $('document-title').value = files.find(file => /\.pdf$/i.test(file.name))?.name.replace(/\.pdf$/i, '') || 'Untitled document'; autoTitle = false; }
      await collectSources(); render(); cards.get(history.active)?.scrollIntoView({ block: 'nearest' });
      status(`Added ${imported.length} ${imported.length === 1 ? 'page' : 'pages'} · Originals stay untouched`);
      console.info(`PDF Desk import: ${files.length} files, ${imported.length} pages, ${Math.round(performance.now() - startTime)} ms`);
    } else status('No pages added · Document unchanged');
    if (failures.length) errors(failures);
  } catch (error) { errors(error.message); }
  finally { setBusy(false); }
}
$('insert').onclick = () => showDialog({ title: 'Insert pages', description: 'Add a PDF, an image, or a blank page. Image proportions stay intact.', fields: `<label for="insert-type">Add</label><select id="insert-type" name="type"><option value="blank">Blank page</option><option value="files">PDFs or images</option></select>${sizeFields()}${positionField()}`, confirm: 'Insert pages', submit: data => {
  const options = Object.fromEntries(data); $('dialog').close();
  if (options.type === 'files') { openFiles(options); return; }
  const [width, height] = pageDimensions(options.size, options.orientation, activePage());
  const page = { id: newId(), sourceId: null, index: 0, width, height, rotation: 0, label: 'Blank page' };
  history.commit(insertAt(history.pages, [page], options.position, history.active), [page.id], page.id); render(); collectSources().catch(error => errors(error.message)); status('Blank page inserted');
} });
$('page-list').addEventListener('click', event => {
  if (busy) return; const card = event.target.closest('[data-page]'); if (!card) return;
  history.select(card.dataset.page, { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey });
  render(); status(`${history.selected.size} ${history.selected.size === 1 ? 'page' : 'pages'} selected`);
});
$('select-all').onclick = () => { history.selected = new Set(history.pages.map(page => page.id)); render(); status(`${history.selected.size} pages selected`); };
$('range-form').onsubmit = event => { event.preventDefault(); if (busy) return; try { const indices = parseRange($('page-range').value, history.pages.length); history.selected = new Set(indices.map(i => history.pages[i].id)); history.active = history.pages[indices[0]].id; history.anchor = history.active; $('page-range').setAttribute('aria-invalid', 'false'); errors([]); render(); cards.get(history.active)?.scrollIntoView({ block: 'nearest' }); status(`${history.selected.size} pages selected`); } catch (error) { $('page-range').setAttribute('aria-invalid', 'true'); errors(error.message); } };
$('rotate').onclick = () => { if (busy || !history.selected.size) return; history.commit(history.pages.map(page => history.selected.has(page.id) ? { ...page, rotation: (page.rotation + 90) % 360 } : page)); render(); status('Selected pages rotated 90° clockwise'); };
$('duplicate').onclick = () => { if (busy || !history.selected.size) return; const ids = []; const pages = history.pages.flatMap(page => { if (!history.selected.has(page.id)) return [page]; const copy = { ...page, id: newId() }; ids.push(copy.id); return [page, copy]; }); history.commit(pages, ids, ids[0]); render(); status('Selected pages duplicated'); };
$('delete').onclick = () => { if (busy || !history.selected.size) return; const count = history.selected.size, at = history.pages.findIndex(page => history.selected.has(page.id)); const pages = history.pages.filter(page => !history.selected.has(page.id)); const next = pages[Math.min(at, pages.length - 1)]?.id; history.commit(pages, next ? [next] : [], next || null); render(); collectSources().catch(error => errors(error.message)); status(`${count} ${count === 1 ? 'page' : 'pages'} deleted · Undo is available`); };
$('undo').onclick = () => { if (!busy && history.undo()) { render(); collectSources().catch(error => errors(error.message)); status('Change undone'); } };
$('redo').onclick = () => { if (!busy && history.redo()) { render(); collectSources().catch(error => errors(error.message)); status('Change reapplied'); } };
$('move').onclick = () => showDialog({ title: 'Move selected pages', description: 'Selected pages move together and retain their document order.', fields: `<label for="move-position">Position</label><select id="move-position" name="position"><option value="before">Before page</option><option value="after">After page</option></select><label for="move-target">Destination</label><select id="move-target" name="target">${history.pages.map((page, index) => `<option value="${page.id}" ${history.selected.has(page.id) ? 'disabled' : ''}>Page ${index + 1} — ${esc(page.label)}</option>`).join('')}<option value="end">End of document</option></select>`, confirm: 'Move pages', submit: data => { history.commit(movePages(history.pages, [...history.selected], data.get('target'), data.get('position') === 'after')); $('dialog').close(); render(); status('Selected pages moved'); } });

$('page-list').addEventListener('dragstart', event => { const card = event.target.closest('[data-page]'); if (!card || busy) { event.preventDefault(); return; } if (!history.selected.has(card.dataset.page)) { history.select(card.dataset.page); render(); } dragging = [...history.selected]; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-pdf-desk-pages', JSON.stringify(dragging)); });
$('page-list').addEventListener('dragover', event => { if (!dragging || busy) return; const card = event.target.closest('[data-page]'); if (!card || dragging.includes(card.dataset.page)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; for (const el of cards.values()) el.classList.toggle('drop-before', el === card); });
$('page-list').addEventListener('drop', event => { if (!dragging || busy) return; const card = event.target.closest('[data-page]'); if (!card || dragging.includes(card.dataset.page)) return; event.preventDefault(); try { history.commit(movePages(history.pages, dragging, card.dataset.page)); render(); status('Pages reordered'); } catch (error) { errors(error.message); } clearDrag(); });
function clearDrag() { dragging = null; for (const card of cards.values()) card.classList.remove('drop-before'); }
document.addEventListener('dragend', clearDrag);
let fileDragDepth = 0;
document.addEventListener('dragenter', event => { if (!event.dataTransfer.types.includes('Files') || busy) return; event.preventDefault(); fileDragDepth++; $('drop-overlay').hidden = false; });
document.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; } });
document.addEventListener('dragleave', event => { if (!event.dataTransfer.types.includes('Files')) return; fileDragDepth = Math.max(0, fileDragDepth - 1); if (!fileDragDepth) $('drop-overlay').hidden = true; });
document.addEventListener('drop', event => { if (!event.dataTransfer.types.includes('Files')) return; event.preventDefault(); fileDragDepth = 0; $('drop-overlay').hidden = true; if (!busy) importFiles([...event.dataTransfer.files]); });

function navigate(index) { if (busy || !history.pages[index]) return; history.select(history.pages[index].id); render(); cards.get(history.active)?.scrollIntoView({ block: 'nearest' }); }
$('previous').onclick = () => navigate(history.pages.findIndex(page => page.id === history.active) - 1);
$('next').onclick = () => navigate(history.pages.findIndex(page => page.id === history.active) + 1);
$('page-number').onchange = () => { const index = Number($('page-number').value) - 1; if (!Number.isInteger(index) || index < 0 || index >= history.pages.length) { errors(`Choose a page from 1 to ${history.pages.length}.`); $('page-number').value = history.pages.findIndex(page => page.id === history.active) + 1; return; } navigate(index); };
function zoom(delta) { if (busy) return; fit = 'custom'; customZoom = Math.max(0.1, Math.min(4, currentScale + delta)); viewKey = ''; render(); }
$('zoom-in').onclick = () => zoom(0.15); $('zoom-out').onclick = () => zoom(-0.15);
$('fit-mode').onchange = () => { if ($('fit-mode').value === 'custom') customZoom = currentScale; fit = $('fit-mode').value; viewKey = ''; render(); };
$('document-title').oninput = () => { autoTitle = false; updateControls(); };
$('dismiss-message').onclick = () => errors([]);

$('save-copy').onclick = () => {
  if (busy || !history.pages.length) return;
  const name = ($('document-title').value || 'document').replace(/\.pdf$/i, '') + '-edited.pdf';
  showDialog({ title: 'Save a copy', description: 'Your source files stay untouched. Your browser chooses the download location or asks where to save.', fields: `<label for="output-name">Filename</label><input id="output-name" name="filename" value="${esc(name)}" required maxlength="184"><label for="export-scope">Pages to include</label><select id="export-scope" name="scope"><option value="all">All ${history.pages.length} pages</option><option value="selected" ${history.selected.size ? '' : 'disabled'}>Selected pages (${history.selected.size})</option></select>`, confirm: 'Save a copy', submit: async data => {
    const filename = safeFilename(data.get('filename'));
    const scope = data.get('scope'); const pages = scope === 'selected' ? selectPages() : history.pages;
    if (!pages.length) throw new Error('Select at least one page to export.');
    $('dialog').close(); setBusy(true); errors([]); status('Preparing your PDF…');
    try {
      const started = performance.now();
      const bytes = await rpc('export', { pages }, [], ({ done, total }) => status(`Preparing page ${done} of ${total}…`));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (scope === 'all') history.markSaved();
      status(`Download started · ${filename} · Originals preserved`);
      console.info(`PDF Desk export: ${pages.length} pages, ${Math.round(performance.now() - started)} ms`);
    } catch (error) { errors(`Could not save the PDF: ${error.message} Your arrangement is still available; try again.`); status('Export failed · Document retained'); }
    finally { setBusy(false); }
  } });
};
$('new-document').onclick = () => {
  if (busy) return;
  const reset = async () => {
    $('dialog').close(); setBusy(true); ++previewVersion; previewTask?.cancel();
    for (const source of sources.values()) source.loading?.destroy(); sources.clear();
    await rpc('reset'); history.reset(); $('document-title').value = 'Untitled document'; autoTitle = true; $('page-range').value = ''; $('file-input').value = ''; pendingImport = {}; errors([]); viewKey = ''; render(); setBusy(false); status('Ready · Originals stay untouched');
  };
  if (history.pages.length || history.dirty) showDialog({ title: 'Start a new document?', description: history.dirty ? 'Your unsaved arrangement will be cleared. Save a copy first if you want to keep it. Your source files stay untouched.' : 'The current arrangement and undo history will be cleared. Your source files stay untouched.', confirm: 'Start new', submit: reset });
  else reset().catch(error => { errors(error.message); setBusy(false); });
};
$('help').onclick = () => showDialog({ title: 'A little help for your desk', description: 'Everything stays on this computer. Start with Add files or drop PDFs, JPEGs and PNGs into the window.', fields: '<dl class="shortcut-list"><dt>Select multiple pages</dt><dd><kbd>Ctrl</kbd> + click</dd><dt>Select a range</dt><dd><kbd>Shift</kbd> + click</dd><dt>Select all pages</dt><dd><kbd>Ctrl</kbd> + <kbd>A</kbd></dd><dt>Undo / redo</dt><dd><kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Y</kbd></dd><dt>Duplicate selected pages</dt><dd><kbd>Ctrl</kbd> + <kbd>D</kbd></dd><dt>Delete selected pages</dt><dd><kbd>Delete</kbd></dd><dt>Save a copy</dt><dd><kbd>Ctrl</kbd> + <kbd>S</kbd></dd><dt>Open files</dt><dd><kbd>Ctrl</kbd> + <kbd>O</kbd></dd><dt>Move through pages</dt><dd><kbd>↑</kbd> / <kbd>↓</kbd></dd></dl><p class="help-note">The 100 MB combined limit includes source files retained for undo. New clears them. Password-protected files and specialist PDF features such as forms, bookmarks and signatures are outside v1. Browser downloads may save automatically to your Downloads folder; check your browser settings to choose a location each time.</p>', confirm: 'Got it', cancel: false, submit: () => $('dialog').close() });
window.addEventListener('beforeunload', event => { if (history.dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('keydown', event => {
  if ($('dialog').open || busy) return;
  const editing = event.target.matches('input,textarea,select,[contenteditable=true]');
  const ctrl = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
  if (ctrl && key === 's') { event.preventDefault(); if (history.pages.length) $('save-copy').click(); return; }
  if (ctrl && key === 'o') { event.preventDefault(); openFiles(); return; }
  if (editing) return;
  if (ctrl && key === 'a') { event.preventDefault(); $('select-all').click(); }
  else if (ctrl && key === 'z') { event.preventDefault(); $(event.shiftKey ? 'redo' : 'undo').click(); }
  else if (ctrl && key === 'y') { event.preventDefault(); $('redo').click(); }
  else if (ctrl && key === 'd') { event.preventDefault(); $('duplicate').click(); }
  else if (key === 'delete' || key === 'backspace') { event.preventDefault(); $('delete').click(); }
  else if (key === 'arrowup' || key === 'arrowdown') { event.preventDefault(); const index = history.pages.findIndex(page => page.id === history.active) + (key === 'arrowup' ? -1 : 1); if (event.shiftKey && history.pages[index]) { history.select(history.pages[index].id, { range: true }); render(); cards.get(history.active)?.scrollIntoView({ block: 'nearest' }); } else navigate(index); }
});
render();
if (window.lucide) window.lucide.createIcons();
