#!/bin/bash

# Marvel Champions BGG Data Update & Deploy Script
# This script updates data locally and pushes to GitHub Pages

set -e  # Exit on any error

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
read -p "🔄 Do you want to update BGG data? (y/N): " update_data
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
    
    # Ask for commit message
    echo ""
    read -p "💬 Enter commit message (or press Enter for default): " commit_msg
    if [ -z "$commit_msg" ]; then
        commit_msg="Update Marvel Champions BGG data - $(date '+%Y-%m-%d %H:%M')"
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
