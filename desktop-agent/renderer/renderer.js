// Authentication elements
const loginSection = document.getElementById("loginSection");
const agentSection = document.getElementById("agentSection");
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginSpinner = document.getElementById("loginSpinner");
const logoutBtn = document.getElementById("logoutBtn");
const loginHelper = document.getElementById("loginHelper");
const userInfo = document.getElementById("userInfo");

// Agent elements
const startBtn = document.getElementById("startBtn");
const helper = document.getElementById("helper");
const logsList = document.getElementById("logsList");
const clearLogsBtn = document.getElementById("clearLogs");
const refreshLogsBtn = document.getElementById("refreshLogs");
const activityIndicator = document.getElementById("activityIndicator");
const activityDot = document.getElementById("activityDot");
const activityLabel = document.getElementById("activityLabel");
const userDetails = document.getElementById("userDetails");

let running = false;
let logInterval = null;
let isLoggedIn = false;
let loginTimeoutId = null; // Auto-timeout for login waiting state

// Global config: single source from preload (window.appConfig). Fallbacks only if preload failed.
const CONFIG_DEFAULTS = {
  LOGIN_TIMEOUT_MS: 60 * 1000,
  LOG_REFRESH_INTERVAL_MS: 5000,
  AUTH_SUCCESS_MESSAGE_TIMEOUT_MS: 3000,
};
const getConfig = () => ({ ...CONFIG_DEFAULTS, ...window.appConfig });

// Update the activity indicator: stopped (gray) / active (green) / idle (yellow)
const setIdleState = (state) => {
  if (!running) return; // Don't update if not running
  const isIdle = state?.isIdle;
  activityDot.className = `activity-dot ${isIdle ? "idle" : "active"}`;
  activityLabel.textContent = isIdle ? "Idle" : "Active";
};

const setStatus = (status) => {
  // Only update status if logged in
  if (!isLoggedIn) return;

  running = Boolean(status?.running);
  startBtn.textContent = running ? "Clock Out" : "Clock In";
  const thresholdSeconds = Math.max(
    0,
    Math.round(Number(status?.thresholdSeconds) || 0),
  );
  helper.textContent = running
    ? `Tracking idle time (after ${thresholdSeconds}s inactivity). You can close this window; the agent stays on.`
    : `Agent runs in background. Idle tracking starts after ${thresholdSeconds}s of inactivity.`;

  // Update activity indicator based on running state (only when logged in)
  if (activityIndicator) {
    activityIndicator.style.display = "flex";
  }

  if (running) {
    // Set to active/idle based on current state
    const isIdle = status?.isIdle || false;
    activityDot.className = `activity-dot ${isIdle ? "idle" : "active"}`;
    activityLabel.textContent = isIdle ? "Idle" : "Active";
  } else {
    // Stopped state - gray dot
    activityDot.className = "activity-dot stopped";
    activityLabel.textContent = "Stopped";
  }
};

const fmtTime = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
};

