# Unity Communications Desktop Agent - Installation Guide

## macOS

**Step 1: Download**

* Download `Unity-Communications-Agent-0.1.0-mac-x64.dmg` (Intel Macs)
* Or `Unity-Communications-Agent-0.1.0-mac-arm64.dmg` (Apple Silicon M1/M2/M3)

**Step 2: Install**


1. Double-click the DMG file
2. Drag "Unity Communications Agent" to Applications folder
3. Eject the DMG

**Step 3: First Launch (Important!)**
macOS may block the app on first launch. Here's how to fix it:

**Option A - Right-click method (Recommended):**


1. Go to Applications folder
2. **Right-click** (or Ctrl+click) on "Unity Communications Agent"
3. Select **"Open"** from the menu
4. Click **"Open"** in the security dialog
5. The app will now open normally

**Option B - Terminal method:**
If Option A doesn't work, open Terminal and run:

```bash
sudo xattr -rd com.apple.quarantine /Applications/Unity\ Communications\ Agent.app
```

Then double-click the app normally.

**Step 4: Use the Agent**


1. Open "Unity Communications Agent" from Applications
2. Enter your name
3. Click "Clock In / Start Agent"
4. The status indicator shows:
   * 🟢 **Green dot = Active** (you're using the computer)
   * 🟡 **Yellow dot = Idle** (idle for 20+ seconds)
   * ⚪ **Gray dot = Stopped** (agent not running)
5. You can close the window - the agent keeps running in the background
6. Click the tray icon (menu bar) to reopen the window


---

## Linux (Ubuntu/Debian)

**Step 1: Download**

* Download `Unity-Communications-Agent-0.1.0.deb` (recommended)
* Or `Unity-Communications-Agent-0.1.0.AppImage` (alternative)

**Step 2: Install**

**For .deb file (Recommended):**

```bash
sudo dpkg -i Unity-Communications-Agent-0.1.0.deb
sudo apt-get install -f  # Fix any missing dependencies
```

**For AppImage:**


1. Make it executable:

   ```bash
   chmod +x Unity-Communications-Agent-0.1.0.AppImage
   ```
2. Run it:

   ```bash
   ./Unity-Communications-Agent-0.1.0.AppImage
   ```

**Step 3: Required Dependencies**
If idle detection doesn't work, install:

```bash
sudo apt install libxss1
```

**Step 4: Check Display Server (if idle detection fails)**
The agent requires X11 (not Wayland). Check your session:

```bash
echo $XDG_SESSION_TYPE
```

If it says "wayland":


1. Log out
2. Click your username
3. Click the gear icon → Select **"Ubuntu on Xorg"**
4. Log in and try again

**Step 5: Use the Agent**


1. Launch "Unity Communications Agent" from Applications menu
2. Enter your name
3. Click "Clock In / Start Agent"
4. Status indicator shows your activity state
5. Close the window - agent runs in background


---

## Windows

**Step 1: Download**

* Download `Unity-Communications-Agent-Setup-0.1.0.exe`

**Step 2: Install**


1. Double-click the EXE file
2. Follow the installation wizard
3. Launch from Start Menu

**Step 3: Use the Agent**


1. Open "Unity Communications Agent"
2. Enter your name
3. Click "Clock In / Start Agent"
4. Status indicator shows your activity state
5. Close the window - agent runs in system tray


---

## Support

If you encounter any issues, please contact:

* Email: meet.soni@bytestechnolab.com
* Include your operating system and any error messages


