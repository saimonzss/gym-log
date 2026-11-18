import { localDateISO, startOrResumeSession, suggestWeightIncrease, personalRecord, sessionStats } from '../logic.js';

export const formatKg = (n) => String(n).replace('.', ',');
const round = (n) => Math.round(n * 100) / 100;
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// "62,5" / "62.5" -> 62.5. Returns null for empty, non-numeric or negative text.
export function parseNumber(text) {
  const t = String(text).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}
const weekday = (iso) => { const [y, m, d] = iso.split('-').map(Number); return WEEKDAYS[new Date(y, m - 1, d).getDay()]; };

// The day Today is showing. It is fixed while the user works (so a workout that crosses midnight keeps
// its day) and released when the app returns to the foreground or the Today tab is opened again.
let boundDate = null;
export const boundDay = () => boundDate;
export const resetDay = () => { boundDate = null; };

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

export function render(container, ctx) {
  const date = boundDate ?? (boundDate = localDateISO());
  const session = startOrResumeSession(ctx.getState(), date);
  const hero = el('header', 'hero');
  hero.append(el('div', 'eyebrow', `${weekday(date)} · ${prettyDate(date)}`), el('h1', '', session ? (session.dayName || 'Entrenamiento') : 'Descanso'));
  container.appendChild(hero);
  if (!session) {
    container.insertAdjacentHTML('beforeend', '<div class="card"><p>Hoy es día de descanso.</p><p class="muted">Podés cambiarlo en la pestaña Rutina.</p></div>');
    return;
  }
  if (session.exercises.length === 0) {
    container.insertAdjacentHTML('beforeend', '<div class="card"><p>No hay ejercicios para hoy. Agregalos en la pestaña Rutina.</p></div>');
    return;
  }
  hero.appendChild(loadBar(session));
  const stats = sessionStats(session);
  const text = el('p', 'load-text');
  text.innerHTML = `<strong>${stats.done}</strong> de ${stats.total} series`;
  hero.appendChild(text);
  renderSessionEditor(container, session, ctx);
}

// One segment per set, grouped by exercise, like plates loaded on a bar.
function loadBar(session) {
  const bar = el('div', 'load');
  bar.setAttribute('aria-hidden', 'true');
  for (const ex of session.exercises) {
    const group = el('div', 'load-group');
    group.style.flex = String(Math.max(1, ex.sets.length));
    ex.sets.forEach((s, i) => {
      const seg = el('span', 'seg' + (s.done ? ' done' : ''));
      seg.dataset.key = `${ex.exerciseId}:${i}`;
      group.appendChild(seg);
    });
    bar.appendChild(group);
  }
  return bar;
}

export function renderSessionEditor(container, session, ctx, { showHints = true } = {}) {
  const sessionId = session.id;
  // A session built from the routine is only saved on its first edit.
  const edit = (fn, opts) => ctx.update((s) => {
    let target = s.sessions.find((x) => x.id === sessionId);
    if (!target) { target = structuredClone(session); s.sessions.push(target); }
    fn(target);
    return s;
  }, opts);
  const state = ctx.getState();
  const others = state.sessions.filter((s) => s.id !== sessionId);

  for (const ex of session.exercises) {
    const card = el('section', 'card exercise-card');
    card.dataset.ex = ex.exerciseId;
    const doneCount = ex.sets.filter((x) => x.done).length;
    const head = el('div', 'ex-head');
    head.append(el('h2', 'ex-title', ex.name), el('span', 'chip' + (doneCount === ex.sets.length && doneCount ? ' complete' : ''), `${doneCount}/${ex.sets.length}`));
    const record = personalRecord(state.sessions, ex.exerciseId);
    card.append(head, el('div', 'muted ex-target', `${ex.targetSets} × ${ex.targetReps}${record ? ` · Récord ${formatKg(record)} kg` : ''}`));

    const hint = showHints ? suggestWeightIncrease(others, ex.exerciseId, state.settings) : { suggest: false };
    if (hint.suggest) {
      const b = el('button', 'suggestion');
      b.append(el('span', 'arrow', '↑'), el('span', '', `Subí a ${formatKg(hint.newWeight)} kg`));
      b.addEventListener('click', () => edit((t) => {
        t.exercises.find((e) => e.exerciseId === ex.exerciseId).sets.forEach((x) => { if (!x.done) x.weight = hint.newWeight; });
      }));
      card.appendChild(b);
    }
    ex.sets.forEach((set, i) => card.appendChild(setRow(ex, set, i, edit, () => container)));
    container.appendChild(card);
  }

  const stats = sessionStats(session);
  if (session.finished) {
    const sum = el('section', 'card summary');
    sum.innerHTML = `<h2>Sesión finalizada ✓</h2><div class="tiles">
      <p class="tile"><span class="small-label">Series</span><strong>${stats.done}/${stats.total}</strong></p>
      <p class="tile"><span class="small-label">Volumen</span><strong>${new Intl.NumberFormat('es-AR').format(Math.round(stats.volume))} kg</strong></p></div>`;
    container.appendChild(sum);
  } else {
    const fin = el('button', 'finish primary wide' + (stats.total && stats.done === stats.total ? ' ready' : ''), 'Finalizar entrenamiento');
    fin.addEventListener('click', () => edit((t) => { t.finished = true; }));
    container.appendChild(fin);
  }
}

