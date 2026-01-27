const userNameInput = document.getElementById('userName');
const startBtn = document.getElementById('startBtn');
const helper = document.getElementById('helper');
const logsList = document.getElementById('logsList');
const clearLogsBtn = document.getElementById('clearLogs');
const refreshLogsBtn = document.getElementById('refreshLogs');
const activityIndicator = document.getElementById('activityIndicator');
const activityDot = document.getElementById('activityDot');
const activityLabel = document.getElementById('activityLabel');

let running = false;
let logInterval = null;

// Update the activity indicator: stopped (gray) / active (green) / idle (yellow)
const setIdleState = (state) => {
  if (!running) return; // Don't update if not running
  const isIdle = state?.isIdle;
  activityDot.className = `activity-dot ${isIdle ? 'idle' : 'active'}`;
  activityLabel.textContent = isIdle ? 'Idle' : 'Active';
};

const setStatus = (status) => {
  running = Boolean(status?.running);
  startBtn.textContent = running ? 'Stop Agent' : 'Clock In / Start Agent';
  const thresholdSeconds = Math.max(0, Math.round(Number(status?.thresholdSeconds) || 0));
  helper.textContent = running
    ? `Tracking idle time (after ${thresholdSeconds}s inactivity). You can close this window; the agent stays on.`
    : `Agent runs in background. Idle tracking starts after ${thresholdSeconds}s of inactivity.`;
  
  // Update activity indicator based on running state
  if (running) {
    // Set to active/idle based on current state
    const isIdle = status?.isIdle || false;
    activityDot.className = `activity-dot ${isIdle ? 'idle' : 'active'}`;
    activityLabel.textContent = isIdle ? 'Idle' : 'Active';
  } else {
    // Stopped state - gray dot
    activityDot.className = 'activity-dot stopped';
    activityLabel.textContent = 'Stopped';
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
  if (minutes < 60) return remSeconds ? `${minutes}m ${remSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
};

const fmtPlatform = (platform) => {
  if (platform === 'darwin') return 'macOS';
  if (platform === 'win32') return 'Windows';
  if (platform === 'linux') return 'Linux';
  return platform || 'Unknown';
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
          <div class="log-user">${log.userName || 'Unknown user'}</div>
          <div class="log-time">${fmtTime(log.idleStart)} → ${fmtTime(
        log.idleEnd
      )}</div>
        </div>
        <div class="log-meta">
          <span class="chip">${fmtDuration(log.durationInSeconds)}</span>
          <span class="chip muted">${fmtPlatform(log.platform)}</span>
        </div>
      </div>
    `
    )
    .join('');
};

const loadLogs = async () => {
  try {
    const { archive = [] } = await window.agentAPI.logs();
    renderLogs(archive);
  } catch (err) {
    console.error('Failed to load logs:', err);
    logsList.innerHTML = `<div class="log-row placeholder">Failed to load logs.</div>`;
  }
};

const startLogAutoRefresh = () => {
  // Clear any existing interval first
  if (logInterval) {
    clearInterval(logInterval);
    logInterval = null;
  }
  // Refresh every 5 seconds for better responsiveness
  logInterval = setInterval(loadLogs, 5000);
  console.log('Log auto-refresh started (every 5s)');
};

const startAgent = async () => {
  const userName = userNameInput.value.trim();
  if (!userName) {
    helper.textContent = 'Please enter a user name before starting.';
    helper.classList.add('warn');
    return;
  }
  helper.classList.remove('warn');

  try {
    const status = await window.agentAPI.start(userName);
    setStatus(status);
    // Refresh logs immediately after starting
    loadLogs();
  } catch (err) {
    helper.textContent = err.message || 'Failed to start agent.';
    helper.classList.add('warn');
  }
};

const stopAgent = async () => {
  const status = await window.agentAPI.stop();
  setStatus(status);
};

startBtn.addEventListener('click', () => {
  if (running) {
    stopAgent();
  } else {
    startAgent();
  }
});

window.agentAPI.onStatus(setStatus);
window.agentAPI.onIdleState(setIdleState);

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const status = await window.agentAPI.status();
    setStatus(status);
  } catch (err) {
    console.error('Failed to get status:', err);
  }
  
  // Always load logs and start auto-refresh on page load
  loadLogs();
  startLogAutoRefresh();
});

clearLogsBtn.addEventListener('click', async () => {
  await window.agentAPI.clearLogs();
  loadLogs();
});

refreshLogsBtn.addEventListener('click', loadLogs);
