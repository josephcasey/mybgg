#!/bin/bash

# Marvel Champions BGG Daily Auto-Sync Script
# Automatically syncs BGG data to Algolia once per day on login
# Place this script in your shell profile (.bashrc, .zshrc, etc.) to run on login

set -e  # Exit on any error

# Configuration
MYBGG_DIR="/Users/jo/mybgg"
SYNC_LOG_FILE="$MYBGG_DIR/.last_sync"
EMAIL_ADDRESS="josephjcasey@gmail.com"
TODAY=$(date '+%Y-%m-%d')

# Function to send email summary
send_email_summary() {
    local status="$1"
    local details="$2"
    local subject="Marvel Champions BGG Daily Sync - $TODAY - $status"
    
    # Create email body
    local email_body="Marvel Champions BGG Daily Sync Report
=====================================
Date: $TODAY
Time: $(date '+%H:%M:%S')
Status: $status

$details

---
Your Marvel Champions BGG Statistics Tracker
https://josephcasey.github.io/mybgg/

This is an automated message from your daily sync script."

    # Try multiple email methods
    local email_sent=false
    
    # Method 1: Use our Python script (opens Mail.app + notification)
    if command -v python >/dev/null 2>&1 && [ -f "$MYBGG_DIR/send_email.py" ]; then
        # Use virtual environment if available
        if [ -d "$MYBGG_DIR/venv" ]; then
            source "$MYBGG_DIR/venv/bin/activate"
            PYTHON_EMAIL_CMD="python"
        else
            PYTHON_EMAIL_CMD="python3"
        fi
        
        if $PYTHON_EMAIL_CMD "$MYBGG_DIR/send_email.py" "$EMAIL_ADDRESS" "$subject" "$email_body"; then
            email_sent=true
            log_message "📧 Email composed via Mail.app for $EMAIL_ADDRESS"
        fi
    fi
    
    # Method 2: macOS notification as backup
    if ! $email_sent; then
        if command -v osascript >/dev/null 2>&1; then
            osascript -e "display notification \"Marvel Champions BGG sync completed! Status: $status\" with title \"BGG Daily Sync\""
            log_message "🔔 macOS notification sent (email fallback)"
            email_sent=true
        fi
    fi
    
    # Method 3: Log to file as final fallback
    if ! $email_sent; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - EMAIL SUMMARY:" >> "$MYBGG_DIR/email_log.txt"
        echo "Subject: $subject" >> "$MYBGG_DIR/email_log.txt"
        echo "$email_body" >> "$MYBGG_DIR/email_log.txt"
        echo "----------------------------------------" >> "$MYBGG_DIR/email_log.txt"
        log_message "📝 Email summary logged to email_log.txt"
    fi
}

# Function to log messages with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if we're in a terminal (not running in background)
if [ -t 1 ]; then
    INTERACTIVE=true
else
    INTERACTIVE=false
fi

