import { loadState, saveState, StorageError, requestPersistence } from './storage.js';
import * as routine from './ui/routine.js';
import * as today from './ui/today.js';
import * as history from './ui/history.js';
import * as progress from './ui/progress.js';
import * as backup from './ui/backup-screen.js';
import { restoreControls } from './ui/backup-screen.js';
import { isBackupDue } from './backup.js';

const placeholder = { render(c) { c.innerHTML = '<p class="muted">Próximamente</p>'; } };
const screens = { today, history, progress, routine, backup };

const main = document.getElementById('main');
const banner = document.getElementById('banner');
const reminder = document.getElementById('reminder');
const tabs = document.getElementById('tabs');
let state = null;
let active = 'today';
let reminderDismissed = false;

function showBanner(text) {
  banner.textContent = text;
  banner.hidden = !text;
}

function render() {
  tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === active));
  main.innerHTML = '';
  reminder.innerHTML = '';
  if (!reminderDismissed && active !== 'backup' && state.sessions.length && isBackupDue(state.settings, new Date())) {
    const r = document.createElement('div');
    r.className = 'card backup-reminder';
    r.innerHTML = '<p>Hace un mes o más que no guardás una copia de seguridad.</p><div class="row"><button class="go-backup primary">Hacer copia</button><button class="later">Más tarde</button></div>';
    r.querySelector('.go-backup').addEventListener('click', () => ctx.navigate('backup'));
    r.querySelector('.later').addEventListener('click', () => { reminderDismissed = true; render(); });
    reminder.appendChild(r);
  }
  screens[active].render(main, ctx);
}

const ctx = {
  getState: () => state,
  // fn receives a copy of the state and returns the new state. Pass { rerender: false } while typing.
  update(fn, { rerender = true } = {}) {
    state = fn(structuredClone(state));
    try {
      saveState(state);
      showBanner('');
    } catch (e) {
      showBanner('No se pudo guardar. Exportá una copia desde la pestaña Copia.');
    }
    if (rerender) render();
  },
  navigate(tab) { active = tab; render(); },
};

function showError(message) {
  tabs.hidden = true;
  main.innerHTML = '';
  const box = document.createElement('div');
  box.id = 'error-screen';
  box.innerHTML = '<h1>No pude abrir tus datos</h1><p></p><p class="muted">No se borró nada.</p>';
  box.querySelector('p').textContent = message;
  main.appendChild(box);
  box.appendChild(restoreControls((restored) => {
    try {
      saveState(restored);
    } catch (e) {
      box.querySelector('.restore-error').textContent = 'No se pudo guardar la copia restaurada.';
      return;
    }
    state = restored;
    tabs.hidden = false;
    render();
  }));
}

tabs.addEventListener('click', (e) => {
  const tab = e.target.closest('button')?.dataset.tab;
  if (tab) ctx.navigate(tab);
});

try {
  state = loadState();
  render();
  requestPersistence();
} catch (e) {
  showError(e instanceof StorageError ? e.message : 'Error inesperado');
}
