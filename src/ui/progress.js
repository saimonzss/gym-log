import { weightSeries, personalRecord, trainedDates, localDateISO } from '../logic.js';
import { formatKg } from './today.js';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
let selectedEx = null;
let month = null; // 'YYYY-MM'

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// exerciseId -> latest name
function exerciseNames(sessions) {
  const names = new Map();
  [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((s) => s.exercises.forEach((e) => names.set(e.exerciseId, e.name)));
  return names;
}

export function render(container, ctx) {
  const { sessions } = ctx.getState();
  const h1 = document.createElement('h1');
  h1.textContent = 'Progreso';
  container.appendChild(h1);
  if (!sessions.length) {
    container.insertAdjacentHTML('beforeend', '<p class="muted">Todavía no hay sesiones.</p>');
    return;
  }
  const names = exerciseNames(sessions);
  if (!names.has(selectedEx)) selectedEx = [...names.keys()][0];
  month = month || localDateISO().slice(0, 7);
  const again = () => { container.innerHTML = ''; render(container, ctx); };

  const card = document.createElement('section');
  card.className = 'card';
  const select = document.createElement('select');
  select.id = 'ex-select';
  select.style.cssText = 'width:100%;min-height:44px;font:inherit;margin-bottom:10px';
  for (const [id, name] of names) select.add(new Option(name, id, false, id === selectedEx));
  select.addEventListener('change', () => { selectedEx = select.value; again(); });
  card.appendChild(select);

  const record = personalRecord(sessions, selectedEx);
  const rec = document.createElement('p');
  rec.className = 'record';
  rec.textContent = record === null ? 'Todavía no hay series hechas de este ejercicio.' : `Récord: ${formatKg(record)} kg`;
  card.appendChild(rec);
  const series = weightSeries(sessions, selectedEx);
  if (series.length) card.appendChild(chart(series));
  container.appendChild(card);
  container.appendChild(calendar(sessions, again));
}

function chart(series) {
  const W = 340, H = 170, pad = 28;
  const ws = series.map((p) => p.weight);
  const min = Math.min(...ws), max = Math.max(...ws);
  const x = (i) => (series.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (series.length - 1));
  const y = (w) => (max === min ? H / 2 : H - pad - ((w - min) * (H - 2 * pad)) / (max - min));
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Peso a lo largo del tiempo');
  svg.style.cssText = 'width:100%;height:auto';
  const el = (name, attrs, text) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text) n.textContent = text;
    svg.appendChild(n);
  };
  el('polyline', { points: series.map((p, i) => `${x(i)},${y(p.weight)}`).join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3 });
  series.forEach((p, i) => {
    el('circle', { class: 'point', cx: x(i), cy: y(p.weight), r: 5, fill: 'var(--accent)' });
    el('text', { x: x(i), y: y(p.weight) - 10, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }, formatKg(p.weight));
  });
  el('text', { x: pad, y: H - 6, 'font-size': 11, fill: 'var(--muted)' }, series[0].date);
  el('text', { x: W - pad, y: H - 6, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' }, series[series.length - 1].date);
  return svg;
}

function calendar(sessions, again) {
  const card = document.createElement('section');
  card.className = 'card';
  const [y, m] = month.split('-').map(Number);
  const head = document.createElement('div');
  head.className = 'row';
  head.innerHTML = '<button class="prev-month fixed" aria-label="Mes anterior">‹</button><strong class="month-label" style="text-align:center"></strong><button class="next-month fixed" aria-label="Mes siguiente">›</button>';
  head.querySelector('.month-label').textContent = `${MONTHS[m - 1]} ${y}`;
  head.querySelector('.prev-month').addEventListener('click', () => { month = shiftMonth(month, -1); again(); });
  head.querySelector('.next-month').addEventListener('click', () => { month = shiftMonth(month, 1); again(); });
  card.appendChild(head);

  const trained = trainedDates(sessions, month);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:10px;text-align:center';
  for (const d of ['L', 'M', 'M', 'J', 'V', 'S', 'D']) grid.insertAdjacentHTML('beforeend', `<div class="small-label">${d}</div>`);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first
  for (let i = 0; i < lead; i++) grid.appendChild(document.createElement('div'));
  const days = new Date(y, m, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'day' + (trained.has(iso) ? ' trained' : '');
    cell.textContent = String(d);
    cell.style.cssText = 'padding:8px 0;border-radius:8px;' + (trained.has(iso) ? 'background:var(--accent);color:var(--accent-text);font-weight:700' : '');
    grid.appendChild(cell);
  }
  card.appendChild(grid);
  return card;
}
