# Marvel Champions BGG - GitHub Pages + Local Python Setup

## 🚀 Perfect Deployment Strategy

**Static App**: GitHub Pages (Free, Fast, Reliable)  
**Python Scripts**: Local automation with `update_and_deploy.sh`

## Part 1: GitHub Pages Setup (One-Time)

### ✅ What GitHub Pages Will Host:
- ✅ All your static files (`index.html`, `index.js`, `app.js`, `style.css`)
- ✅ All JSON data files (`hero_images.json`, `villain_images_final.json`, etc.)
- ✅ Static assets (images, favicon, search-by-algolia.png)
- ✅ **Free custom domain support**
- ✅ **Automatic SSL certificates**
- ✅ **Instant deployment on git push**

### 🔧 Enable GitHub Pages:

1. **Go to your repository**: https://github.com/josephcasey/mybgg
2. **Click "Settings"** tab
3. **Scroll to "Pages"** in the left sidebar
4. **Source**: Select "Deploy from a branch"
5. **Branch**: Select "master" 
6. **Folder**: Select "/ (root)"
7. **Click "Save"**

### 🌐 Your Live Site:
`https://josephcasey.github.io/mybgg/`

## Part 2: Local Python Automation

### 🐍 **Python Environment Setup (First Time)**

Before running any scripts, set up your Python virtual environment:

```bash
./setup_venv.sh
```

**This script will:**
- ✅ Create isolated Python 3 virtual environment
- ✅ Install all required Python dependencies
- ✅ Configure proper python3/pip3 usage throughout the project
- ✅ Set up isolated Python environment for the project

**✨ Important**: All scripts now consistently use `python3` and `pip3` commands for maximum compatibility across macOS systems.

### 🔐 **API Key Management & Security Setup**

**Environment Variable Configuration:**
Your Algolia admin API key is now securely managed via environment variables:

```bash
# This is automatically done during setup, but for reference:
export APIKEY="your_admin_api_key_here"
```

**Security Features:**
- ✅ **Admin API key** stored as environment variable (not in code)
- ✅ **Search-only API key** safely committed in config files
- ✅ **GitHub Secrets** integration for CI/CD workflows
- ✅ **Automatic key detection** in Python scripts

**Development Workflow:**
```bash
# Run with environment variable (recommended)
python scripts/download_and_index.py

# Or specify key manually if needed
python scripts/download_and_index.py --apikey YOUR_ADMIN_KEY

# Test mode (no indexing, saves Algolia quota)
python scripts/download_and_index.py --no_indexing
```

**VS Code Debugger Integration:**
- ✅ Launch configurations use environment variables
- ✅ Multiple debug profiles available:
  - "Download & Index (Full)" - Complete indexing
  - "Download & Index (No Indexing - Test)" - Development mode
- ✅ Automatic virtual environment detection

### 🤖 Automated Update Script

I've created `update_and_deploy.sh` for you! This script:

- ✅ **Runs Python data collection** (BGG downloads, image processing)
- ✅ **Commits updated JSON files** to git
- ✅ **Pushes to GitHub** (triggers automatic GitHub Pages deployment)
- ✅ **Interactive prompts** (asks before updating data)
- ✅ **Error handling** and status reporting

### 🎯 Usage:

```bash
# From your project root
./update_and_deploy.sh
```

**The script will:**
1. Ask if you want to update BGG data
2. Run Python scripts if requested
3. Show git changes
4. Ask for commit message
5. Push to GitHub Pages automatically

### 🕘 **Automated Daily Sync Script**

I've also created `daily_sync.sh` for automatic daily updates! This script:

