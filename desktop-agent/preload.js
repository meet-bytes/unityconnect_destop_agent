const { contextBridge, ipcRenderer } = require("electron");

// Safely load config with fallback
let LOG_REFRESH_INTERVAL_MS = 5000;
let AUTH_SUCCESS_MESSAGE_TIMEOUT_MS = 3000;
let LOGIN_TIMEOUT_MS = 60 * 1000; // fallback only if require fails
try {
  const appConfig = require("./config/appConfig");
  LOG_REFRESH_INTERVAL_MS = appConfig.LOG_REFRESH_INTERVAL_MS || 5000;
  AUTH_SUCCESS_MESSAGE_TIMEOUT_MS =
    appConfig.AUTH_SUCCESS_MESSAGE_TIMEOUT_MS || 3000;
  if (appConfig.LOGIN_TIMEOUT_MS != null && typeof appConfig.LOGIN_TIMEOUT_MS === "number" && appConfig.LOGIN_TIMEOUT_MS > 0) {
    LOGIN_TIMEOUT_MS = appConfig.LOGIN_TIMEOUT_MS;
  }
} catch (err) {
  console.error("Failed to load appConfig in preload:", err);
}

contextBridge.exposeInMainWorld("agentAPI", {
  start: (userName) => ipcRenderer.invoke("agent:start", { userName }),
  stop: () => ipcRenderer.invoke("agent:stop"),
  status: () => ipcRenderer.invoke("agent:status"),
  logs: () => ipcRenderer.invoke("agent:logs"),
  clearLogs: () => ipcRenderer.invoke("agent:clearLogs"),
  onStatus: (callback) => {
    ipcRenderer.on("agent:status", (_event, status) => callback(status));
  },
  onIdleState: (callback) => {
    ipcRenderer.on("agent:idleState", (_event, state) => callback(state));
  },
});

contextBridge.exposeInMainWorld("authAPI", {
  status: () => ipcRenderer.invoke("auth:status"),
  login: () => ipcRenderer.invoke("auth:login"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  onSuccess: (callback) => {
    ipcRenderer.on("auth:success", (_event, data) => callback(data));
  },
  onError: (callback) => {
    ipcRenderer.on("auth:error", (_event, data) => callback(data));
  },
  onStatusChange: (callback) => {
    ipcRenderer.on("auth:status", (_event, data) => callback(data));
  },
  onTokenExpired: (callback) => {
    ipcRenderer.on("auth:tokenExpired", (_event, data) => callback(data));
  },
});

// Expose app config to renderer (global state from config/appConfig.js)
const appConfigToExpose = {
  LOG_REFRESH_INTERVAL_MS,
  AUTH_SUCCESS_MESSAGE_TIMEOUT_MS,
  LOGIN_TIMEOUT_MS,
};
contextBridge.exposeInMainWorld("appConfig", appConfigToExpose);
