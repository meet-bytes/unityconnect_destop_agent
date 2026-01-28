const {
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  Tray,
  Menu,
  screen,
} = require("electron");
const path = require("path");
const AutoLaunch = require("auto-launch");
const idleDetector = require("./services/idleDetector");
const syncService = require("./services/syncService");
const { ensureStore } = require("./services/localStorage");
const {
  IDLE_THRESHOLD_SECONDS,
  WARNING_COUNTDOWN_SECONDS,
} = require("./config/idleTiming");

const SERVER_ENDPOINT =
  "https://unity-communication.bytestechnolab.net/api/idle-logs";

let mainWindow;
let tray;
let overlayWindow;

// Overlay state
let overlayPhase = "hidden"; // 'hidden' | 'countdown'
let pendingOverlayEvent = null; // { channel, payload }
let lastCountdownPayload = null; // { countdown: number }

const iconPath = path.join(__dirname, "assets", "app-logo.png");
const trayIconPaths = {
  active: path.join(__dirname, "assets", "tray-active.png"),
  idle: path.join(__dirname, "assets", "tray-idle.png"),
  stopped: path.join(__dirname, "assets", "tray-stopped.png"),
};

// Auto-launch configuration (starts app on login)
const autoLauncher = new AutoLaunch({
  name: "Unity Communications Agent",
  path: app.getPath("exe"),
  isHidden: true, // Start minimized to tray
});

// Enable auto-launch by default
const enableAutoLaunch = async () => {
  try {
    const isEnabled = await autoLauncher.isEnabled();
    if (!isEnabled) {
      await autoLauncher.enable();
      console.log("Auto-launch enabled");
    }
  } catch (err) {
    console.error("Failed to enable auto-launch:", err);
  }
};

function getTrayStatus() {
  const s = idleDetector.getStatus();
  if (!s?.running) return "stopped";
  return s.isIdle ? "idle" : "active";
}

function getTrayStatusLabel() {
  const t = getTrayStatus();
  return t === "stopped" ? "Stopped" : t === "idle" ? "Idle" : "Active";
}

function updateTrayIcon() {
  if (!tray || tray.isDestroyed()) return;
  const status = getTrayStatus();
  const iconPathForStatus = trayIconPaths[status] || trayIconPaths.stopped;
  const img = nativeImage.createFromPath(iconPathForStatus);
  if (!img.isEmpty()) {
    tray.setImage(img);
  }
  tray.setToolTip(`Unity Communications Agent • ${getTrayStatusLabel()}`);
}

function createTray() {
  let img = nativeImage.createFromPath(trayIconPaths.stopped);
  if (img.isEmpty()) {
    img = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  }
  tray = new Tray(img);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      label: "Status",
      sublabel: "Check agent status",
      click: () => {
        const status = idleDetector.getStatus();
        const state = status.running ? "Running" : "Stopped";
        console.log(`Agent status: ${state}`);
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  updateTrayIcon();

  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
};

const createWindow = () => {
  const icon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 620,
    height: 820,
    resizable: false,
    title: "Unity Communications",
    icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Hide window instead of closing (keeps agent running in background)
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

const ensureOverlayWindow = () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;

  const icon = nativeImage.createFromPath(iconPath);
  const display = screen.getPrimaryDisplay();
  const bounds = display?.bounds || { x: 0, y: 0, width: 1280, height: 720 };
  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fullscreen: true,
    fullscreenable: true,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    icon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload-overlay.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setMenuBarVisibility(false);
  overlayWindow.loadFile(path.join(__dirname, "renderer", "overlay.html"));

  overlayWindow.webContents.once("did-finish-load", () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    if (pendingOverlayEvent) {
      const { channel, payload } = pendingOverlayEvent;
      pendingOverlayEvent = null;
      overlayWindow.webContents.send(channel, payload);
    }
  });

  overlayWindow.once("ready-to-show", () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    // Ensure full screen/bounds (some Linux WMs ignore initial fullscreen for transparent windows)
    overlayWindow.setBounds(bounds);
    overlayWindow.setFullScreen(true);

    // Make overlay click-through (user activity still resets system idle time)
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    // Stay above full-screen apps where supported
    overlayWindow.setAlwaysOnTop(true, "screen-saver");
    if (overlayWindow.setVisibleOnAllWorkspaces) {
      overlayWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
      });
    }
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  return overlayWindow;
};

