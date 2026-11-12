import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, readState } from './helpers.js';
import { defaultState } from '../../src/storage.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); });

function everyDayState() {
  const s = defaultState();
  for (let i = 0; i < 7; i++) s.routine[i] = { name: 'Pecho', rest: false, exercises: [{ id: 'ex1', name: 'Press banca', sets: 3, reps: 8 }] };
  return s;
}
const flags = (page) => page.locator('.set-toggle').evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed')));

test('a workout crossing midnight stays on its day until the app comes back to the foreground', async () => {
  const app = await openApp(server.url, { seed: everyDayState(), clockAt: new Date(2026, 10, 12, 23, 58) });
  try {
    await app.page.locator('.set-toggle').nth(0).click();
    await app.page.locator('.set-toggle').nth(1).click();
    await app.page.clock.setFixedTime(new Date(2026, 10, 13, 0, 5));
    await app.page.locator('.set-toggle').nth(2).click(); // still the same workout
    assert.match(await app.page.locator('main').innerText(), /12 de noviembre/i);
    assert.deepEqual(await flags(app.page), ['true', 'true', 'true']);
    const sessions = (await readState(app.page)).sessions;
    assert.deepEqual(sessions.map((x) => x.date), ['2026-11-12']);

    await app.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    assert.match(await app.page.locator('main').innerText(), /13 de noviembre/i);
    assert.deepEqual(await flags(app.page), ['false', 'false', 'false']);
  } finally { await app.close(); }
});

test('opening the Today tab again after midnight shows the new day', async () => {
  const app = await openApp(server.url, { seed: everyDayState(), clockAt: new Date(2026, 10, 12, 23, 58) });
  try {
    await app.page.click('[data-tab="routine"]');
    await app.page.clock.setFixedTime(new Date(2026, 10, 13, 8, 0));
    await app.page.click('[data-tab="today"]');
    assert.match(await app.page.locator('main').innerText(), /13 de noviembre/i);
  } finally { await app.close(); }
});
