const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('journalApi', {
  getStorageInfo: () => ipcRenderer.invoke('journal:get-storage-info'),
  chooseStorageFolder: () => ipcRenderer.invoke('journal:choose-storage-folder'),
  loadState: () => ipcRenderer.invoke('journal:load-state'),
  saveState: (nextState) => ipcRenderer.invoke('journal:save-state', nextState),
  saveImages: (payload) => ipcRenderer.invoke('journal:save-images', payload),
  deleteImage: (filePath) => ipcRenderer.invoke('journal:delete-image', filePath),
})
