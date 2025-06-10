#!/bin/bash

# Remove Marvel Champions BGG Login Agent
# This script removes the macOS Launch Agent

echo "🗑️  Marvel Champions BGG Login Agent Removal"
echo "============================================="
echo ""

LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$LAUNCH_AGENTS_DIR/com.josephcasey.mybgg.dailysync.plist"

# Check if plist exists
if [ ! -f "$PLIST_FILE" ]; then
    echo "ℹ️  Launch Agent not found. Nothing to remove."
    echo "   File: $PLIST_FILE"
    exit 0
fi

echo "📍 Found Launch Agent: $PLIST_FILE"
echo ""

# Unload the launch agent
echo "🔄 Unloading Launch Agent..."
if launchctl unload "$PLIST_FILE" 2>/dev/null; then
    echo "✅ Launch Agent unloaded successfully"
else
    echo "⚠️  Launch Agent was not loaded (this is okay)"
fi

# Remove the plist file
echo "🗑️  Removing plist file..."
if rm "$PLIST_FILE"; then
    echo "✅ Launch Agent plist file removed"
else
    echo "❌ Failed to remove plist file"
    exit 1
fi

echo ""
echo "🎉 Removal complete!"
echo ""
echo "📋 What was removed:"
echo "   • Launch Agent: com.josephcasey.mybgg.dailysync"
echo "   • Plist file: $PLIST_FILE"
echo ""
echo "📱 The daily sync will no longer run automatically."
echo "💡 You can still run manual syncs with:"
echo "   ./daily_sync.sh"
echo "   ./update_and_deploy.sh"
echo ""
echo "🔄 To reinstall automation, run:"
echo "   ./setup_login_agent.sh"
echo ""
