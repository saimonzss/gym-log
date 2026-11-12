import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, readState } from './helpers.js';
import { defaultState } from '../../src/storage.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); });

function seedState() {
  const s = defaultState();
  for (let i = 0; i < 7; i++) s.routine[i].rest = true; // no session is auto-created today
  const mk = (date, doneFlags) => ({
    id: 's' + date, date, dayIndex: 4, dayName: 'Pecho', finished: true,
    exercises: [{ exerciseId: 'ex1', name: 'Press banca', targetSets: 3, targetReps: 8,
      sets: doneFlags.map((done) => ({ weight: 60, reps: 8, done })) }],
  });
  s.sessions = [mk('2026-10-01', [true, true, false]), mk('2026-10-08', [true, true, true])];
  return s;
}

test('history lists sessions from newest to oldest', async () => {
  const app = await openApp(server.url, { seed: seedState() });
  try {
    await app.page.click('[data-tab="history"]');
    const items = await app.page.locator('.history-item').allInnerTexts();
    assert.equal(items.length, 2);
    assert.match(items[0], /8 de octubre/);
    assert.match(items[0], /3\/3/);
    assert.match(items[1], /1 de octubre/);
    assert.match(items[1], /2\/3/);
  } finally { await app.close(); }
});

test('completing a pending set of an old session persists after reload', async () => {
  const app = await openApp(server.url, { seed: seedState() });
  try {
    await app.page.click('[data-tab="history"]');
    await app.page.locator('.history-item').nth(1).click();
    await app.page.locator('.set-toggle').nth(2).click();
    await app.page.reload();
    const old = (await readState(app.page)).sessions.find((x) => x.date === '2026-10-01');
    assert.equal(old.exercises[0].sets[2].done, true);
    await app.page.click('[data-tab="history"]');
    assert.match(await app.page.locator('.history-item').nth(1).innerText(), /3\/3/);
  } finally { await app.close(); }
});

test('deleting a session asks for confirmation and removes it only when accepted', async () => {
  const app = await openApp(server.url, { seed: seedState() });
  try {
    await app.page.click('[data-tab="history"]');
    await app.page.locator('.history-item').nth(1).click();
    app.page.once('dialog', (d) => d.dismiss());
    await app.page.locator('.delete-session').click();
    assert.equal((await readState(app.page)).sessions.length, 2);
    app.page.once('dialog', (d) => d.accept());
    await app.page.locator('.delete-session').click();
    assert.equal((await readState(app.page)).sessions.length, 1);
    assert.equal(await app.page.locator('.history-item').count(), 1);
  } finally { await app.close(); }
});
