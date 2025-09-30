#!/bin/bash

# Marvel Champions BGG Data Update & Deploy Script
# This script updates data locally and pushes to GitHub Pages
# Usage: ./update_and_deploy.sh [commit_message] [--no-bgg-update]
#   commit_message: Optional commit message to use instead of prompting
#   --no-bgg-update: Skip BGG data update prompt and go straight to deployment

set -e  # Exit on any error

# Parse command line arguments
PRESET_COMMIT_MSG=""
SKIP_BGG_UPDATE=false

for arg in "$@"; do
    case $arg in
        --no-bgg-update)
            SKIP_BGG_UPDATE=true
            shift
            ;;
        *)
            if [ -z "$PRESET_COMMIT_MSG" ]; then
                PRESET_COMMIT_MSG="$arg"
            fi
            shift
            ;;
    esac
done

echo "🚀 Marvel Champions BGG Data Update & Deploy Script"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "config.json" ]; then
    echo "❌ Error: config.json not found. Please run this script from the mybgg project root."
    exit 1
fi

echo "📍 Current directory: $(pwd)"
echo ""

# Step 1: Update Python data (if requested)
if [ "$SKIP_BGG_UPDATE" = true ]; then
    echo "⏭️  Skipping BGG data update (--no-bgg-update flag provided)."
    update_data="N"
else
    read -p "🔄 Do you want to update BGG data? (y/N): " update_data
fi

if [[ $update_data =~ ^[Yy]$ ]]; then
    echo ""
    echo "📥 Updating BGG collection data..."
    
    # Check if Python requirements are installed
    if [ ! -d "scripts/__pycache__" ]; then
        echo "📦 Installing Python requirements..."
        cd scripts
        pip3 install --user -r requirements.txt
        cd ..
    fi
    
    # Determine Algolia admin API key (preferred sources in order):
    # 1) APIKEY environment variable
    # 2) .vscode/launch.json env entry for APIKEY
    # 3) legacy --apikey argument in .vscode/launch.json
    # 4) prompt the user
    
    # Check if virtual environment exists and activate it
    if [ -d "venv" ]; then
        echo "🐍 Activating Python virtual environment..."
        source venv/bin/activate
        PYTHON_CMD="python3"
    else
        echo "⚠️  Virtual environment not found, using system Python"
        PYTHON_CMD="python3"
    fi

    algolia_admin_key=""

    # 1) Use APIKEY environment variable if set
    if [ -n "$APIKEY" ]; then
        algolia_admin_key="$APIKEY"
        echo "🔒 Using Algolia admin API key from environment variable (APIKEY)"
    fi

    # 2) Attempt to extract APIKEY from .vscode/launch.json env block (if still empty)
    if [ -z "$algolia_admin_key" ] && [ -f ".vscode/launch.json" ]; then
        echo "🔎 Trying to read APIKEY from .vscode/launch.json (env.APIKEY)..."
        # Look for a JSON entry like "APIKEY": "value"
        algolia_admin_key=$(grep -o '"APIKEY"\s*:\s*"[^"]*"' .vscode/launch.json | sed 's/.*"APIKEY"\s*:\s*"\([^"]*\)".*/\1/') || true
    fi

    # 3) Fallback: legacy pattern where --apikey is present in args array
    if [ -z "$algolia_admin_key" ] && [ -f ".vscode/launch.json" ]; then
        echo "🔎 Trying legacy extraction of --apikey from .vscode/launch.json..."
        algolia_admin_key=$(grep -o '"--apikey",\s*"[^"]*"' .vscode/launch.json | sed 's/"--apikey",\s*"\([^\"]*\)"/\1/') || true
    fi

    # 4) Prompt the user if still not found
    if [ -z "$algolia_admin_key" ]; then
        echo "❗ Algolia admin API key not found in environment or .vscode/launch.json"
        read -p "🔐 Enter your Algolia admin API key (or leave blank to skip): " algolia_admin_key
    fi

    if [ -n "$algolia_admin_key" ]; then
        echo "✅ Using provided Algolia admin API key. Running data update..."
        $PYTHON_CMD scripts/download_and_index.py --apikey "$algolia_admin_key" --cache_bgg
    else
        echo "⚠️  No API key provided. Skipping data update. You can still deploy current data files."
    fi
    
    # Check if new data was generated
    if [ -f "output.txt" ]; then
        echo "✅ Data update completed. Check output.txt for details."
        echo ""
        echo "📊 Updated files:"
        ls -la *.json | grep -E "(hero_images|villain_images|cached_)" || echo "   No JSON files found matching pattern"
    else
        echo "⚠️  No output.txt found. Data update may have failed."
    fi
    
    echo ""
