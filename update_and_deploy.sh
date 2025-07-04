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
    
    # Get Algolia admin API key from launch.json
    echo "🔑 Reading Algolia admin API key from .vscode/launch.json..."
    
    # Check if virtual environment exists and activate it
    if [ -d "venv" ]; then
        echo "🐍 Activating Python virtual environment..."
        source venv/bin/activate
        PYTHON_CMD="python3"
    else
        echo "⚠️  Virtual environment not found, using system Python"
        PYTHON_CMD="python3"
    fi
    
    if [ -f ".vscode/launch.json" ]; then
        # Extract API key from launch.json using grep and sed
        algolia_admin_key=$(grep -o '"--apikey", "[^"]*"' .vscode/launch.json | sed 's/"--apikey", "\([^"]*\)"/\1/')
        
        if [ -n "$algolia_admin_key" ]; then
            echo "✅ Found Algolia admin API key in launch.json"
            
            # Run the data download script
            echo "🔍 Downloading latest BGG data and updating Algolia index..."
            $PYTHON_CMD scripts/download_and_index.py --apikey "$algolia_admin_key" --cache_bgg
        else
            echo "❌ Could not extract API key from launch.json"
            echo "   Please check the format in .vscode/launch.json"
        fi
    else
        echo "❌ .vscode/launch.json not found"
        echo "   Manual API key entry:"
        read -p "🔐 Enter your Algolia admin API key: " algolia_admin_key
        
        if [ -n "$algolia_admin_key" ]; then
            # Run the data download script
            echo "🔍 Downloading latest BGG data and updating Algolia index..."
            $PYTHON_CMD scripts/download_and_index.py --apikey "$algolia_admin_key" --cache_bgg
        else
            echo "❌ No API key provided. Skipping data update."
            echo "   You can still deploy current data files."
        fi
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
