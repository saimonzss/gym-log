# Bitácora de gimnasio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una PWA para iPhone que registra pesos y repeticiones del gimnasio con precarga de la última sesión, sugerencia de progresión, gráficos de progreso y copia de seguridad.

**Architecture:** Página única en HTML/CSS/JS plano (módulos ES), sin frameworks ni dependencias. Tres capas: `storage` (única que toca `localStorage`), `logic` y `backup` (funciones puras, probadas con `node --test`) y `ui` (pantallas que usan las anteriores). Service worker para uso sin conexión.

**Tech Stack:** HTML, CSS, JavaScript (ES modules), `node --test` para la lógica, Playwright (ya instalado, `require('playwright')`) para pruebas de interfaz, GitHub Pages para publicar.

**Spec:** `docs/superpowers/specs/2026-11-12-bitacora-gimnasio-design.md`

## Global Constraints

- Sin frameworks, sin librerías externas, sin build step; todo funciona abriendo los archivos servidos estáticamente.
- Los datos viven solo en el iPhone (`localStorage`); la app pide `navigator.storage.persist()`.
- Debe funcionar sin conexión tras la primera carga (service worker).
- Objetivo de uso: iPhone 17 Pro, Safari, instalada con "Agregar a pantalla de inicio". Interfaz en español, pensada para una mano; botones táctiles de al menos 44×44 px.
- Cada serie se guarda al instante; no hay botón de guardar por serie.
- Subir peso: botones **+2,5 kg / −2,5 kg**, **+1 / −1 repetición**; también se puede escribir (acepta coma decimal: `62,5`).
- Sugerencia de progresión: últimas **3** sesiones del ejercicio, todas las series hechas, mismo peso, repeticiones ≥ objetivo → sugerir **+2,5 kg**. Nunca se aplica sola. Valores en `settings` (`progressionSessions`, `progressionStepKg`).
- Domingo es descanso por defecto; el gimnasio es de lunes a sábado.
- Las sesiones guardan sus propios datos (nombre, objetivos) y no cambian al editar la rutina.
- Copia de seguridad: exportar, restaurar con validación y confirmación, recordatorio cada 30 días.
- Fechas siempre en hora local (`YYYY-MM-DD`), nunca `toISOString()`.
- Los mensajes de commit terminan con las dos líneas de atribución del sistema (`Co-Authored-By` y `Claude-Session`).

## Review Focus

- Abrir "Hoy" dos veces el mismo día retoma la sesión existente; no crea una sesión duplicada.
- Cerca de medianoche el día de la sesión es el local, no el UTC.
- Editar o renombrar un ejercicio de la rutina no altera sesiones pasadas ni su precarga histórica.
- Restaurar un archivo vacío, que no sea JSON o que sea de otra app se rechaza sin tocar los datos actuales.
- Almacenamiento lleno, bloqueado o con JSON dañado: aviso visible, ofrece exportar o restaurar, nunca pantalla en blanco ni pérdida silenciosa.
- Peso nunca baja de 0; texto vacío o inválido en el campo de peso no guarda `NaN`.

## File Structure

```
index.html              estructura, tab bar, registro del service worker
styles.css              estilos (tema oscuro/claro, botones grandes)
manifest.webmanifest    nombre, íconos, display standalone
sw.js                   caché offline de todos los archivos de la app
icons/                  icon-192.png, icon-512.png, apple-touch-icon.png
package.json            "type": "module", script "test"
src/storage.js          estado por defecto, load/save, persistencia
src/logic.js            precarga, sugerencia, récord, series para gráfico, fechas
src/backup.js           exportar, parsear/validar, recordatorio mensual
src/app.js              estado en memoria, tabs, ctx para las pantallas
src/ui/today.js         pantalla Hoy
src/ui/history.js       lista de sesiones pasadas y edición
src/ui/routine.js       configuración de la rutina
src/ui/progress.js      gráfico, récord, calendario
src/ui/backup-screen.js exportar / restaurar / aviso
tests/*.test.js         pruebas de lógica
tests/e2e/*.test.js     pruebas de interfaz con Playwright
```

### Tipos compartidos (todos los módulos los usan tal cual)

