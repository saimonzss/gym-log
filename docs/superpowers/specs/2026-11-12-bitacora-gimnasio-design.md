# Bitácora de gimnasio: diseño

## Objetivo

Una app personal para registrar pesos y repeticiones en el gimnasio, que se use en el iPhone entre series y que el usuario siga usando semanas y meses después.

**Problema que resuelve:** el registro en Notas se abandonó por tedioso. Había que copiar, pegar y cambiar los pesos cada día, a veces se olvidaba anotar y luego no se recordaba qué se había hecho.

**Criterio de éxito:** registrar una serie es más rápido que hacerlo en Notas (un toque si no cambió nada) y la app muestra el progreso, de modo que anotar tenga recompensa.

## Contexto del usuario

- Usuario único, sin conocimientos de programación; define funciones y diseño, Claude construye.
- iPhone 17 Pro (Safari / iOS).
- Rutina fija que se repite todas las semanas, con ejercicios definidos para cada día.
- Va al gimnasio de lunes a sábado; el domingo es descanso.

## Alcance de la primera versión

### 1. Entrenamiento de hoy (pantalla principal)

- Arriba, el nombre del día según la rutina (ej. "Lunes: pecho y tríceps").
- Lista de ejercicios del día; cada uno es una tarjeta con sus series.
- Cada serie viene **precargada con lo hecho la última vez** en ese ejercicio (ej. "60 kg × 8").
- Tocar una serie la marca como hecha con esos valores (el caso "igual que la última vez").
- Si algo cambió: botones **+2,5 kg / −2,5 kg** y **+1 / −1 repetición**, sin teclado; también se puede escribir el número.
- Cada marca se guarda al instante; no hay botón de guardar por serie.
- Botón "Finalizar" cierra la sesión.
- **Completar sesiones pasadas:** se puede abrir una sesión anterior y registrar o corregir series después.
- **Sugerencia de subir de peso:** ver la regla más abajo.

### 2. Rutina

- Se configura una vez: por cada día de la semana, lista de ejercicios, y por ejercicio cuántas series y repeticiones objetivo.
- Editable en cualquier momento; las sesiones pasadas se conservan tal cual fueron registradas.
- Un día puede marcarse como descanso. El domingo viene como descanso por defecto.

### 3. Progreso

- Por ejercicio: gráfico del peso a lo largo del tiempo y récord personal.
- Calendario del mes con los días entrenados marcados.

### 4. Copia de seguridad

- Botón **Exportar** (genera un archivo con todos los datos) y botón **Restaurar** (carga ese archivo).
- La app recuerda hacer una copia de seguridad una vez al mes.

### Regla de sugerencia de progresión

- Si en las **últimas 3 sesiones** de un ejercicio se completaron todas las series con el **mismo peso** y las repeticiones objetivo, la app sugiere **subir 2,5 kg**.
- La sugerencia se muestra en la tarjeta del ejercicio; el usuario decide si la acepta. Nunca se aplica sola.
- Los valores (3 sesiones, 2,5 kg) son ajustes por defecto, fáciles de cambiar durante el desarrollo si el usuario los quiere distintos.

### Fuera de alcance (por ahora)

Cronómetro de descanso, peso y medidas corporales, fotos, cuentas de usuario, sincronización en la nube, compartir con otras personas, biblioteca de ejercicios con videos.

## Arquitectura

**Web app instalable (PWA)** hecha con HTML, CSS y JavaScript simples, sin frameworks ni dependencias externas. Es una sola página.

- **Datos:** se guardan en el almacenamiento del propio iPhone (`localStorage`, o IndexedDB si el volumen lo pide). La app pide almacenamiento persistente al navegador (`navigator.storage.persist()`) para reducir el riesgo de que iOS lo borre.
- **Sin conexión:** un service worker guarda la app en el teléfono, así funciona en el gimnasio sin señal tras la primera carga.
- **Instalación:** el usuario abre el enlace en Safari y usa Compartir → "Agregar a pantalla de inicio". Instalada, iOS protege mejor los datos.
- **Hosting:** GitHub Pages (gratis). Requisito previo: que el usuario tenga una cuenta de GitHub; se confirma al armar el plan.
- **Gráficos:** SVG dibujado a mano, sin librerías.

### Unidades internas

- **Almacenamiento:** lee y escribe los datos; es lo único que toca el navegador para guardar.
- **Lógica de entrenamiento:** calcula la precarga desde la última sesión y la sugerencia de progresión. No sabe nada de pantallas, por lo que se puede probar sola.
- **Pantallas:** Hoy, Rutina, Progreso, Copia de seguridad. Usan las dos unidades anteriores.

### Modelo de datos

- **Rutina:** días de la semana → lista de ejercicios → series objetivo y repeticiones objetivo.
- **Sesión:** fecha, día de la rutina, lista de ejercicios con las series realmente hechas (peso, repeticiones).
- Las sesiones guardan sus propios datos y no dependen de la rutina actual, para no alterar el historial al editar la rutina.

## Manejo de errores

- Si el almacenamiento falla o está lleno, la app avisa de forma visible en lugar de fallar en silencio, y ofrece exportar.
- Al restaurar una copia, se valida el archivo; si es inválido se rechaza sin tocar los datos actuales.
- Al restaurar, se pide confirmación antes de reemplazar los datos existentes.

## Pruebas

- Pruebas automáticas de la lógica de entrenamiento: precarga desde la última sesión, primer uso sin historial, regla de sugerencia (casos que cumplen, casos con peso distinto, series incompletas).
- Prueba de exportar y restaurar (ida y vuelta sin pérdida de datos).
- Verificación manual en el iPhone: instalación, guardado tras cerrar y reabrir, uso sin conexión.
