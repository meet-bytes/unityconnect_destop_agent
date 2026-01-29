/**
 * App config: single source of truth for the whole project.
 * Main process and services require() this file; renderer gets values via preload (window.appConfig).
 */
// API Endpoints
const SERVER_ENDPOINT =
  "https://unity-communication.bytestechnolab.net/api/idle-logs";
const LOGIN_BASE_URL = "http://192.168.10.20:3000/login";

// Protocol Configuration
const PROTOCOL_SCHEME = "unityagent";
const PROTOCOL_AUTH_PATH = "auth";

/**
 * Builds the login URL for the browser.
 * Note: Frontend handles redirect to protocol URL after login (no redirect_uri needed).
 */
const buildLoginURL = () => {
  return LOGIN_BASE_URL;
};

const LOGIN_URL = buildLoginURL();

// App Information
const APP_ID = "com.unitycommunications.idleagent";
const PRODUCT_NAME = "Unity Communications Agent";
const APP_NAME = "Unity Communications Agent";

// Timing Configuration
const SYNC_INTERVAL_MS = 15000; // Sync idle logs to server every 15 seconds
const IDLE_POLL_INTERVAL_MS = 1000; // Check idle state every 1 second
const LOG_REFRESH_INTERVAL_MS = 5000; // Refresh logs in UI every 5 seconds
const LOGIN_TIMEOUT_MS = 1 * 60 * 1000; // Auto-timeout login waiting state after 1 minute
const SYNC_QUEUE_DELAY_MS = 100; // Delay before syncing queued logs (ms)
const AUTH_SUCCESS_MESSAGE_TIMEOUT_MS = 3000; // How long to show "Login successful!" message (ms)
const TOKEN_EXPIRY_CLOCK_SKEW_SECONDS = 60; // Clock skew tolerance for token expiry check (seconds)

// Idle Detection Configuration (in seconds)
const IDLE_THRESHOLD_SECONDS = 30; // Idle starts after this many seconds of inactivity
const WARNING_COUNTDOWN_SECONDS = 10; // Countdown shown before idle (10 -> 0)

// Window Configuration
const WINDOW_WIDTH = 620;
const WINDOW_HEIGHT = 820;

module.exports = {
  // API Endpoints
  SERVER_ENDPOINT,
  LOGIN_BASE_URL,
  LOGIN_URL,
  buildLoginURL,

  // Protocol
  PROTOCOL_SCHEME,
  PROTOCOL_AUTH_PATH,
  getProtocolURL: (path = PROTOCOL_AUTH_PATH) => `${PROTOCOL_SCHEME}://${path}`,

  // App Information
  APP_ID,
  PRODUCT_NAME,
  APP_NAME,

  // Timing
  SYNC_INTERVAL_MS,
  IDLE_POLL_INTERVAL_MS,
  LOG_REFRESH_INTERVAL_MS,
  LOGIN_TIMEOUT_MS,
  SYNC_QUEUE_DELAY_MS,
  AUTH_SUCCESS_MESSAGE_TIMEOUT_MS,
  TOKEN_EXPIRY_CLOCK_SKEW_SECONDS,

  // Idle Detection
  IDLE_THRESHOLD_SECONDS,
  WARNING_COUNTDOWN_SECONDS,

  // Window
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
};