```
State       { version: 1, routine: Record<0..6, RoutineDay>, sessions: Session[], settings: Settings }
RoutineDay  { name: string, rest: boolean, exercises: Exercise[] }       // índice 0 = domingo (Date.getDay)
Exercise    { id: string, name: string, sets: number, reps: number }
Session     { id: string, date: string, dayIndex: number, dayName: string, finished: boolean, exercises: SessionExercise[] }
SessionExercise { exerciseId: string, name: string, targetSets: number, targetReps: number, sets: SetEntry[] }
SetEntry    { weight: number, reps: number, done: boolean }
Settings    { progressionSessions: number, progressionStepKg: number, lastBackupAt: string | null }
```

---

### Task 1: Proyecto base y almacenamiento

**Files:**
- Create: `package.json`, `src/storage.js`, `tests/storage.test.js`

**Interfaces:**
- Produces: `defaultState(): State` (rutina con 7 días, domingo `rest: true`, resto `rest: false` con `exercises: []`, `settings` con 3, 2.5, null); `class StorageError extends Error`; `loadState(store = globalThis.localStorage): State` (clave `gymlog.state`; vacío → `defaultState()`; JSON dañado o `store` inaccesible → lanza `StorageError`); `saveState(state: State, store = globalThis.localStorage): void` (lanza `StorageError` si falla); `requestPersistence(): Promise<boolean>`.

- [ ] **Step 1: Write the failing tests** in `tests/storage.test.js`, con un `store` falso en memoria (`getItem/setItem`): `loadState` sin datos devuelve `defaultState()` con domingo en descanso; `saveState` y luego `loadState` devuelve el mismo estado; `loadState` con `"{no es json"` lanza `StorageError`; `saveState` con un `store` cuyo `setItem` lanza `QuotaExceededError` lanza `StorageError`.
- [ ] **Step 2: Run** `node --test tests/storage.test.js` — Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement** `package.json` (`"type": "module"`, `"scripts": {"test": "node --test tests/"}`) y `src/storage.js` con las firmas de Interfaces. `requestPersistence` llama a `navigator.storage?.persist?.()` y devuelve `false` si no existe.
- [ ] **Step 4: Run** `node --test tests/storage.test.js` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: project base and storage layer`.

### Task 2: Lógica de entrenamiento

**Files:**
- Create: `src/logic.js`, `tests/logic.test.js`

**Interfaces:**
- Consumes: tipos compartidos.
- Produces:
  - `localDateISO(d: Date = new Date()): string` (fecha local `YYYY-MM-DD`)
  - `startOrResumeSession(state: State, dateISO: string): Session | null` (null si el día es descanso; si ya existe sesión de esa fecha la devuelve; si no, la crea desde la rutina con la precarga y **no la agrega** a `state`, el llamador la guarda)
  - `prefillSets(sessions: Session[], exerciseId: string, targetSets: number, targetReps: number): SetEntry[]`
  - `suggestWeightIncrease(sessions: Session[], exerciseId: string, settings: Settings): { suggest: boolean, newWeight?: number }`
  - `personalRecord(sessions: Session[], exerciseId: string): number | null`
  - `weightSeries(sessions: Session[], exerciseId: string): { date: string, weight: number }[]` (peso máximo hecho por sesión, orden cronológico)
  - `trainedDates(sessions: Session[], yearMonth: string): Set<string>` (`yearMonth` = `'2026-11'`; fechas con al menos una serie hecha)

- [ ] **Step 1: Write the failing tests** en `tests/logic.test.js`:
  - `prefillSets` sin historial → `targetSets` series con `weight: 0`, `reps: targetReps`, `done: false`.
  - `prefillSets` copia peso y repeticiones de la sesión más reciente que tenga series hechas de ese ejercicio, siempre con `done: false`; ignora sesiones donde ninguna serie está hecha; ajusta a `targetSets` (rellena repitiendo la última o recorta).
  - `prefillSets` busca por `exerciseId`: renombrar el ejercicio no rompe la precarga.
  - `suggestWeightIncrease`: 3 sesiones con 3×8 hechas a 60 kg y objetivo 8 → `{suggest: true, newWeight: 62.5}`; solo 2 sesiones → false; pesos distintos entre sesiones → false; una serie sin hacer → false; repeticiones por debajo del objetivo → false; peso 0 → false.
  - `startOrResumeSession`: domingo → `null`; segundo llamado el mismo día devuelve la misma sesión (mismo `id`) si ya estaba en `state.sessions`; `dayName` y objetivos se copian de la rutina.
  - `localDateISO(new Date(2026, 10, 12, 23, 59))` → `'2026-11-12'` (local, no UTC).
  - `personalRecord` ignora series no hechas; `weightSeries` y `trainedDates` con casos de 2-3 sesiones.
- [ ] **Step 2: Run** `node --test tests/logic.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** las firmas de Interfaces en `src/logic.js`. Las "últimas N sesiones" se ordenan por `date` descendente; ids con `crypto.randomUUID()`.
- [ ] **Step 4: Run** `node --test tests/logic.test.js` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: training logic (prefill, progression, records)`.

### Task 3: Copia de seguridad (lógica)

**Files:**
- Create: `src/backup.js`, `tests/backup.test.js`

**Interfaces:**
- Consumes: `State`, `defaultState()` de `src/storage.js`.
- Produces: `class BackupError extends Error`; `exportBackup(state: State, now: Date = new Date()): string` (JSON `{app: 'gym-log', version: 1, exportedAt, state}`); `parseBackup(text: string): State` (lanza `BackupError` si está vacío, no es JSON, `app !== 'gym-log'`, o `state` no tiene `routine` con 7 días, `sessions` array y `settings`); `isBackupDue(settings: Settings, now: Date): boolean` (true si `lastBackupAt` es null o pasaron ≥ 30 días).

- [ ] **Step 1: Write the failing tests:** ida y vuelta `parseBackup(exportBackup(s))` deep-equal a `s`; `parseBackup("")`, `parseBackup("hola")`, `parseBackup('{"app":"otra"}')` y un estado sin `sessions` lanzan `BackupError`; `isBackupDue` con null → true, hace 29 días → false, hace 30 días → true.
- [ ] **Step 2: Run** `node --test tests/backup.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `src/backup.js` según Interfaces.
- [ ] **Step 4: Run** `npm test` — Expected: PASS (todas las pruebas).
- [ ] **Step 5: Commit** `feat: backup export, validation and reminder`.

