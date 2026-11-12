import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp } from './helpers.js';
import { defaultState } from '../../src/storage.js';
import { localDateISO } from '../../src/logic.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); });

const YM = localDateISO().slice(0, 7);

function seedState() {
  const s = defaultState();
  for (let i = 0; i < 7; i++) s.routine[i].rest = true;
  const mk = (day, weight, done = true) => ({
    id: 's' + day, date: `${YM}-${day}`, dayIndex: 1, dayName: 'Pecho', finished: true,
    exercises: [{ exerciseId: 'ex1', name: 'Press banca', targetSets: 2, targetReps: 8,
      sets: [{ weight, reps: 8, done }, { weight: weight + 10, reps: 8, done: false }] }],
  });
  s.sessions = [mk('01', 60), mk('03', 62.5), mk('05', 65), mk('07', 100, false)]; // last one: nothing done
  return s;
}

test('progress shows chart points, record and trained days', async () => {
  const app = await openApp(server.url, { seed: seedState() });
  try {
    await app.page.click('[data-tab="progress"]');
    assert.deepEqual(await app.page.locator('#ex-select option').allInnerTexts(), ['Press banca']);
    assert.equal(await app.page.locator('svg.chart circle.point').count(), 3);
    assert.match(await app.page.locator('.record').innerText(), /65 kg/);
    const trained = await app.page.locator('.day.trained').allInnerTexts();
    assert.deepEqual(trained.map((t) => t.trim()), ['1', '3', '5']);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

test('calendar month navigation moves away from and back to the trained month', async () => {
  const app = await openApp(server.url, { seed: seedState() });
  try {
    await app.page.click('[data-tab="progress"]');
    const label = await app.page.locator('.month-label').innerText();
    await app.page.click('.prev-month');
    assert.notEqual(await app.page.locator('.month-label').innerText(), label);
    assert.equal(await app.page.locator('.day.trained').count(), 0);
    await app.page.click('.next-month');
    assert.equal(await app.page.locator('.month-label').innerText(), label);
    assert.equal(await app.page.locator('.day.trained').count(), 3);
  } finally { await app.close(); }
});

test('progress with no sessions shows the empty state', async () => {
  const s = defaultState();
  for (let i = 0; i < 7; i++) s.routine[i].rest = true;
  const app = await openApp(server.url, { seed: s });
  try {
    await app.page.click('[data-tab="progress"]');
    assert.match(await app.page.locator('main').innerText(), /Todavía no hay sesiones/);
  } finally { await app.close(); }
});
