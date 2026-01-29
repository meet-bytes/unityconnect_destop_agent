# Protocol Handler Troubleshooting

## Issue: "Launched external handler" but app doesn't receive callback

If you see "Launched external handler for 'unityagent://auth?token=...'" in the browser console but the desktop app doesn't respond, follow these steps:

### Step 1: Verify Protocol Handler Registration

Run the registration script:
```bash
cd desktop-agent
./scripts/register-protocol.sh
```

Verify it's registered:
```bash
xdg-mime query default x-scheme-handler/unityagent
```
Should output: `unityagent-handler.desktop`

### Step 2: Check if App is Running

**Important:** The app must be running when you click login, OR the protocol handler should launch it automatically.

**Option A: Keep app running**
- Start the app first: `npm run electron:dev`
- Then click Login in the browser
- The app should receive the callback via `second-instance` event

**Option B: Let protocol handler launch app**
- Don't start the app manually
- Click Login in browser
- Protocol handler should launch the app with the URL
- Check console logs for `[protocol] App ready, checking argv:`

### Step 3: Check Console Logs

When you click login and the browser redirects, check the Electron app console for:

```
[protocol] Received URL: unityagent://auth?token=...
[protocol] Second instance event, commandLine: [...]
[protocol] Extracted URL from commandLine: ...
[protocol] App ready, checking argv: [...]
[auth] Token stored successfully
```

### Step 4: Test Protocol Handler Directly

Test if the protocol handler works:
```bash
xdg-open 'unityagent://auth?token=test123&refreshToken=test456'
```

The app should:
- Launch (if not running) OR focus (if running)
- Show `[protocol] Received URL:` in console
- Store the token

### Step 5: Check Desktop Entry

Verify the desktop entry exists and is correct:
```bash
cat ~/.local/share/applications/unityagent-handler.desktop
```

Should show:
```
Exec="/path/to/node_modules/.bin/electron" "/path/to/desktop-agent/main.js" %u
```

### Step 6: Common Issues

**Issue:** App launches but doesn't receive URL
- **Fix:** Check if `main.js` is the correct entry point in desktop entry
- **Fix:** Ensure `%u` is at the end of Exec line

**Issue:** App doesn't launch at all
- **Fix:** Check Electron path in desktop entry is correct
- **Fix:** Run `chmod +x ~/.local/share/applications/unityagent-handler.desktop`
- **Fix:** Run `update-desktop-database ~/.local/share/applications`

**Issue:** Browser shows "No handler" or "Choose application"
- **Fix:** Re-run `./scripts/register-protocol.sh`
- **Fix:** Log out and log back in (to refresh desktop database)

**Issue:** App is running but second-instance doesn't fire
- **Fix:** Ensure single-instance lock is working (check console for "Single instance lock acquired")
- **Fix:** Check if URL is in commandLine array (see console logs)

### Step 7: Manual Test

1. **Start app:** `npm run electron:dev`
2. **In another terminal:** `xdg-open 'unityagent://auth?token=test123&refreshToken=test456'`
3. **Check app console** for `[protocol] Received URL:`
4. **If working:** You should see token stored and UI update
5. **If not working:** Check which step failed (launch, URL extraction, token parsing)

### Debug Mode

To see all protocol-related logs, check the Electron console output. All protocol handling logs are prefixed with `[protocol]` or `[auth]`.

### Still Not Working?

1. Check browser console for any errors
2. Check Electron app console for protocol logs
3. Verify desktop entry permissions: `ls -la ~/.local/share/applications/unityagent-handler.desktop`
4. Try restarting your desktop environment (logout/login)
5. Check if another app is handling `unityagent://` protocol
