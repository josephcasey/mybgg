# Marvel Champions BGG Project - Copilot Instructions

## 🎯 **Project Overview**
Marvel Champions BGG Statistics Tracker - A static web application deployed via GitHub Pages with local Python automation for BGG data syncing.

## 💻 **Jo's Development Environment**
- **OS**: macOS Big Sur
- **Python**: Use virtual environments for dependency management
- **Virtual Environment**: `venv` located at `./venv/` in project root
- **Installation**: `pip install ...` within activated virtual environment
- **Activation**: `source venv/bin/activate` before running Python scripts
- **Encoding**: UTF-8 encoding and readable print/logging
- **Testing**: Prefer pytest, flake8 or ruff
- **Terminal**: VSCode terminal usage assumed
- **Dependencies**: Always use virtual environments for Python dependencies

## 📋 **Development Guidelines**

### **File Management:**
- ✅ Keep all test code in separate `copilot-test` directory
- ❌ Do not create new files that supersede existing ones
- ❌ Do not handle any git operations directly
- ✅ Before making edits, confirm adherence to these instructions

### **Documentation Updates:**
- 📝 **ALWAYS update `GITHUB_PAGES_DEPLOYMENT.md`** when making changes to:
  - Deployment scripts (`update_and_deploy.sh`, `daily_sync.sh`, etc.)
  - Automation setup (`setup_login_agent.sh`, `remove_login_agent.sh`)
  - Email functionality or workflow changes
  - New features or configuration changes
  - Any changes that affect the user's deployment experience

### **Project Structure:**
- **Static App**: Hosted on GitHub Pages (HTML/CSS/JS + JSON data)
- **Python Scripts**: Run locally for BGG data collection and Algolia indexing
- **Automation**: macOS Launch Agent for daily syncing
- **Email**: Automated summaries to josephjcasey@gmail.com

## 🔧 **Key Components to Consider**

### **Python Environment:**
- `setup_venv.sh` - Creates and configures virtual environment with all dependencies
- `venv/` directory - Isolated Python environment (automatically used by all scripts)
- Virtual environment activation is handled automatically by deployment scripts

### **Deployment Scripts:**
- `update_and_deploy.sh` - Interactive data update and GitHub deployment
- `quick_deploy.sh` - Deploy current files without data update
- `daily_sync.sh` - Automated daily BGG sync with email notifications

### **Automation:**
- `setup_login_agent.sh` - Creates macOS Launch Agent for daily automation
- `remove_login_agent.sh` - Removes automation
- Launch Agent runs at 8:00 AM daily + on first login after 8 AM

### **Documentation:**
- `GITHUB_PAGES_DEPLOYMENT.md` - **PRIMARY DEPLOYMENT GUIDE** (keep updated!)
- `RENDER_DEPLOYMENT.md` - Legacy Render deployment info
- `release_notes.md` - Project changelog

## 📧 **Email System:**
- Sends daily summaries of BGG sync results
- Three email types: SUCCESS, NO NEW PLAYS, ALREADY SYNCED
- Includes play details, hero counts, and collection growth

## 🚨 **Critical Reminders**
1. **Always update `GITHUB_PAGES_DEPLOYMENT.md`** when modifying deployment workflows
2. **Test email functionality** with `test_email.sh` when changing email features
3. **Preserve existing JSON data files** - they contain user's game statistics
4. **Maintain backward compatibility** with existing automation setup
5. **Document breaking changes** clearly in deployment guide
6. **Use virtual environment** - Run `./setup_venv.sh` for new setups or dependency issues
