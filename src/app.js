import { loadState, saveState, StorageError, requestPersistence } from './storage.js';
import * as routine from './ui/routine.js';
import * as today from './ui/today.js';
import * as history from './ui/history.js';
import * as progress from './ui/progress.js';
import * as backup from './ui/backup-screen.js';
import { restoreControls } from './ui/backup-screen.js';
import { isBackupDue } from './backup.js';
import { localDateISO } from './logic.js';

const placeholder = { render(c) { c.innerHTML = '<p class="muted">Próximamente</p>'; } };
const screens = { today, history, progress, routine, backup };

const main = document.getElementById('main');
const banner = document.getElementById('banner');
const reminder = document.getElementById('reminder');
const tabs = document.getElementById('tabs');
let state = null;
let active = 'today';
let reminderDismissed = false;

const ICONS = {
  today: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
  history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  progress: '<path d="M4 5v14h16M7.5 15l4-4.5 3 2.5 4.5-6"/>',
  routine: '<rect x="4" y="5.5" width="16" height="14" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  backup: '<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 17.5v1A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5v-1"/>',
};
tabs.querySelectorAll('button').forEach((b) => {
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[b.dataset.tab]}</svg><span>${b.textContent}</span>`;
});

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
    r.innerHTML = '<p style="font-weight:700">Hace un mes o más que no guardás una copia de seguridad.</p><div class="row"><button class="go-backup primary">Hacer copia</button><button class="later">Más tarde</button></div>';
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
  navigate(tab) {
    if (!state) return;
    if (tab === 'today') today.resetDay();
    active = tab;
    render();
    main.classList.remove('enter'); // replay the entrance animation only on navigation, not on every tap
    void main.offsetWidth;
    main.classList.add('enter');
  },
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

function onForeground() {
  const bound = today.boundDay();
  if (!state || document.visibilityState !== 'visible' || !bound || bound === localDateISO()) return;
  today.resetDay();
  if (active === 'today') render();
}
document.addEventListener('visibilitychange', onForeground);
window.addEventListener('pageshow', onForeground);

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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
