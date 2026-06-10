const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (title, body) =>
    ipcRenderer.invoke('show-notification', { title, body }),
  getVersion: () =>
    ipcRenderer.invoke('get-app-version'),
  updateAlertBadge: (count) =>
    ipcRenderer.invoke('update-alert-badge', count),
  platform: process.platform,
  // Archivos nativos (exportar / importar)
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  openFile: () => ipcRenderer.invoke('open-file'),
  // Gestión de usuarios (admin, usa service role en main process)
  createUser: (data) => ipcRenderer.invoke('create-user', data),
  disableUser: (userId) => ipcRenderer.invoke('disable-user', userId),
})
