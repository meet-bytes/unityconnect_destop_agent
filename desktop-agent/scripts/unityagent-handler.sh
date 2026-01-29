#!/bin/bash
# Wrapper script for protocol handler
# This ensures the protocol URL is properly passed to the Electron app

# Get the protocol URL from arguments
PROTOCOL_URL="$1"

# Get the project directory (parent of scripts)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
ELECTRON_PATH="$PROJECT_DIR/node_modules/.bin/electron"
STORAGE_DIR="$HOME/.config/desktop-agent"
PROTOCOL_QUEUE_FILE="$STORAGE_DIR/protocol-queue.json"

# Write URL to queue file as fallback (in case second-instance doesn't fire)
mkdir -p "$STORAGE_DIR" 2>/dev/null
ESCAPED_URL=$(echo "$PROTOCOL_URL" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g')
TIMESTAMP=$(date +%s)000
echo "{\"url\":\"$ESCAPED_URL\",\"timestamp\":$TIMESTAMP}" > "$PROTOCOL_QUEUE_FILE" 2>/dev/null

# Launch Electron with the protocol URL (triggers second-instance if app is running)
if [ -f "$ELECTRON_PATH" ]; then
    exec "$ELECTRON_PATH" "$PROJECT_DIR/main.js" "$PROTOCOL_URL"
else
    exit 1
fi
