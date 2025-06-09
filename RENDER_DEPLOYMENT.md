# Marvel Champions BGG Statistics Tracker - Render Deployment

## Deployment Overview
This is a static web application that displays Marvel Champions statistics from BoardGameGeek collections using Algolia search. The app includes all necessary JSON data files and static assets.

## Key Files Included in Deployment
- **JSON Data Files** (all automatically included):
  - `hero_images.json` (32KB) - Hero card image URLs and data
  - `villain_images_final.json` (12KB) - Villain card image URLs and data
  - `cached_hero_names.json` (866 bytes) - Cached hero names from BGG
  - `cached_villain_names.json` (1KB) - Cached villain names from BGG
  - `config.json` (380 bytes) - BGG username and Algolia API credentials
  - `package.json` - Node.js package configuration

- **Application Files**:
  - `index.html` - Main application page
  - `index.js` (97KB) - Main application logic with Algolia integration
  - `app.js` (11KB) - Additional application logic
  - `config.js` - Configuration file
  - `style.css` (24KB) - Styling including villain/hero overlays

- **Static Assets**:
  - `favicon.ico`
  - PNG images and overlay images
  - Search-by-Algolia branding

## Render Deployment Steps

### Method 1: GitHub Integration (Recommended)
1. Push your code to a GitHub repository
2. Connect your GitHub account to Render
3. Create a new "Static Site" on Render
4. Select your repository
5. Configure deployment settings:
   - **Build Command**: `chmod +x build.sh && ./build.sh`
   - **Publish Directory**: `.` (root directory)
   - **Environment**: Production

### Method 2: Direct Upload
1. Create a new "Static Site" on Render
2. Upload your project files directly
3. Ensure all JSON files are included in the upload

## Environment Configuration
The app uses the existing `config.json` file which contains:
- BGG username
- Algolia Application ID
- Algolia Search API Key

No additional environment variables are required as credentials are embedded in the config file.

## Build Process
The `build.sh` script is already configured for static deployment:
- No compilation needed (vanilla JavaScript)
- All JSON files are served directly
- Static assets are served as-is

## Verification After Deployment
1. Check that the main page loads at your Render URL
2. Verify that JSON files are accessible:
   - `https://your-app.onrender.com/hero_images.json`
   - `https://your-app.onrender.com/villain_images_final.json`
   - `https://your-app.onrender.com/config.json`
3. Test Algolia search functionality
4. Verify hero and villain image overlays work correctly

## Performance Notes
- All JSON files (47KB total) will be cached appropriately
- Static assets have optimized cache headers
- Algolia handles search performance externally

## Troubleshooting
- If JSON files don't load, check browser developer tools for 404 errors
- If Algolia search fails, verify credentials in `config.json`
- If images don't display, check image URL accessibility

## File Dependencies Confirmed ✅
All required JSON data files are present in the project root and will be automatically included in the Render deployment.
