import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/storage.js';
import { exportBackup, parseBackup, isBackupDue, BackupError } from '../src/backup.js';

test('parseBackup(exportBackup(s)) round-trips the state', () => {
  const s = defaultState();
  s.routine[1].exercises.push({ id: 'a', name: 'Press banca', sets: 4, reps: 8 });
  assert.deepEqual(parseBackup(exportBackup(s)), s);
});

test('parseBackup rejects empty text', () => {
  assert.throws(() => parseBackup(''), BackupError);
});

test('parseBackup rejects non-JSON text', () => {
  assert.throws(() => parseBackup('hola'), BackupError);
});

test('parseBackup rejects a file from another app', () => {
  assert.throws(() => parseBackup('{"app":"otra"}'), BackupError);
});

test('parseBackup rejects a state without sessions', () => {
  const s = defaultState();
  delete s.sessions;
  const text = JSON.stringify({ app: 'gym-log', version: 1, exportedAt: 'x', state: s });
  assert.throws(() => parseBackup(text), BackupError);
});

test('parseBackup rejects a routine that does not have 7 days', () => {
  const s = defaultState();
  delete s.routine[3];
  const text = JSON.stringify({ app: 'gym-log', version: 1, exportedAt: 'x', state: s });
  assert.throws(() => parseBackup(text), BackupError);
});

test('isBackupDue: null is due, 29 days is not, 30 days is', () => {
  const now = new Date('2026-12-01T12:00:00Z');
  const ago = (d) => new Date(now.getTime() - d * 86400000).toISOString();
  assert.equal(isBackupDue({ lastBackupAt: null }, now), true);
  assert.equal(isBackupDue({ lastBackupAt: ago(29) }, now), false);
  assert.equal(isBackupDue({ lastBackupAt: ago(30) }, now), true);
});
