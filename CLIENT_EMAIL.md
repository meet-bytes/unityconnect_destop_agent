# Email to Client - Desktop Agent POC


---

**Subject:** Unity Communications Desktop Agent - Installation & Testing


---

Hi \[Client Name\],

We're excited to share the Unity Communications Desktop Agent for your testing. This lightweight application helps us understand work patterns by tracking idle time (when your computer is inactive).

## What the Agent Does

The Desktop Agent:

* ✅ **Tracks idle time only** - detects when your computer is inactive for 20+ seconds
* ✅ **Runs in the background** - minimal impact on your work
* ✅ **Secure and private** - no keyboard, mouse, screen, or file tracking
* ✅ **Works offline** - stores data locally and syncs when online
* ✅ **You're in control** - start/stop anytime

**How it works:**


1. Install the agent on your computer
2. Enter your name and click "Clock In / Start Agent"
3. The agent runs silently in the background
4. It detects idle periods (20+ seconds of inactivity)
5. Data is stored locally and sent to our secure server

## Installation Files

We've prepared installers for all platforms:

**macOS:**

* `Unity-Communications-Agent-0.1.0-mac-x64.dmg` (Intel Macs)
* `Unity-Communications-Agent-0.1.0-mac-arm64.dmg` (Apple Silicon)

**Windows:**

* `Unity-Communications-Agent-Setup-0.1.0.exe`

**Linux:**

* `Unity-Communications-Agent-0.1.0.deb` (recommended)
* `Unity-Communications-Agent-0.1.0.AppImage` (alternative)

## Quick Installation Guide

### macOS


1. Download and open the DMG file
2. Drag the app to Applications folder
3. **Important:** On first launch, right-click the app → Select "Open" → Click "Open" in the dialog
   * (macOS security may block unsigned apps - this is normal for POC)
4. Enter your name and start tracking

### Linux


1. Install: `sudo dpkg -i Unity-Communications-Agent-0.1.0.deb`
2. If using AppImage: `chmod +x Unity-Communications-Agent-*.AppImage`
3. Install dependency: `sudo apt install libxss1` (if idle detection doesn't work)
4. Enter your name and start tracking

### Windows


1. Run the installer EXE
2. Follow the setup wizard
3. Launch and start tracking

**Detailed installation guide is attached** with troubleshooting steps for common issues.

## What to Test


1. **Installation** - Does it install without issues?
2. **Start/Stop** - Can you start and stop the agent?
3. **Idle Detection** - Does it detect when you're idle (status changes to yellow)?
4. **Background Running** - Does it keep running when you close the window?
5. **Logs** - Do idle logs appear in the UI?

## Status Indicators

The agent shows your current state:

* 🟢 **Green dot = Active** - You're using the computer
* 🟡 **Yellow dot = Idle** - Idle for 20+ seconds (tracking)
* ⚪ **Gray dot = Stopped** - Agent not running

## Support

If you encounter any issues:

* Check the attached installation guide
* Contact: meet.soni@bytestechnolab.com
* Include your OS and any error messages

## Privacy & Security

We want to assure you:

* **No sensitive data tracked** - only idle/active state
* **No keyboard/mouse monitoring**
* **No screen/file/process access**
* **Data stored locally** on your machine
* **Secure transmission** to our server only

Thank you for testing! We look forward to your feedback.

Best regards,
\[Your Name\]
Bytes Technolab


---

**Attachments:**

* Installation Guide (INSTALLATION_GUIDE.md)
* Platform-specific installers


