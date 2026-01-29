# Protocol Handler Troubleshooting

When the browser shows "Launched external handler for 'unityagent://auth?token=...'" but the desktop app doesn't respond, use this guide.

## How it works

1. **Browser** redirects to `unityagent://auth?token=...&refreshToken=...`.
2. **OS** invokes the protocol handler: `scripts/unityagent-handler.sh` with the URL.
3. **Wrapper script** (`unityagent-handler.sh`):
   - Writes the URL to `~/.config/desktop-agent/protocol-queue.json` (fallback).
   - Launches Electron with the URL (so `second-instance` can fire if the app is already running).
4. **Desktop app** receives the URL either via:
   - **second-instance** (Windows/Linux when it fires), or
   - **Queue file fallback**: app polls `protocol-queue.json` every 500 ms (used when `second-instance` doesn’t fire on Linux).

---

## Step 1: Verify protocol handler registration

From the `desktop-agent` directory:

```bash
cd desktop-agent
./scripts/register-protocol.sh
```

Check that the handler is registered:

```bash
xdg-mime query default x-scheme-handler/unityagent
```

Expected: `unityagent-handler.desktop`

---

## Step 2: Ensure the app is running

The app **must be running** when the browser redirects (tray or window).

- Start the app: `npm run electron:dev`
- Then complete login in the browser and allow the redirect.
- If **second-instance** doesn’t fire (common on Linux), the **queue file fallback** still delivers the URL as long as the app is running.

---

## Step 3: Check desktop entry

The handler uses a **wrapper script**, not Electron directly:

```bash
cat ~/.local/share/applications/unityagent-handler.desktop
```

Expected:

```
Exec="/path/to/desktop-agent/scripts/unityagent-handler.sh" %u
```

- `%u` must be present (replaced with the protocol URL).
- The script path must point to your project’s `scripts/unityagent-handler.sh`.

Make the desktop file and script executable if needed:

```bash
chmod +x ~/.local/share/applications/unityagent-handler.desktop
chmod +x /path/to/desktop-agent/scripts/unityagent-handler.sh
```

---

## Step 4: Test the protocol handler directly

With the app **already running**:

```bash
xdg-open 'unityagent://auth?token=test123&refreshToken=test456'
```

Expected:

- App window comes to front.
- Token is handled (you may see login/agent UI).
- No extra errors in the Electron console.

If the app is **not** running, the same command should start the app with the URL (first-launch flow).

---

## Step 5: Queue file fallback (Linux)

On Linux, `second-instance` often doesn’t fire. The app uses a **file-based fallback**:

1. Wrapper script writes the URL to:  
   `~/.config/desktop-agent/protocol-queue.json`
2. The running app polls this file every 500 ms and processes any URL found.
3. The file is deleted after reading.

If redirect “does nothing” but the app is running:

- Confirm the wrapper is the one invoked (desktop entry `Exec` points to `unityagent-handler.sh`).
- Optionally check that the queue file appears right after the browser redirect:  
  `ls -la ~/.config/desktop-agent/protocol-queue.json`  
  (It may disappear quickly once the app reads it.)

---

## Step 6: Common issues and fixes

| Issue | What to check | Fix |
|-------|----------------|-----|
| App doesn’t launch at all | Desktop entry `Exec` path, script and desktop file executable | Fix paths in `register-protocol.sh`, run it again, `chmod +x` on the script and `.desktop` file |
| Browser: “No handler” or “Choose application” | Handler not/default not set | Run `./scripts/register-protocol.sh`; log out and back in if needed |
| “Launched external handler” but app does nothing | App not running; or wrapper not writing queue file | Start app first (`npm run electron:dev`); confirm desktop entry uses `unityagent-handler.sh` |
| App starts but doesn’t receive URL (first launch) | URL in `argv` / queue file | Ensure `%u` is in desktop entry `Exec`; ensure wrapper writes `protocol-queue.json` |
| Second-instance never fires (Linux) | Expected on some setups | Rely on queue file fallback; keep app running when redirecting |

---

## Step 7: Quick checklist

1. **Registration:**  
   `xdg-mime query default x-scheme-handler/unityagent` → `unityagent-handler.desktop`
2. **Desktop entry:**  
   `Exec=".../unityagent-handler.sh" %u`
3. **Script executable:**  
   `chmod +x scripts/unityagent-handler.sh`
4. **App running** when you complete login in the browser.
5. **Direct test:**  
   With app running, `xdg-open 'unityagent://auth?token=test123&refreshToken=test456'` → app reacts.

---

## Related docs

- **Login flow (desktop + frontend):** `LOGIN_FLOW.md`
