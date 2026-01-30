# Desktop Idle Tracking Agent – POC

Electron desktop agent + Express API server to detect desktop idle time (idle vs active only), store logs locally, and sync them when online. No keyboard/mouse/file/process tracking.

---

## Contents

- [Structure](#structure)
- [Prerequisites](#prerequisites)
- [Install & Run (development)](#install--run-development)
- [Build](#build-desktop-app-poc)
- [Offline → online sync](#offline--online-sync-demo)
- [What to validate](#what-to-validate-in-this-poc)
- [Notes / constraints](#notes--constraints)
- [Public distribution (do users need to register?)](#public-distribution-do-users-need-to-register)
- [Installation guide (end users)](#installation-guide-end-users) — [Where to get the app](#where-users-get-the-app)
- [Login flow (desktop & frontend)](#login-flow-desktop--frontend)
- [Protocol handler troubleshooting](#protocol-handler-troubleshooting)
- [Support](#support)

---

## Structure

```
idle-agent-poc/
├── desktop-agent/   # Electron app (idle detector + local queue + sync)
└── api-server/      # Express API (receives idle logs)
```

---

## Prerequisites

- Node 18+ recommended
- npm

---

## Install & Run (development)

### API server (port 4000)

```bash
cd api-server
npm install
npm run dev   # or: npm start
```

Logs are stored at `api-server/logs/idle-logs.jsonl` and echoed to the console. Each record includes the client IP (from `x-forwarded-for` or the socket) plus platform from the agent payload.

### Desktop agent

```bash
cd desktop-agent
npm install
npm run electron:dev
```

UI: set idle threshold (default 60s) → **Login** → **Clock In / Start Agent**. Status badge shows Running/Stopped. Branding uses `assets/unitylogo.png`. Close the window—agent keeps running in background until stopped.

---

## Build (desktop app POC)

```bash
cd desktop-agent
npm run build   # electron-packager output in desktop-agent/dist
```

---

## Offline → online sync demo

1. Start the desktop agent and API server.
2. Stop the API server (simulate offline).
3. Let the machine go idle past the threshold, then resume activity (a log is queued locally in `desktop-agent/storage/idleLogs.json`).
4. Restart the API server. The agent auto-syncs queued logs to `POST http://unity-communication.bytestechnolab.net/api/idle-logs`.

---

## What to validate in this POC

- Idle vs active transitions only (no input/process capture).
- Logs are persisted locally as JSON with queueing when offline.
- Auto-sync resumes when the API server is reachable.
- Payload sent:

  ```json
  {
    "userName": "Jane Doe",
    "idleStart": "2025-12-24T10:00:00.000Z",
    "idleEnd": "2025-12-24T10:05:00.000Z",
    "durationInSeconds": 300,
    "platform": "darwin"
  }
  ```

---

## Notes / constraints

- Runs on Windows, macOS, Linux.
- User must start the agent manually.
- Uses Electron `powerMonitor.getSystemIdleTime()`; no keyboard/mouse/screen/process/file monitoring.
- Simple JSON storage for clarity; easy to swap for SQLite later if needed.

---

## Public distribution (do users need to register?)

**End users do not need to run any registration script** in normal cases.

| Platform | Protocol registration | What the user does |
|----------|------------------------|--------------------|
| **macOS** | Automatic. The built app declares `unityagent://` in its bundle; the OS associates it when the app is installed. | Install the app → Login works. No extra steps. |
| **Windows** | Automatic. The installer (NSIS) registers `unityagent://` during setup. | Install the .exe → Login works. No extra steps. |
| **Linux** | The built .deb/AppImage includes the protocol in the .desktop file; the app also calls `setAsDefaultProtocolClient()` on launch. | Install the package. If the browser ever asks “Open with…”, choose “Unity Communications Agent”. No script to run. |

The `desktop-agent/scripts/register-protocol.sh` script is only for **development** (e.g. when you run `npm run electron:dev` and the app isn’t installed). Public users who install your built installers do **not** need to run it.

**As publisher (you):** For public distribution you may want to **code-sign** the app (and on macOS, **notarize** it) so users don’t see “unknown developer” warnings. That involves registering for an Apple Developer account and/or a Windows code-signing certificate—separate from protocol registration.

---

## Installation guide (end users)

### Where users get the app

You need to **host or distribute the installers** so users can download them. Common options:

| Option | How |
|--------|-----|
| **Your website** | Add a “Download” or “Desktop agent” page with links to the installer files. |
| **GitHub Releases** | After building, upload the files from `desktop-agent/dist/` to a GitHub Release; share the release URL. |
| **Internal / company portal** | Upload the installers to your intranet or download portal and link from there. |
| **App stores** (optional) | Publish to Microsoft Store and/or Mac App Store; users install from the store. |

**Build the installers** (for you, the publisher):

```bash
cd desktop-agent
npm run dist:all
```

Installers are created in **`desktop-agent/dist/`**:

- **macOS:** `Unity-Communications-Agent-0.1.0-mac-x64.dmg`, `...-mac-arm64.dmg`
- **Windows:** `Unity-Communications-Agent-Setup-0.1.0.exe`
- **Linux:** `Unity-Communications-Agent-0.1.0.deb`, `Unity-Communications-Agent-0.1.0.AppImage`

To build only Linux: `npm run dist:linux`. For a single format: `npm run dist:linux:appimage` or `npm run dist:linux:deb`. If the build fails with `ERR_ELECTRON_BUILDER_CANNOT_EXECUTE`, run it in a normal terminal (outside the IDE); some environments kill the builder subprocess.

Put the right file(s) on your download page and point users to that URL. Example wording: *“Download the desktop agent for [Windows / Mac / Linux] from [link].”*

---

### macOS

**Step 1: Download**

- Download `Unity-Communications-Agent-0.1.0-mac-x64.dmg` (Intel Macs)
- Or `Unity-Communications-Agent-0.1.0-mac-arm64.dmg` (Apple Silicon M1/M2/M3)

**Step 2: Install**

1. Double-click the DMG file
2. Drag "Unity Communications Agent" to Applications folder
3. Eject the DMG

**Step 3: First launch (important)**

macOS may block the app on first launch.

- **Option A (recommended):** Applications folder → **Right-click** (or Ctrl+click) "Unity Communications Agent" → **Open** → click **Open** in the security dialog.
- **Option B:** In Terminal:  
  `sudo xattr -rd com.apple.quarantine /Applications/Unity\ Communications\ Agent.app`  
  Then double-click the app.

**Step 4: Use the agent**

1. Open "Unity Communications Agent" from Applications
2. Click **Login** and complete login in the browser
3. Click "Clock In / Start Agent"
4. Status: 🟢 Active | 🟡 Idle | ⚪ Stopped
5. Close the window—agent keeps running; use tray icon to reopen

---

### Linux (Ubuntu/Debian)

**Step 1: Download**

- `Unity-Communications-Agent-0.1.0.deb` (recommended) or `Unity-Communications-Agent-0.1.0.AppImage`

**Step 2: Install**

- **.deb:**  
  `sudo dpkg -i Unity-Communications-Agent-0.1.0.deb`  
  `sudo apt-get install -f`
- **AppImage:**  
  `chmod +x Unity-Communications-Agent-0.1.0.AppImage`  
  `./Unity-Communications-Agent-0.1.0.AppImage`

**Step 3: Dependencies (if idle detection fails)**

```bash
sudo apt install libxss1
```

**Step 4: Display server**

Agent needs X11 (not Wayland). Check: `echo $XDG_SESSION_TYPE`. If `wayland`, log out → choose **Ubuntu on Xorg** at login → log in again.

**Step 5: Login redirect**

The installed app registers the `unityagent://` protocol automatically. If the browser asks “Open with…”, choose “Unity Communications Agent”. If redirect still fails, see [Protocol handler troubleshooting](#protocol-handler-troubleshooting).

---

### Windows

**Step 1: Download**

- `Unity-Communications-Agent-Setup-0.1.0.exe`

**Step 2: Install**

- Double-click EXE → follow wizard → launch from Start Menu

**Step 3: Use the agent**

- Open app → Login → Clock In / Start Agent; close window to keep running in tray

---

## Login flow (desktop & frontend)

### Overview

- **Desktop app** opens: `http://localhost:9071/login?redirect_uri=unityagent`
- **Frontend** must:
  - If `redirect_uri=unityagent`: after login (or when already logged in), send user back via `unityagent://auth?token=...&refreshToken=...`
  - Otherwise: normal web login (e.g. redirect to dashboard)

### Steps

1. User clicks **Login** in desktop app → browser opens with the login URL.
2. User logs in (or is already logged in). Frontend reads `redirect_uri=unityagent`.
3. **Not logged in:** show login form → after success, redirect to `unityagent://auth?token=...&refreshToken=...`.
4. **Already logged in (recommended):** show “You're already logged in” with **[Open in Desktop Agent]** and **[Go to Dashboard]**.
5. Desktop app receives URL (second-instance or queue file), stores tokens in `auth.json`, shows/focuses window, sends `auth:success` to renderer.

### Frontend: detect desktop agent

```typescript
const urlParams = new URLSearchParams(window.location.search);
const redirectUri = urlParams.get("redirect_uri");
const isDesktopAgent = redirectUri === "unityagent";
```

### Frontend: after login redirect

```typescript
if (isDesktopAgent) {
  const redirectUrl = `unityagent://auth?token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
  window.location.href = redirectUrl;
  return;
}
navigate("/dashboard");
```

### Desktop config (`desktop-agent/config/appConfig.js`)

```javascript
LOGIN_URL = "http://localhost:9071/login?redirect_uri=unityagent";
LOGIN_TIMEOUT_MS = 1 * 60 * 1000; // 1 minute
PROTOCOL_SCHEME = "unityagent";
PROTOCOL_AUTH_PATH = "auth";
```

### When to show what

| Scenario | What to show |
|----------|---------------|
| Not logged in + `redirect_uri=unityagent` | Login form → after submit → `unityagent://auth?...` |
| Already logged in + `redirect_uri=unityagent` | “You're already logged in” + [Open in Desktop Agent] [Go to Dashboard] |
| Already logged in + `/login` (no param) | Redirect to dashboard |
| Not logged in + `/login` | Login form → after submit → dashboard |

---

## Protocol handler troubleshooting

When the browser shows “Launched external handler for 'unityagent://auth?...'” but the desktop app doesn’t respond:

### How it works

1. Browser redirects to `unityagent://auth?token=...&refreshToken=...`.
2. OS runs the handler: `desktop-agent/scripts/unityagent-handler.sh` with the URL.
3. Wrapper script writes the URL to `~/.config/desktop-agent/protocol-queue.json` and launches Electron with the URL.
4. App receives the URL via **second-instance** (when it fires) or by **polling the queue file** every 500 ms (Linux fallback).

### 1. Verify handler registration

```bash
cd desktop-agent
./scripts/register-protocol.sh
xdg-mime query default x-scheme-handler/unityagent   # expect: unityagent-handler.desktop
```

### 2. App must be running

Start the app (`npm run electron:dev`) before completing login in the browser. If second-instance doesn’t fire (common on Linux), the queue file still delivers the URL.

### 3. Check desktop entry

```bash
cat ~/.local/share/applications/unityagent-handler.desktop
```

Expect: `Exec="/path/to/desktop-agent/scripts/unityagent-handler.sh" %u`. Ensure script and .desktop are executable (`chmod +x`).

### 4. Test handler directly

With app running:

```bash
xdg-open 'unityagent://auth?token=test123&refreshToken=test456'
```

App window should come to front and handle the URL.

### 5. Queue file fallback (Linux)

Wrapper writes to `~/.config/desktop-agent/protocol-queue.json`; app polls every 500 ms. If redirect “does nothing” but app is running, confirm desktop entry uses `unityagent-handler.sh`.

### Quick checklist

1. `xdg-mime query default x-scheme-handler/unityagent` → `unityagent-handler.desktop`
2. Desktop entry: `Exec=".../unityagent-handler.sh" %u`
3. `chmod +x desktop-agent/scripts/unityagent-handler.sh`
4. App running when completing login in browser
5. Direct test: with app running, `xdg-open 'unityagent://auth?token=test123&refreshToken=test456'` → app reacts

---

## Support

For issues, include your OS and any error messages:

- Email: meet.soni@bytestechnolab.com
