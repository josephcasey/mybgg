#!/bin/bash

# Test email functionality for Marvel Champions BGG Daily Sync
# This script tests multiple email delivery methods

EMAIL_ADDRESS="josephjcasey@gmail.com"
TODAY=$(date '+%Y-%m-%d')

echo "📧 Testing email functionality for Marvel Champions BGG Daily Sync"
echo "=================================================================="
echo ""

echo "✅ Testing multiple email delivery methods"
echo "📧 Target email: $EMAIL_ADDRESS"
echo ""

# Test email content
test_subject="Marvel Champions BGG Daily Sync - TEST EMAIL"
test_body="Marvel Champions BGG Daily Sync Test
===================================
Date: $TODAY
Time: $(date '+%H:%M:%S')
Status: TEST

This is a test email to verify that your daily sync script can send email summaries.

If you receive this email, the email functionality is working correctly!

Test Summary:
• System: $(uname -s) $(uname -r)
• Shell: $SHELL
• Python: $(python3 --version 2>/dev/null || echo 'Not available')
• From directory: $(pwd)

Next Steps:
1. If you received this via Mail.app: ✅ Email setup is working!
2. If you got a macOS notification: 🔔 Notification backup is working!
3. If neither worked: Check the email_log.txt file

---
Your Marvel Champions BGG Statistics Tracker
https://josephcasey.github.io/mybgg/

This is a test message from your daily sync setup."

echo "🔄 Testing email delivery methods..."
echo ""

# Method 1: Python script with Mail.app
echo "📱 Method 1: Mail.app + Notification"
if [ -f "send_email.py" ] && command -v python3 >/dev/null 2>&1; then
    if python3 send_email.py "$EMAIL_ADDRESS" "$test_subject" "$test_body"; then
        echo "✅ Method 1 succeeded"
        method1_success=true
    else
        echo "❌ Method 1 failed"
        method1_success=false
    fi
else
    echo "❌ Method 1 not available (missing Python or send_email.py)"
    method1_success=false
fi

echo ""

# Method 2: macOS notification only
echo "🔔 Method 2: macOS Notification Only"
if command -v osascript >/dev/null 2>&1; then
    if osascript -e "display notification \"Marvel Champions BGG email test completed! Check Mail.app or email_log.txt for results.\" with title \"BGG Email Test\""; then
        echo "✅ Method 2 succeeded"
        method2_success=true
    else
        echo "❌ Method 2 failed"
        method2_success=false
    fi
else
    echo "❌ Method 2 not available (no osascript)"
    method2_success=false
fi

echo ""

# Method 3: Log to file
echo "📝 Method 3: File Logging"
log_file="email_log.txt"
echo "$(date '+%Y-%m-%d %H:%M:%S') - EMAIL TEST:" >> "$log_file"
echo "Subject: $test_subject" >> "$log_file"
echo "$test_body" >> "$log_file"
echo "----------------------------------------" >> "$log_file"
echo "✅ Method 3 succeeded - logged to $log_file"

echo ""
echo "📋 Test Results Summary:"
echo "   📱 Mail.app + Notification: $([ "$method1_success" = true ] && echo "✅ Working" || echo "❌ Failed")"
echo "   🔔 macOS Notification: $([ "$method2_success" = true ] && echo "✅ Working" || echo "❌ Failed")"
echo "   📝 File Logging: ✅ Working"
echo ""

if [ "$method1_success" = true ]; then
    echo "🎉 Recommended: Mail.app method is working!"
    echo "   Your daily sync will open Mail.app with pre-composed emails"
    echo "   and send macOS notifications"
elif [ "$method2_success" = true ]; then
    echo "🔔 Backup method working: You'll get macOS notifications"
    echo "   Email summaries will be logged to email_log.txt"
else
    echo "📝 Fallback only: Email summaries will be logged to email_log.txt"
fi

echo ""
echo "🎯 Next steps:"
echo "   1. Run the daily sync: ./daily_sync.sh"
echo "   2. Check for Mail.app opening or notifications"
echo "   3. Review email_log.txt for logged summaries"
echo ""
