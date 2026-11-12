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
const shortDate = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1].slice(0, 3).toLowerCase()}`; };

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
    container.insertAdjacentHTML('beforeend', '<div class="card"><p class="muted" style="margin:0">Todavía no hay sesiones. Tu progreso aparece acá cuando registres entrenamientos.</p></div>');
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
  select.setAttribute('aria-label', 'Ejercicio');
  select.style.fontWeight = '700';
  for (const [id, name] of names) select.add(new Option(name, id, false, id === selectedEx));
  select.addEventListener('change', () => { selectedEx = select.value; again(); });
  card.appendChild(select);

  const record = personalRecord(sessions, selectedEx);
  const series = weightSeries(sessions, selectedEx);
  if (record === null) {
    const p = document.createElement('p');
    p.className = 'record muted';
    p.style.margin = '12px 0 0';
    p.textContent = 'Todavía no hay series hechas de este ejercicio.';
    card.appendChild(p);
  } else {
    const tiles = document.createElement('div');
    tiles.className = 'tiles';
    tiles.style.marginTop = '12px';
    tiles.innerHTML = `
      <p class="tile record"><span class="small-label">Récord</span><strong>${formatKg(record)} kg</strong></p>
      <p class="tile"><span class="small-label">Última</span><strong>${formatKg(series[series.length - 1].weight)} kg</strong></p>
      <p class="tile"><span class="small-label">Sesiones</span><strong>${series.length}</strong></p>`;
    card.append(tiles, chart(series));
  }
  container.appendChild(card);
  container.appendChild(calendar(sessions, again));
}

function chart(series) {
  const W = 340, H = 180, L = 36, R = 16, T = 24, B = 26;
  const ws = series.map((p) => p.weight);
  const min = Math.min(...ws), max = Math.max(...ws);
  const x = (i) => (series.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (series.length - 1));
  const y = (w) => (max === min ? (T + H - B) / 2 : H - B - ((w - min) * (H - T - B)) / (max - min));
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Peso a lo largo del tiempo, de ${formatKg(ws[0])} a ${formatKg(ws[ws.length - 1])} kg`);
  const el = (name, attrs, text) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    svg.appendChild(n);
    return n;
  };
  const defs = el('defs', {});
  defs.innerHTML = '<linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--blue)" stop-opacity=".35"/><stop offset="1" stop-color="var(--blue)" stop-opacity="0"/></linearGradient>';
  for (const w of max === min ? [min] : [min, (min + max) / 2, max]) {
    el('line', { x1: L, x2: W - R, y1: y(w), y2: y(w), stroke: 'var(--line)', 'stroke-width': 1 });
    el('text', { x: L - 6, y: y(w) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' }, formatKg(Math.round(w * 10) / 10));
  }
  const pts = series.map((p, i) => `${x(i)},${y(p.weight)}`);
  if (series.length > 1) {
    el('path', { d: `M${pts.join(' L')} L${x(series.length - 1)},${H - B} L${x(0)},${H - B} Z`, fill: 'url(#chart-fill)' });
    el('polyline', { points: pts.join(' '), fill: 'none', stroke: 'var(--blue)', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  }
  series.forEach((p, i) => {
    const last = i === series.length - 1;
    el('circle', { class: 'point', cx: x(i), cy: y(p.weight), r: last ? 6 : 3.5, fill: 'var(--blue)', stroke: 'var(--card)', 'stroke-width': last ? 3 : 1.5 });
  });
  const lastI = series.length - 1;
  el('text', { x: Math.min(x(lastI), W - R - 4), y: y(ws[lastI]) - 12, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 800, fill: 'var(--text)' }, `${formatKg(ws[lastI])} kg`);
  el('text', { x: L, y: H - 6, 'font-size': 11, fill: 'var(--muted)' }, shortDate(series[0].date));
  if (series.length > 1) el('text', { x: W - R, y: H - 6, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' }, shortDate(series[lastI].date));
  return svg;
}

function calendar(sessions, again) {
  const card = document.createElement('section');
  card.className = 'card';
  const [y, m] = month.split('-').map(Number);
  const trained = trainedDates(sessions, month);
  const head = document.createElement('div');
  head.className = 'cal-head';
  head.innerHTML = '<button class="prev-month" aria-label="Mes anterior">‹</button><strong class="month-label"></strong><button class="next-month" aria-label="Mes siguiente">›</button>';
  head.querySelector('.month-label').textContent = `${MONTHS[m - 1]} ${y}`;
  head.querySelector('.prev-month').addEventListener('click', () => { month = shiftMonth(month, -1); again(); });
  head.querySelector('.next-month').addEventListener('click', () => { month = shiftMonth(month, 1); again(); });
  const count = document.createElement('p');
  count.className = 'muted';
  count.style.cssText = 'text-align:center;margin:6px 0 0;font-size:14px';
  count.textContent = trained.size === 1 ? '1 entrenamiento este mes' : `${trained.size} entrenamientos este mes`;
  card.append(head, count);

  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  for (const d of ['L', 'M', 'M', 'J', 'V', 'S', 'D']) grid.insertAdjacentHTML('beforeend', `<div class="small-label">${d}</div>`);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first
  for (let i = 0; i < lead; i++) grid.appendChild(document.createElement('div'));
  const days = new Date(y, m, 0).getDate();
  const today = localDateISO();
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'day' + (trained.has(iso) ? ' trained' : '') + (iso === today ? ' today' : '');
    cell.textContent = String(d);
    grid.appendChild(cell);
  }
  card.appendChild(grid);
  return card;
}
