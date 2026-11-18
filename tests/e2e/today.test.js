import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, readState } from './helpers.js';
import { defaultState } from '../../src/storage.js';
import { localDateISO } from '../../src/logic.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); });

const TODAY = localDateISO();
const DAY = new Date().getDay();

function routineState({ rest = false, history = [] } = {}) {
  const s = defaultState();
  s.routine[DAY] = { name: 'Pecho', rest, exercises: [{ id: 'ex1', name: 'Press banca', sets: 3, reps: 8 }] };
  s.sessions = history;
  return s;
}
function past(date, weight, { done = true, reps = 8 } = {}) {
  return {
    id: 'p-' + date, date, dayIndex: DAY, dayName: 'Pecho', finished: true,
    exercises: [{ exerciseId: 'ex1', name: 'Press banca', targetSets: 3, targetReps: 8,
      sets: [0, 1, 2].map(() => ({ weight, reps, done })) }],
  };
}
const todaySessions = (state) => state.sessions.filter((s) => s.date === TODAY);

test('Today shows 3 sets prefilled from the last session', async () => {
  const app = await openApp(server.url, { seed: routineState({ history: [past('2026-10-01', 60)] }) });
  try {
    assert.equal(await app.page.locator('.set').count(), 3);
    assert.match(await app.page.locator('.set-toggle').first().getAttribute('aria-label'), /60 kg × 8/);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

test('tapping a set marks it done and it survives a reload', async () => {
  const app = await openApp(server.url, { seed: routineState({ history: [past('2026-10-01', 60)] }) });
  try {
    await app.page.locator('.set-toggle').first().click();
    assert.equal(await app.page.locator('.set-toggle').first().getAttribute('aria-pressed'), 'true');
    await app.page.reload();
    assert.equal(await app.page.locator('.set-toggle').first().getAttribute('aria-pressed'), 'true');
    assert.equal(todaySessions(await readState(app.page))[0].exercises[0].sets[0].done, true);
  } finally { await app.close(); }
});

test('+2,5 kg changes 60 to 62,5', async () => {
  const app = await openApp(server.url, { seed: routineState({ history: [past('2026-10-01', 60)] }) });
  try {
    await app.page.locator('.w-plus').first().click();
    assert.match(await app.page.locator('.set-toggle').first().getAttribute('aria-label'), /62,5 kg × 8/);
    assert.equal(todaySessions(await readState(app.page))[0].exercises[0].sets[0].weight, 62.5);
  } finally { await app.close(); }
});

test('weight never goes below 0 with -2,5 kg', async () => {
  const app = await openApp(server.url, { seed: routineState() });
  try {
    await app.page.locator('.w-minus').first().click();
    assert.equal(todaySessions(await readState(app.page))[0].exercises[0].sets[0].weight, 0);
  } finally { await app.close(); }
});

test('typing 62,5 works and empty or invalid text never stores NaN', async () => {
  const app = await openApp(server.url, { seed: routineState({ history: [past('2026-10-01', 60)] }) });
  try {
    const input = app.page.locator('.w-input').first();
    await input.fill('62,5');
    assert.equal(todaySessions(await readState(app.page))[0].exercises[0].sets[0].weight, 62.5);
    await input.fill('');
    await input.fill('abc');
    const w = todaySessions(await readState(app.page))[0].exercises[0].sets[0].weight;
    assert.ok(Number.isFinite(w) && w >= 0);
    const reps = app.page.locator('.r-input').first();
    await reps.fill('-3');
    assert.ok(todaySessions(await readState(app.page))[0].exercises[0].sets[0].reps >= 0);
  } finally { await app.close(); }
});

test('opening Today twice does not duplicate the session', async () => {
  const app = await openApp(server.url, { seed: routineState() });
  try {
    await app.page.locator('.set-toggle').first().click();
    await app.page.reload();
    await app.page.reload();
    assert.equal(todaySessions(await readState(app.page)).length, 1);
  } finally { await app.close(); }
});

test('opening Today alone saves nothing, and exercises added to the routine later show up', async () => {
  const s = routineState();
  s.routine[DAY].exercises = [];
  const app = await openApp(server.url, { seed: s });
  try {
    assert.match(await app.page.locator('main').innerText(), /No hay ejercicios/);
    assert.equal(todaySessions(await readState(app.page)).length, 0);
    await app.page.click('[data-tab="routine"]');
    await app.page.click(`[data-day="${DAY}"] .add-exercise`);
    await app.page.fill(`[data-day="${DAY}"] .ex-name`, 'Remo');
    await app.page.click('[data-tab="today"]');
    assert.equal(await app.page.locator('.exercise-card').count(), 1);
    assert.equal(await app.page.locator('.set').count(), 3);
  } finally { await app.close(); }
});

test('suggestion appears after 3 matching sessions and applies +2,5 to pending sets', async () => {
  const history = [past('2026-09-20', 60), past('2026-09-27', 60), past('2026-10-04', 60)];
  const app = await openApp(server.url, { seed: routineState({ history }) });
  try {
    const hint = app.page.locator('.suggestion');
    assert.match(await hint.innerText(), /62,5/);
    await hint.click();
    const sets = todaySessions(await readState(app.page))[0].exercises[0].sets;
    assert.deepEqual(sets.map((x) => x.weight), [62.5, 62.5, 62.5]);
  } finally { await app.close(); }
});

test('no suggestion with only 2 matching sessions', async () => {
  const app = await openApp(server.url, { seed: routineState({ history: [past('2026-09-27', 60), past('2026-10-04', 60)] }) });
  try {
    assert.equal(await app.page.locator('.suggestion').count(), 0);
  } finally { await app.close(); }
});

test('Finalizar marks the session finished', async () => {
  const app = await openApp(server.url, { seed: routineState() });
  try {
    await app.page.locator('.finish').click();
    assert.equal(todaySessions(await readState(app.page))[0].finished, true);
  } finally { await app.close(); }
});

test('rest day shows the rest message and creates no session', async () => {
  const app = await openApp(server.url, { seed: routineState({ rest: true }) });
  try {
    assert.match(await app.page.locator('main').innerText(), /descanso/i);
    assert.equal(todaySessions(await readState(app.page)).length, 0);
  } finally { await app.close(); }
});

test('tapping a set or a stepper updates that row in place without rebuilding the screen', async () => {
  const app = await openApp(server.url, { seed: routineState({ history: [past('2026-10-01', 60)] }) });
  try {
    await app.page.evaluate(() => {
      document.querySelector('.set').__marker = 1;
      document.querySelector('.exercise-card').__marker = 1;
    });
    await app.page.locator('.set-toggle').first().click();
    await app.page.locator('.w-plus').first().click();
    await app.page.locator('.r-plus').first().click();
    const same = await app.page.evaluate(() => document.querySelector('.set').__marker === 1 && document.querySelector('.exercise-card').__marker === 1);
    assert.equal(same, true, 'screen was rebuilt');
    assert.equal(await app.page.locator('.set-toggle').first().getAttribute('aria-pressed'), 'true');
    assert.equal(await app.page.inputValue('.w-input >> nth=0'), '62,5');
    assert.equal(await app.page.inputValue('.r-input >> nth=0'), '9');
    assert.equal(await app.page.locator('.exercise-card .chip').first().innerText(), '1/3');
    assert.equal(await app.page.locator('.seg.done').count(), 1);
    assert.match(await app.page.locator('.load-text').innerText(), /1 de 3/);
    const set = todaySessions(await readState(app.page))[0].exercises[0].sets[0];
    assert.deepEqual(set, { weight: 62.5, reps: 9, done: true });
  } finally { await app.close(); }
});

test('marking every set makes Finalizar ready, unmarking one undoes it', async () => {
  const app = await openApp(server.url, { seed: routineState() });
  try {
    for (let i = 0; i < 3; i++) await app.page.locator('.set-toggle').nth(i).click();
    assert.match(await app.page.locator('.finish').getAttribute('class'), /ready/);
    assert.equal(await app.page.locator('.exercise-card .chip').first().innerText(), '3/3');
    await app.page.locator('.set-toggle').nth(1).click();
    assert.doesNotMatch(await app.page.locator('.finish').getAttribute('class'), /ready/);
    const sets = todaySessions(await readState(app.page))[0].exercises[0].sets;
    assert.deepEqual(sets.map((x) => x.done), [true, false, true]);
  } finally { await app.close(); }
});