### Task 4: Esqueleto de la app y pantalla Rutina

**Files:**
- Create: `index.html`, `styles.css`, `src/app.js`, `src/ui/routine.js`, `tests/e2e/routine.test.js`

**Interfaces:**
- Consumes: `loadState`, `saveState`, `StorageError`, `requestPersistence`.
- Produces: en `src/app.js`, `ctx = { getState(): State, update(fn: (s: State) => State): void }` — `update` aplica `fn`, guarda y re-renderiza la pantalla activa; si `saveState` lanza `StorageError`, muestra un banner visible "No se pudo guardar. Exportá una copia" y mantiene el estado en memoria. Si `loadState` lanza `StorageError` al arrancar, muestra la pantalla de error con botón "Restaurar copia" (reutiliza Task 9) y **no** guarda nada. Cada pantalla exporta `render(container: HTMLElement, ctx): void`. Tab bar inferior: Hoy, Historial, Progreso, Rutina, Copia.
- `routine.js`: lista los 7 días (empezando por lunes); por día: nombre editable, interruptor de descanso, ejercicios con nombre, series y repeticiones editables, agregar y quitar ejercicio (ids con `crypto.randomUUID()`).

- [ ] **Step 1: Write the failing e2e test** en `tests/e2e/routine.test.js` (viewport iPhone, servidor estático local con `python3 -m http.server`): arrancar sin datos muestra el domingo como descanso; agregar al lunes el ejercicio "Press banca" 4×8; recargar la página y verificar que sigue ahí; un `localStorage` con `"{roto"` muestra la pantalla de error en vez de una pantalla en blanco.
- [ ] **Step 2: Run** `node --test tests/e2e/routine.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `index.html`, `styles.css`, `src/app.js` y `src/ui/routine.js` según Interfaces. Las demás pestañas muestran un texto "Próximamente" hasta sus tareas.
- [ ] **Step 4: Run** `node --test tests/e2e/routine.test.js` — Expected: PASS. Captura de pantalla a 390×844 revisada a mano.
- [ ] **Step 5: Commit** `feat: app shell and routine screen`.

### Task 5: Pantalla Hoy

**Files:**
- Create: `src/ui/today.js`, `tests/e2e/today.test.js`
- Modify: `src/app.js` (conectar pestaña Hoy como inicial)

**Interfaces:**
- Consumes: `ctx`, `startOrResumeSession`, `suggestWeightIncrease`, `localDateISO`, `personalRecord`.
- Produces: `render(container, ctx)` en `today.js`. Al abrir: `startOrResumeSession(state, localDateISO())`; si devuelve una sesión nueva la agrega a `state.sessions` vía `ctx.update`; si es `null` muestra "Hoy es día de descanso". Cada serie es un botón con "peso × repeticiones"; tocarla alterna `done`. Debajo de cada serie, controles `−2,5 kg`, `+2,5 kg`, `−1 rep`, `+1 rep` y campos numéricos para escribir. "Finalizar" pone `finished: true`. La tarjeta del ejercicio muestra la sugerencia ("Subí a 62,5 kg") cuando `suggestWeightIncrease(...).suggest`; tocarla aplica el nuevo peso a las series no hechas.

- [ ] **Step 1: Write the failing e2e test:** con una rutina del día actual de 1 ejercicio 3×8, abrir Hoy muestra 3 series; tocar una la marca hecha; cerrar y reabrir la app conserva el estado; `+2,5 kg` cambia 60 → 62,5; el peso no baja de 0 con `−2,5 kg` desde 0; escribir `62,5` con coma y texto vacío no guarda `NaN`; abrir Hoy dos veces no duplica la sesión; con 3 sesiones previas que cumplen la regla aparece la sugerencia y tocarla sube las series pendientes a +2,5 kg. Sembrar datos escribiendo `gymlog.state` en `localStorage` antes de cargar.
- [ ] **Step 2: Run** `node --test tests/e2e/today.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `src/ui/today.js` según Interfaces; interpretar la entrada con `Number(text.replace(',', '.'))` y descartar valores no finitos o negativos.
- [ ] **Step 4: Run** `node --test tests/e2e/today.test.js` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: today screen with prefill and progression hint`.

### Task 6: Historial y completar sesiones pasadas

**Files:**
- Create: `src/ui/history.js`, `tests/e2e/history.test.js`

**Interfaces:**
- Consumes: `ctx`.
- Produces: `render(container, ctx)`: lista de sesiones por fecha descendente (fecha, nombre del día, series hechas / totales); tocar una abre el mismo editor de series de la pantalla Hoy sobre esa sesión, reutilizando una función de `today.js` exportada como `renderSessionEditor(container, session, ctx): void` (extraerla en esta tarea sin cambiar el comportamiento de Hoy). Botón para borrar una sesión con confirmación.

- [ ] **Step 1: Write the failing e2e test:** con dos sesiones sembradas, el historial las lista de más reciente a más antigua; abrir una antigua, marcar una serie pendiente y recargar conserva el cambio; borrar pide confirmación y, tras aceptar, desaparece.
- [ ] **Step 2: Run** `node --test tests/e2e/history.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `history.js` y extraer `renderSessionEditor` de `today.js`.
- [ ] **Step 4: Run** `node --test tests/e2e/` — Expected: PASS (Hoy sigue pasando).
- [ ] **Step 5: Commit** `feat: history screen and past session editing`.