const sendOverlay = (channel, payload) => {
  const win = ensureOverlayWindow();
  if (!win || win.isDestroyed()) return;

  if (win.webContents.isLoadingMainFrame()) {
    pendingOverlayEvent = { channel, payload };
    return;
  }
  win.webContents.send(channel, payload);
};

const hideOverlay = () => {
  overlayPhase = "hidden";
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
};

const showCountdownOverlay = (countdownSeconds) => {
  const win = ensureOverlayWindow();
  if (!win || win.isDestroyed()) return;
  overlayPhase = "countdown";
  if (!win.isVisible()) win.showInactive();
  lastCountdownPayload = { countdown: countdownSeconds };
  sendOverlay("overlay:countdown", lastCountdownPayload);
};

const broadcastStatus = () => {
  const status = idleDetector.getStatus();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("agent:status", status);
  }
};

// Broadcast idle state changes to renderer
const broadcastIdleState = (state) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("agent:idleState", state);
  }
  updateTrayIcon();
};

// Set up idle state change listener
idleDetector.onStateChange(broadcastIdleState);

// Drive full-screen overlay from per-second idle ticks
idleDetector.onTick((tick) => {
  const { idleSeconds } = tick || {};
  const idleSec = Number(idleSeconds) || 0;
  const idleAt = Math.max(1, Number(IDLE_THRESHOLD_SECONDS) || 20);
  const warnCountdown = Math.max(1, Number(WARNING_COUNTDOWN_SECONDS) || 10);
  const warnAt = Math.max(0, idleAt - warnCountdown);

  // Only show overlay while agent is running
  const status = idleDetector.getStatus();
  if (!status.running) {
    if (overlayPhase !== "hidden") hideOverlay();
    return;
  }

  // User is active (or below warning threshold) => close overlay immediately
  if (idleSec < warnAt) {
    if (overlayPhase !== "hidden") hideOverlay();
    return;
  }

  // Warning phase: show countdown (WARNING_COUNTDOWN_SECONDS -> 0)
  if (idleSec >= warnAt && idleSec < idleAt) {
    const countdown = Math.max(0, Math.ceil(idleAt - idleSec));
    showCountdownOverlay(countdown);
    return;
  }

  // After countdown hits 0 (total idle >= 20s) -> auto-close overlay
  if (overlayPhase !== "hidden") hideOverlay();
});

// Overlay renderer handshake: resend the latest countdown when it's ready
ipcMain.on("overlay:ready", (event) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (event.sender !== overlayWindow.webContents) return;

  if (overlayPhase === "countdown" && lastCountdownPayload) {
    sendOverlay("overlay:countdown", lastCountdownPayload);
  }
});

app.whenReady().then(async () => {
  ensureStore();
  syncService.init({ endpoint: SERVER_ENDPOINT });

  // Set dock icon on macOS
  if (process.platform === "darwin" && iconPath) {
    const icon = nativeImage.createFromPath(iconPath);
    app.dock.setIcon(icon);
  }

  // Create tray first (so it's always visible)
  createTray();

  // Create main window
  createWindow();

  // Enable auto-launch on login
  await enableAutoLaunch();

  app.on("activate", () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    mainWindow.show();
  });
});

ipcMain.handle("agent:start", async (_event, payload = {}) => {
  const { userName } = payload;
  if (!userName || !userName.trim()) {
    throw new Error("User name is required to start the agent.");
  }

  idleDetector.start({
    userName: userName.trim(),
    thresholdSeconds: IDLE_THRESHOLD_SECONDS,
  });
  broadcastStatus();
  updateTrayIcon();
  return idleDetector.getStatus();
});

ipcMain.handle("agent:stop", async () => {
  idleDetector.stop();
  hideOverlay();
  broadcastStatus();
  updateTrayIcon();
  return idleDetector.getStatus();
});

ipcMain.handle("agent:status", async () => idleDetector.getStatus());

ipcMain.handle("agent:logs", async () => {
  const { archive, queue } = require("./services/localStorage").readStore();
  return { archive, queue };
});

ipcMain.handle("agent:clearLogs", async () => {
  const storage = require("./services/localStorage");
  storage.clearAll();
  return { ok: true };
});

app.on("before-quit", () => {
  app.isQuitting = true;
  idleDetector.stop();
  hideOverlay();
  syncService.stop();
});

// Keep app running in background on all platforms (tray stays active)
app.on("window-all-closed", () => {
  // Do nothing - app stays running via tray
  // Only quit when user clicks "Quit" from tray menu
});