// After a set is tapped, refresh the counters that depend on it without rebuilding the screen
// (a rebuild flashes on iPhone and restarts every animation).
function syncProgress(container, key, done) {
  const seg = document.querySelector(`.hero .seg[data-key="${key}"]`);
  if (seg) seg.classList.toggle('done', done);
  const rows = container.querySelectorAll('.set');
  const doneRows = container.querySelectorAll('.set.done').length;
  const text = document.querySelector('.hero .load-text');
  if (text) text.innerHTML = `<strong>${doneRows}</strong> de ${rows.length} series`;
  for (const card of container.querySelectorAll('.exercise-card')) {
    const n = card.querySelectorAll('.set').length;
    const d = card.querySelectorAll('.set.done').length;
    const chip = card.querySelector('.chip');
    chip.textContent = `${d}/${n}`;
    chip.classList.toggle('complete', d === n && d > 0);
  }
  const fin = container.querySelector('.finish');
  if (fin) fin.classList.toggle('ready', rows.length > 0 && doneRows === rows.length);
}

function setRow(ex, set, i, edit, getContainer) {
  const key = `${ex.exerciseId}:${i}`;
  const row = el('div', 'set');
  row.dataset.set = String(i);
  row.innerHTML = `
    <button class="set-toggle"><span class="set-num">${i + 1}</span>${CHECK}</button>
    <div class="stepper w"><button class="w-minus" aria-label="Menos 2,5 kg">−2,5</button><label class="val"><input class="w-input" type="text" inputmode="decimal" aria-label="Peso en kg"><span>kg</span></label><button class="w-plus" aria-label="Más 2,5 kg">+2,5</button></div>
    <div class="stepper r"><button class="r-minus" aria-label="Una repetición menos">−1</button><label class="val"><input class="r-input" type="text" inputmode="numeric" aria-label="Repeticiones"><span>reps</span></label><button class="r-plus" aria-label="Una repetición más">+1</button></div>`;
  const toggle = row.querySelector('.set-toggle');
  const w = row.querySelector('.w-input');
  const r = row.querySelector('.r-input');
  const paint = (s) => {
    toggle.setAttribute('aria-label', `Serie ${i + 1} · ${formatKg(s.weight)} kg × ${s.reps}`);
    toggle.setAttribute('aria-pressed', String(s.done));
    row.classList.toggle('done', s.done);
  };
  paint(set);
  w.value = formatKg(set.weight);
  r.value = String(set.reps);

  // Every change writes absolute values, so the first edit of a not-yet-saved session stays correct.
  const save = (values) => edit((t) => Object.assign(t.exercises.find((e) => e.exerciseId === ex.exerciseId).sets[i], values), { rerender: false });
  toggle.addEventListener('click', () => {
    set.done = !set.done;
    paint(set);
    save({ done: set.done });
    syncProgress(getContainer(), key, set.done);
  });
  const setWeight = (n) => { set.weight = n; w.value = formatKg(n); paint(set); save({ weight: n }); };
  const setReps = (n) => { set.reps = n; r.value = String(n); paint(set); save({ reps: n }); };
  row.querySelector('.w-minus').addEventListener('click', () => setWeight(Math.max(0, round(set.weight - 2.5))));
  row.querySelector('.w-plus').addEventListener('click', () => setWeight(round(set.weight + 2.5)));
  row.querySelector('.r-minus').addEventListener('click', () => setReps(Math.max(0, set.reps - 1)));
  row.querySelector('.r-plus').addEventListener('click', () => setReps(set.reps + 1));
  w.addEventListener('input', () => {
    const n = parseNumber(w.value);
    if (n !== null) { set.weight = n; paint(set); save({ weight: n }); }
  });
  r.addEventListener('input', () => {
    const n = parseNumber(r.value);
    if (n !== null && Number.isInteger(n)) { set.reps = n; paint(set); save({ reps: n }); }
  });
  return row;
}