### Task 7: Pantalla Progreso

**Files:**
- Create: `src/ui/progress.js`, `tests/e2e/progress.test.js`

**Interfaces:**
- Consumes: `weightSeries`, `personalRecord`, `trainedDates`, `ctx`.
- Produces: `render(container, ctx)`: selector de ejercicio (todos los ejercicios presentes en sesiones, por nombre más reciente), gráfico SVG de línea con `weightSeries`, récord personal en texto, y calendario del mes actual con los días entrenados marcados y botones para ver el mes anterior y siguiente. Estado vacío legible si no hay datos ("Todavía no hay sesiones").

- [ ] **Step 1: Write the failing e2e test:** con 3 sesiones sembradas, el selector muestra el ejercicio, el SVG tiene un punto por sesión, el récord muestra el máximo, y el calendario marca exactamente los días con series hechas; sin datos aparece el estado vacío.
- [ ] **Step 2: Run** `node --test tests/e2e/progress.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `src/ui/progress.js`; gráfico en SVG a mano, sin librerías.
- [ ] **Step 4: Run** `node --test tests/e2e/progress.test.js` — Expected: PASS. Captura a 390×844 revisada a mano.
- [ ] **Step 5: Commit** `feat: progress screen with chart and calendar`.

### Task 8: Pantalla Copia de seguridad

**Files:**
- Create: `src/ui/backup-screen.js`, `tests/e2e/backup.test.js`
- Modify: `src/app.js` (aviso mensual al abrir)

**Interfaces:**
- Consumes: `exportBackup`, `parseBackup`, `isBackupDue`, `BackupError`, `ctx`.
- Produces: `render(container, ctx)`: botón "Exportar" (descarga/comparte el JSON con nombre `gym-log-AAAA-MM-DD.json` y guarda `lastBackupAt`); botón "Restaurar" (selector de archivo → `parseBackup` → diálogo de confirmación "Esto reemplaza tus datos actuales" → `ctx.update(() => restaurado)`); si `parseBackup` lanza `BackupError`, muestra el motivo y no cambia nada. En `app.js`, al abrir, si hay sesiones y `isBackupDue`, mostrar un aviso con atajo a esta pantalla.

- [ ] **Step 1: Write the failing e2e test:** exportar descarga un archivo cuyo contenido pasa `parseBackup`; restaurar ese archivo sobre datos distintos los reemplaza solo tras confirmar y cancelar no cambia nada; restaurar un archivo vacío y uno de otra app muestran error y dejan los datos intactos; con `lastBackupAt` de hace 31 días y sesiones sembradas aparece el aviso al abrir.
- [ ] **Step 2: Run** `node --test tests/e2e/backup.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `backup-screen.js` y el aviso en `app.js`; la pantalla de error de arranque de Task 4 usa este mismo flujo de restaurar.
- [ ] **Step 4: Run** `npm test && node --test tests/e2e/` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: backup screen and monthly reminder`.

### Task 9: PWA e instalación en iPhone

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png` (180×180), `tests/e2e/offline.test.js`
- Modify: `index.html` (enlaces al manifest, `apple-touch-icon`, metas `apple-mobile-web-app-capable`, `viewport-fit=cover`; registrar `sw.js`; llamar `requestPersistence()` al arrancar)

