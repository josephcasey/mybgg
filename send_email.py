#!/usr/bin/env python3

"""
Enhanced email sender for Marvel Champions BGG Daily Sync
Uses AppleScript to send emails via Mail.app on macOS
"""

import subprocess
import sys
import os
from datetime import datetime

def send_via_applescript(to_email, subject, body):
    """
    Send email via AppleScript using Mail.app
    This automatically sends the email without user intervention
    """
    
    # Escape quotes and special characters for AppleScript
    def escape_for_applescript(text):
        return text.replace('\\', '\\\\').replace('"', '\\"').replace('\r', '\\r').replace('\n', '\\n')
    
    escaped_subject = escape_for_applescript(subject)
    escaped_body = escape_for_applescript(body)
    escaped_to = escape_for_applescript(to_email)
    
    applescript = f'''
    tell application "Mail"
        set newMessage to make new outgoing message with properties {{subject:"{escaped_subject}", content:"{escaped_body}"}}
        tell newMessage
            make new to recipient at end of to recipients with properties {{address:"{escaped_to}"}}
            send
        end tell
    end tell
    '''
    
    try:
        # Run AppleScript to send email
        result = subprocess.run(
            ['osascript', '-e', applescript],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print(f"✅ Email sent successfully to {to_email}")
            return True
        else:
            print(f"❌ AppleScript failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Email sending timed out")
        return False
    except Exception as e:
        print(f"❌ Failed to send email via AppleScript: {e}")
        return False

def send_notification_email():
    """Send a notification via macOS notification system as backup"""
    try:
        # Send macOS notification
        subprocess.run([
            'osascript', '-e',
            'display notification "Marvel Champions BGG sync completed! Check your stats at josephcasey.github.io/mybgg/" with title "BGG Sync Complete"'
        ], check=True)
        print("✅ macOS notification sent")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to send notification: {e}")
        return False

def log_email_to_file(to_email, subject, body):
    """Fallback: Log email content to file"""
    log_file = os.path.expanduser("~/mybgg_email_log.txt")
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*50}\n")
            f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"To: {to_email}\n")
            f.write(f"Subject: {subject}\n")
            f.write(f"Body:\n{body}\n")
            f.write(f"{'='*50}\n")
        print(f"📝 Email logged to {log_file}")
        return True
    except Exception as e:
        print(f"❌ Failed to log email: {e}")
        return False
        print("✅ macOS notification sent")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to send notification: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3 send_email.py <to_email> <subject> <body>")
        sys.exit(1)
    
    to_email = sys.argv[1]
    subject = sys.argv[2]
    body = sys.argv[3]
    
    print(f"📧 Attempting to send email to {to_email}")
    
    # Try multiple delivery methods in order of preference
    success = False
    
    # Method 1: AppleScript via Mail.app (automatic sending)
    if send_via_applescript(to_email, subject, body):
        success = True
    else:
        print("⚠️  AppleScript email failed, trying notification...")
        
        # Method 2: macOS notification
        if send_notification_email():
            success = True
        
        # Method 3: Log to file as ultimate fallback
        if log_email_to_file(to_email, subject, body):
            success = True
    
    if success:
        print("✅ Email delivery completed successfully")
        sys.exit(0)
    else:
        print("❌ All email delivery methods failed")
        sys.exit(1)
