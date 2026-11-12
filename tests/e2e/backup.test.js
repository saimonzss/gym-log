import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, openApp, readState } from './helpers.js';
import { defaultState } from '../../src/storage.js';
import { exportBackup, parseBackup } from '../../src/backup.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); });

const session = (n) => ({
  id: 's' + n, date: `2026-10-0${n}`, dayIndex: 1, dayName: 'Pecho', finished: true,
  exercises: [{ exerciseId: 'ex1', name: 'Press banca', targetSets: 1, targetReps: 8, sets: [{ weight: 60, reps: 8, done: true }] }],
});
function stateWith(n, lastBackupAt = new Date().toISOString()) {
  const s = defaultState();
  for (let i = 0; i < 7; i++) s.routine[i].rest = true; // no session auto-created today
  s.sessions = Array.from({ length: n }, (_, i) => session(i + 1));
  s.settings.lastBackupAt = lastBackupAt;
  return s;
}
const file = (text) => ({ name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(text) });

test('export downloads a file that parseBackup accepts and records lastBackupAt', async () => {
  const app = await openApp(server.url, { seed: stateWith(2, null) });
  try {
    await app.page.click('[data-tab="backup"]');
    const [download] = await Promise.all([app.page.waitForEvent('download'), app.page.click('.export')]);
    assert.match(download.suggestedFilename(), /^gym-log-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = parseBackup(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(parsed.sessions.length, 2);
    await app.page.waitForFunction(() => JSON.parse(localStorage.getItem('gymlog.state')).settings.lastBackupAt !== null);
  } finally { await app.close(); }
});

test('restore replaces data only after confirming; cancelling changes nothing', async () => {
  const app = await openApp(server.url, { seed: stateWith(1) });
  try {
    await app.page.click('[data-tab="backup"]');
    const backup = file(exportBackup(stateWith(2)));
    app.page.once('dialog', (d) => d.dismiss());
    await app.page.setInputFiles('.restore-file', backup);
    await app.page.waitForTimeout(300);
    assert.equal((await readState(app.page)).sessions.length, 1);
    app.page.once('dialog', (d) => d.accept());
    await app.page.setInputFiles('.restore-file', backup);
    await app.page.waitForFunction(() => JSON.parse(localStorage.getItem('gymlog.state')).sessions.length === 2);
  } finally { await app.close(); }
});

test('restoring an empty file or a file from another app shows an error and keeps the data', async () => {
  const app = await openApp(server.url, { seed: stateWith(1) });
  try {
    await app.page.click('[data-tab="backup"]');
    for (const bad of ['', '{"app":"otra"}', 'hola']) {
      await app.page.setInputFiles('.restore-file', file(bad));
      await app.page.waitForSelector('.restore-error:not(:empty)');
      assert.equal((await readState(app.page)).sessions.length, 1);
      await app.page.evaluate(() => { document.querySelector('.restore-error').textContent = ''; });
    }
  } finally { await app.close(); }
});

test('reminder shows when the last backup is 31 days old and there are sessions', async () => {
  const old = new Date(Date.now() - 31 * 86400000).toISOString();
  const app = await openApp(server.url, { seed: stateWith(1, old) });
  try {
    assert.equal(await app.page.locator('.backup-reminder').count(), 1);
    await app.page.click('.backup-reminder .go-backup');
    assert.equal(await app.page.locator('.export').count(), 1);
  } finally { await app.close(); }
});

test('no reminder with a recent backup, or with no sessions at all', async () => {
  const recent = await openApp(server.url, { seed: stateWith(1) });
  try { assert.equal(await recent.page.locator('.backup-reminder').count(), 0); } finally { await recent.close(); }
  const empty = await openApp(server.url, { seed: stateWith(0, null) });
  try { assert.equal(await empty.page.locator('.backup-reminder').count(), 0); } finally { await empty.close(); }
});

test('the startup error screen can restore a backup', async () => {
  const app = await openApp(server.url, { seed: '{roto' });
  try {
    assert.equal(await app.page.isVisible('#error-screen'), true);
    app.page.once('dialog', (d) => d.accept());
    await app.page.setInputFiles('.restore-file', file(exportBackup(stateWith(2))));
    await app.page.waitForSelector('#tabs:not([hidden])');
    assert.equal((await readState(app.page)).sessions.length, 2);
  } finally { await app.close(); }
});
