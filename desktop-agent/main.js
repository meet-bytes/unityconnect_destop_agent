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
const authService = require("./services/authService");
const protocolQueue = require("./services/protocolQueue");
const {
  SERVER_ENDPOINT,
  buildLoginURL,
  PROTOCOL_SCHEME,
  APP_NAME,
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  IDLE_THRESHOLD_SECONDS,
  WARNING_COUNTDOWN_SECONDS,
  SYNC_INTERVAL_MS,
} = require("./config/appConfig");

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
  name: APP_NAME,
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
  tray.setToolTip(`${APP_NAME} • ${getTrayStatusLabel()}`);
}

function createTray() {
  let img = nativeImage.createFromPath(trayIconPaths.stopped);
  if (img.isEmpty()) {
    img = nativeImage
      .createFromPath(iconPath)
      .resize({ width: 16, height: 16 });
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
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow(true);
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
}

const createWindow = (showWindow = true) => {
  // Prevent duplicate windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (showWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    return mainWindow;
  }

  const icon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: false,
    title: APP_NAME,
    icon,
    show: showWindow, // Control visibility
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

  // If window should be hidden, hide it after load
  if (!showWindow) {
    mainWindow.once("ready-to-show", () => {
      mainWindow.hide();
    });
  }
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

// Extract protocol URL from argv/commandLine array
const getProtocolURLFromArgs = (args) => {
  const prefix = `${PROTOCOL_SCHEME}://`;
  for (let i = 0; i < (args || []).length; i++) {
    const arg = args[i];
    if (arg && typeof arg === "string" && arg.startsWith(prefix)) return arg;
    if (arg && typeof arg === "string" && (arg.includes(PROTOCOL_SCHEME) || arg.includes("token="))) {
      const m = arg.match(/unityagent:\/\/[^\s"']+/);
      if (m) return m[0];
    }
  }
  return null;
};

// Handle custom protocol (unityagent://)
const handleProtocolURL = (url) => {
  try {
    const authData = authService.parseTokenFromURL(url, PROTOCOL_SCHEME);
    if (!authData || !authData.token) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("auth:error", {
          message: "Invalid authentication URL. No token found.",
        });
        mainWindow.show();
        mainWindow.focus();
      }
      return;
    }

    authService.setToken(
      authData.token,
      authData.refreshToken || null,
      authData.userInfo || null,
    );

    // Ensure window exists and is visible
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow(true);
    } else {
      // Force show and focus window when receiving auth callback
      mainWindow.show();
      mainWindow.focus();
      // Bring to front (works on Linux)
      if (mainWindow.setAlwaysOnTop) {
        mainWindow.setAlwaysOnTop(true);
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
          }
        }, 100);
      }
    }
    
    // Send auth success event to renderer
    const sendAuthSuccess = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once("did-finish-load", () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send("auth:success", {
                    token: authData.token,
                    userInfo: authData.userInfo,
                  });
                }
              }, 100);
            }
          });
        } else {
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("auth:success", {
                token: authData.token,
                userInfo: authData.userInfo,
              });
            }
          }, 100);
        }
      }
    };
    
    // Wait a bit for window to be ready if just created
    setTimeout(sendAuthSuccess, mainWindow && !mainWindow.isDestroyed() ? 100 : 500);
  } catch (err) {
    console.error("Error handling protocol URL:", err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auth:error", {
        message: "Failed to process authentication. Please try again.",
      });
      mainWindow.show();
      mainWindow.focus();
    }
  }
};

// Handle protocol URL on Windows/Linux (when app is launched via protocol)
// This must be done BEFORE app.whenReady()
if (process.platform === "win32" || process.platform === "linux") {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
    process.exit(0);
  } else {
    app.on("second-instance", (_event, commandLine) => {
      // Always show window when second-instance fires
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow(true);
      } else {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
      
      const protocolURL = getProtocolURLFromArgs(commandLine);
      if (!protocolURL) {
        // Bring window to front even without protocol URL
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.setAlwaysOnTop) {
          mainWindow.setAlwaysOnTop(true);
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.setAlwaysOnTop(false);
            }
          }, 100);
        }
        return;
      }
      
      // Bring to front when protocol URL is present
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.setAlwaysOnTop) {
        mainWindow.setAlwaysOnTop(true);
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
          }
        }, 100);
      }
      
      setTimeout(() => handleProtocolURL(protocolURL), mainWindow && !mainWindow.isDestroyed() ? 200 : 500);
    });
  }
}

