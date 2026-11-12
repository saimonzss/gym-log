import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, openApp, readState } from './helpers.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); });

test('fresh start shows Sunday as rest in the routine screen', async () => {
  const app = await openApp(server.url);
  try {
    await app.page.click('[data-tab="routine"]');
    assert.equal(await app.page.isChecked('[data-day="0"] .rest-toggle'), true);
    assert.equal(await app.page.isChecked('[data-day="1"] .rest-toggle'), false);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

test('adding an exercise to Monday survives a reload', async () => {
  const app = await openApp(server.url);
  try {
    await app.page.click('[data-tab="routine"]');
    await app.page.fill('[data-day="1"] .day-name', 'Pecho y tríceps');
    await app.page.click('[data-day="1"] .add-exercise');
    await app.page.fill('[data-day="1"] .exercise .ex-name', 'Press banca');
    await app.page.fill('[data-day="1"] .exercise .ex-sets', '4');
    await app.page.fill('[data-day="1"] .exercise .ex-reps', '8');
    await app.page.reload();
    await app.page.click('[data-tab="routine"]');
    assert.equal(await app.page.inputValue('[data-day="1"] .day-name'), 'Pecho y tríceps');
    assert.equal(await app.page.inputValue('[data-day="1"] .exercise .ex-name'), 'Press banca');
    assert.equal(await app.page.inputValue('[data-day="1"] .exercise .ex-sets'), '4');
    const ex = (await readState(app.page)).routine[1].exercises[0];
    assert.deepEqual([ex.name, ex.sets, ex.reps], ['Press banca', 4, 8]);
  } finally { await app.close(); }
});

test('corrupt saved data shows the error screen instead of a blank page', async () => {
  const app = await openApp(server.url, { seed: '{roto' });
  try {
    assert.equal(await app.page.isVisible('#error-screen'), true);
    assert.equal(await app.page.isVisible('#tabs'), false);
    assert.equal(await app.page.evaluate(() => localStorage.getItem('gymlog.state')), '{roto');
  } finally { await app.close(); }
});