**Interfaces:**
- Produces: `sw.js` guarda en caché todos los archivos listados en `index.html`, `src/**`, `icons/**`, `styles.css`, `manifest.webmanifest` en la instalación y responde primero desde caché; el nombre de la caché lleva un número de versión que se sube en cada despliegue. Los íconos se generan con Playwright renderizando un SVG simple (mancuerna) a PNG.

- [ ] **Step 1: Write the failing e2e test:** cargar la app una vez, esperar el service worker activo, poner el contexto en modo sin conexión, recargar y verificar que la app abre y los datos siguen; el manifest tiene `display: standalone` y los íconos devuelven 200.
- [ ] **Step 2: Run** `node --test tests/e2e/offline.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** manifest, `sw.js`, íconos y cambios de `index.html`.
- [ ] **Step 4: Run** `npm test && node --test tests/e2e/` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: installable offline PWA`.

### Task 10: Publicación y verificación en el iPhone

**Files:**
- Create: `README.md` (qué es, cómo instalar en el iPhone, cómo hacer copia de seguridad)

- [ ] **Step 1: Confirmar con el usuario** que tiene cuenta de GitHub y el nombre del repositorio antes de crear nada (acción hacia afuera). El repositorio contiene solo el código de la app; los datos de entrenamiento nunca salen del teléfono.
- [ ] **Step 2: Crear el repositorio** con `gh repo create`, subir `main` y activar GitHub Pages desde la raíz de `main`. Expected: la URL pública responde 200 y carga la app.
- [ ] **Step 3: Verificación manual en el iPhone** (guiada al usuario): abrir la URL en Safari; Compartir → "Agregar a pantalla de inicio"; registrar una serie, cerrar la app por completo y reabrirla (el dato sigue); activar modo avión y abrirla (funciona); exportar una copia.
- [ ] **Step 4: Commit** `docs: README and deployment notes`.
