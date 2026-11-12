import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/storage.js';
import {
  localDateISO, startOrResumeSession, prefillSets, suggestWeightIncrease,
  personalRecord, weightSeries, trainedDates,
} from '../src/logic.js';

// helper: session with one exercise; sets = [[weight, reps, done], ...]
function sess(date, sets, { id = 'ex1', name = 'Press banca', targetSets = 3, targetReps = 8 } = {}) {
  return {
    id: 's-' + date, date, dayIndex: 1, dayName: 'Pecho', finished: true,
    exercises: [{
      exerciseId: id, name, targetSets, targetReps,
      sets: sets.map(([weight, reps, done]) => ({ weight, reps, done })),
    }],
  };
}
const full = (w, r = 8) => [[w, r, true], [w, r, true], [w, r, true]];
const settings = { progressionSessions: 3, progressionStepKg: 2.5, lastBackupAt: null };

test('prefillSets without history gives targetSets empty sets at targetReps', () => {
  const sets = prefillSets([], 'ex1', 3, 8);
  assert.deepEqual(sets, [0, 1, 2].map(() => ({ weight: 0, reps: 8, done: false })));
});

test('prefillSets copies weight and reps from the latest session with done sets, all undone', () => {
  const sessions = [
    sess('2026-11-01', full(50)),
    sess('2026-11-08', [[60, 8, true], [60, 7, true], [55, 6, true]]),
    sess('2026-11-10', [[70, 8, false], [70, 8, false], [70, 8, false]]), // nothing done: ignored
  ];
  assert.deepEqual(prefillSets(sessions, 'ex1', 3, 8), [
    { weight: 60, reps: 8, done: false },
    { weight: 60, reps: 7, done: false },
    { weight: 55, reps: 6, done: false },
  ]);
});

test('prefillSets adjusts to targetSets by repeating last or trimming', () => {
  const sessions = [sess('2026-11-08', [[60, 8, true], [55, 6, true]])];
  const more = prefillSets(sessions, 'ex1', 4, 8);
  assert.equal(more.length, 4);
  assert.deepEqual(more[3], { weight: 55, reps: 6, done: false });
  assert.equal(prefillSets(sessions, 'ex1', 1, 8).length, 1);
});

test('prefillSets matches by exerciseId so renaming does not break history', () => {
  const sessions = [sess('2026-11-08', full(60), { name: 'Nombre viejo' })];
  assert.equal(prefillSets(sessions, 'ex1', 3, 8)[0].weight, 60);
  assert.equal(prefillSets(sessions, 'otro', 3, 8)[0].weight, 0);
});

test('suggestWeightIncrease suggests +2.5 after 3 matching sessions', () => {
  const sessions = ['2026-11-01', '2026-11-04', '2026-11-08'].map((d) => sess(d, full(60)));
  assert.deepEqual(suggestWeightIncrease(sessions, 'ex1', settings), { suggest: true, newWeight: 62.5 });
});

test('suggestWeightIncrease is false with only 2 sessions', () => {
  const sessions = ['2026-11-04', '2026-11-08'].map((d) => sess(d, full(60)));
  assert.equal(suggestWeightIncrease(sessions, 'ex1', settings).suggest, false);
});

test('suggestWeightIncrease is false when weights differ between sessions', () => {
  const sessions = [sess('2026-11-01', full(57.5)), sess('2026-11-04', full(60)), sess('2026-11-08', full(60))];
  assert.equal(suggestWeightIncrease(sessions, 'ex1', settings).suggest, false);
});

test('suggestWeightIncrease is false when a set was not done', () => {
  const sessions = [sess('2026-11-01', full(60)), sess('2026-11-04', full(60)),
    sess('2026-11-08', [[60, 8, true], [60, 8, true], [60, 8, false]])];
  assert.equal(suggestWeightIncrease(sessions, 'ex1', settings).suggest, false);
});

test('suggestWeightIncrease is false when reps are below target', () => {
  const sessions = [sess('2026-11-01', full(60)), sess('2026-11-04', full(60)), sess('2026-11-08', full(60, 7))];
  assert.equal(suggestWeightIncrease(sessions, 'ex1', settings).suggest, false);
});

