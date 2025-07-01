# Release Notes

## [v2.1.0] - 2025-07-01

### 🐍 **Python Environment Management**

- **Virtual Environment Support**: Added `setup_venv.sh` script for clean Python dependency management
- **Automated Environment Activation**: All deployment scripts now automatically use virtual environment if available
- **Dependency Isolation**: Prevents conflicts with system Python packages
- **Enhanced Installation**: Graceful handling of problematic packages (Pillow, colorgram.py)
- **Cross-Script Compatibility**: Virtual environment support in `daily_sync.sh`, `update_and_deploy.sh`, and `send_email.py`

### 🔧 **Developer Experience Improvements**

- **Updated Copilot Instructions**: Now recommend virtual environments for dependency management
- **Enhanced Documentation**: Updated `GITHUB_PAGES_DEPLOYMENT.md` with virtual environment setup steps
- **Better Error Handling**: Improved troubleshooting section with environment-specific guidance
- **Automated Setup**: One-command setup for new development environments

### 🚀 **Breaking Changes**

- **Recommended Setup**: New projects should start with `./setup_venv.sh` before running other scripts
- **Dependency Management**: System-level pip installations no longer recommended

## [v2.0.1] - 2024-12-31

### Bug Fixes

- **Enhanced Email Delivery:**  
  Fixed email system to use AppleScript for automatic sending via Mail.app instead of requiring manual intervention. Emails now send automatically without user interaction.

- **Improved Email Reliability:**  
  - AppleScript integration for automatic email sending
  - Multiple fallback methods (notification + file logging)
  - Better error handling and timeout management
  - Gmail delivery issues resolved

- **Email Testing:**  
  Updated `test_email.sh` to properly test the new AppleScript email system

## [v2.0.0] - 2024-12-31

### Major Features - GitHub Pages Deployment & Automation

- **GitHub Pages Hosting:**  
  Complete migration from Render to GitHub Pages for static site hosting. No more credit card requirements or hosting fees.

- **Daily Automation System:**  
  - macOS Launch Agent for true daily automation (8:00 AM + login triggers)
  - Smart deduplication prevents multiple syncs per day
  - Background operation that won't interrupt your work
  - Setup: `./setup_login_agent.sh`, Remove: `./remove_login_agent.sh`

- **Comprehensive Email Notifications:**  
  Three types of detailed email summaries sent to josephjcasey@gmail.com:
  - ✅ SUCCESS: New plays found with hero/villain breakdowns
  - 📊 NO NEW PLAYS: Confirmation when no changes detected  
  - 🔄 ALREADY SYNCED: Status when sync already completed today

- **Multiple Deployment Scripts:**  
  - `update_and_deploy.sh`: Interactive data update + GitHub deployment
  - `quick_deploy.sh`: Deploy current files without data updates
  - `daily_sync.sh`: Automated daily BGG sync with email notifications

- **Enhanced Documentation:**  
  Complete deployment guide with step-by-step instructions in `GITHUB_PAGES_DEPLOYMENT.md`

### Technical Improvements

- **Algolia API Key Management:**  
  Automatic extraction from `.vscode/launch.json` during deployment
- **Python Dependencies:**  
  All BGG sync functionality preserved with local Python execution
- **Backup Systems:**  
  Multiple fallback methods for email delivery and notifications

## [v1.0.0] - 2024-05-09

### Features & Improvements

- **Overlay Redesign:**  
  The statistics overlay is now centered and constrained to 50vw on large screens, with responsive full-width on smaller screens. This provides a cleaner, more focused stats display.

- **Side-by-Side Stats Tables:**  
  Hero and Villain statistics are now displayed in a side-by-side layout for easier comparison.

- **Sticky Table Headers:**  
  Table headers remain visible as you scroll, making it easier to interpret long lists of stats.

- **Bar-Row Visualization Restored:**  
  Each row now includes a two-tone bar:  
  - The total bar width is proportional to the highest number of plays in the table.  
  - The colored segment within the bar represents the number of wins, proportional to the total plays for that row.  
  - This visually communicates both popularity and win rate at a glance.

- **Default Sorting:**  
  Both tables now default to sorting by "Plays" in descending order, showing the most-played heroes and villains at the top.

