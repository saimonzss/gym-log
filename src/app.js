import { loadState, saveState, StorageError, requestPersistence } from './storage.js';
import * as routine from './ui/routine.js';
import * as today from './ui/today.js';
import * as history from './ui/history.js';

const placeholder = { render(c) { c.innerHTML = '<p class="muted">Próximamente</p>'; } };
const screens = { today, history, progress: placeholder, routine, backup: placeholder };

const main = document.getElementById('main');
const banner = document.getElementById('banner');
const tabs = document.getElementById('tabs');
let state = null;
let active = 'today';

function showBanner(text) {
  banner.textContent = text;
  banner.hidden = !text;
}

function render() {
  tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === active));
  main.innerHTML = '';
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
