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
