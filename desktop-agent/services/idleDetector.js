const { powerMonitor } = require('electron');
const localStorage = require('./localStorage');
const syncService = require('./syncService');

const { IDLE_THRESHOLD_SECONDS, IDLE_POLL_INTERVAL_MS } = require('../config/appConfig');
const POLL_INTERVAL_MS = IDLE_POLL_INTERVAL_MS;

let pollHandle = null;
let idleStart = null;
let thresholdMs = IDLE_THRESHOLD_SECONDS * 1000;
let activeUser = null;
let currentlyIdle = false;
let onStateChangeCallback = null;
let onTickCallback = null;

// Track if idle detection is working (for Linux debugging)
let idleDetectionWorking = null;
let lastNonZeroIdleTime = 0;

const checkIdle = () => {
  let idleSeconds;
  
  try {
    idleSeconds = powerMonitor.getSystemIdleTime();
  } catch (err) {
    console.error('[IdleDetector] Error getting idle time:', err.message);
    return;
  }

  if (idleDetectionWorking === null) {
    idleDetectionWorking = idleSeconds > 0 || process.platform !== 'linux';
    if (!idleDetectionWorking && process.platform === 'linux') {
      console.warn('[IdleDetector] Idle time 0 on Linux. Install libxss1 or use X11: sudo apt install libxss1');
    }
  }
  if (idleSeconds > 0) {
    lastNonZeroIdleTime = idleSeconds;
    if (idleDetectionWorking === false) idleDetectionWorking = true;
  }

  const now = Date.now();
  const isIdle = idleSeconds * 1000 >= thresholdMs;

  // Emit tick updates (for overlays/UI)
  if (onTickCallback) {
    onTickCallback({
      idleSeconds,
      isIdle,
      idleThresholdSeconds: thresholdMs / 1000,
    });
  }

  if (isIdle !== currentlyIdle) {
    currentlyIdle = isIdle;
    if (onStateChangeCallback) {
      onStateChangeCallback({ isIdle: currentlyIdle, idleSeconds });
    }
  }

  if (isIdle && !idleStart) {
    idleStart = new Date(now - idleSeconds * 1000);
  }

  if (!isIdle && idleStart) {
    const idleEnd = new Date();
    const durationInSeconds = Math.max(
      1,
      Math.round((idleEnd.getTime() - idleStart.getTime()) / 1000)
    );
    localStorage.appendLog({
      userName: activeUser,
      idleStart: idleStart.toISOString(),
      idleEnd: idleEnd.toISOString(),
      durationInSeconds,
      platform: process.platform,
    });

    syncService.queueSync();
    idleStart = null;
  }
};

const start = ({ userName, thresholdSeconds } = {}) => {
  stop();
  activeUser = userName;
  currentlyIdle = false;
  thresholdMs =
    Number.isFinite(Number(thresholdSeconds)) && Number(thresholdSeconds) > 0
      ? Number(thresholdSeconds) * 1000
      : IDLE_THRESHOLD_SECONDS * 1000;

  pollHandle = setInterval(checkIdle, POLL_INTERVAL_MS);
  
  // Immediately check once
  checkIdle();
};

const stop = () => {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  idleStart = null;
  currentlyIdle = false;
  idleDetectionWorking = null;
};

const getStatus = () => ({
  running: Boolean(pollHandle),
  isIdle: currentlyIdle,
  idleSince: idleStart ? idleStart.toISOString() : null,
  thresholdSeconds: thresholdMs / 1000,
});

const onStateChange = (callback) => {
  onStateChangeCallback = callback;
};

const onTick = (callback) => {
  onTickCallback = callback;
};

module.exports = {
  start,
  stop,
  getStatus,
  onStateChange,
  onTick,
};
