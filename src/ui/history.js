import { renderSessionEditor, prettyDate } from './today.js';
import { sessionStats } from '../logic.js';

let openId = null; // session being edited, if any

export function render(container, ctx) {
  const state = ctx.getState();
  const session = openId && state.sessions.find((s) => s.id === openId);
  if (!session) openId = null;
  session ? renderEditor(container, session, ctx) : renderList(container, state, ctx);
}

function renderList(container, state, ctx) {
  const h1 = document.createElement('h1');
  h1.textContent = 'Historial';
  container.appendChild(h1);
  if (!state.sessions.length) {
    container.insertAdjacentHTML('beforeend', '<div class="card"><p class="muted" style="margin:0">Todavía no hay sesiones. Aparecen acá cuando marcás tu primera serie.</p></div>');
    return;
  }
  const sorted = [...state.sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const s of sorted) {
    const { done, total } = sessionStats(s);
    const b = document.createElement('button');
    b.className = 'history-item card';
    const main = document.createElement('span');
    main.className = 'hi-main';
    const name = document.createElement('strong');
    name.textContent = s.dayName || 'Entrenamiento';
    const date = document.createElement('span');
    date.className = 'muted';
    date.textContent = prettyDate(s.date);
    main.append(name, date);
    const chip = document.createElement('span');
    chip.className = 'chip' + (total && done === total ? ' complete' : '');
    chip.textContent = `${done}/${total}`;
    b.append(main, chip);
    b.addEventListener('click', () => { openId = s.id; ctx.navigate('history'); });
    container.appendChild(b);
  }
}

function renderEditor(container, session, ctx) {
  const back = document.createElement('button');
  back.className = 'back';
  back.textContent = '‹ Historial';
  back.addEventListener('click', () => { openId = null; ctx.navigate('history'); });
  const h1 = document.createElement('h1');
  h1.textContent = session.dayName || 'Entrenamiento';
  h1.style.marginBottom = '2px';
  const sub = document.createElement('p');
  sub.className = 'muted';
  sub.textContent = prettyDate(session.date);
  container.append(back, h1, sub);
  renderSessionEditor(container, session, ctx, { showHints: false });

  const del = document.createElement('button');
  del.className = 'delete-session danger wide';
  del.style.marginTop = '14px';
  del.textContent = 'Borrar esta sesión';
  del.addEventListener('click', () => {
    if (!window.confirm('¿Borrar esta sesión? No se puede deshacer.')) return;
    const id = session.id;
    openId = null;
    ctx.update((s) => { s.sessions = s.sessions.filter((x) => x.id !== id); return s; });
  });
  container.appendChild(del);
}
