import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, 'public');
const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.bcmap': 'application/octet-stream', '.icc': 'application/octet-stream', '.pfb': 'application/octet-stream' };
export function createAppServer() {
  return http.createServer(async (req, res) => {
    const address = `127.0.0.1:${req.socket.localPort}`;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    if (req.headers.host !== address && req.headers.host !== `localhost:${req.socket.localPort}`) { res.writeHead(403).end('Local access only.'); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    if (req.url === '/__pdf-desk') { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ app: 'pdf-desk', version: '1.0.1' })); return; }
    let file;
    try {
      const path = decodeURIComponent(new URL(req.url, `http://${address}`).pathname);
      file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(root + sep) || path.includes('\\') || path.includes('\0')) throw new Error('Invalid path');
      if (!(await stat(file)).isFile()) throw new Error('Not a file');
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': bytes.length });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('File not found.'); }
  });
}

function openBrowser(url) {
  if (process.platform === 'win32') execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process -FilePath '${url}'`], { windowsHide: true });
  else execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], () => {});
}

export async function start({ port = 43127, open = false } = {}) {
  for (let candidate = port; candidate < port + 10; candidate++) {
    const server = createAppServer();
    try {
      await new Promise((resolveListening, reject) => { server.once('error', reject); server.listen(candidate, '127.0.0.1', resolveListening); });
      const url = `http://127.0.0.1:${server.address().port}`;
      console.log(`PDF Desk: ${url}`);
      if (open) openBrowser(url);
      return server;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      try {
        const response = await fetch(`http://127.0.0.1:${candidate}/__pdf-desk`, { signal: AbortSignal.timeout(700) });
        const identity = await response.json();
        if (identity.app === 'pdf-desk') { console.log(`PDF Desk already running: http://127.0.0.1:${candidate}`); if (open) openBrowser(`http://127.0.0.1:${candidate}`); return null; }
      } catch { /* Try another local port if it belongs to another application. */ }
    }
  }
  throw new Error('Ports 43127–43136 are busy. Close an old PDF Desk server or run with --port <number>.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const option = process.argv.indexOf('--port');
  const port = option < 0 ? 43127 : Number(process.argv[option + 1]);
  if (!Number.isInteger(port) || port < 1024 || port > 65525) { console.error('Choose a port between 1024 and 65525.'); process.exitCode = 1; }
  else start({ port, open: process.argv.includes('--open') }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