const fmtDuration = (secondsRaw) => {
  const seconds = Math.max(0, Number(secondsRaw) || 0);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60)
    return remSeconds ? `${minutes}m ${remSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
};

const fmtPlatform = (platform) => {
  if (platform === "darwin") return "macOS";
  if (platform === "win32") return "Windows";
  if (platform === "linux") return "Linux";
  return platform || "Unknown";
};

const renderLogs = (logs) => {
  if (!logs?.length) {
    logsList.innerHTML = `<div class="log-row placeholder">No idle logs yet.</div>`;
    return;
  }

  const latest = logs
    .slice()
    .sort((a, b) => new Date(b.idleEnd) - new Date(a.idleEnd))
    .slice(0, 20);

  logsList.innerHTML = latest
    .map(
      (log) => `
      <div class="log-row">
        <div class="log-main">
          <div class="log-user">${log.userName || "Unknown user"}</div>
          <div class="log-time">${fmtTime(log.idleStart)} → ${fmtTime(
            log.idleEnd,
          )}</div>
        </div>
        <div class="log-meta">
          <span class="chip">${fmtDuration(log.durationInSeconds)}</span>
          <span class="chip muted">${fmtPlatform(log.platform)}</span>
        </div>
      </div>
    `,
    )
    .join("");
};

const loadLogs = async () => {
  try {
    const { archive = [] } = await window.agentAPI.logs();
    renderLogs(archive);
  } catch (err) {
    logsList.innerHTML = `<div class="log-row placeholder">Failed to load logs.</div>`;
    logsList.innerHTML = `<div class="log-row placeholder">Failed to load logs.</div>`;
  }
};

const startLogAutoRefresh = () => {
  // Clear any existing interval first
  if (logInterval) {
    clearInterval(logInterval);
    logInterval = null;
  }
  const intervalMs = getConfig().LOG_REFRESH_INTERVAL_MS;
  logInterval = setInterval(loadLogs, intervalMs);
};

// Extract user info from JWT token if userInfo is not available
const extractUserInfoFromToken = (token) => {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "==".slice(0, (4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
};

const startAgent = async () => {
  helper.classList.remove("warn");

  try {
    // Get user info from auth status
    const authStatus = await window.authAPI.status();
    if (!authStatus.loggedIn || !authStatus.token) {
      helper.textContent = "Please log in first.";
      helper.classList.add("warn");
      return;
    }

    // Extract user name from userInfo or JWT token
    let userName = null;
    if (authStatus.userInfo?.name) {
      userName = authStatus.userInfo.name;
    } else if (authStatus.userInfo?.email) {
      userName = authStatus.userInfo.email.split("@")[0];
    } else {
      // Try to extract from JWT token
      const tokenPayload = extractUserInfoFromToken(authStatus.token);
      if (tokenPayload?.email) {
        userName = tokenPayload.email.split("@")[0];
      } else if (tokenPayload?.sub) {
        userName = tokenPayload.sub;
      } else {
        userName = "User";
      }
    }

    const status = await window.agentAPI.start(userName);
    setStatus(status);
    // Refresh logs immediately after starting
    loadLogs();
  } catch (err) {
    helper.textContent = err.message || "Failed to start agent.";
    helper.classList.add("warn");
  }
};

const stopAgent = async () => {
  const status = await window.agentAPI.stop();
  setStatus(status);
};

startBtn.addEventListener("click", () => {
  if (running) {
    stopAgent();
  } else {
    startAgent();
  }
});

// Authentication functions
const showLoginSection = () => {
  loginSection.style.display = "block";
  agentSection.style.display = "none";
  // Hide activity indicator when not logged in
  if (activityIndicator) {
    activityIndicator.style.display = "none";
  }
  isLoggedIn = false;
};

const showAgentSection = () => {
  loginSection.style.display = "none";
  agentSection.style.display = "flex";
  // Show activity indicator when logged in
  if (activityIndicator) {
    activityIndicator.style.display = "flex";
  }
  isLoggedIn = true;
};

const setLoginButtonLoading = (loading) => {
  if (loading) {
    loginBtn.disabled = true;
    if (loginBtnText) loginBtnText.textContent = "Opening browser...";
    if (loginSpinner) loginSpinner.style.display = "block";
  } else {
    loginBtn.disabled = false;
    if (loginBtnText) loginBtnText.textContent = "Login";
    if (loginSpinner) loginSpinner.style.display = "none";
  }
};

const handleLogin = async () => {
  if (!window.authAPI) {
    loginHelper.textContent = "Application not ready. Please refresh.";
    loginHelper.classList.add("warn");
    return;
  }

  // Clear any existing timeout
  if (loginTimeoutId) {
    clearTimeout(loginTimeoutId);
    loginTimeoutId = null;
  }

  try {
    // Show loading state
    setLoginButtonLoading(true);
    loginHelper.textContent = "Opening browser for login...";
    loginHelper.classList.remove("warn");

    await window.authAPI.login();

    // Browser opened successfully, now waiting for callback
    setLoginButtonLoading(false);
    loginHelper.textContent =
      "Please complete login in your browser. Waiting for authentication...";

    const timeoutMs = getConfig().LOGIN_TIMEOUT_MS;
    const timeoutSeconds = Math.floor(timeoutMs / 1000);
    loginTimeoutId = setTimeout(() => {
      loginTimeoutId = null;
      setLoginButtonLoading(false);
      loginHelper.textContent = `Login timed out. Please try again.`;
      loginHelper.classList.add("warn");
    }, timeoutMs);
  } catch (err) {
    setLoginButtonLoading(false);
    if (loginTimeoutId) {
      clearTimeout(loginTimeoutId);
      loginTimeoutId = null;
    }
    const msg = (err && err.message) || "";
    if (
      msg.includes("Network") ||
      msg.includes("offline") ||
      msg.includes("connection") ||
      msg.includes("unreachable")
    ) {
      loginHelper.textContent =
        "Network offline or unreachable. Check your connection and try again.";
    } else if (msg.includes("browser") || msg.includes("open")) {
      loginHelper.textContent =
        "Could not open browser. Check your default browser or try again.";
    } else {
      loginHelper.textContent =
        msg || "Failed to open login page. Please try again.";
    }
    loginHelper.classList.add("warn");
  }
};

const handleLogout = async () => {
  if (!window.authAPI || !window.agentAPI) return;

  try {
    // Stop agent if running
    if (running) {
      await window.agentAPI.stop();
    }
    await window.authAPI.logout();
    showLoginSection();
    loginHelper.textContent = "";
  } catch (_err) {}
};

const displayUserInfo = (authStatus) => {
  if (!authStatus.loggedIn || !authStatus.token) {
    userInfo.textContent = "Logged in";
    userDetails.textContent = "";
    return;
  }

  // Try to get user info from userInfo object first
  let displayName = null;
  let displayEmail = null;
  let displayEmployeeId = null;

  if (authStatus.userInfo) {
    displayName = authStatus.userInfo.name;
    displayEmail = authStatus.userInfo.email;
    displayEmployeeId = authStatus.userInfo.employeeId || authStatus.userInfo.id;
  }

  // If not available, extract from JWT token
  if (!displayEmail || !displayName) {
    const tokenPayload = extractUserInfoFromToken(authStatus.token);
    if (tokenPayload) {
      if (!displayEmail && tokenPayload.email) {
        displayEmail = tokenPayload.email;
      }
      if (!displayName && tokenPayload.name) {
        displayName = tokenPayload.name;
      }
      if (!displayEmployeeId && tokenPayload.employeeId) {
        displayEmployeeId = tokenPayload.employeeId;
      }
    }
  }

  // Display user info
  userInfo.textContent = "Logged in";
  
  const details = [];
  if (displayName) {
    details.push(displayName);
  }
  if (displayEmail) {
    details.push(displayEmail);
  }
  if (displayEmployeeId) {
    details.push(`ID: ${displayEmployeeId}`);
  }
  
  userDetails.textContent = details.length > 0 ? details.join(" • ") : "";
};

const checkAuthStatus = async () => {
  if (!window.authAPI) {
    showLoginSection();
    return;
  }

  try {
    const authStatus = await window.authAPI.status();
    if (authStatus.loggedIn && authStatus.token) {
      showAgentSection();
      displayUserInfo(authStatus);
    } else {
      showLoginSection();
    }
  } catch (_err) {
    showLoginSection();
  }
};

// Event listeners
loginBtn.addEventListener("click", handleLogin);
logoutBtn.addEventListener("click", handleLogout);

window.addEventListener("DOMContentLoaded", async () => {
  // Ensure APIs are available
  if (!window.authAPI || !window.agentAPI) return;

  window.authAPI.onSuccess(async () => {
    if (loginTimeoutId) {
      clearTimeout(loginTimeoutId);
      loginTimeoutId = null;
    }
    setLoginButtonLoading(false);
    // Force check auth status to update UI
    await checkAuthStatus();
    loginHelper.textContent = "Login successful! Redirecting...";
    loginHelper.classList.remove("warn");
    const successTimeout = getConfig().AUTH_SUCCESS_MESSAGE_TIMEOUT_MS;
    setTimeout(() => {
      loginHelper.textContent = "";
    }, successTimeout);
  });

  window.authAPI.onError((data) => {
    if (loginTimeoutId) {
      clearTimeout(loginTimeoutId);
      loginTimeoutId = null;
    }
    setLoginButtonLoading(false);
    loginHelper.textContent =
      data.message || "Authentication failed. Please try again.";
    loginHelper.classList.add("warn");
  });

  // Listen for token expired (session expired)
  if (window.authAPI.onTokenExpired) {
    window.authAPI.onTokenExpired((data) => {
      showLoginSection();
      loginHelper.textContent =
        data.message || "Session expired. Please log in again.";
      loginHelper.classList.add("warn");
    });
  }

  window.agentAPI.onStatus(setStatus);
  window.agentAPI.onIdleState(setIdleState);

  // Check authentication status first
  await checkAuthStatus();

  // Only load agent status and logs if logged in
  if (isLoggedIn) {
    try {
      const status = await window.agentAPI.status();
      setStatus(status);
    } catch (_err) {}

    // Always load logs and start auto-refresh on page load
    loadLogs();
    startLogAutoRefresh();
  }
});

clearLogsBtn.addEventListener("click", async () => {
  await window.agentAPI.clearLogs();
  loadLogs();
});

refreshLogsBtn.addEventListener("click", loadLogs);
