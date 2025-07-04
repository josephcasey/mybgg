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

**If site doesn't load:**
- Check GitHub Pages is enabled in Settings → Pages
- Wait 1-2 minutes for deployment
- Check repository is public

**If JSON files return 404:**
- Ensure files are committed to master branch
- Check files exist in GitHub web interface

**If Algolia search fails:**
- Verify credentials in `config.json`
- Check browser console for errors

**If daily sync fails:**
- Check email logs for error details
- Ensure virtual environment is working: `source venv/bin/activate && python3 --version`
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

### 📈 **Deployment Metrics:**
- **Hosting Cost**: $0 (GitHub Pages free tier)
- **Update Frequency**: Daily automatic sync + manual on-demand
- **Email Notifications**: 3 types (Success, No New Plays, Already Synced)
- **Data Sources**: BoardGameGeek API + Algolia search index
- **Automation**: macOS Launch Agent (8:00 AM daily + login triggers)

---

**🔗 Quick Links:**
- 🌐 **Live Site**: https://josephcasey.github.io/mybgg/
- 📚 **Full Documentation**: This deployment guide
- 📊 **Version History**: [`release_notes.md`](release_notes.md)
- 🔧 **Source Code**: [GitHub Repository](https://github.com/josephcasey/mybgg)
