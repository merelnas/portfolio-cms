const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

// ── Paths ────────────────────────────────────────────────────────
const USER_DATA  = app.getPath('userData');
const IMAGES_DIR = path.join(USER_DATA, 'images');
const DATA_FILE  = path.join(USER_DATA, 'portfolio.json');
const BACKUP_DIR = path.join(USER_DATA, 'backups');

for (const dir of [IMAGES_DIR, BACKUP_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Windows ──────────────────────────────────────────────────────
let mainWin = null;
let previewWin = null;

function createMain() {
  mainWin = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Portfolio Admin',
  });

  mainWin.loadFile(path.join(__dirname, '..', 'Admin', 'admin.html'));

  mainWin.on('close', async e => {
    e.preventDefault();
    // Auto-backup on quit
    try { await autoBackup(); } catch (_) {}
    mainWin.destroy();
  });
}

function createPreview(websiteDir) {
  if (previewWin && !previewWin.isDestroyed()) {
    previewWin.focus();
    previewWin.reload();
    return;
  }
  previewWin = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'Preview — Portfolio Website',
    webPreferences: {
      // Allow loading local files cross-origin for preview
      webSecurity: false,
    },
  });
  previewWin.loadFile(path.join(websiteDir, 'index.html'));
  previewWin.on('closed', () => { previewWin = null; });
}

app.whenReady().then(createMain);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMain(); });

// ── Auto-backup ──────────────────────────────────────────────────
async function autoBackup() {
  if (!fs.existsSync(DATA_FILE)) return;
  const date = new Date().toISOString().slice(0, 10);
  const dest = path.join(BACKUP_DIR, `portfolio-backup-${date}.json`);
  // Keep last 10 daily backups
  const existing = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('portfolio-backup-') && f.endsWith('.json'))
    .sort();
  if (existing.length >= 10) {
    fs.unlinkSync(path.join(BACKUP_DIR, existing[0]));
  }
  fs.copyFileSync(DATA_FILE, dest);
}

// ── IPC handlers ─────────────────────────────────────────────────

// Load all portfolio data
ipcMain.handle('data:load', () => {
  if (!fs.existsSync(DATA_FILE)) return null;
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
});

// Save all portfolio data
ipcMain.handle('data:save', (_, data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  return true;
});

// Save an image file; returns the relative filename
ipcMain.handle('image:save', (_, { filename, base64 }) => {
  const ext  = path.extname(filename).toLowerCase() || '.jpg';
  const name = `${Date.now()}${ext}`;
  const dest = path.join(IMAGES_DIR, name);
  const buf  = Buffer.from(base64, 'base64');
  fs.writeFileSync(dest, buf);
  return name; // stored as just the filename; resolved via image:read
});

// Read an image back as a data-URL (for display)
ipcMain.handle('image:read', (_, filename) => {
  const full = path.join(IMAGES_DIR, filename);
  if (!fs.existsSync(full)) return null;
  const ext  = path.extname(filename).slice(1).replace('jpg','jpeg');
  const b64  = fs.readFileSync(full).toString('base64');
  return `data:image/${ext};base64,${b64}`;
});

// Delete an image file
ipcMain.handle('image:delete', (_, filename) => {
  const full = path.join(IMAGES_DIR, filename);
  if (fs.existsSync(full)) fs.unlinkSync(full);
  return true;
});

// Get the images directory path (for Electron drag-from-Finder)
ipcMain.handle('image:dir', () => IMAGES_DIR);

// Open a native file picker and return base64 + filename
ipcMain.handle('image:pick', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWin, {
    title: 'Choose an image',
    filters: [{ name: 'Images', extensions: ['jpg','jpeg','png','webp','gif'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return null;
  const filePath = filePaths[0];
  const b64 = fs.readFileSync(filePath).toString('base64');
  return { filename: path.basename(filePath), base64: b64 };
});

// Manual backup export to a user-chosen location
ipcMain.handle('backup:export', async (_, jsonString) => {
  const date = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWin, {
    title: 'Save backup',
    defaultPath: `portfolio-backup-${date}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, jsonString);
  return true;
});

// Restore backup from file picker
ipcMain.handle('backup:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWin, {
    title: 'Restore backup',
    filters: [{ name: 'JSON backup', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return null;
  return fs.readFileSync(filePaths[0], 'utf8');
});

// Open live preview window
ipcMain.handle('preview:open', async () => {
  // Ask user to locate their local Website folder
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWin, {
    title: 'Select your local Website folder',
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths.length) return false;
  createPreview(filePaths[0]);
  return true;
});

// Reload preview if open (called after publish)
ipcMain.handle('preview:reload', () => {
  if (previewWin && !previewWin.isDestroyed()) previewWin.reload();
});

// Reveal backups folder in Finder/Explorer
ipcMain.handle('backup:showDir', () => shell.openPath(BACKUP_DIR));

// Get app version
ipcMain.handle('app:version', () => app.getVersion());
