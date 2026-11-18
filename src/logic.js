const pad = (n) => String(n).padStart(2, '0');

export function localDateISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

// Entries of one exercise that have at least one done set, newest first.
function exerciseHistory(sessions, exerciseId) {
  return [...sessions]
    .sort(byDateDesc)
    .map((s) => s.exercises.find((e) => e.exerciseId === exerciseId))
    .filter((e) => e && e.sets.some((x) => x.done));
}

export function prefillSets(sessions, exerciseId, targetSets, targetReps) {
  const last = exerciseHistory(sessions, exerciseId)[0];
  if (!last) {
    return Array.from({ length: targetSets }, () => ({ weight: 0, reps: targetReps, done: false }));
  }
  const sets = last.sets.map((x) => ({ weight: x.weight, reps: x.reps, done: false }));
  while (sets.length < targetSets) sets.push({ ...sets[sets.length - 1] });
  return sets.slice(0, targetSets);
}

export function suggestWeightIncrease(sessions, exerciseId, settings) {
  const recent = exerciseHistory(sessions, exerciseId).slice(0, settings.progressionSessions);
  if (recent.length < settings.progressionSessions) return { suggest: false };
  const weight = recent[0].sets[0].weight;
  if (!(weight > 0)) return { suggest: false };
  const ok = recent.every((e) =>
    e.sets.length >= e.targetSets &&
    e.sets.every((x) => x.done && x.weight === weight && x.reps >= e.targetReps));
  return ok ? { suggest: true, newWeight: weight + settings.progressionStepKg } : { suggest: false };
}

export function startOrResumeSession(state, dateISO) {
  const existing = state.sessions.find((s) => s.date === dateISO);
  const [y, m, d] = dateISO.split('-').map(Number);
  const dayIndex = new Date(y, m - 1, d).getDay();
  const day = state.routine[dayIndex];
  if (existing) return day && !day.rest ? followRoutine(existing, day, state.sessions) : existing;
  if (!day || day.rest) return null;
  return {
    id: globalThis.crypto.randomUUID(),
    date: dateISO,
    dayIndex,
    dayName: day.name,
    finished: false,
    exercises: day.exercises.map((ex) => ({
      exerciseId: ex.id,
      name: ex.name,
      targetSets: ex.sets,
      targetReps: ex.reps,
      sets: prefillSets(state.sessions, ex.id, ex.sets, ex.reps),
    })),
  };
}

// Copy of a saved session updated to the day's current routine: names, targets, added exercises
// (prefilled) and removed ones (kept only if they have done sets). A done set is never removed.
function followRoutine(session, day, sessions) {
  const others = sessions.filter((s) => s.id !== session.id);
  const exercises = day.exercises.map((ex) => {
    const saved = session.exercises.find((e) => e.exerciseId === ex.id);
    if (!saved) {
      return { exerciseId: ex.id, name: ex.name, targetSets: ex.sets, targetReps: ex.reps, sets: prefillSets(others, ex.id, ex.sets, ex.reps) };
    }
    const sets = saved.sets.map((x) => ({ ...x }));
    while (sets.length < ex.sets) {
      const last = sets[sets.length - 1];
      sets.push(last ? { weight: last.weight, reps: last.reps, done: false } : { weight: 0, reps: ex.reps, done: false });
    }
    while (sets.length > ex.sets && !sets[sets.length - 1].done) sets.pop();
    return { ...saved, name: ex.name, targetSets: ex.sets, targetReps: ex.reps, sets };
  });
  const kept = session.exercises
    .filter((e) => !day.exercises.some((ex) => ex.id === e.exerciseId) && e.sets.some((x) => x.done))
    .map((e) => structuredClone(e));
  return { ...session, dayName: day.name, exercises: [...exercises, ...kept] };
}

function doneSets(session, exerciseId) {
  const e = session.exercises.find((x) => x.exerciseId === exerciseId);
  return e ? e.sets.filter((x) => x.done) : [];
}

export function personalRecord(sessions, exerciseId) {
  const weights = sessions.flatMap((s) => doneSets(s, exerciseId).map((x) => x.weight));
  return weights.length ? Math.max(...weights) : null;
}

export function weightSeries(sessions, exerciseId) {
  return [...sessions]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((s) => ({ date: s.date, done: doneSets(s, exerciseId) }))
    .filter((x) => x.done.length)
    .map((x) => ({ date: x.date, weight: Math.max(...x.done.map((y) => y.weight)) }));
}

export function trainedDates(sessions, yearMonth) {
  return new Set(
    sessions
      .filter((s) => s.date.startsWith(yearMonth) && s.exercises.some((e) => e.sets.some((x) => x.done)))
      .map((s) => s.date),
  );
}

// Done sets, total sets and lifted volume (kg × reps over done sets) of one session.
export function sessionStats(session) {
  const all = session.exercises.flatMap((e) => e.sets);
  const done = all.filter((x) => x.done);
  return { done: done.length, total: all.length, volume: done.reduce((sum, x) => sum + x.weight * x.reps, 0) };
}
