import { validateState } from './validate.js';

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
  if (data.version !== 1) throw new BackupError('La copia es de una versión que esta app no conoce');
  const s = data.state;
  try {
    validateState(s);
  } catch (e) {
    throw new BackupError('La copia está incompleta o dañada');
  }
  return s;
}

export function isBackupDue(settings, now) {
  if (!settings.lastBackupAt) return true;
  return now.getTime() - new Date(settings.lastBackupAt).getTime() >= 30 * 86400000;
}
