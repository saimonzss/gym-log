const KEY = 'gymlog.state';

export class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageError';
  }
}

export function defaultState() {
  const routine = {};
  for (let i = 0; i < 7; i++) {
    routine[i] = { name: '', rest: i === 0, exercises: [] };
  }
  return {
    version: 1,
    routine,
    sessions: [],
    settings: { progressionSessions: 3, progressionStepKg: 2.5, lastBackupAt: null },
  };
}

export function loadState(store = globalThis.localStorage) {
  let raw;
  try {
    raw = store.getItem(KEY);
  } catch (e) {
    throw new StorageError('No se puede acceder al almacenamiento');
  }
  if (raw === null || raw === undefined) return defaultState();
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new StorageError('Los datos guardados están dañados');
  }
}

export function saveState(state, store = globalThis.localStorage) {
  try {
    store.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    throw new StorageError('No se pudo guardar');
  }
}

export async function requestPersistence() {
  try {
    const result = await globalThis.navigator?.storage?.persist?.();
    return result === true;
  } catch (e) {
    return false;
  }
}
