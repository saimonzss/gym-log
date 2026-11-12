// Deep shape check for a State. Throws Error with a short reason when something is wrong.
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const isInt = (x, min) => Number.isInteger(x) && x >= min;
const fail = (what) => { throw new Error(`Datos inválidos: ${what}`); };

export function validateState(s) {
  if (!isObj(s) || s.version !== 1) fail('versión');
  if (!isObj(s.routine)) fail('rutina');
  for (let d = 0; d < 7; d++) {
    const day = s.routine[d];
    if (!isObj(day) || typeof day.name !== 'string' || typeof day.rest !== 'boolean' || !Array.isArray(day.exercises)) fail(`día ${d}`);
    for (const ex of day.exercises) {
      if (!isObj(ex) || typeof ex.id !== 'string' || typeof ex.name !== 'string' || !isInt(ex.sets, 1) || !isInt(ex.reps, 1)) fail('ejercicio de la rutina');
    }
  }
  if (!Array.isArray(s.sessions)) fail('sesiones');
  for (const x of s.sessions) {
    if (!isObj(x) || typeof x.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !isInt(x.dayIndex, 0) ||
        typeof x.dayName !== 'string' || typeof x.finished !== 'boolean' || !Array.isArray(x.exercises)) fail('sesión');
    for (const e of x.exercises) {
      if (!isObj(e) || typeof e.exerciseId !== 'string' || typeof e.name !== 'string' ||
          !isInt(e.targetSets, 0) || !isInt(e.targetReps, 0) || !Array.isArray(e.sets)) fail('ejercicio de una sesión');
      for (const set of e.sets) {
        if (!isObj(set) || !Number.isFinite(set.weight) || set.weight < 0 || !isInt(set.reps, 0) || typeof set.done !== 'boolean') fail('serie');
      }
    }
  }
  const st = s.settings;
  if (!isObj(st) || !isInt(st.progressionSessions, 1) || !Number.isFinite(st.progressionStepKg) || st.progressionStepKg <= 0 ||
      !(st.lastBackupAt === null || typeof st.lastBackupAt === 'string')) fail('ajustes');
}
