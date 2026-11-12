const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

const positiveInt = (v) => (/^\d+$/.test(v) && Number(v) > 0 ? Number(v) : null);

export function render(container, ctx) {
  const state = ctx.getState();
  const h1 = document.createElement('h1');
  h1.textContent = 'Rutina';
  container.appendChild(h1);
  for (const d of ORDER) container.appendChild(dayCard(d, state.routine[d], ctx));
}

function dayCard(d, day, ctx) {
  const card = document.createElement('section');
  card.className = 'card';
  card.dataset.day = String(d);
  card.innerHTML = `
    <div class="day-head">
      <h2>${DAY_NAMES[d]}</h2>
      <label class="switch">Descanso <input class="rest-toggle" type="checkbox"></label>
    </div>
    <input class="day-name" type="text" placeholder="Nombre del día, ej: Pecho y tríceps" aria-label="Nombre del día">
    <div class="exercises"></div>`;
  const name = card.querySelector('.day-name');
  name.value = day.name;
  name.addEventListener('input', () => ctx.update((s) => { s.routine[d].name = name.value; return s; }, { rerender: false }));
  const rest = card.querySelector('.rest-toggle');
  rest.checked = day.rest;
  rest.addEventListener('change', () => ctx.update((s) => { s.routine[d].rest = rest.checked; return s; }));
  if (day.rest) {
    name.hidden = true;
    card.querySelector('.day-head').style.marginBottom = '0';
    return card;
  }

  const list = card.querySelector('.exercises');
  for (const ex of day.exercises) list.appendChild(exerciseRow(d, ex, ctx));
  const add = document.createElement('button');
  add.className = 'add-exercise primary wide';
  add.textContent = '+ Agregar ejercicio';
  add.addEventListener('click', () => ctx.update((s) => {
    s.routine[d].exercises.push({ id: crypto.randomUUID(), name: '', sets: 3, reps: 10 });
    return s;
  }));
  card.appendChild(add);
  return card;
}

function exerciseRow(d, ex, ctx) {
  const row = document.createElement('div');
  row.className = 'exercise';
  row.innerHTML = `
    <input class="ex-name" type="text" placeholder="Ejercicio" aria-label="Ejercicio">
    <div class="ex-nums">
      <label><span class="small-label">Series</span><input class="ex-sets" type="number" inputmode="numeric" min="1"></label>
      <span class="times">×</span>
      <label><span class="small-label">Reps</span><input class="ex-reps" type="number" inputmode="numeric" min="1"></label>
      <button class="remove-exercise danger" aria-label="Quitar ejercicio">✕</button>
    </div>`;
  const patch = (fn) => ctx.update((s) => {
    const target = s.routine[d].exercises.find((e) => e.id === ex.id);
    if (target) fn(target);
    return s;
  }, { rerender: false });
  const name = row.querySelector('.ex-name');
  name.value = ex.name;
  name.addEventListener('input', () => patch((t) => { t.name = name.value; }));
  for (const [cls, key] of [['.ex-sets', 'sets'], ['.ex-reps', 'reps']]) {
    const input = row.querySelector(cls);
    input.value = ex[key];
    input.addEventListener('input', () => {
      const n = positiveInt(input.value);
      if (n !== null) patch((t) => { t[key] = n; });
    });
  }
  row.querySelector('.remove-exercise').addEventListener('click', () => ctx.update((s) => {
    s.routine[d].exercises = s.routine[d].exercises.filter((e) => e.id !== ex.id);
    return s;
  }));
  return row;
}
