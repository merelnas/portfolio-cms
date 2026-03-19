const { contextBridge, ipcRenderer } = require('electron');

// Expose a clean, safe API to the renderer (admin.html)
contextBridge.exposeInMainWorld('electronAPI', {

  // ── Data persistence ─────────────────────────────────────────
  loadData:    ()           => ipcRenderer.invoke('data:load'),
  saveData:    (data)       => ipcRenderer.invoke('data:save', data),

  // ── Images ───────────────────────────────────────────────────
  saveImage:   (filename, base64) => ipcRenderer.invoke('image:save', { filename, base64 }),
  readImage:   (filename)  => ipcRenderer.invoke('image:read', filename),
  deleteImage: (filename)  => ipcRenderer.invoke('image:delete', filename),
  pickImage:   ()          => ipcRenderer.invoke('image:pick'),
  getImageDir: ()          => ipcRenderer.invoke('image:dir'),

  // ── Backup / restore ─────────────────────────────────────────
  exportBackup:   (json)   => ipcRenderer.invoke('backup:export', json),
  importBackup:   ()       => ipcRenderer.invoke('backup:import'),
  showBackupDir:  ()       => ipcRenderer.invoke('backup:showDir'),

  // ── Preview window ───────────────────────────────────────────
  openPreview:    ()       => ipcRenderer.invoke('preview:open'),
  reloadPreview:  ()       => ipcRenderer.invoke('preview:reload'),

  // ── App info ─────────────────────────────────────────────────
  getVersion:     ()       => ipcRenderer.invoke('app:version'),

  // ── Detect if running in Electron ────────────────────────────
  isElectron: true,
});
