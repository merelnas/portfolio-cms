# Portfolio CMS

A desktop app + static website system for managing and publishing an artist portfolio.

## Project structure

```
Admin/admin.html        — the CMS admin panel
Website/                — the static GitHub Pages site
Electron/main.js        — Electron main process
Electron/preload.js     — Electron IPC bridge
package.json            — app config & build settings
.github/workflows/      — auto-builds .exe and .app via GitHub Actions
```

## Run locally

```bash
npm install
npm start
```

## Build installers

Push a version tag to trigger GitHub Actions:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will build a `.dmg` (Mac) and `.exe` (Windows) and attach them to a GitHub Release automatically.