- ✅ **Runs automatically** on computer login (via macOS Launch Agent)
- ✅ **Checks if data is fresh** (only syncs once per day)
- ✅ **Smart timing** (8:00 AM daily + first login if after 8 AM)
- ✅ **Background operation** (doesn't interrupt your work)
- ✅ **Comprehensive logging** to multiple log files
- ✅ **Email summaries** to josephjcasey@gmail.com with sync results

### 🛠️ **Setup Daily Auto-Sync:**

```bash
# One-time setup (creates macOS Launch Agent)
./setup_login_agent.sh

# Test email functionality (optional)
./test_email.sh

# Remove automation if needed
./remove_login_agent.sh
```

This creates a macOS Launch Agent that runs automatically when you log into your computer.

### 📅 **Daily Sync Behavior:**

- **Every day at 8:00 AM**: Automatic BGG data sync
- **First login after 8:00 AM**: Runs immediately if missed morning sync
- **Background operation**: Won't interrupt your work
- **Once per day limit**: Smart deduplication prevents multiple syncs
- **Manual override**: Run `./daily_sync.sh` anytime

### 📧 **Email Notifications:**

The system now includes robust email delivery:

- **AppleScript Integration**: Automatically sends emails via Mail.app
- **No manual intervention**: Emails are sent automatically
- **Fallback notifications**: macOS notifications if email fails
- **Email logging**: All emails logged to `~/mybgg_email_log.txt`
- **Three email types**:
  - ✅ **SUCCESS**: New plays found with detailed summaries
  - 📊 **NO NEW PLAYS**: Confirmation when no changes detected  
  - 🔄 **ALREADY SYNCED**: Status when sync already completed today

**Test email system**: `./test_email.sh`

### ⚠️ What GitHub Pages CANNOT Host:

**Python Scripts (Run Locally):**
- ❌ `scripts/download_and_index.py` (BGG data fetching)  
- ❌ `scripts/character_art.py` (Hall of Heroes scraping)
- ❌ `scripts/mybgg/` modules (bgg_client, downloader, indexer)
- ❌ `scripts/villain_images_generator.py` (Image processing)
- ❌ Any Python dependencies from `requirements.txt`

**Why?** GitHub Pages only serves static files - no Python execution.

**Solution**: Use the `update_and_deploy.sh` script to run these locally!

## Part 3: Complete Workflow

### 🔄 Regular Data Updates:

```bash
# 1. Update data and deploy (interactive)
./update_and_deploy.sh

# 2. Or just deploy current files
git add .
git commit -m "Update Marvel Champions data"
git push origin master
```

### ⚡ Deployment Timeline:
1. **Local script runs**: ~30 seconds
2. **Git push**: ~5 seconds  
3. **GitHub Pages build**: ~1-2 minutes
4. **Site updated**: Total ~3 minutes

## Part 4: Verification & Testing

### ✅ After First Deployment:

1. **Visit**: https://josephcasey.github.io/mybgg/
2. **Check JSON files are accessible**:
   - https://josephcasey.github.io/mybgg/hero_images.json
   - https://josephcasey.github.io/mybgg/villain_images_final.json
   - https://josephcasey.github.io/mybgg/config.json
3. **Test Algolia search functionality**
4. **Verify hero/villain image overlays work**

### 🐛 Troubleshooting:

**If Python scripts fail:**
- First, check if virtual environment is set up: `ls -la venv/`
- If missing, run: `./setup_venv.sh`
- If packages are missing: Re-run `./setup_venv.sh`

**If API key errors occur:**
- Check environment variable: `echo $APIKEY`
- If empty, re-run: `source ~/.zshrc` or restart terminal
- Verify GitHub secret is set in repository Settings → Secrets → Actions
- For VS Code debugging, check `.vscode/launch.json` has correct env settings

**If site doesn't load:**
- Check GitHub Pages is enabled in Settings → Pages
- Wait 1-2 minutes for deployment
- Check repository is public

**If JSON files return 404:**
- Ensure files are committed to master branch
- Check files exist in GitHub web interface

**If Algolia search fails:**
- Verify search-only API key in `config.json` and `config.js` match
- Check browser console for authentication errors
- Ensure admin API key is only used for indexing (not in frontend files)

**If daily sync fails:**
- Check email logs for error details
- Ensure virtual environment is working: `source venv/bin/activate && python3 --version`
- Test API key setup: `python scripts/download_and_index.py --no_indexing`
- Test manually: `./daily_sync.sh`

## Part 5: Benefits of This Setup

### ✅ **Advantages:**

- **Free hosting** for your main app
- **Fast global CDN** via GitHub Pages
- **Automatic deployments** on git push
- **Version control** for all data changes
- **Local control** over Python data processing
- **No credit card required**
- **Professional URL** (josephcasey.github.io/mybgg)

### 🎯 **Perfect For:**

- Static web applications (like yours!)
- Data-driven sites with JSON
- Projects with local data processing
- Personal portfolio projects
- Open source applications

## 🚀 Ready to Deploy?

1. **Enable GitHub Pages** (Steps in Part 1)
2. **Run the deployment script**:
   ```bash
   ./update_and_deploy.sh
   ```
3. **Wait 2 minutes** for GitHub Pages to build
4. **Visit your live site**!

Your Marvel Champions BGG Statistics Tracker will be live at:
**https://josephcasey.github.io/mybgg/**

## 📝 Release Notes & Deployment History

### 🔄 **Recent Deployments:**

This section tracks major updates and improvements to your Marvel Champions BGG app:

#### **September 2025 - Security & Development Experience Improvements**
- ✅ **API Key Security Enhancement** - Admin keys moved to environment variables
- ✅ **GitHub Secrets Integration** - Secure CI/CD with repository secrets
- ✅ **VS Code Debug Configuration** - Enhanced development workflow with launch configs
- ✅ **Environment Variable Automation** - Scripts automatically detect API keys
- ✅ **Improved Error Handling** - Better validation and user feedback

#### **June 2025 - Full Automation & Email System**
- ✅ **GitHub Pages Deployment Setup** - Complete static hosting solution
- ✅ **macOS Launch Agent** - Automated daily BGG syncing at 8:00 AM
- ✅ **Email Notification System** - Three types of daily summary emails
- ✅ **Enhanced Daily Sync** - Detailed play tracking and new hero detection
- ✅ **Deployment Scripts** - `update_and_deploy.sh`, `quick_deploy.sh`, `daily_sync.sh`
- ✅ **Management Tools** - `setup_login_agent.sh`, `remove_login_agent.sh`, `test_email.sh`

#### **Previous Versions:**
- 📊 **v1.0.0 (May 2024)** - Initial statistics overlay, side-by-side tables, bar visualizations
- 🎯 See [`release_notes.md`](release_notes.md) for detailed version history

### 🚀 **Latest Features:**
- **Automatic Daily Sync**: BGG data updates without manual intervention
- **Email Summaries**: Know immediately when new plays are added
- **Smart Detection**: Tracks new heroes, play counts, and collection growth
- **GitHub Pages Hosting**: Fast, reliable, free static site hosting
- **Launch Agent Automation**: macOS system-level scheduling for reliability
- **Team Play Aggregation Fix**: `scripts/mybgg/downloader.py` now merges multi-hero Marvel Champions plays into a single team entry, so Algolia receives full team data. Re-run `python scripts/download_and_index.py` (with your admin API key loaded) or `./update_and_deploy.sh` to refresh the index after pulling this update.

## 🔧 Frontend Development & Testing

### ✅ Recent Frontend Improvements (v2.1.0)

**Team Statistics Enhancements:**
- ✅ **Fixed missing `filterTeamPlays` function** - Team tab now properly filters team games
- ✅ **Enhanced team composition parsing** - Handles commas, semicolons, "and", "&" separators
- ✅ **Two-hero column display** - Team stats show 1st & 2nd hero with images
- ✅ **Modal popup fixes** - Hero/villain detail modals working correctly
- ✅ **Side-by-side layout restored** - Hero and villain stats display properly
- ✅ **InstantSearch tab syncing** - Solo/Team tab switches now update backend filters automatically, so team plays load without manual refresh
- ✅ **Team composition parser** - Normalizes hero nicknames (Spidey, Rocket, etc.), strips aspect suffixes, and falls back to hero1/hero2 fields so team images render reliably
- ✅ **Team table sorting** - Column headers now sort by plays, wins, win%, or last played without resetting

**Image Loading & Display:**
- ✅ **CORS-friendly image loading** - Images load correctly from JSON files
- ✅ **Hero image matching** - Improved name resolution with alias support
- ✅ **Villain image matching** - Better difficulty level stripping
- ✅ **Aspect detection** - Enhanced hero aspect recognition
- ✅ **Error handling** - Graceful fallbacks when images missing

### 🧪 Local Testing Setup

For full frontend development and testing:

```bash
# Start local HTTP server (avoids CORS issues)
python3 -m http.server 8080

# Open in browser
open http://localhost:8080
```

**Why local server?** 
- ✅ Prevents CORS errors when loading JSON files
- ✅ Mimics GitHub Pages environment exactly
- ✅ Enables full app functionality during development
- ✅ Tests image loading, search, and team functionality

### 🐛 Debugging Team Functionality

The team tab includes comprehensive debugging output:

```javascript
// Check browser console (F12) for:
🔍 filterTeamPlays: Starting with 483 total hits
🔍 filterTeamPlays: Found 42 team plays out of 483 total
🔍 Sample team plays: [...]
📊 displayTeamStats called with 42 hits
```

**Common debugging steps:**
1. Open browser console (F12 → Console)
2. Click "Team" tab
3. Look for filtering and parsing debug messages
4. Verify team composition format in data

### 📱 App Features Status

**✅ Working Features:**
- Hero stats table with images and sorting
- Villain stats table with images and sorting  
- Team stats table with dual hero columns
- Modal popups on hover (hero/villain details)
- Search functionality via Algolia
- Time period filtering
- Responsive design

**🔧 Key Fixes Applied:**
- `filterTeamPlays` function implementation
- Image data loading synchronization
- InstantSearch initialization order
- Stats widget template structure
- Team composition parsing logic
- Modal event handler restoration
