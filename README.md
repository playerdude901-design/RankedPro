# Ranked Pro

Aplicación para editores de Premiere Pro y ranking público.

- Web: https://playerdude901-design.github.io/RankedPro/
- Código de escritorio: `desktop/app/`
- Pruebas: `cd desktop` y `node --test tests/*.test.js`
- Compilar instalador: `npm ci --prefix app`, después `npx --yes electron-builder@26.18.0 --config electron-builder.yml --win nsis --x64 --publish never` desde `desktop/`. Requiere Node, Python y Windows.
- Notas de versión: `desktop/app/release-notes.json` (copiadas en `updates.json` para la web).