// Register protocol handler
// Note: In development, protocol registration often fails because the app isn't installed
// You need to manually register it using the register-protocol.sh script
if (process.defaultApp && process.argv.length >= 2) {
  try {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  } catch (err) {
    console.error("[protocol] Registration failed (dev):", err.message);
  }
} else {
  try {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
  } catch (err) {
    console.error("[protocol] Registration failed:", err);
  }
}

// Handle protocol URL when app is already running (macOS)
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleProtocolURL(url);
});

app.whenReady().then(async () => {
  ensureStore();
  syncService.init({ 
    endpoint: SERVER_ENDPOINT,
    intervalMs: SYNC_INTERVAL_MS,
  });

  // Set dock icon on macOS
  if (process.platform === "darwin" && iconPath) {
    const icon = nativeImage.createFromPath(iconPath);
    app.dock.setIcon(icon);
  }

  // Create tray first (so it's always visible)
  createTray();

  // Poll protocol queue file as fallback (in case second-instance doesn't fire)
  let isProcessingQueue = false;
  const checkProtocolQueue = () => {
    if (isProcessingQueue) return;
    const queuedURL = protocolQueue.dequeueProtocolURL();
    if (queuedURL) {
      isProcessingQueue = true;
      // Ensure window is visible
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow(true);
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
      setTimeout(() => {
        handleProtocolURL(queuedURL);
        setTimeout(() => { isProcessingQueue = false; }, 1000);
      }, 300);
    }
  };
  setInterval(checkProtocolQueue, 500);
  checkProtocolQueue();

  // Handle protocol URL if app was launched via protocol (first launch)
  let protocolURL = getProtocolURLFromArgs(process.argv);
  if (!protocolURL && process.env.ELECTRON_PROTOCOL_URL) {
    protocolURL = process.env.ELECTRON_PROTOCOL_URL;
  }

  // Validate token on startup (expired tokens are cleared by authService.readAuth)
  authService.validateTokenOnStartup();

  // Check if user is already logged in
  const isLoggedIn = authService.isLoggedIn();

  // Create main window: show if protocol URL exists (we're logging in) or if not logged in
  const shouldShowWindow = !isLoggedIn || !!protocolURL;
  createWindow(shouldShowWindow);

  // Handle protocol URL if present (first launch scenario)
  if (protocolURL) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      if (mainWindow.setAlwaysOnTop) {
        mainWindow.setAlwaysOnTop(true);
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
          }
        }, 200);
      }
    }
    setTimeout(() => handleProtocolURL(protocolURL), 500);
  }

  // Enable auto-launch on login
  await enableAutoLaunch();

  // If already logged in, notify renderer and keep window hidden (starts in tray)
  if (isLoggedIn && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.once("did-finish-load", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("auth:status", { loggedIn: true });
      }
    });
  }

  // If token was expired and cleared, notify renderer when it loads
  if (!validation.valid && validation.reason === "expired" && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.once("did-finish-load", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("auth:tokenExpired", { message: "Session expired. Please log in again." });
      }
    });
  }

  app.on("activate", () => {
    if (!mainWindow) {
      createWindow(true);
      return;
    }
    mainWindow.show();
  });
});

ipcMain.handle("agent:start", async (_event, payload = {}) => {
  // Check authentication first (token expiry is validated in authService.isLoggedIn)
  const isLoggedIn = authService.isLoggedIn();
  if (!isLoggedIn) {
    throw new Error("Please log in first to start the agent.");
  }

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

// Authentication IPC handlers
ipcMain.handle("auth:status", async () => {
  return {
    loggedIn: authService.isLoggedIn(),
    token: authService.getToken(),
    refreshToken: authService.getRefreshToken(),
    userInfo: authService.getUserInfo(),
  };
});

ipcMain.handle("auth:login", async () => {
  try {
    // Validate token not expired before opening browser (optional; expiry handled on startup)
    const isLoggedIn = authService.isLoggedIn();
    if (!isLoggedIn && authService.getToken()) {
      authService.logout();
    }
    
    const loginURL = buildLoginURL();
    const { shell } = require("electron");
    await shell.openExternal(loginURL);
    return { success: true };
  } catch (err) {
    console.error("Failed to open login URL:", err);
    const msg = err.message || "";
    if (msg.includes("ENOENT") || msg.includes("open") || msg.includes("browser")) {
      throw new Error("Could not open browser. Check your default browser or try again.");
    }
    if (msg.includes("network") || msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT")) {
      throw new Error("Network offline or unreachable. Check your connection and try again.");
    }
    throw new Error("Failed to open login page. Please try again.");
  }
});

ipcMain.handle("auth:logout", async () => {
  authService.logout();
  // Stop agent if running
  idleDetector.stop();
  hideOverlay();
  broadcastStatus();
  updateTrayIcon();
  return { success: true };
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
