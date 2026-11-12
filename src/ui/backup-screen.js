import { exportBackup, parseBackup, BackupError } from '../backup.js';
import { localDateISO } from '../logic.js';
import { prettyDate } from './today.js';

// File picker + validation + confirmation. Calls onRestore(state) only after the user confirms.
export function restoreControls(onRestore) {
  const box = document.createElement('div');
  box.innerHTML = `
    <label class="restore" style="display:block">
      <span class="btn-like" style="display:flex;align-items:center;justify-content:center;min-height:44px;border:1px solid var(--line);border-radius:10px;background:var(--card)">Restaurar copia…</span>
      <input class="restore-file" type="file" accept=".json,application/json" style="position:absolute;opacity:0;width:1px;height:1px">
    </label>
    <p class="restore-error" style="color:#d33"></p>`;
  const input = box.querySelector('.restore-file');
  const error = box.querySelector('.restore-error');
  input.addEventListener('change', async () => {
    error.textContent = '';
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    try {
      const restored = parseBackup(await f.text());
      if (!window.confirm('Esto reemplaza tus datos actuales. ¿Continuar?')) return;
      onRestore(restored);
    } catch (e) {
      error.textContent = e instanceof BackupError ? e.message : 'No se pudo restaurar la copia';
    }
  });
  return box;
}

async function exportFile(state) {
  const text = exportBackup(state);
  const name = `gym-log-${localDateISO()}.json`;
  const f = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [f] })) {
    await navigator.share({ files: [f] }); // iPhone: share sheet -> "Guardar en Archivos"
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(f);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export function render(container, ctx) {
  const state = ctx.getState();
  const last = state.settings.lastBackupAt;
  container.innerHTML = `
    <h1>Copia de seguridad</h1>
    <section class="card">
      <p class="muted">Tus datos viven solo en este teléfono. Guardá una copia de vez en cuando, por ejemplo en Archivos o iCloud.</p>
      <p class="last-backup"></p>
      <button class="export primary" style="width:100%">Exportar copia</button>
      <p class="export-error" style="color:#d33"></p>
    </section>
    <section class="card"></section>`;
  container.querySelector('.last-backup').textContent = last
    ? `Última copia: ${prettyDate(last.slice(0, 10))}`
    : 'Todavía no hiciste ninguna copia.';
  container.querySelector('.export').addEventListener('click', async () => {
    try {
      await exportFile(ctx.getState());
      ctx.update((s) => { s.settings.lastBackupAt = new Date().toISOString(); return s; });
    } catch (e) {
      if (e && e.name === 'AbortError') return; // user closed the share sheet
      container.querySelector('.export-error').textContent = 'No se pudo exportar la copia.';
    }
  });
  container.querySelectorAll('section.card')[1].appendChild(restoreControls((restored) => {
    ctx.update(() => restored);
  }));
}
