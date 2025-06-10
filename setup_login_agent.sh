#!/bin/bash

# Setup script for Marvel Champions BGG Login Agent
# This creates a macOS Launch Agent that runs on first login each day

echo "🚀 Marvel Champions BGG Login Agent Setup"
echo "========================================="
echo ""

MYBGG_DIR="/Users/jo/mybgg"
DAILY_SYNC_SCRIPT="$MYBGG_DIR/daily_sync.sh"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$LAUNCH_AGENTS_DIR/com.josephcasey.mybgg.dailysync.plist"

# Check if daily_sync.sh exists
if [ ! -f "$DAILY_SYNC_SCRIPT" ]; then
    echo "❌ Error: daily_sync.sh not found at $DAILY_SYNC_SCRIPT"
    exit 1
fi

echo "📍 Daily sync script found: $DAILY_SYNC_SCRIPT"
echo "📁 Launch Agents directory: $LAUNCH_AGENTS_DIR"
echo ""

# Create LaunchAgents directory if it doesn't exist
if [ ! -d "$LAUNCH_AGENTS_DIR" ]; then
    echo "📁 Creating LaunchAgents directory..."
    mkdir -p "$LAUNCH_AGENTS_DIR"
fi

# Check if plist already exists
if [ -f "$PLIST_FILE" ]; then
    echo "⚠️  Launch Agent already exists. Removing old version..."
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    rm "$PLIST_FILE"
fi

echo "📝 Creating Launch Agent plist file..."

# Create the plist file
cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.josephcasey.mybgg.dailysync</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$DAILY_SYNC_SCRIPT</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>8</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    
    <key>WorkingDirectory</key>
    <string>$MYBGG_DIR</string>
    
    <key>StandardOutPath</key>
    <string>$MYBGG_DIR/launch_agent.log</string>
    
    <key>StandardErrorPath</key>
    <string>$MYBGG_DIR/launch_agent_error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/Users/jo/Library/Python/3.8/bin</string>
        <key>HOME</key>
        <string>$HOME</string>
    </dict>
    
    <key>ProcessType</key>
    <string>Background</string>
    
    <key>ThrottleInterval</key>
    <integer>3600</integer>
</dict>
</plist>
EOF

echo "✅ Launch Agent plist created: $PLIST_FILE"
echo ""

# Load the launch agent
echo "🔄 Loading Launch Agent..."
if launchctl load "$PLIST_FILE"; then
    echo "✅ Launch Agent loaded successfully!"
else
    echo "❌ Failed to load Launch Agent"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 What will happen now:"
echo "   • Every day at 8:00 AM, the sync will run automatically"
echo "   • Also runs immediately after login (if you log in after 8 AM)"
echo "   • Logs will be saved to:"
echo "     - $MYBGG_DIR/launch_agent.log (normal output)"
echo "     - $MYBGG_DIR/launch_agent_error.log (errors)"
echo "     - $MYBGG_DIR/daily_sync.log (sync activity)"
echo ""
echo "🎯 Manual controls:"
echo "   • Test sync now: $DAILY_SYNC_SCRIPT"
echo "   • Check if loaded: launchctl list | grep mybgg"
echo "   • Unload agent: launchctl unload $PLIST_FILE"
echo "   • Reload agent: launchctl unload $PLIST_FILE && launchctl load $PLIST_FILE"
echo ""
echo "📧 Email notifications will be sent to josephjcasey@gmail.com"
echo "📱 You'll get daily updates about your Marvel Champions plays!"
echo ""
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$LAUNCH_AGENT_DIR/com.josephcasey.mybgg.dailysync.plist"

# Check if daily_sync.sh exists
if [ ! -f "$DAILY_SYNC_SCRIPT" ]; then
    echo "❌ Error: daily_sync.sh not found at $DAILY_SYNC_SCRIPT"
    exit 1
fi

echo "📍 Daily sync script found: $DAILY_SYNC_SCRIPT"
echo "📂 Launch agent directory: $LAUNCH_AGENT_DIR"
echo ""

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCH_AGENT_DIR"

# Check if launch agent already exists
if [ -f "$PLIST_FILE" ]; then
    echo "✅ Launch agent already exists at $PLIST_FILE"
    echo ""
    read -p "🔄 Do you want to update it? (y/N): " update_agent
    if [[ ! $update_agent =~ ^[Yy]$ ]]; then
        echo "⏭️  Keeping existing launch agent."
        echo ""
        echo "🎯 To manually start/stop the agent:"
        echo "   launchctl load $PLIST_FILE"
        echo "   launchctl unload $PLIST_FILE"
        exit 0
    fi
    
    # Unload existing agent
    echo "🛑 Stopping existing launch agent..."
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
fi

# Create the launch agent plist file
echo "📝 Creating launch agent configuration..."

cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.josephcasey.mybgg.dailysync</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>$DAILY_SYNC_SCRIPT</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>StartInterval</key>
    <integer>3600</integer>
    
    <key>StandardOutPath</key>
    <string>$MYBGG_DIR/daily_sync_agent.log</string>
    
    <key>StandardErrorPath</key>
    <string>$MYBGG_DIR/daily_sync_agent_error.log</string>
    
    <key>WorkingDirectory</key>
    <string>$MYBGG_DIR</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>$HOME</string>
    </dict>
    
    <key>ThrottleInterval</key>
    <integer>300</integer>
</dict>
</plist>
EOF

echo "✅ Launch agent created at $PLIST_FILE"
echo ""

# Load the launch agent
echo "🚀 Loading launch agent..."
if launchctl load "$PLIST_FILE"; then
    echo "✅ Launch agent loaded successfully!"
else
    echo "❌ Failed to load launch agent"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 What happens now:"
echo "   • The agent runs every hour when you're logged in"
echo "   • It checks if a daily sync is needed (once per day maximum)"
echo "   • Syncs only during reasonable hours (6 AM - 11 PM)"
echo "   • Sends email summaries to josephjcasey@gmail.com"
echo "   • Logs activity to $MYBGG_DIR/daily_sync_agent.log"
echo ""
echo "🔧 Management commands:"
echo "   # Check if agent is running"
echo "   launchctl list | grep mybgg"
echo ""
echo "   # Stop the agent"
echo "   launchctl unload $PLIST_FILE"
echo ""
echo "   # Start the agent"
echo "   launchctl load $PLIST_FILE"
echo ""
echo "   # View logs"
echo "   tail -f $MYBGG_DIR/daily_sync_agent.log"
echo ""
echo "🎯 To test immediately:"
echo "   $DAILY_SYNC_SCRIPT"
echo ""
echo "🗑️  To completely remove:"
echo "   launchctl unload $PLIST_FILE"
echo "   rm $PLIST_FILE"
echo ""
