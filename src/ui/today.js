import { localDateISO, startOrResumeSession, suggestWeightIncrease, personalRecord } from '../logic.js';

export const formatKg = (n) => String(n).replace('.', ',');
const round = (n) => Math.round(n * 100) / 100;

// "62,5" / "62.5" -> 62.5. Returns null for empty, non-numeric or negative text.
export function parseNumber(text) {
  const t = String(text).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

export function render(container, ctx) {
  const date = localDateISO();
  let session = startOrResumeSession(ctx.getState(), date);
  if (!session) {
    container.innerHTML = '<h1>Hoy</h1><div class="card"><p>Hoy es día de descanso.</p><p class="muted">Podés cambiarlo en la pestaña Rutina.</p></div>';
    return;
  }
  if (!ctx.getState().sessions.some((s) => s.id === session.id)) {
    const created = session;
    ctx.update((s) => { s.sessions.push(created); return s; }, { rerender: false });
  }
  const h1 = document.createElement('h1');
  h1.textContent = session.dayName || 'Entrenamiento de hoy';
  const sub = document.createElement('p');
  sub.className = 'muted';
  sub.textContent = prettyDate(session.date);
  container.append(h1, sub);
  if (session.exercises.length === 0) {
    container.insertAdjacentHTML('beforeend', '<div class="card"><p>No hay ejercicios para hoy. Agregalos en la pestaña Rutina.</p></div>');
    return;
  }
  renderSessionEditor(container, session, ctx);
}

export function renderSessionEditor(container, session, ctx, { showHints = true } = {}) {
  const sessionId = session.id;
  const edit = (fn, opts) => ctx.update((s) => {
    const target = s.sessions.find((x) => x.id === sessionId);
    if (target) fn(target);
    return s;
  }, opts);
  const state = ctx.getState();
  const others = state.sessions.filter((s) => s.id !== sessionId);

  for (const ex of session.exercises) {
    const card = document.createElement('section');
    card.className = 'card exercise-card';
    card.dataset.ex = ex.exerciseId;
    const record = personalRecord(state.sessions, ex.exerciseId);
    card.innerHTML = `
      <h2 class="ex-title"></h2>
      <div class="muted ex-target">${ex.targetSets} × ${ex.targetReps}${record ? ` · Récord: ${formatKg(record)} kg` : ''}</div>`;
    card.querySelector('.ex-title').textContent = ex.name;

    const hint = showHints ? suggestWeightIncrease(others, ex.exerciseId, state.settings) : { suggest: false };
    if (hint.suggest) {
      const b = document.createElement('button');
      b.className = 'suggestion primary';
      b.style.cssText = 'margin-top:10px;width:100%';
      b.textContent = `Subí a ${formatKg(hint.newWeight)} kg`;
      b.addEventListener('click', () => edit((t) => {
        t.exercises.find((e) => e.exerciseId === ex.exerciseId).sets.forEach((x) => { if (!x.done) x.weight = hint.newWeight; });
      }));
      card.appendChild(b);
    }
    ex.sets.forEach((set, i) => card.appendChild(setRow(ex, set, i, edit)));
    container.appendChild(card);
  }

  if (session.finished) {
    container.insertAdjacentHTML('beforeend', '<p class="muted" style="text-align:center">Sesión finalizada ✓</p>');
  } else {
    const fin = document.createElement('button');
    fin.className = 'finish primary';
    fin.style.width = '100%';
    fin.textContent = 'Finalizar';
    fin.addEventListener('click', () => edit((t) => { t.finished = true; }));
    container.appendChild(fin);
  }
}

function setRow(ex, set, i, edit) {
  const row = document.createElement('div');
  row.className = 'set';
  row.dataset.set = String(i);
  row.innerHTML = `
    <button class="set-toggle" style="width:100%;margin-top:10px"></button>
    <div class="row" style="margin-top:6px">
      <div class="row stepper" style="flex:3"><button class="w-minus fixed" aria-label="Menos peso">−2,5</button><input class="w-input" type="text" inputmode="decimal" aria-label="Peso en kg"><button class="w-plus fixed" aria-label="Más peso">+2,5</button></div>
      <div class="row stepper" style="flex:2.4"><button class="r-minus fixed" aria-label="Menos repeticiones">−1</button><input class="r-input" type="text" inputmode="numeric" aria-label="Repeticiones"><button class="r-plus fixed" aria-label="Más repeticiones">+1</button></div>
    </div>`;
  const toggle = row.querySelector('.set-toggle');
  const w = row.querySelector('.w-input');
  const r = row.querySelector('.r-input');
  const paint = (s) => {
    toggle.textContent = `${s.done ? '✓ ' : ''}Serie ${i + 1} · ${formatKg(s.weight)} kg × ${s.reps}`;
    toggle.setAttribute('aria-pressed', String(s.done));
    toggle.classList.toggle('primary', s.done);
  };
  paint(set);
  w.value = formatKg(set.weight);
  r.value = String(set.reps);

  const patch = (fn, opts) => edit((t) => fn(t.exercises.find((e) => e.exerciseId === ex.exerciseId).sets[i]), opts);
  toggle.addEventListener('click', () => patch((x) => { x.done = !x.done; }));
  row.querySelector('.w-minus').addEventListener('click', () => patch((x) => { x.weight = Math.max(0, round(x.weight - 2.5)); }));
  row.querySelector('.w-plus').addEventListener('click', () => patch((x) => { x.weight = round(x.weight + 2.5); }));
  row.querySelector('.r-minus').addEventListener('click', () => patch((x) => { x.reps = Math.max(0, x.reps - 1); }));
  row.querySelector('.r-plus').addEventListener('click', () => patch((x) => { x.reps += 1; }));
  w.addEventListener('input', () => {
    const n = parseNumber(w.value);
    if (n !== null) { set.weight = n; paint(set); patch((x) => { x.weight = n; }, { rerender: false }); }
  });
  r.addEventListener('input', () => {
    const n = parseNumber(r.value);
    if (n !== null && Number.isInteger(n)) { set.reps = n; paint(set); patch((x) => { x.reps = n; }, { rerender: false }); }
  });
  return row;
}