else
    echo "⏭️  Skipping data update."
    echo ""
fi

# Step 2: Git status check
echo "📋 Current Git status:"
git status --porcelain

# Check if there are changes to commit
if [[ -n $(git status --porcelain) ]]; then
    echo ""
    echo "📝 Changes detected. Preparing to commit and deploy..."
    
    # Show what changed
    echo ""
    echo "🔍 Changed files:"
    git status --short
    
    # Generate AI commit message based on changes
    echo ""
    echo "🤖 Generating AI commit message based on changes..."
    
    # Get a summary of changes for AI analysis
    changed_files=$(git status --porcelain | head -10)
    git_diff_summary=$(git diff --cached --stat 2>/dev/null || git diff --stat)
    
    # Create a prompt for AI commit message generation
    ai_prompt="Based on these git changes, generate a concise commit message (50 chars max):

Changed files:
$changed_files

Diff summary:
$git_diff_summary

Focus on: data updates, feature additions, bug fixes, or documentation changes.
Use conventional commits format (feat:, fix:, docs:, etc.) when appropriate."
    
    # Check if commit message was provided as parameter
    if [ -n "$PRESET_COMMIT_MSG" ]; then
        commit_msg="$PRESET_COMMIT_MSG"
        echo "💬 Using provided commit message: $commit_msg"
    else
        # Try to get AI-generated commit message (requires GitHub CLI with Copilot)
        if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
            echo "🔍 Using GitHub Copilot CLI for commit message..."
            ai_suggested_msg=$(echo "$ai_prompt" | gh copilot suggest -t shell 2>/dev/null | grep -E "^(feat|fix|docs|chore|update)" | head -1 | sed 's/^[[:space:]]*//')
            
            if [ -n "$ai_suggested_msg" ]; then
                echo "💡 AI suggests: $ai_suggested_msg"
                echo ""
                read -p "💬 Use this message? (Y/n) or enter custom: " user_choice
                
                case "$user_choice" in
                    [nN]|[nN][oO])
                        read -p "💬 Enter your commit message: " commit_msg
                        ;;
                    "")
                        commit_msg="$ai_suggested_msg"
                        ;;
                    [yY]|[yY][eE][sS])
                        commit_msg="$ai_suggested_msg"
                        ;;
                    *)
                        commit_msg="$user_choice"
                        ;;
                esac
            else
                echo "⚠️  AI suggestion failed, falling back to manual input"
                read -p "💬 Enter commit message (or press Enter for default): " commit_msg
            fi
        else
            echo "⚠️  GitHub CLI with Copilot not available, falling back to manual input"
            read -p "💬 Enter commit message (or press Enter for default): " commit_msg
        fi
        
        # Clean up commit message - if it's empty or just whitespace, use default
        commit_msg=$(echo "$commit_msg" | xargs)  # Trim whitespace
        
        # Fallback to default if still empty or user literally typed "Enter"
        if [ -z "$commit_msg" ] || [ "$commit_msg" = "Enter" ]; then
            commit_msg="Update Marvel Champions BGG data - $(date '+%Y-%m-%d %H:%M')"
        fi
    fi
    
    # Step 3: Commit and push to GitHub Pages
    echo ""
    echo "📤 Committing and pushing to GitHub Pages..."
    
    git add .
    git commit -m "$commit_msg"
    git push origin master
    
    echo ""
    echo "🎉 Deployment complete!"
    echo ""
    echo "🌐 Your site will be updated at:"
    echo "   https://josephcasey.github.io/mybgg/"
    echo ""
    echo "⏰ Note: GitHub Pages may take 1-2 minutes to update."
    
else
    echo ""
    echo "✨ No changes detected. Site is already up to date!"
    echo ""
    echo "🌐 Current site: https://josephcasey.github.io/mybgg/"
fi

echo ""
echo "✅ Script completed successfully!"