# Function to run the sync
run_sync() {
    log_message "🔄 Starting daily BGG sync for Marvel Champions..."
    
    cd "$MYBGG_DIR"
    
    # Capture sync output for email
    SYNC_OUTPUT=""
    
    # Store current cached plays count before sync
    PREV_HERO_COUNT=0
    if [ -f "cached_hero_names.json" ]; then
        PREV_HERO_COUNT=$(grep -o '"[^"]*"' cached_hero_names.json | wc -l 2>/dev/null || echo "0")
    fi
    
    # Get Algolia admin API key from launch.json
    if [ -f ".vscode/launch.json" ]; then
        algolia_admin_key=$(grep -o '"--apikey", "[^"]*"' .vscode/launch.json | sed 's/"--apikey", "\([^"]*\)"/\1/')
        
        if [ -n "$algolia_admin_key" ]; then
            log_message "✅ Found Algolia admin API key"
            
            # Check if virtual environment exists and activate it
            if [ -d "$MYBGG_DIR/venv" ]; then
                log_message "🐍 Activating Python virtual environment..."
                source "$MYBGG_DIR/venv/bin/activate"
                PYTHON_CMD="python"
            else
                log_message "⚠️  Virtual environment not found, using system Python"
                PYTHON_CMD="python3"
            fi
            
            # Run the Python sync script and capture output
            log_message "📥 Downloading latest BGG data and updating Algolia..."
            
            # Capture the output from the Python script
            if PYTHON_OUTPUT=$($PYTHON_CMD scripts/download_and_index.py --apikey "$algolia_admin_key" --cache_bgg 2>&1); then
                # Extract key information from output
                TOTAL_PLAYS=$(echo "$PYTHON_OUTPUT" | grep -o "Imported [0-9]* Marvel Champions plays" | grep -o "[0-9]*" || echo "unknown")
                UNIQUE_HEROES=$(echo "$PYTHON_OUTPUT" | grep -o "Saved [0-9]* unique hero names" | grep -o "[0-9]*" || echo "unknown")
                FILTERED_PLAYS=$(echo "$PYTHON_OUTPUT" | grep -o "Final count: [0-9]*" | grep -o "[0-9]*" || echo "unknown")
                INDEXED_PLAYS=$(echo "$PYTHON_OUTPUT" | grep -o "Indexed [0-9]* Marvel Champions plays" | grep -o "[0-9]*" || echo "unknown")
                
                # Calculate new heroes discovered
                NEW_HERO_COUNT=0
                if [ -f "cached_hero_names.json" ] && [ "$UNIQUE_HEROES" != "unknown" ]; then
                    NEW_HERO_COUNT=$((UNIQUE_HEROES - PREV_HERO_COUNT))
                    if [ $NEW_HERO_COUNT -lt 0 ]; then
                        NEW_HERO_COUNT=0
                    fi
                fi
                
                # Extract recent plays information (look for newest plays in output)
                RECENT_PLAYS=""
                if echo "$PYTHON_OUTPUT" | grep -q "Sample play data:"; then
                    # Extract the sample play data to show the most recent play
                    SAMPLE_PLAY=$(echo "$PYTHON_OUTPUT" | sed -n '/Sample play data:/,/^$/p' | tail -n +2)
                    RECENT_VILLAIN=$(echo "$SAMPLE_PLAY" | grep '"villain":' | sed 's/.*"villain": "\([^"]*\)".*/\1/' || echo "")
                    RECENT_HERO=$(echo "$SAMPLE_PLAY" | grep '"hero":' | sed 's/.*"hero": "\([^"]*\)".*/\1/' || echo "")
                    RECENT_DATE=$(echo "$SAMPLE_PLAY" | grep '"date":' | sed 's/.*"date": "\([^"]*\)".*/\1/' || echo "")
                    RECENT_WIN=$(echo "$SAMPLE_PLAY" | grep '"win":' | sed 's/.*"win": \([0-9]*\).*/\1/' || echo "")
                    
                    if [ -n "$RECENT_HERO" ] && [ -n "$RECENT_VILLAIN" ]; then
                        WIN_STATUS="❌ Loss"
                        if [ "$RECENT_WIN" = "1" ]; then
                            WIN_STATUS="✅ Win"
                        fi
                        RECENT_PLAYS="📊 Most Recent Play:
• $RECENT_DATE: $RECENT_HERO vs $RECENT_VILLAIN ($WIN_STATUS)"
                    fi
                fi
                
                # Check for any new heroes discovered today
                NEW_HEROES_INFO=""
                if [ "$NEW_HERO_COUNT" -gt 0 ]; then
                    NEW_HEROES_INFO="🆕 New Heroes Discovered: $NEW_HERO_COUNT"
                fi
                
                # Extract filtered multi-hero examples
                MULTI_HERO_EXAMPLES=""
                if echo "$PYTHON_OUTPUT" | grep -q "Examples of filtered multi-hero plays:"; then
                    FILTERED_EXAMPLES=$(echo "$PYTHON_OUTPUT" | sed -n '/Examples of filtered multi-hero plays:/,/^$/p' | grep "  - " | head -3)
                    if [ -n "$FILTERED_EXAMPLES" ]; then
                        MULTI_HERO_EXAMPLES="🔍 Filtered Multi-Hero Plays:
$FILTERED_EXAMPLES"
                    fi
                fi
                
                # Check if any actual data changed by comparing play counts
                # If the indexed plays count is the same as before, it means no new plays
                PREV_INDEXED_COUNT=0
                if [ -f "$MYBGG_DIR/.last_play_count" ]; then
                    PREV_INDEXED_COUNT=$(cat "$MYBGG_DIR/.last_play_count" 2>/dev/null || echo "0")
                fi
                
                # Store current count for next time
                echo "$INDEXED_PLAYS" > "$MYBGG_DIR/.last_play_count"
                
                # Update the sync log
                echo "$TODAY" > "$SYNC_LOG_FILE"
                log_message "✅ Daily sync completed successfully!"
                
                # Check if we found new plays or just re-indexed existing ones
                if [ "$INDEXED_PLAYS" = "$PREV_INDEXED_COUNT" ] && [ "$PREV_INDEXED_COUNT" != "0" ]; then
                    # No new plays found - send "no new data" email
                    SYNC_OUTPUT="📊 NO NEW PLAYS

BGG Sync Completed - No Changes Detected:
• Total plays in collection: $TOTAL_PLAYS
• Unique heroes tracked: $UNIQUE_HEROES  
• Plays indexed in Algolia: $INDEXED_PLAYS
• Previous play count: $PREV_INDEXED_COUNT

✅ Your data is current! No new Marvel Champions plays found since last sync.

$RECENT_PLAYS

Data Source: BoardGameGeek collection
Last Checked: $(date '+%Y-%m-%d %H:%M:%S')
Next Check: Tomorrow morning

Your Marvel Champions statistics are up to date on your website."
                    
                    send_email_summary "NO NEW PLAYS" "$SYNC_OUTPUT"
                    
                    if [ "$INTERACTIVE" = true ]; then
                        echo ""
                        echo "📊 Marvel Champions BGG sync completed - no new plays found"
                        echo "🎮 Your collection remains at $INDEXED_PLAYS plays"
                        echo "📧 Confirmation email sent to $EMAIL_ADDRESS"
                        echo "🌐 Your site: https://josephcasey.github.io/mybgg/"
                        echo ""
                    fi
                else
                    # New plays found - send success email with details
                    PLAYS_DIFFERENCE=$((INDEXED_PLAYS - PREV_INDEXED_COUNT))
                    if [ $PLAYS_DIFFERENCE -lt 0 ]; then
                        PLAYS_DIFFERENCE=0
                    fi
                    
                    NEW_PLAYS_INFO=""
                    if [ $PLAYS_DIFFERENCE -gt 0 ]; then
                        NEW_PLAYS_INFO="🆕 New Plays Added: $PLAYS_DIFFERENCE"
                    fi
                    
                    SYNC_OUTPUT="✅ SUCCESS - NEW DATA FOUND

BGG Data Summary:
• Total plays imported: $TOTAL_PLAYS
• Unique heroes tracked: $UNIQUE_HEROES  
• Plays after filtering: $FILTERED_PLAYS
• Plays indexed in Algolia: $INDEXED_PLAYS
$NEW_PLAYS_INFO
$NEW_HEROES_INFO

$RECENT_PLAYS

$MULTI_HERO_EXAMPLES

Data Source: BoardGameGeek collection for user in config.json
Last Updated: $(date '+%Y-%m-%d %H:%M:%S')

Your Marvel Champions statistics have been updated and are live on your website."
                    
                    # Send success email
                    send_email_summary "SUCCESS" "$SYNC_OUTPUT"
                    
                    # Only show interactive messages if in a terminal
                    if [ "$INTERACTIVE" = true ]; then
                        echo ""
                        echo "🎉 Marvel Champions BGG data updated!"
                        echo "📊 Plays indexed: $INDEXED_PLAYS (from $TOTAL_PLAYS total)"
                        if [ $PLAYS_DIFFERENCE -gt 0 ]; then
                            echo "🆕 New plays added: $PLAYS_DIFFERENCE"
                        fi
                        if [ -n "$RECENT_HERO" ]; then
                            echo "🎮 Latest play: $RECENT_HERO vs $RECENT_VILLAIN on $RECENT_DATE"
                        fi
                        if [ "$NEW_HERO_COUNT" -gt 0 ]; then
                            echo "🆕 New heroes discovered: $NEW_HERO_COUNT"
                        fi
                        echo "📧 Email summary sent to $EMAIL_ADDRESS"
                        echo "🌐 Your site: https://josephcasey.github.io/mybgg/"
                        echo ""
                    fi
                fi
                
                return 0
            else
                # Python script failed
                log_message "❌ Python sync script failed"
                SYNC_OUTPUT="❌ FAILED

Error running BGG data sync:
$PYTHON_OUTPUT

Please check the script manually:
cd $MYBGG_DIR
./daily_sync.sh"
                
                send_email_summary "FAILED" "$SYNC_OUTPUT"
                return 1
            fi
        else
            log_message "❌ Could not extract API key from launch.json"
            SYNC_OUTPUT="❌ CONFIGURATION ERROR

Could not extract Algolia API key from .vscode/launch.json
Please check the file format and try again."
            send_email_summary "CONFIG ERROR" "$SYNC_OUTPUT"
            return 1
        fi
    else
        log_message "❌ .vscode/launch.json not found"
        SYNC_OUTPUT="❌ CONFIGURATION ERROR

.vscode/launch.json file not found
The Algolia API key is required for syncing data."
        send_email_summary "CONFIG ERROR" "$SYNC_OUTPUT"
        return 1
    fi
}