test('suggestWeightIncrease is false when weight is 0', () => {
  const sessions = ['2026-11-01', '2026-11-04', '2026-11-08'].map((d) => sess(d, full(0)));
  assert.equal(suggestWeightIncrease(sessions, 'ex1', settings).suggest, false);
});

test('suggestWeightIncrease ignores an untouched current session', () => {
  const sessions = ['2026-11-01', '2026-11-04', '2026-11-08'].map((d) => sess(d, full(60)));
  sessions.push(sess('2026-11-10', [[60, 8, false], [60, 8, false], [60, 8, false]]));
  assert.equal(suggestWeightIncrease(sessions, 'ex1', settings).suggest, true);
});

test('startOrResumeSession returns null on rest day (Sunday)', () => {
  const state = defaultState();
  assert.equal(startOrResumeSession(state, '2026-11-15'), null); // 2026-11-15 is a Sunday
});

test('startOrResumeSession builds session from routine with prefill and copies names/targets', () => {
  const state = defaultState();
  state.routine[1] = { name: 'Pecho y tríceps', rest: false, exercises: [{ id: 'ex1', name: 'Press banca', sets: 3, reps: 8 }] };
  state.sessions.push(sess('2026-11-09', full(60)));
  const s = startOrResumeSession(state, '2026-11-16'); // Monday
  assert.equal(s.date, '2026-11-16');
  assert.equal(s.dayIndex, 1);
  assert.equal(s.dayName, 'Pecho y tríceps');
  assert.equal(s.finished, false);
  assert.equal(s.exercises[0].targetSets, 3);
  assert.equal(s.exercises[0].sets[0].weight, 60);
  assert.equal(s.exercises[0].sets[0].done, false);
});

test('startOrResumeSession resumes the existing session of that date', () => {
  const state = defaultState();
  state.routine[1] = { name: 'Pecho', rest: false, exercises: [{ id: 'ex1', name: 'Press banca', sets: 3, reps: 8 }] };
  const first = startOrResumeSession(state, '2026-11-16');
  state.sessions.push(first);
  const second = startOrResumeSession(state, '2026-11-16');
  assert.equal(second.id, first.id);
});

test('localDateISO uses local time, not UTC', () => {
  assert.equal(localDateISO(new Date(2026, 10, 12, 23, 59)), '2026-11-12');
  assert.equal(localDateISO(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('personalRecord ignores sets not done', () => {
  const sessions = [sess('2026-11-01', [[60, 8, true], [100, 8, false], [65, 5, true]])];
  assert.equal(personalRecord(sessions, 'ex1'), 65);
  assert.equal(personalRecord(sessions, 'otro'), null);
});

test('weightSeries gives max done weight per session in chronological order', () => {
  const sessions = [sess('2026-11-08', full(62.5)), sess('2026-11-01', [[60, 8, true], [57.5, 8, true], [90, 8, false]])];
  assert.deepEqual(weightSeries(sessions, 'ex1'), [
    { date: '2026-11-01', weight: 60 },
    { date: '2026-11-08', weight: 62.5 },
  ]);
});

test('trainedDates returns dates with at least one done set in the month', () => {
  const sessions = [
    sess('2026-11-01', full(60)),
    sess('2026-11-04', [[60, 8, false]]),
    sess('2026-10-30', full(60)),
    sess('2026-11-08', [[60, 8, true], [60, 8, false]]),
  ];
  assert.deepEqual([...trainedDates(sessions, '2026-11')].sort(), ['2026-11-01', '2026-11-08']);
});

test('sessionStats counts done sets, total sets and volume of done sets only', async () => {
  const { sessionStats } = await import('../src/logic.js');
  const s = sess('2026-11-01', [[60, 8, true], [62.5, 6, true], [100, 8, false]]);
  s.exercises.push({ exerciseId: 'b', name: 'Fondos', targetSets: 2, targetReps: 10, sets: [{ weight: 0, reps: 10, done: true }, { weight: 0, reps: 10, done: false }] });
  assert.deepEqual(sessionStats(s), { done: 3, total: 5, volume: 60 * 8 + 62.5 * 6 });
  assert.deepEqual(sessionStats({ exercises: [] }), { done: 0, total: 0, volume: 0 });
});
