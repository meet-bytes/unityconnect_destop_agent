const { powerMonitor } = require('electron');
const localStorage = require('./localStorage');
const syncService = require('./syncService');

const { IDLE_THRESHOLD_SECONDS } = require('../config/idleTiming');
const POLL_INTERVAL_MS = 1000;

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

  // Debug: Log first few checks and when idle time changes significantly
  if (idleDetectionWorking === null) {
    console.log(`[IdleDetector] Platform: ${process.platform}`);
    console.log(`[IdleDetector] Initial idle time: ${idleSeconds}s`);
    idleDetectionWorking = idleSeconds > 0 || process.platform !== 'linux';
    
    if (!idleDetectionWorking && process.platform === 'linux') {
      console.warn('[IdleDetector] WARNING: Idle time is 0 on Linux.');
      console.warn('[IdleDetector] This may indicate missing libxss1 or running under Wayland.');
      console.warn('[IdleDetector] Install: sudo apt install libxss1');
      console.warn('[IdleDetector] Or switch to X11 session (Ubuntu on Xorg)');
    }
  }

  // Track last non-zero idle time for debugging
  if (idleSeconds > 0) {
    lastNonZeroIdleTime = idleSeconds;
    if (idleDetectionWorking === false) {
      idleDetectionWorking = true;
      console.log('[IdleDetector] Idle detection now working!');
    }
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

  // Track state change for UI indicator
  if (isIdle !== currentlyIdle) {
    currentlyIdle = isIdle;
    console.log(`[IdleDetector] State changed: ${isIdle ? 'IDLE' : 'ACTIVE'} (idle: ${idleSeconds}s)`);
    if (onStateChangeCallback) {
      onStateChangeCallback({ isIdle: currentlyIdle, idleSeconds });
    }
  }

  if (isIdle && !idleStart) {
    idleStart = new Date(now - idleSeconds * 1000);
    console.log(`[IdleDetector] Idle period started at ${idleStart.toISOString()}`);
  }

  if (!isIdle && idleStart) {
    const idleEnd = new Date();
    const durationInSeconds = Math.max(
      1,
      Math.round((idleEnd.getTime() - idleStart.getTime()) / 1000)
    );

    console.log(`[IdleDetector] Idle period ended. Duration: ${durationInSeconds}s`);

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
  idleDetectionWorking = null; // Reset for next start
  console.log('[IdleDetector] Stopped');
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