- **Improved Table Sorting:**  
  Clicking table headers toggles sorting direction and updates the display accordingly.

- **Modal Popups:**  
  Hovering over a hero or villain name shows a modal with detailed matchup stats. Emergency rebuild logic ensures modals always display correct data.

- **Performance & Robustness:**  
  - Caching and fallback logic for modal data.  
  - Defensive code to handle missing or malformed data.  
  - Diagnostic logging for easier debugging.

### Bug Fixes

- Fixed an issue where bar-rows were not visible or did not accurately represent wins/losses.
- Fixed an issue where extra tables could appear after the main stats tables.
- Fixed villain table rendering and modal data population edge cases.
- Fixed overlay and table layout issues on different screen sizes.

## [v2.0.0] - 2025-06-10

### 🚀 Major Features - Deployment Automation & Email System

#### **GitHub Pages Deployment**
- **Static Hosting Setup**: Complete migration to GitHub Pages for free, reliable hosting
- **Automated Deployment Scripts**: 
  - `update_and_deploy.sh` - Interactive data update and deployment
  - `quick_deploy.sh` - Deploy current files without data update
- **Build Configuration**: Optimized static site deployment with proper cache headers

#### **Daily Automation System**
- **macOS Launch Agent**: System-level automation that runs daily at 8:00 AM
- **Smart Scheduling**: Runs on first login if missed morning sync
- **Background Operation**: Non-intrusive automation that doesn't interrupt workflow
- **Setup Scripts**: 
  - `setup_login_agent.sh` - One-click automation setup
  - `remove_login_agent.sh` - Easy removal of automation

#### **Email Notification System**
- **Three Email Types**:
  - **SUCCESS**: New plays found with detailed summaries
  - **NO NEW PLAYS**: Confirmation when no changes detected
  - **ALREADY SYNCED**: Status when sync already completed today
- **Rich Content**: Play details, hero counts, win/loss tracking, collection growth
- **Smart Detection**: Tracks new heroes discovered and play count changes

#### **Enhanced Data Processing**
- **Detailed Play Tracking**: Shows most recent plays with hero, villain, date, and outcome
- **Collection Analytics**: Tracks hero collection growth over time
- **Multi-Hero Filtering**: Intelligent filtering of complex team plays
- **Progress Metrics**: Before/after comparisons for sync operations

### 🔧 Technical Improvements

#### **Deployment Infrastructure**
- **Git Integration**: Automatic commit and push to GitHub Pages
- **Version Control**: All deployment changes tracked in git history
- **Error Handling**: Comprehensive error detection and reporting
- **Logging System**: Multi-level logging (sync, agent, error logs)

#### **Data Sync Enhancements**
- **API Key Management**: Automatic extraction from VSCode launch.json
- **Cache Optimization**: BGG API caching for faster subsequent runs
- **Deduplication Logic**: Prevents unnecessary syncs and API calls
- **Throttling**: Rate limiting to respect BGG API guidelines

#### **Development Tools**
- **Test Scripts**: Email functionality testing with `test_email.sh`
- **Manual Override**: Ability to run sync manually anytime
- **Status Monitoring**: Launch agent status checking commands
- **Backup Systems**: Automatic backup of configuration files

### 📊 Deployment Metrics
- **Hosting Cost**: $0 (GitHub Pages free tier)
- **Sync Frequency**: Daily automatic + manual on-demand
- **Email Delivery**: 100% automated notification system
- **Uptime**: 24/7 static hosting with GitHub's CDN
- **Data Sources**: BoardGameGeek API + Algolia search index

### 🎯 Benefits Delivered
- **Zero-Maintenance**: Set up once, runs automatically forever
- **Complete Transparency**: Email summaries show exactly what changed
- **Professional Hosting**: Fast, reliable GitHub Pages deployment
- **Data Integrity**: Version-controlled data updates with full history
- **Developer Experience**: Simple scripts for all operations

### 📚 Documentation
- **Complete Deployment Guide**: [`GITHUB_PAGES_DEPLOYMENT.md`](GITHUB_PAGES_DEPLOYMENT.md)
- **Copilot Instructions**: Enhanced developer guidelines
- **Setup Procedures**: Step-by-step automation setup
- **Troubleshooting**: Common issues and solutions
