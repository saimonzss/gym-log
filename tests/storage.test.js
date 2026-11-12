import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, loadState, saveState, StorageError } from '../src/storage.js';

function fakeStore(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
  };
}

test('loadState without data returns defaultState with Sunday as rest', () => {
  const s = loadState(fakeStore());
  assert.deepEqual(s, defaultState());
  assert.equal(s.routine[0].rest, true);
  assert.equal(s.routine[1].rest, false);
  assert.deepEqual(s.settings, { progressionSessions: 3, progressionStepKg: 2.5, lastBackupAt: null });
});

test('saveState then loadState round-trips the same state', () => {
  const store = fakeStore();
  const s = defaultState();
  s.routine[1].exercises.push({ id: 'a', name: 'Press banca', sets: 4, reps: 8 });
  saveState(s, store);
  assert.deepEqual(loadState(store), s);
});

test('loadState with corrupt JSON throws StorageError', () => {
  const store = fakeStore({ 'gymlog.state': '{no es json' });
  assert.throws(() => loadState(store), StorageError);
});

test('saveState throws StorageError when setItem fails with quota error', () => {
  const store = { getItem: () => null, setItem() { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } };
  assert.throws(() => saveState(defaultState(), store), StorageError);
});
