import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAppServer } from '../server.mjs';
test('server serves only static app assets, advertises local identity and rejects writes and foreign hosts', async t => {
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const index = await fetch(base); assert.equal(index.status, 200); assert((await index.text()).includes('PDF Desk')); assert(index.headers.get('content-security-policy').includes("connect-src 'self'"));
  assert.equal((await fetch(base + '/__pdf-desk')).status, 200);
  assert.equal((await fetch(base + '/vendor/pdf.worker.mjs')).headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal((await fetch(base, { method: 'POST', body: 'never accept files' })).status, 405);
  assert.equal((await fetch(base + '/%2e%2e/server.mjs')).status, 404);
  assert.equal((await fetch(base + '/%5c..%5cserver.mjs')).status, 404);
  const foreign = await new Promise(resolve => { const req = http.get(base, { headers: { Host: 'unrelated.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', error => resolve(error)); }); assert.equal(foreign, 403);
});
