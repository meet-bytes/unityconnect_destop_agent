#!/bin/bash
# Script to register the unityagent:// protocol handler on Linux
# Run this from the desktop-agent directory

set -e  # Exit on error

echo "=========================================="
echo "Unity Agent Protocol Handler Registration"
echo "=========================================="
echo ""

# Get the script directory and go up one level to get desktop-agent directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "Project directory: $PROJECT_DIR"

# Check if electron exists
ELECTRON_PATH="$PROJECT_DIR/node_modules/.bin/electron"
if [ ! -f "$ELECTRON_PATH" ]; then
    echo "ERROR: Electron not found at $ELECTRON_PATH"
    echo "Please run 'npm install' first"
    exit 1
fi

echo "Electron found at: $ELECTRON_PATH"
echo ""

# Create applications directory if it doesn't exist
APPLICATIONS_DIR="$HOME/.local/share/applications"
mkdir -p "$APPLICATIONS_DIR"

# Create desktop entry for the protocol handler
DESKTOP_FILE="$APPLICATIONS_DIR/unityagent-handler.desktop"

echo "Creating desktop entry at: $DESKTOP_FILE"

# Use wrapper script for better protocol handling
WRAPPER_SCRIPT="$PROJECT_DIR/scripts/unityagent-handler.sh"

cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=Unity Communications Agent
Comment=Unity Communications Desktop Agent Protocol Handler
Exec="$WRAPPER_SCRIPT" %u
Type=Application
NoDisplay=true
MimeType=x-scheme-handler/unityagent;
StartupNotify=false
EOF

# Make it executable
chmod +x "$DESKTOP_FILE"

echo "✓ Desktop entry created"
echo ""

# Register the MIME type
echo "Registering protocol handler..."
xdg-mime default unityagent-handler.desktop x-scheme-handler/unityagent

# Update desktop database
echo "Updating desktop database..."
update-desktop-database "$APPLICATIONS_DIR" 2>/dev/null || true

echo ""
echo "=========================================="
echo "✓ Protocol handler registered successfully!"
echo "=========================================="
echo ""
echo "Desktop file: $DESKTOP_FILE"
echo ""
echo "Verification:"
VERIFIED=$(xdg-mime query default x-scheme-handler/unityagent 2>/dev/null || echo "not found")
if [ "$VERIFIED" = "unityagent-handler.desktop" ]; then
    echo "✓ Handler verified: $VERIFIED"
else
    echo "⚠ Warning: Handler not verified. Got: $VERIFIED"
fi
echo ""
echo "To test, run:"
echo "  xdg-open 'unityagent://auth?token=test123'"
echo ""
echo "Or test the full flow:"
echo "  1. Start your app: npm run electron:dev"
echo "  2. Click Login"
echo "  3. Complete login in browser"
echo "  4. The app should automatically receive the token"
echo ""
