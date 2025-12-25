const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentAPI', {
  start: (userName) =>
    ipcRenderer.invoke('agent:start', { userName }),
  stop: () => ipcRenderer.invoke('agent:stop'),
  status: () => ipcRenderer.invoke('agent:status'),
  logs: () => ipcRenderer.invoke('agent:logs'),
  clearLogs: () => ipcRenderer.invoke('agent:clearLogs'),
  onStatus: (callback) => {
    ipcRenderer.on('agent:status', (_event, status) => callback(status));
  },
  onIdleState: (callback) => {
    ipcRenderer.on('agent:idleState', (_event, state) => callback(state));
  },
});

