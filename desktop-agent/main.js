const { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu } = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');
const idleDetector = require('./services/idleDetector');
const syncService = require('./services/syncService');
const { ensureStore } = require('./services/localStorage');

const SERVER_ENDPOINT = 'https://unity-communication.bytestechnolab.net/api/idle-logs';

let mainWindow;
let tray;

const iconPath = path.join(__dirname, 'assets', 'app_icon.png');

// Auto-launch configuration (starts app on login)
const autoLauncher = new AutoLaunch({
  name: 'Unity Communications Agent',
  path: app.getPath('exe'),
  isHidden: true, // Start minimized to tray
});

// Enable auto-launch by default
const enableAutoLaunch = async () => {
  try {
    const isEnabled = await autoLauncher.isEnabled();
    if (!isEnabled) {
      await autoLauncher.enable();
      console.log('Auto-launch enabled');
    }
  } catch (err) {
    console.error('Failed to enable auto-launch:', err);
  }
};

// Create system tray icon with menu
const createTray = () => {
  const icon = nativeImage.createFromPath(iconPath);
  // Resize for tray (16x16 on most platforms, 22x22 on some Linux)
  const trayIcon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
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
      label: 'Status',
      sublabel: 'Check agent status',
      click: () => {
        const status = idleDetector.getStatus();
        const state = status.running ? 'Running' : 'Stopped';
        console.log(`Agent status: ${state}`);
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Unity Communications Agent');
  tray.setContextMenu(contextMenu);

  // Click on tray icon opens the window
  tray.on('click', () => {
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
    title: 'Unity Communications',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Hide window instead of closing (keeps agent running in background)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const broadcastStatus = () => {
  const status = idleDetector.getStatus();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:status', status);
  }
};

// Broadcast idle state changes to renderer
const broadcastIdleState = (state) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:idleState', state);
  }
};

// Set up idle state change listener
idleDetector.onStateChange(broadcastIdleState);

app.whenReady().then(async () => {
  ensureStore();
  syncService.init({ endpoint: SERVER_ENDPOINT });

  // Set dock icon on macOS
  if (process.platform === 'darwin' && iconPath) {
    const icon = nativeImage.createFromPath(iconPath);
    app.dock.setIcon(icon);
  }

  // Create tray first (so it's always visible)
  createTray();

  // Create main window
  createWindow();

  // Enable auto-launch on login
  await enableAutoLaunch();

  app.on('activate', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    mainWindow.show();
  });
});

ipcMain.handle('agent:start', async (_event, payload = {}) => {
  const { userName } = payload;
  if (!userName || !userName.trim()) {
    throw new Error('User name is required to start the agent.');
  }

  idleDetector.start({
    userName: userName.trim(),
    thresholdSeconds: 20, // Fixed 20-second threshold
  });
  broadcastStatus();
  return idleDetector.getStatus();
});

ipcMain.handle('agent:stop', async () => {
  idleDetector.stop();
  broadcastStatus();
  return idleDetector.getStatus();
});

ipcMain.handle('agent:status', async () => idleDetector.getStatus());

ipcMain.handle('agent:logs', async () => {
  const { archive, queue } = require('./services/localStorage').readStore();
  return { archive, queue };
});

ipcMain.handle('agent:clearLogs', async () => {
  const storage = require('./services/localStorage');
  storage.clearAll();
  return { ok: true };
});

app.on('before-quit', () => {
  app.isQuitting = true;
  idleDetector.stop();
  syncService.stop();
});

// Keep app running in background on all platforms (tray stays active)
app.on('window-all-closed', () => {
  // Do nothing - app stays running via tray
  // Only quit when user clicks "Quit" from tray menu
});
