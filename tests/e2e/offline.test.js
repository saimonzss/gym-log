import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, openApp, readState } from './helpers.js';
import { defaultState } from '../../src/storage.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); });

const ROOT = path.resolve(import.meta.dirname, '../..');
const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test('sw.js precache list covers every app file', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const listed = [...sw.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const needed = ['index.html', 'styles.css', 'manifest.webmanifest', ...walk('src'), ...walk('icons')];
  for (const f of needed) assert.ok(listed.includes(f), `${f} missing from sw.js FILES`);
});

test('manifest is standalone and its icons are served', async () => {
  const app = await openApp(server.url);
  try {
    const res = await app.page.request.get(server.url + 'manifest.webmanifest');
    const m = await res.json();
    assert.equal(m.display, 'standalone');
    assert.ok(m.icons.length >= 2);
    for (const icon of [...m.icons.map((i) => i.src), 'icons/apple-touch-icon.png']) {
      assert.equal((await app.page.request.get(server.url + icon)).status(), 200, icon);
    }
    assert.equal(await app.page.locator('link[rel="apple-touch-icon"]').count(), 1);
  } finally { await app.close(); }
});

test('app opens offline after the first load and keeps its data', async () => {
  const s = defaultState();
  s.settings.lastBackupAt = new Date().toISOString();
  s.routine[1].name = 'Pecho offline';
  const app = await openApp(server.url, { seed: s, serviceWorkers: 'allow' });
  try {
    await app.page.evaluate(() => Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error('service worker never became ready')), 3000)),
    ]));
    await app.context.setOffline(true);
    await app.page.reload();
    await app.page.waitForSelector('#tabs');
    await app.page.click('[data-tab="routine"]');
    assert.equal(await app.page.inputValue('[data-day="1"] .day-name'), 'Pecho offline');
    assert.equal((await readState(app.page)).routine[1].name, 'Pecho offline');
  } finally { await app.close(); }
});
