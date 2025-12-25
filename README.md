# Desktop Idle Tracking Agent – POC

Electron desktop agent + Express API server to detect desktop idle time (idle vs active only), store logs locally, and sync them when online. No keyboard/mouse/file/process tracking.

## Structure

```
idle-agent-poc/
├── desktop-agent/   # Electron app (idle detector + local queue + sync)
└── api-server/      # Express API (receives idle logs)
```

## Prereqs

* Node 18+ recommended
* npm

## Install

```bash
# API server
cd idle-agent-poc/api-server
npm install

# Desktop agent
cd ../desktop-agent
npm install
```

## Run API server (port 4000)

```bash
cd idle-agent-poc/api-server
npm run dev   # or: npm start
```

Logs are stored at `api-server/logs/idle-logs.jsonl` and echoed to the console. Each record also includes the client IP (from `x-forwarded-for` or the socket) plus platform from the agent payload.

## Run desktop agent

```bash
cd idle-agent-poc/desktop-agent
npm run electron:dev
```

UI: enter user name → set idle threshold (default 60s) → **Clock In / Start Agent**. Status badge shows Running/Stopped. Branding uses `assets/unitylogo.png`. Close the window—agent keeps running in background until stopped.

## Build desktop app (POC)

```bash
cd idle-agent-poc/desktop-agent
npm run build   # electron-packager output in desktop-agent/dist
```

## Offline → online sync demo


1. Start the desktop agent and API server.
2. Stop the API server (simulate offline).
3. Let the machine go idle past the threshold, then resume activity (a log is queued locally in `desktop-agent/storage/idleLogs.json`).
4. Restart the API server. The agent auto-syncs queued logs to `POST http://unity-communication.bytestechnolab.net/api/idle-logs`.

## What to validate in this POC

* Idle vs active transitions only (no input/process capture).
* Logs are persisted locally as JSON with queueing when offline.
* Auto-sync resumes when the API server is reachable.
* Payload sent:

  ```json
  {
    "userName": "Jane Doe",
    "idleStart": "2025-12-24T10:00:00.000Z",
    "idleEnd": "2025-12-24T10:05:00.000Z",
    "durationInSeconds": 300,
    "platform": "darwin"
  }
  ```

## Notes / Constraints

* Runs on Windows, macOS, Linux.
* User must start the agent manually.
* Uses Electron `powerMonitor.getSystemIdleTime()`; no keyboard/mouse/screen/process/file monitoring.
* Simple JSON storage for clarity; easy to swap for SQLite later if needed.


