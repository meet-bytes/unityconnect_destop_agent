const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  userActivity: () => ipcRenderer.invoke('overlay:userActivity'),
  getIdleTime: () => ipcRenderer.invoke('overlay:getIdleTime'),
  ready: () => ipcRenderer.send('overlay:ready'),
  onCountdown: (callback) => {
    ipcRenderer.on('overlay:countdown', (_event, data) => callback(data));
  },
});
