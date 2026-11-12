import { renderSessionEditor, prettyDate } from './today.js';

let openId = null; // session being edited, if any

const counts = (s) => {
  const all = s.exercises.flatMap((e) => e.sets);
  return `${all.filter((x) => x.done).length}/${all.length}`;
};

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
    container.insertAdjacentHTML('beforeend', '<p class="muted">Todavía no hay sesiones.</p>');
    return;
  }
  const sorted = [...state.sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const s of sorted) {
    const b = document.createElement('button');
    b.className = 'history-item card';
    b.style.cssText = 'display:block;width:100%;text-align:left;height:auto;padding:12px 14px';
    b.textContent = `${prettyDate(s.date)} · ${s.dayName || 'Entrenamiento'} · ${counts(s)} series`;
    b.addEventListener('click', () => { openId = s.id; ctx.navigate('history'); });
    container.appendChild(b);
  }
}

function renderEditor(container, session, ctx) {
  const back = document.createElement('button');
  back.className = 'back';
  back.textContent = '← Historial';
  back.addEventListener('click', () => { openId = null; ctx.navigate('history'); });
  const h1 = document.createElement('h1');
  h1.textContent = session.dayName || 'Entrenamiento';
  const sub = document.createElement('p');
  sub.className = 'muted';
  sub.textContent = prettyDate(session.date);
  container.append(back, h1, sub);
  renderSessionEditor(container, session, ctx, { showHints: false });

  const del = document.createElement('button');
  del.className = 'delete-session danger';
  del.style.cssText = 'width:100%;margin-top:14px';
  del.textContent = 'Borrar esta sesión';
  del.addEventListener('click', () => {
    if (!window.confirm('¿Borrar esta sesión? No se puede deshacer.')) return;
    const id = session.id;
    openId = null;
    ctx.update((s) => { s.sessions = s.sessions.filter((x) => x.id !== id); return s; });
  });
  container.appendChild(del);
}
