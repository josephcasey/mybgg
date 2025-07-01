#!/bin/bash

# Setup virtual environment for Marvel Champions BGG project
# This creates a clean Python environment with all required dependencies

set -e

echo "🐍 Setting up Python virtual environment for Marvel Champions BGG..."
echo "=================================================================="

# Check if we're in the right directory
if [ ! -f "scripts/requirements.txt" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Expected to find: scripts/requirements.txt"
    exit 1
fi

# Remove existing virtual environment if it exists
if [ -d "venv" ]; then
    echo "🧹 Removing existing virtual environment..."
    rm -rf venv
fi

# Create new virtual environment
echo "📦 Creating new virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "⚡ Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "🔧 Upgrading pip..."
python -m pip install --upgrade pip

# Install dependencies from requirements.txt
echo "📚 Installing Python dependencies..."

# Install core dependencies first (excluding problematic ones)
echo "  🔧 Installing core dependencies..."
pip install algoliasearch==3.0.0 declxml==1.1.3 requests-cache attrs cattrs certifi charset-normalizer idna platformdirs requests urllib3

# Try to install Pillow and colorgram.py (needed for image processing, but not critical for BGG sync)
echo "  🎨 Installing image processing dependencies (optional)..."
pip install Pillow colorgram.py || echo "⚠️  Image processing dependencies failed - BGG sync will still work"

echo ""
echo "✅ Virtual environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Activate the environment: source venv/bin/activate"
echo "   2. Test the BGG sync: python scripts/download_and_index.py"
echo "   3. Deactivate when done: deactivate"
echo ""
echo "🔧 For daily automation, the scripts will automatically use this environment"
