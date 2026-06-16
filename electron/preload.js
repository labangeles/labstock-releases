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
  saveFile:  (data) => ipcRenderer.invoke('save-file',  data),
  saveXlsx:  (data) => ipcRenderer.invoke('save-xlsx',  data),
  openFile:  ()     => ipcRenderer.invoke('open-file'),
  // Gestión de usuarios (admin, usa service role en main process)
  createUser:     (data)   => ipcRenderer.invoke('create-user',    data),
  updateUser:     (data)   => ipcRenderer.invoke('update-user',    data),
  resetPassword:  (data)   => ipcRenderer.invoke('reset-password', data),
  enableUser:     (userId) => ipcRenderer.invoke('enable-user',    userId),
  disableUser:    (userId) => ipcRenderer.invoke('disable-user',   userId),
  // Seguridad — binding de máquina
  getMachineId:   ()       => ipcRenderer.invoke('get-machine-id'),
  resetMachineId: (userId) => ipcRenderer.invoke('reset-machine-id', userId),
})
