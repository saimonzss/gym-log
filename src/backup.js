export class BackupError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BackupError';
  }
}

export function exportBackup(state, now = new Date()) {
  return JSON.stringify({ app: 'gym-log', version: 1, exportedAt: now.toISOString(), state });
}

export function parseBackup(text) {
  if (typeof text !== 'string' || text.trim() === '') throw new BackupError('El archivo está vacío');
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new BackupError('El archivo no es una copia válida');
  }
  if (!data || data.app !== 'gym-log') throw new BackupError('El archivo no es de esta app');
  const s = data.state;
  const validRoutine = s && s.routine && [0, 1, 2, 3, 4, 5, 6].every((i) => s.routine[i] && Array.isArray(s.routine[i].exercises));
  if (!validRoutine || !Array.isArray(s.sessions) || !s.settings) {
    throw new BackupError('La copia está incompleta o dañada');
  }
  return s;
}

export function isBackupDue(settings, now) {
  if (!settings.lastBackupAt) return true;
  return now.getTime() - new Date(settings.lastBackupAt).getTime() >= 30 * 86400000;
}