# Main logic
main() {
    # Check if mybgg directory exists
    if [ ! -d "$MYBGG_DIR" ]; then
        if [ "$INTERACTIVE" = true ]; then
            echo "⚠️  Marvel Champions BGG directory not found: $MYBGG_DIR"
        fi
        return 1
    fi
    
    # Check if we've already synced today
    if [ -f "$SYNC_LOG_FILE" ]; then
        LAST_SYNC=$(cat "$SYNC_LOG_FILE" 2>/dev/null || echo "never")
        
        if [ "$LAST_SYNC" = "$TODAY" ]; then
            # Already synced today - but send a brief confirmation email if interactive
            if [ "$INTERACTIVE" = true ]; then
                # Send a "no sync needed" email
                NO_SYNC_OUTPUT="ℹ️ NO SYNC NEEDED

Daily BGG sync already completed today ($TODAY).

Your Marvel Champions BGG Statistics Tracker is up to date with the latest data from BoardGameGeek.

🌐 View your current stats: https://josephcasey.github.io/mybgg/

Next sync will run tomorrow on your first terminal login."

                send_email_summary "ALREADY SYNCED" "$NO_SYNC_OUTPUT"
                
                echo "✅ Marvel Champions BGG data already synced today"
                echo "📧 Confirmation email sent to $EMAIL_ADDRESS"
                echo "🌐 Your site: https://josephcasey.github.io/mybgg/"
            fi
            return 0
        fi
    fi
    
    # Check if it's a reasonable time to sync (avoid middle of night, etc.)
    HOUR=$(date '+%H')
    if [ "$HOUR" -lt 6 ] || [ "$HOUR" -gt 23 ]; then
        # Too early or too late - skip sync
        return 0
    fi
    
    # Run the sync
    if [ "$INTERACTIVE" = true ]; then
        echo "🌅 Good morning! Checking for Marvel Champions BGG updates..."
        run_sync
    else
        # Run in background mode (silent)
        run_sync >> "$MYBGG_DIR/daily_sync.log" 2>&1
    fi
}

# Run main function
main "$@"
