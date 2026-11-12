# Bitácora de gimnasio

App personal para registrar pesos y repeticiones en el gimnasio desde el iPhone. Precarga lo que hiciste la última vez, te sugiere cuándo subir de peso y te muestra tu progreso. Funciona sin conexión; los datos se guardan solo en tu teléfono.

## Instalar en el iPhone

1. Abrí el enlace de la app en **Safari**.
2. Tocá **Compartir → "Agregar a pantalla de inicio"**.
3. Abrila siempre desde el ícono, no desde Safari (así iOS protege mejor tus datos).

## Copia de seguridad

Tus datos viven solo en el teléfono. En la pestaña **Copia** podés **exportar** un archivo (guardalo en Archivos o iCloud) y **restaurarlo** si cambiás de teléfono o se pierden los datos. La app te lo recuerda cada 30 días.

## Desarrollo

```bash
npm test            # pruebas de la lógica
npm run test:e2e    # pruebas de interfaz (Playwright)
python3 -m http.server 8000   # servir la app en http://localhost:8000
```

Al publicar una versión nueva, subí `VERSION` en `sw.js` para que los teléfonos descarguen los archivos actualizados. Si agregás archivos a `src/` o `icons/`, agregalos también a la lista `FILES` de `sw.js` (un test lo verifica).
