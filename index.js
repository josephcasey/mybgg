const searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY);

const search = instantsearch({
    indexName: ALGOLIA_INDEX_NAME,
    searchClient,
    initialUiState: {
        [ALGOLIA_INDEX_NAME]: {
            query: '',
            menu: {
                date: undefined
            },
            configure: {
                filters: 'play_type:solo',
                hitsPerPage: 1000  // Get all hits in one page for stats
            }
        }
    }
});

// Add at the top of the file with other state variables
let isEditing = false;
let currentHeroData = [];
let currentSortState = {
    column: 1, // Default sort by Plays
    asc: false, // Default descending
    sortType: 'number'
};

let currentHeroSortState = {
    column: 1, // Default sort by Plays
    asc: false, // Default descending
    sortType: 'number'
};

let currentVillainData = [];
let currentVillainSortState = {
    column: 1, // Default sort by Plays
    asc: false, // Default descending
    sortType: 'number'
};

let heroImageData = {}; // To store hero image data
let villainImageData = {}; // To store villain image data

// Image data loading state
let imageDataLoaded = false;
let pendingStatsUpdate = null;

// Aspect overlay configuration
const ASPECT_OVERLAY_ENABLED = false; // Toggle to enable/disable aspect overlays (disabled: using CSS overlays instead)
const OVERLAY_IMAGES_PATH = 'overlay_images/'; // Path to overlay images directory

// CSS Overlay Animation Options:
// 'smooth' - Smooth entrance animation with scale effect
// 'hover' - Fade in/out on hover 
// 'gradient' - Gradient overlay with hover intensity change
// 'pulse' - Subtle pulsing effect
// 'static' - No animation, just solid overlay
// 'vivid' - Always visible vivid gradient from left edge fading out
const OVERLAY_ANIMATION_STYLE = 'vivid';

// Manual hero to aspect mapping (same as character_art.py)
const HERO_ASPECT_MAPPING = {
    'spider-man': 'aggression',
    'captain america': 'leadership', 
    'iron man': 'protection',
    'black widow': 'justice',
    'doctor strange': 'justice',
    'hulk': 'aggression',
    'she-hulk': 'aggression',
    'thor': 'aggression',
    'black panther': 'protection',
    'captain marvel': 'leadership',
    'ms. marvel': 'protection',
    'hawkeye': 'leadership',
    'ant-man': 'leadership',
    'wasp': 'aggression',
    'quicksilver': 'protection',
    'scarlet witch': 'justice',
    'groot': 'protection',
    'rocket raccoon': 'aggression',
    'star-lord': 'leadership',
    'gamora': 'aggression',
    'drax': 'protection',
    'venom': 'justice',
    'miles morales': 'justice',
    'ghost-spider': 'justice',
    'spider-woman': 'justice',
    'wolverine': 'aggression',
    'storm': 'leadership',
    'colossus': 'protection',
    'nightcrawler': 'aggression',
    'shadowcat': 'aggression',
    'cyclops': 'leadership',
    'phoenix': 'aggression',
    'rogue': 'protection',
    'gambit': 'aggression',
    'jubilee': 'aggression',
    'cable': 'leadership',
    'domino': 'leadership',
    'deadpool': 'aggression',
    'x-23': 'aggression',
    'magik': 'justice',
    'iceman': 'protection',
    'angel': 'leadership',
    'bishop': 'justice',
    'psylocke': 'aggression',
    'forge': 'leadership'
};

const HERO_ALIASES = {
    'Dr. Strange': 'Doctor Strange',
    'Dr Strange': 'Doctor Strange',
    'Dr. Strange (Stephen Strange)': 'Doctor Strange',
    'Spidey': 'Spider-Man',
    'Spidey (Peter Parker)': 'Spider-Man',
    'Wolvie': 'Wolverine',
    'Rocket Ra': 'Rocket Raccoon',
    'Rocket Rac': 'Rocket Raccoon',
    'Rocket': 'Rocket Raccoon'
};

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveHeroAlias(inputName) {
    if (inputName == null) {
        return { name: '', changed: false };
    }

    const original = String(inputName);
    const trimmed = original.trim();
    if (!trimmed) {
        return { name: '', changed: trimmed !== original };
    }

    const lowered = trimmed.toLowerCase();

    for (const alias in HERO_ALIASES) {
        if (!Object.prototype.hasOwnProperty.call(HERO_ALIASES, alias)) continue;
        if (lowered === alias.toLowerCase()) {
            const canonical = HERO_ALIASES[alias];
            return { name: canonical, changed: canonical !== trimmed };
        }
    }

    for (const alias in HERO_ALIASES) {
        if (!Object.prototype.hasOwnProperty.call(HERO_ALIASES, alias)) continue;
        const canonical = HERO_ALIASES[alias];
        const aliasPattern = new RegExp('^' + escapeRegex(alias) + '\\b', 'i');
        if (aliasPattern.test(trimmed)) {
            const remainder = trimmed.replace(aliasPattern, '').trimStart();
            const combined = remainder ? `${canonical} ${remainder}` : canonical;
            return { name: combined.trim(), changed: true };
        }
    }

    return { name: trimmed, changed: trimmed !== original };
}

function normalizeNameForComparison(name) {
    return name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

function normalizeTeamHeroName(rawName) {
    if (!rawName) return '';

    let working = String(rawName)
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();

    if (!working) return '';

    working = working.replace(/\([^)]*\)/g, '').trim();

    const aliasResult = resolveHeroAlias(working);
    let normalized = aliasResult.name || '';

    if (!normalized) return '';

    normalized = normalized.replace(/\b(Aggression|Leadership|Protection|Justice)\b$/i, '').trim();
    normalized = normalized.replace(/\s{2,}/g, ' ').trim();

    // Title-case words that remain lowercase (skip if alias mapping already provided casing)
    if (normalized === normalized.toLowerCase()) {
        normalized = normalized.split(' ').map(part => {
            if (!part) return part;
            if (part.includes('-')) {
                return part.split('-').map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join('-');
            }
            return part.charAt(0).toUpperCase() + part.slice(1);
        }).join(' ');
    }

    return normalized;
}

// Function to detect aspect from hero name
function detectAspectFromName(heroName) {
    const cleanName = heroName.toLowerCase().trim();
    
    // Strategy 1: Use same aspect detection logic as plays column (exact ending matches)
    const aspects = [
        { name: "aggression", keywords: ["aggression", "agg", "aggressive", "aggressi", "agression"] },
        { name: "leadership", keywords: ["leadership", "lead", "leader", "leaders", "leadersh"] },
        { name: "protection", keywords: ["protection", "protec", "protect", "protectio", "protecti"] },
        { name: "justice", keywords: ["justice", "just", "justicia", "justic", "justi"] }
    ];
    
    // First try exact matches (hero name ends with full aspect name)
    for (const aspect of aspects) {
        if (cleanName.endsWith(aspect.name)) {
            return aspect.name;
        }
    }
    
    // If no exact match, try fuzzy matching (hero name ends with aspect keywords)
    for (const aspect of aspects) {
        for (const keyword of aspect.keywords) {
            if (cleanName.endsWith(keyword.toLowerCase())) {
                return aspect.name;
            }
        }
    }
    
    // Strategy 2: Check manual hero-to-aspect mapping
    if (HERO_ASPECT_MAPPING[cleanName]) {
        return HERO_ASPECT_MAPPING[cleanName];
    }
    
    // Strategy 3: Fallback - check if any words in hero name match mapping keys
    const cleanWords = cleanName.replace('-', ' ').split(' ');
    for (const [mappedHero, aspect] of Object.entries(HERO_ASPECT_MAPPING)) {
        const mappedWords = mappedHero.replace('-', ' ').split(' ');
        if (cleanWords.some(word => mappedWords.includes(word))) {
            return aspect;
        }
    }
    
    return null;
}

// Function to detect villain difficulty from villain name (similar to hero aspect detection)
function detectVillainDifficulty(villainName) {
    const cleanName = villainName.toLowerCase().trim();
    
    // Debug logging for specific problematic case
    if (villainName.includes('Crossbones')) {
        console.log(`DEBUG DIFFICULTY: Testing "${villainName}" -> cleaned: "${cleanName}"`);
    }
    
    // Standard difficulty patterns (easier): names ending in A, A1, 1/2
    const standardPatterns = [
        /\s*\ba\b\s*$/,          // Ends with "A"
        /\s*\ba1\b\s*$/,         // Ends with "A1"
        /\s*\b1\/2\b\s*$/,       // Ends with "1/2"
        /\b1\/2$/,               // Ends with "1/2" (no spaces)
        /1\/2$/,                 // Simple 1/2 pattern without word boundary
        /\s*\(standard\)$/i,     // Ends with "(Standard)"
        /\s*\(easy\)$/i          // Ends with "(Easy)"
    ];
    
    // Expert difficulty patterns (harder): names ending in 2/3, B, B1, C, numbers 2-4
    const expertPatterns = [
        /\s*\bb\b\s*$/,          // Ends with "B"
        /\s*\bb1\b\s*$/,         // Ends with "B1"
        /\s*\bc\b\s*$/,          // Ends with "C"
        /\s*\b2\/3\b\s*$/,       // Ends with "2/3"
        /\b2\/3$/,               // Ends with "2/3" (no spaces)
        /2\/3$/,                 // Simple 2/3 pattern without word boundary
        /\s*\b3\/4\b\s*$/,       // Ends with "3/4"
        /\b3\/4$/,               // Ends with "3/4" (no spaces)
        /3\/4$/,                 // Simple 3/4 pattern without word boundary
        /\s*\b[2-4]\b\s*$/,      // Ends with single digits 2, 3, or 4
        /\s*\(expert\)$/i,       // Ends with "(Expert)"
        /\s*\(heroic\)$/i        // Ends with "(Heroic)"
    ];
    
    // Check for standard difficulty patterns first
    for (const pattern of standardPatterns) {
        if (pattern.test(cleanName)) {
            if (villainName.includes('Crossbones')) {
                console.log(`DEBUG DIFFICULTY: "${villainName}" matched STANDARD pattern: ${pattern}`);
            }
            return 'standard';
        }
    }
    
    // Check for expert difficulty patterns
    for (const pattern of expertPatterns) {
        if (pattern.test(cleanName)) {
            if (villainName.includes('Crossbones')) {
                console.log(`DEBUG DIFFICULTY: "${villainName}" matched EXPERT pattern: ${pattern}`);
            }
            return 'expert';
        }
    }
    
    // Default to standard if no specific indicator found
    return 'standard';
}

// Function to get overlay image URL for a hero (synchronous version)
function getOverlayImageUrl(heroName, originalImageUrl) {
    if (!ASPECT_OVERLAY_ENABLED || !originalImageUrl) {
        return originalImageUrl;
    }
    
    const aspect = detectAspectFromName(heroName);
    if (!aspect) {
        console.log(`No aspect detected for ${heroName}, using original image`);
        return originalImageUrl; // No aspect detected, use original
    }
    
    // Extract base filename from original URL
    const urlParts = originalImageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const baseFilename = filename.split('.')[0];
    
    // Construct overlay image path
    const overlayFilename = `${baseFilename}_${aspect}_overlay.jpg`;
    const overlayUrl = `${OVERLAY_IMAGES_PATH}${overlayFilename}`;
    
    // Check if we've already verified this overlay exists
    if (window.overlayImageCache && window.overlayImageCache[overlayUrl] !== undefined) {
        const useOverlay = window.overlayImageCache[overlayUrl];
        console.log(`${heroName} (${aspect}): ${useOverlay ? 'Using overlay' : 'Using original'} - ${useOverlay ? overlayUrl : originalImageUrl}`);
        return useOverlay ? overlayUrl : originalImageUrl;
    }
    
    // If not cached, return original for now (cache will be populated async)
    console.log(`${heroName} (${aspect}): Cache not ready, using original - ${originalImageUrl}`);
    return originalImageUrl;
}

// Helper function to check if an image exists
function checkImageExists(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = imageUrl;
    });
}

// Function to pre-cache overlay image availability
async function cacheOverlayImages(heroData) {
    console.log('Pre-caching overlay image availability...');
    window.overlayImageCache = window.overlayImageCache || {};
    
    const checkPromises = [];
    
    Object.values(heroData).forEach(hero => {
        if (hero.image) {
            Object.keys(HERO_ASPECT_MAPPING).forEach(heroName => {
                const aspect = HERO_ASPECT_MAPPING[heroName];
                
                // Extract base filename from original URL
                const urlParts = hero.image.split('/');
                const filename = urlParts[urlParts.length - 1];
                const baseFilename = filename.split('.')[0];
                
                // Construct overlay image path
                const overlayFilename = `${baseFilename}_${aspect}_overlay.jpg`;
                const overlayUrl = `${OVERLAY_IMAGES_PATH}${overlayFilename}`;
                
                // Only check if not already cached
                if (window.overlayImageCache[overlayUrl] === undefined) {
                    const promise = checkImageExists(overlayUrl).then(exists => {
                        window.overlayImageCache[overlayUrl] = exists;
                        if (exists) {
                            console.log(`✓ Overlay available: ${overlayFilename}`);
                        }
                    });
                    checkPromises.push(promise);
                }
            });
        }
    });
    
    await Promise.all(checkPromises);
    console.log(`Cached ${Object.keys(window.overlayImageCache).length} overlay image checks`);
}
// Image sizing configuration
const HERO_IMAGE_HEIGHT = 50; // Height in pixels for hero cards
const VILLAIN_IMAGE_HEIGHT = 50; // Height in pixels for villain cards

// Initialize a global map to manage table sort event handlers
if (!window.tableSortHandlers) {
    window.tableSortHandlers = new Map();
}

// Initialize cache for hero-specific villain stats
if (!window.villainStatsCache) {
    window.villainStatsCache = {};
}

// Utility function to escape HTML characters
function escapeHTML(str) {
    str = String(str); // Ensure it's a string
    return str.replace(/[&<>"']/g, function (match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match];
    });
}

// Helper function to format timestamp to YYYY-MM-DD
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'N/A'; // Handle invalid timestamps
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper function to format timestamp to Month'YY (e.g., May'25)
function formatMonthYear(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'N/A';
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${month}'${year}`;
}

// Place this near your other utility functions, outside any function
function isWithinLastMonth(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    if (isNaN(date)) return false;
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(now.getMonth() - 1);
    return date > oneMonthAgo;
}

function formatDayMonthYear(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const day = date.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${day} ${month}'${year}`;
}

// Add configure widget first
search.addWidgets([
    instantsearch.widgets.configure({
        hitsPerPage: 1000,
        distinct: true,
        clickAnalytics: true
    }),
    
    instantsearch.widgets.searchBox({
        container: '#searchbox',
        placeholder: 'Search plays...'
    }),

    instantsearch.widgets.infiniteHits({
        container: '.hits',
        templates: {
            empty: 'No results found.',
            item(hit, { html, components }) {
                // Use custom rendering based on current tab
                return renderHit(hit);
            }
        },
        escapeHTML: false, // Allow custom HTML
        transformItems(items) {
            // Trigger stats update after items are processed
            setTimeout(() => computeStats(items), 0);
            return items;
        },
        cssClasses: {
            root: 'infinite-hits',
            loadMore: 'infinite-hits-loadmore'
        }
    }),

    instantsearch.widgets.menuSelect({
        container: '#time-period',
        attribute: 'date',
        sortBy: ['count:desc'],
        limit: 10,
        templates: {
            item: ({ label, value, count }) => `${label} (${count})`,
            defaultOption: 'All Time'
        }
    }),

    instantsearch.widgets.stats({
        container: '#stats-container',
        templates: {
            text() {
                return '<div class="statistics"><div id="hero-stats-table"></div><div id="villain-stats-table"></div></div>';
            }
        }
    })
]);

// Start the search instance
search.start();

// Initialize image data loading
loadImageData();

// Load image data
async function loadImageData() {
    try {
        console.log('Loading hero image data...');
        const heroResponse = await fetch('hero_images.json');
        heroImageData = await heroResponse.json();
        console.log('Hero image data loaded:', Object.keys(heroImageData).length, 'entries');
        
        console.log('Loading villain image data...');
        const villainResponse = await fetch('villain_images_final.json');
        villainImageData = await villainResponse.json();
        console.log('Villain image data loaded:', Object.keys(villainImageData).length, 'entries');
        
        // Pre-cache overlay images if enabled
        if (ASPECT_OVERLAY_ENABLED) {
            await cacheOverlayImages(heroImageData);
        }
        
        console.log('Image data loading complete');
        imageDataLoaded = true;
        
        // Process any pending stats update
        if (pendingStatsUpdate) {
            console.log('Processing deferred stats update');
            const hits = pendingStatsUpdate;
            pendingStatsUpdate = null;
            computeStats(hits);
        }
    } catch (error) {
        console.error('Error loading image data:', error);
        // Set to empty objects so the app still works without images
        heroImageData = {};
        villainImageData = {};
        imageDataLoaded = true; // Still mark as loaded so app continues to work
        
        // Process any pending stats update even without images
        if (pendingStatsUpdate) {
            console.log('Processing deferred stats update (without images)');
            const hits = pendingStatsUpdate;
            pendingStatsUpdate = null;
            computeStats(hits);
        }
    }
}

/**
 * Computes overall statistics from hit results
 */
function computeStats(hits) {
    console.log('Computing stats for hits:', hits.length);
    
    // If image data hasn't loaded yet, store the hits and wait
    if (!imageDataLoaded) {
        console.log('Image data not loaded yet, deferring stats computation');
        pendingStatsUpdate = hits;
        return;
    }
    
    // Initialize counters and collections
    const heroStats = {};
    const villainStats = {};
    
    // Process each hit to build statistics
    hits.forEach(hit => {
        const hero = hit.hero;
        const villain = hit.villain;
        const win = Boolean(hit.win);
        const hitDateTimestamp = hit.date ? new Date(hit.date).getTime() : 0;

        // Update hero stats
        if (!heroStats[hero]) {
            heroStats[hero] = { name: hero, plays: 0, wins: 0, winRate: 0, lastPlayedDate: 0 };
        }
        heroStats[hero].plays++;
        if (win) {
            heroStats[hero].wins++;
        }
        if (hitDateTimestamp > heroStats[hero].lastPlayedDate) {
            heroStats[hero].lastPlayedDate = hitDateTimestamp;
        }
        
        // Update villain stats
        if (!villainStats[villain]) {
            villainStats[villain] = { name: villain, plays: 0, wins: 0, winRate: 0, lastPlayedDate: 0 };
        }
        villainStats[villain].plays++;
        if (win) {
            villainStats[villain].wins++;
        }
        if (hitDateTimestamp > villainStats[villain].lastPlayedDate) {
            villainStats[villain].lastPlayedDate = hitDateTimestamp;
        }
    });
    
    // Calculate win rates and convert to arrays
    const heroes = Object.values(heroStats).map(h => {
        h.winRate = h.plays > 0 ? Math.round((h.wins / h.plays) * 100) : 0;
        return h;
    });
    
    const villains = Object.values(villainStats).map(v => {
        v.winRate = v.plays > 0 ? Math.round((v.wins / v.plays) * 100) : 0;
        return v;
    });
    
    console.log('Stats computed:', {
        heroCount: heroes.length,
        villainCount: villains.length,
        heroNames: heroes.map(h => h.name)
    });
    
    // Update the display with computed stats
    updateStatsDisplay(heroes, villains, hits);
    
    return { heroes, villains };
}

/**
 * Computes statistics for how a specific villain performed against different heroes
 */
function computeVillainHeroStats(villainName, hits) {
    // Cache check - avoid reprocessing if we've computed this before
    if (window.heroStatsCache?.[villainName]) {
        return window.heroStatsCache[villainName];
    }
    
    console.log(`Computing hero stats for villain: ${villainName}`);
    
    // Filter hits for this villain - use more efficient map/object approach
    const villainHits = hits.filter(hit => hit.villain === villainName);
    console.log(`Found ${villainHits.length} hits for villain ${villainName}`);
    
    // Group by hero using object
    const heroStats = {};
    
    // Process all hits in a single pass
    villainHits.forEach(hit => {
        const hero = hit.hero;
        const win = Boolean(hit.win);
        
        if (!heroStats[hero]) {
            heroStats[hero] = { hero, plays: 0, wins: 0, winRate: 0 };
        }
        
        heroStats[hero].plays++;
        if (win) {
            heroStats[hero].wins++;
        }
    });
    
    // Calculate win rates and convert to array in one step
    const result = Object.values(heroStats).map(h => {
        h.winRate = h.plays > 0 ? Math.round((h.wins / h.plays) * 100) : 0;
        return h;
    }).sort((a, b) => b.plays - a.plays); // Sort by most played heroes
    
    // Cache the results
    if (!window.heroStatsCache) window.heroStatsCache = {};
    window.heroStatsCache[villainName] = result;
    
    return result;
}

/**
 * Computes statistics for how a specific hero performed against different villains
 */
function computeHeroVillainStats(heroName, hits) {
    // Cache check
    if (window.villainStatsCache?.[heroName]) {
        return window.villainStatsCache[heroName];
    }
    console.log(`Computing villain stats for hero: ${heroName}`);

    const heroHits = hits.filter(hit => hit.hero === heroName);
    const villainStats = {};

    heroHits.forEach(hit => {
        const villain = hit.villain;
        const win = Boolean(hit.win); // Hero's win against this villain

        if (!villainStats[villain]) {
            villainStats[villain] = { villain, plays: 0, wins: 0, winRate: 0 };
        }
        villainStats[villain].plays++;
        if (win) {
            villainStats[villain].wins++;
        }
    });

    const result = Object.values(villainStats).map(v => {
        v.winRate = v.plays > 0 ? Math.round((v.wins / v.plays) * 100) : 0;
        return v;
    }).sort((a, b) => b.plays - a.plays); // Sort by most played villains

    if (!window.villainStatsCache) window.villainStatsCache = {};
    window.villainStatsCache[heroName] = result;
    
    console.log(`Computed villain stats for ${heroName}: ${result.length} villains`);
    return result;
}

/**
 * Generates hero stats HTML (rows and modals) based on sort state and all hits
 */
function renderSortedHeroStats(heroes, sortState, allHits) {
    const { column, asc } = sortState;

    console.log(`DEBUG: renderSortedHeroStats called with sortState.column: ${column}, sortState.asc: ${asc} (type: ${typeof asc})`);

    const sorted = [...heroes].sort((a, b) => {
        let aVal, bVal;

        if (column === 0) { // Hero Name
            aVal = a.name;
            bVal = b.name;
        } else if (column === 1) { // Plays
            aVal = a.plays;
            bVal = b.plays;
        } else if (column === 2) { // Wins
            aVal = a.wins;
            bVal = b.wins;
        } else if (column === 3) { // Win %
            aVal = parseFloat(a.winRate);
            bVal = parseFloat(b.winRate);
        } else { // Last Played (column 4)
            aVal = a.lastPlayedDate || 0;
            bVal = b.lastPlayedDate || 0;
        }

        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            if (isNaN(aVal) && !isNaN(bVal)) comparison = -1;
            else if (!isNaN(aVal) && isNaN(bVal)) comparison = 1;
            else if (isNaN(aVal) && isNaN(bVal)) comparison = 0;
            else comparison = aVal - bVal;
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
            comparison = aVal.localeCompare(bVal);
        }
        
        return asc === true ? comparison : -comparison;
    });

    if (sorted.length > 0) {
        console.log('DEBUG: renderSortedHeroStats - First 3 sorted:', sorted.slice(0, 3).map(h => ({ name: h.name, plays: h.plays, wins: h.wins, winRate: h.winRate, lastPlayedDate: formatDate(h.lastPlayedDate) })));
    }
    
    let tableRowsHtml = '';
    let modalsHtml = '';

    sorted.forEach(hero => {
        if (!window.villainStatsCache?.[hero.name]) {
            computeHeroVillainStats(hero.name, allHits);
        }
    });

    const maxPlays = Math.max(...sorted.map(h => h.plays), 1);
    
    sorted.forEach((hero, index) => {
        const safeHeroName = hero.name.replace(/[^a-zA-Z0-9]/g, '');
        const heroModalId = `hero-detail-${index}-${safeHeroName}`;

        // --- MODIFICATION START --- (Aspect removal and alias resolution logic)
        let heroNameForImageLookup = hero.name;
        let heroNameForDisplay = hero.name;
        let detectedAspect = null;
        const originalHeroName = hero.name; // Store original for debugging
        
        // First apply hero aliases to handle nicknames
        const aliasBefore = heroNameForImageLookup;
        const aliasResult = resolveHeroAlias(heroNameForImageLookup);
        if (aliasResult.changed) {
            console.log(`✓ Alias resolved: "${aliasBefore}" → "${aliasResult.name}"`);
        }
        heroNameForImageLookup = aliasResult.name;
        heroNameForDisplay = aliasResult.name;
        
        // Then strip aspects and detect which one was found (with fuzzy matching)
        const aspects = [
            { name: "Aggression", keywords: ["aggression", "agg", "aggressive", "aggressi", "agression"] },
            { name: "Leadership", keywords: ["leadership", "lead", "leader", "leaders", "leadersh"] },
            { name: "Protection", keywords: ["protection", "protec", "protect", "protectio", "protecti"] },
            { name: "Justice", keywords: ["justice", "just", "justicia", "justic", "justi"] }
        ];
        
        // First try exact matches
        for (const aspect of aspects) {
            if (heroNameForImageLookup.endsWith(aspect.name)) {
                detectedAspect = aspect.name;
                const beforeAspectStrip = heroNameForImageLookup;
                heroNameForImageLookup = heroNameForImageLookup.substring(0, heroNameForImageLookup.length - aspect.name.length).trim();
                heroNameForDisplay = heroNameForDisplay.substring(0, heroNameForDisplay.length - aspect.name.length).trim();
                // console.log(`ASPECT: "${beforeAspectStrip}" -> "${heroNameForImageLookup}"`);
                break; 
            }
        }
        
        // If no exact match, try fuzzy matching
        if (!detectedAspect) {
            for (const aspect of aspects) {
                for (const keyword of aspect.keywords) {
                    // Check if hero name ends with this keyword (case insensitive)
                    const heroLower = heroNameForImageLookup.toLowerCase();
                    if (heroLower.endsWith(keyword.toLowerCase())) {
                        detectedAspect = aspect.name;
                        const beforeAspectStrip = heroNameForImageLookup;
                        // Remove the keyword from the end
                        const keywordLength = keyword.length;
                        heroNameForImageLookup = heroNameForImageLookup.substring(0, heroNameForImageLookup.length - keywordLength).trim();
                        heroNameForDisplay = heroNameForDisplay.substring(0, heroNameForDisplay.length - keywordLength).trim();
                        console.log(`FUZZY ASPECT MATCH: "${beforeAspectStrip}" matched "${keyword}" -> "${aspect.name}" -> cleaned: "${heroNameForImageLookup}"`);
                        break;
                    }
                }
                if (detectedAspect) break; // Exit outer loop if we found a match
            }
        }
        
        // Determine aspect color for plays cell
        let aspectColor = 'transparent'; // Default no background
        if (detectedAspect) {
            switch (detectedAspect) {
                case 'Aggression':
                    aspectColor = 'rgb(255, 0, 0)'; // Vivid red - matches overlay
                    break;
                case 'Leadership':
                    aspectColor = 'rgb(0, 100, 255)'; // Vivid blue - matches overlay
                    break;
                case 'Protection':
                    aspectColor = 'rgb(0, 200, 0)'; // Vivid green - matches overlay
                    break;
                case 'Justice':
                    aspectColor = 'rgb(255, 220, 0)'; // Vivid yellow - matches overlay
                    break;
            }
        }
        
        if (originalHeroName !== heroNameForImageLookup) {
            console.log(`FINAL HERO NAME TRANSFORMATION: "${originalHeroName}" -> "${heroNameForImageLookup}"`);
        }
        // --- MODIFICATION END ---

        // Now create the display name using the processed heroNameForDisplay
        let heroNameDisplay = escapeHTML(heroNameForDisplay);

        const heroNameWithAspect = hero.name; 
        let matchedKeyFromImageData = null;

        // --- BEGIN DEBUG LOGGING ---
        // console.log(`Processing hero from stats: "${heroNameWithAspect}"`);
        // if (index === 0 && heroImageData) {
        //     console.log('heroImageData (first hero log):', heroImageData);
        // }
        // --- END DEBUG LOGGING ---

        if (heroImageData) {
            let longestMatchLength = 0;
            for (const keyInImageData in heroImageData) {
                // Use heroNameForImageLookup for matching
                if (heroNameForImageLookup.startsWith(keyInImageData)) { 
                    if (keyInImageData.length > longestMatchLength) {
                        longestMatchLength = keyInImageData.length;
                        matchedKeyFromImageData = keyInImageData;
                    }
                }
            }
        }

        let tdCellStyles = `position: relative; height: ${HERO_IMAGE_HEIGHT}px; min-height: ${HERO_IMAGE_HEIGHT}px; display: table-cell; vertical-align: middle; cursor: pointer;`; // Base styles for the TD
        let imageOverlayHtml = ''; // Will contain the hoverable image overlay

        if (matchedKeyFromImageData) {
            if (heroImageData[matchedKeyFromImageData] && heroImageData[matchedKeyFromImageData].image) {
                const originalImageUrl = heroImageData[matchedKeyFromImageData].image;
                const escapedImageUrl = escapeHTML(originalImageUrl);
                
                // Determine overlay color based on detected aspect (vivid colors for always-visible gradients)
                let overlayColor = 'rgba(0,0,0,0)'; // Default: transparent
                if (detectedAspect) {
                    switch (detectedAspect) {
                        case 'Aggression':
                            overlayColor = 'rgba(255, 0, 0, 0.8)'; // Vivid red
                            break;
                        case 'Leadership':
                            overlayColor = 'rgba(0, 100, 255, 0.8)'; // Vivid blue
                            break;
                        case 'Protection':
                            overlayColor = 'rgba(0, 200, 0, 0.8)'; // Vivid green
                            break;
                        case 'Justice':
                            overlayColor = 'rgba(255, 220, 0, 0.8)'; // Vivid yellow
                            break;
                    }
                }
                
                // Create a hoverable overlay div with configurable CSS transitions
                const overlayClass = `aspect-overlay-${OVERLAY_ANIMATION_STYLE}`;
                const aspectClass = detectedAspect ? `aspect-${detectedAspect.toLowerCase()}` : '';
                imageOverlayHtml = `
                    <div class="hero-image-container ${aspectClass}" style="
                        position: absolute; 
                        top: 0; 
                        left: 0; 
                        right: 0; 
                        bottom: 0; 
                        background-image: url('${escapedImageUrl}'); 
                        background-repeat: no-repeat; 
                        background-size: 100% right; 
                        background-position: 10% 18%;
                        --overlay-color: ${overlayColor};
                        pointer-events: auto;
                    " 
                    onmouseover="showHeroDetail('${heroModalId}');"
                    onmouseout="hideHeroDetail('${heroModalId}', event);"
                    onclick="if(typeof window.handleHeroClick === 'function') window.handleHeroClick('${escapeHTML(hero.name).replace(/'/g, "\\'")}');">
                        <div class="${overlayClass}"></div>
                    </div>`;
            } else {
                console.log(`No image property or null image for matched key "${matchedKeyFromImageData}" (from hero "${heroNameForImageLookup}") in heroImageData. Entry:`, heroImageData[matchedKeyFromImageData]);
            }
        } else {
            console.log(`No matching key found in heroImageData for "${heroNameForImageLookup}".`);
            if (!heroImageData) {
                console.log(`heroImageData is null or undefined when checking for "${heroNameForImageLookup}"`);
            }
        }

        // Highlight last played if within last month
        const lastPlayedRaw = hero.lastPlayedDate;
        const lastPlayedFormatted = formatMonthYear(lastPlayedRaw); // changed from formatDate
        const lastPlayedTooltip = formatDayMonthYear(lastPlayedRaw);
        const highlightLastPlayed = isWithinLastMonth(lastPlayedRaw)
            ? ' style="color: red;"'
            : '';

        tableRowsHtml += `
            <tr class="hero-row">
                <td class="hero-name" style="${tdCellStyles} padding: 8px;">
                    ${imageOverlayHtml}
                    <span style="font-weight: bold; color: rgba(255, 255, 255, 0.6); text-shadow: 1px 1px 3px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.7); position: absolute; bottom: 0; left: 0; z-index: 2; pointer-events: none; font-size: 0.9em; background-color: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 0 3px 0 0;">${heroNameDisplay}</span>
                </td>
                <td class="number-col" style="background: linear-gradient(to right, ${aspectColor} 0%, white 100%);">${hero.plays}</td>
                <td class="number-col">${hero.wins}</td>
                <td class="number-col">${hero.winRate}%</td>
                <td class="date-col"${highlightLastPlayed} data-timestamp="${lastPlayedRaw}" title="${lastPlayedTooltip}">${lastPlayedFormatted}</td>
            </tr>
            <tr class="bar-row">
                <td colspan="5">
                    <div style="position:relative;height:8px;background:transparent;width:100%;">
                        <div style="height:8px;background:#b3c6ff;width:${(hero.plays / maxPlays) * 100}%;border-radius:4px;position:relative;">
                            <div style="height:8px;background:#3366cc;width:${(hero.plays > 0 ? (hero.wins / hero.plays) * 100 : 0)}%;border-radius:4px;"></div>
                        </div>
                    </div>
                </td>
            </tr>
        `;

        const villainStatsForHero = window.villainStatsCache[hero.name] || [];
        let villainRowsHtml = '';
        if (villainStatsForHero.length > 0) {
            villainRowsHtml = villainStatsForHero.map(vStat => `
                <tr style="background-color: white; border-bottom: 1px solid #dddddd;">
                    <td style="padding: 8px; text-align: left; color: black; border: 1px solid #eeeeee;">${escapeHTML(vStat.villain) || 'Unknown'}</td>
                    <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${vStat.plays || 0}</td>
                    <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${vStat.wins || 0}</td>
                    <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${vStat.winRate || 0}%</td>
                </tr>
            `).join('');
        } else {
            villainRowsHtml = `
                <tr style="background-color: white;">
                    <td colspan="4" style="padding: 15px; text-align: center; color: black;">
                        No villain data available for this hero (${escapeHTML(hero.name)})
                    </td>
                </tr>
            `;
        }

        modalsHtml += `
        <div id="${heroModalId}" class="hero-modal" data-hero-name="${escapeHTML(hero.name)}" style="
            display: none; 
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: transparent;
            z-index: 10000;
            pointer-events: none;
        ">
            <div class="hero-modal-content" style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: white;
                border: 2px solid #0000aa; 
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                min-width: 350px;
                max-width: min(600px, 80vw);
                max-height: 90%;
                overflow: auto;
                pointer-events: auto;
                color: black;
            ">
                <div class="hero-modal-header" style="background-color: #e0e8ff; padding: 10px; margin-bottom: 10px; border-bottom: 1px solid #0000aa; border-radius: 5px;">
                    <h3 style="margin: 0; color: black; font-size: 18px; font-weight: bold; text-align: center; word-wrap: break-word; overflow-wrap: anywhere; white-space: normal; line-height: 1.3; max-width: 25ch; margin-left: auto; margin-right: auto; hyphens: auto;">VILLAINS FACED BY ${escapeHTML(hero.name).toUpperCase()}</h3>
                </div>
                <div class="hero-modal-body" style="padding: 10px; background-color: white;">
                    <div class="table-container">
                        <table class="hero-villains-table" style="width: 100%; border-collapse: collapse;">
                            <thead style="background-color: #cccccc;">
                                <tr>
                                    <th style="padding: 8px; text-align: left; color: black; border: 1px solid #cccccc; font-weight: bold;">Villain</th>
                                    <th style="padding: 8px; text-align: right; color: black; border: 1px solid #cccccc; font-weight: bold;">Plays</th>
                                    <th style="padding: 8px; text-align: right; color: black; border: 1px solid #cccccc; font-weight: bold;">Hero Wins</th>
                                    <th style="padding: 8px; text-align: right; color: black; border: 1px solid #cccccc; font-weight: bold;">Hero Win %</th>
                                </tr>
                            </thead>
                            <tbody>${villainRowsHtml}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>`;
    });
    
    return { tableRowsHtml, modalsHtml };
}

function renderSortedVillainStats(villains, sortState, allHits) {
    const { column, asc } = sortState;

    console.log(`DEBUG: renderSortedVillainStats called with sortState.column: ${column}, sortState.asc: ${asc} (type: ${typeof asc})`);
    
    window.heroStatsCache = window.heroStatsCache || {};
    
    const sorted = [...villains].sort((a, b) => {
        let aVal, bVal;

        if (column === 0) { // Villain Name
            aVal = a.name;
            bVal = b.name;
        } else if (column === 1) { // Plays
            aVal = a.plays;
            bVal = b.plays;
        } else if (column === 2) { // Hero Wins
            aVal = a.wins;
            bVal = b.wins;
        } else if (column === 3) { // Win % (Hero Win % against Villain)
            aVal = parseFloat(a.winRate);
            bVal = parseFloat(b.winRate);
        } else { // Last Played (column 4)
            aVal = a.lastPlayedDate || 0;
            bVal = b.lastPlayedDate || 0;
        }

        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            if (isNaN(aVal) && !isNaN(bVal)) comparison = -1;
            else if (!isNaN(aVal) && isNaN(bVal)) comparison = 1;
            else if (isNaN(aVal) && isNaN(bVal)) comparison = 0;
            else comparison = aVal - bVal;
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
            comparison = aVal.localeCompare(bVal);
        }
        
        return asc === true ? comparison : -comparison;
    });

    if (sorted.length > 0) {
        console.log('DEBUG: renderSortedVillainStats - First 3 sorted:', sorted.slice(0, 3).map(v => ({ name: v.name, plays: v.plays, wins: v.wins, winRate: v.winRate, lastPlayedDate: formatDate(v.lastPlayedDate) })));
    }

    let tableRowsHtml = '';
    let modalsHtml = '';

    for (const villain of sorted) {
        const villainName = villain.name;
        if (!window.heroStatsCache[villainName]) {
            try {
                computeVillainHeroStats(villainName, allHits);
            } catch (e) {
                console.error(`Failed to compute stats for ${villainName}:`, e);
                window.heroStatsCache[villainName] = [];
            }
        }
    }
    const maxPlays = Math.max(...sorted.map(v => v.plays), 1);

    // Helper function to check if date is within the last month
    function isWithinLastMonth(dateString) {
        if (!dateString) return false;
        const date = new Date(dateString);
        if (isNaN(date)) return false;
        const now = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return date > oneMonthAgo;
    }

    sorted.forEach((villain, index) => {
        const safeVillainName = villain.name.replace(/[^a-zA-Z0-9]/g, '');
        const villainId = `villain-${index}-${safeVillainName}`;
        
        // Process villain name for image lookup (remove difficulty indicators)
        let villainNameForImageLookup = villain.name;
        let villainNameForDisplay = villain.name;
        const originalVillainName = villain.name;
        
        // Remove difficulty indicators like "1/2", "A", "B", "C", "(Expert)", "(Heroic)", etc.
        const difficultyPatterns = [
            /\s*\(Expert\)$/i,
            /\s*\(Heroic\)$/i,
            /\s*\(Standard\)$/i,
            /\s*\(Easy\)$/i,
            /\s*\b[ABC]\b\s*$/,     // Difficulty levels A, B, C
            /\s*\b1\/2\b\s*$/,      // Difficulty 1/2 with spaces
            /\b1\/2$/,              // Difficulty 1/2 without spaces
            /\s*\b2\/3\b\s*$/,      // Difficulty 2/3 with spaces
            /\b2\/3$/,              // Difficulty 2/3 without spaces
            /\s*\b3\/4\b\s*$/,      // Difficulty 3/4 with spaces
            /\b3\/4$/,              // Difficulty 3/4 without spaces
            /\s*\b\d\b\s*$/         // Single digit difficulty
        ];
        
        for (const pattern of difficultyPatterns) {
            if (pattern.test(villainNameForImageLookup)) {
                villainNameForImageLookup = villainNameForImageLookup.replace(pattern, '').trim();
                villainNameForDisplay = villainNameForDisplay.replace(pattern, '').trim();
                console.log(`VILLAIN DIFFICULTY STRIPPED: "${originalVillainName}" -> "${villainNameForImageLookup}"`);
                break;
            }
        }
        
        // Debug logging for first few villains
        if (index < 3) {
            console.log(`DEBUG VILLAIN ${index}: Processing "${originalVillainName}" -> lookup: "${villainNameForImageLookup}"`);
            if (villainImageData) {
                console.log(`DEBUG VILLAIN ${index}: Available villain image keys:`, Object.keys(villainImageData).slice(0, 5));
            }
        }
        
        // Find matching villain image
        let matchedKeyFromImageData = null;
        
        if (villainImageData) {
            let longestMatchLength = 0;
            
            // First try exact match with original name (for cases where the original name exactly matches)
            if (villainImageData[originalVillainName]) {
                matchedKeyFromImageData = originalVillainName;
                longestMatchLength = originalVillainName.length;
            }
            
            // Then try fuzzy matching with processed name
            for (const keyInImageData in villainImageData) {
                // Check if the processed villain name matches the beginning of any key in image data
                if (villainNameForImageLookup && keyInImageData.startsWith(villainNameForImageLookup)) {
                    if (keyInImageData.length > longestMatchLength) {
                        longestMatchLength = keyInImageData.length;
                        matchedKeyFromImageData = keyInImageData;
                    }
                }
                // Also check reverse: if the image data key (without difficulty) matches our processed name
                let imageKeyProcessed = keyInImageData;
                for (const pattern of difficultyPatterns) {
                    if (pattern.test(imageKeyProcessed)) {
                        imageKeyProcessed = imageKeyProcessed.replace(pattern, '').trim();
                        break;
                    }
                }
                if (imageKeyProcessed === villainNameForImageLookup && keyInImageData.length > longestMatchLength) {
                    longestMatchLength = keyInImageData.length;
                    matchedKeyFromImageData = keyInImageData;
                }
            }
            
            // Debug logging for matches
            if (index < 3) {
                console.log(`DEBUG VILLAIN ${index}: Matching result for "${originalVillainName}" (lookup: "${villainNameForImageLookup}"): ${matchedKeyFromImageData || 'NO_MATCH'}`);
            }
        }
        
        // Detect villain difficulty first (before generating image overlay)
        const detectedDifficulty = detectVillainDifficulty(villain.name);
        
        let tdCellStyles = `position: relative; height: ${VILLAIN_IMAGE_HEIGHT}px; min-height: ${VILLAIN_IMAGE_HEIGHT}px; display: table-cell; vertical-align: middle; cursor: pointer;`;
        let imageOverlayHtml = '';
        
        if (matchedKeyFromImageData) {
            if (villainImageData[matchedKeyFromImageData] && villainImageData[matchedKeyFromImageData].image) {
                const imageUrl = escapeHTML(villainImageData[matchedKeyFromImageData].image);
                console.log(`✅ VILLAIN IMAGE MATCH: "${originalVillainName}" matched "${matchedKeyFromImageData}" -> ${imageUrl}`);
                imageOverlayHtml = `
                    <div class="villain-image-container difficulty-${detectedDifficulty}" style="
                        position: absolute; 
                        top: 0; 
                        left: 0; 
                        right: 0; 
                        bottom: 0; 
                        background-image: url('${imageUrl}');
                        background-repeat: no-repeat; 
                        background-size: 110% auto; 
                        background-position: 10% 18%;
                        cursor: pointer;
                        z-index: 1;
                        pointer-events: auto;
                    " 
                    onmouseover="showVillainDetail('${villainId}', event);"
                    onmouseout="hideVillainDetail('${villainId}', event);"
                    onclick="if(typeof window.handleVillainClick === 'function') window.handleVillainClick('${escapeHTML(villain.name).replace(/'/g, "\\'")}');">
                        <div class="villain-overlay-vivid"></div>
                    </div>`;
            } else {
                console.log(`❌ No image property or null image for matched key "${matchedKeyFromImageData}" (from villain "${villainNameForImageLookup}") in villainImageData.`);
            }
        } else {
            console.log(`❌ No matching key found in villainImageData for "${villainNameForImageLookup}" (original: "${originalVillainName}").`);
            if (!villainImageData) {
                console.log(`❌ villainImageData is null or undefined when checking for "${villainNameForImageLookup}"`);
            }
        }
        
        const lastPlayedRaw = villain.lastPlayedDate;
        const lastPlayedFormatted = formatMonthYear(lastPlayedRaw);
        const lastPlayedTooltip = formatDayMonthYear(lastPlayedRaw);
        const highlightLastPlayed = isWithinLastMonth(lastPlayedRaw)
            ? ' style="color: red;"'
            : '';

        // Determine color for plays cell based on already detected difficulty
        let difficultyColor = 'rgb(0, 0, 0)'; // Default black
        if (detectedDifficulty === 'standard') {
            difficultyColor = 'rgb(0, 0, 0)'; // Black for Standard difficulty
        } else if (detectedDifficulty === 'expert') {
            difficultyColor = 'rgb(255, 0, 0)'; // Aggression red for Expert difficulty
        }

        tableRowsHtml += `
            <tr class="villain-row">
                <td class="villain-name" style="${tdCellStyles} padding: 8px;">
                    ${imageOverlayHtml}
                    <span style="font-weight: bold; color: rgba(255, 255, 255, 0.6); text-shadow: 1px 1px 3px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.7); position: absolute; bottom: 0; left: 0; z-index: 2; pointer-events: none; font-size: 0.9em; background-color: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 0 3px 0 0;">${escapeHTML(villainNameForDisplay)}</span>
                </td>
                <td class="number-col" style="background: linear-gradient(to right, ${difficultyColor} 0%, white 100%);">${villain.plays}</td>
                <td class="number-col">${villain.wins}</td>
                <td class="number-col win-rate-col">${villain.winRate}%</td>
                <td class="date-col"${highlightLastPlayed} data-timestamp="${lastPlayedRaw}" title="${lastPlayedTooltip}">${lastPlayedFormatted}</td>
            </tr>
            <tr class="bar-row">
                <td colspan="5">
                    <div style="position:relative;height:8px;background:transparent;width:100%;">
                        <div style="height:8px;background:#ffd6b3;width:${(villain.plays / maxPlays) * 100}%;border-radius:4px;position:relative;">
                            <div style="height:8px;background:#ff6600;width:${(villain.plays > 0 ? (villain.wins / villain.plays) * 100 : 0)}%;border-radius:4px;"></div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
        
        const heroStats = window.heroStatsCache[villain.name] || [];
        let heroRowsHtml = '';
        if (heroStats && heroStats.length > 0) {
            heroRowsHtml = heroStats.map(h => `
                <tr style="background-color: white; border-bottom: 1px solid #dddddd;">
                    <td style="padding: 8px; text-align: left; color: black; border: 1px solid #eeeeee;">${escapeHTML(h.hero) || 'Unknown'}</td>
                    <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.plays || 0}</td>
                    <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.wins || 0}</td>
                    <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.winRate || 0}%</td>
                </tr>
            `).join('');
        } else {
            heroRowsHtml = `
                <tr style="background-color: white;">
                    <td colspan="4" style="padding: 15px; text-align: center; color: black;">
                        No hero data available for this villain (${escapeHTML(villain.name)})
                    </td>
                </tr>
            `;
        }
        modalsHtml += `
        <div id="${villainId}" class="villain-modal" data-villain-name="${escapeHTML(villain.name)}" style="
            display: none; 
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: transparent;
            z-index: 10000;
            pointer-events: none;
        ">
            <div class="villain-modal-content" style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: white;
                border: 2px solid #990000;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                min-width: 350px;
                max-width: min(600px, 80vw);
                max-height: 90%;
                overflow: auto;
                pointer-events: auto;
                color: black;
            ">
                <div class="villain-modal-header" style="background-color: #ffe0e0; padding: 10px; margin-bottom: 10px; border-bottom: 1px solid #990000; border-radius: 5px;">
                     <h3 style="margin: 0; color: black; font-size: 18px; font-weight: bold; text-align: center; word-wrap: break-word; overflow-wrap: anywhere; white-space: normal; line-height: 1.3; max-width: 25ch; margin-left: auto; margin-right: auto; hyphens: auto;">HEROES FACED BY ${escapeHTML(villain.name).toUpperCase()}</h3>
                </div>
                <div class="villain-modal-body" style="padding: 10px; background-color: white;">
                    <div class="table-container">
                        <table class="villain-heroes-table" style="width: 100%; border-collapse: collapse;">
                            <thead style="background-color: #cccccc;">
                                <tr>
                                    <th style="padding: 8px; text-align: left; color: black; border: 1px solid #cccccc; font-weight: bold;">Hero</th>
                                    <th style="padding: 8px; text-align: right; color: black; border: 1px solid #cccccc; font-weight: bold;">Plays</th>
                                    <th style="padding: 8px; text-align: right; color: black; border: 1px solid #cccccc; font-weight: bold;">Wins</th>
                                    <th style="padding: 8px; text-align: right; color: black; border: 1px solid #cccccc; font-weight: bold;">Win%</th>
                                </tr>
                            </thead>
                            <tbody>${heroRowsHtml}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>`;        
    });
    return { tableRowsHtml, modalsHtml };
}

/**
 * Updates the stats display based on current tab and computed data
 */
function updateStatsDisplay(heroes, villains, allHits) {
    const heroTableContainer = document.getElementById('hero-stats-table');
    const villainTableContainer = document.getElementById('villain-stats-table');
    
    if (!heroTableContainer || !villainTableContainer) {
        console.log('Stats containers not found, will try again later');
        return;
    }

    if (currentTab === 'solo') {
        // Show solo hero stats
        displayHeroStats(heroes, allHits);
        displayVillainStats(villains, allHits);
    } else if (currentTab === 'team') {
        // Show team stats (for now, aggregate team data into hero-like format)
        displayTeamStats(allHits);
        displayVillainStats(villains, allHits);
    }
}

/**
 * Display hero statistics table
 */
function displayHeroStats(heroes, allHits) {
    const container = document.getElementById('hero-stats-table');
    if (!container) return;

    if (heroes.length === 0) {
        container.innerHTML = '<p>No hero data available</p>';
        return;
    }

    // Generate hero table
    const { tableRowsHtml, modalsHtml } = renderSortedHeroStats(heroes, currentHeroSortState, allHits);
    
    container.innerHTML = `
        <div>
            <h3>Hero Statistics</h3>
            <div class="table-container">
                <table class="stats-table hero-stats">
                    <thead>
                        <tr>
                            <th class="hero-col sortable" data-column="0" data-sort-type="string">Hero</th>
                            <th class="number-col sortable" data-column="1" data-sort-type="number">Plays</th>
                            <th class="number-col sortable" data-column="2" data-sort-type="number">Wins</th>
                            <th class="number-col sortable" data-column="3" data-sort-type="number">Win %</th>
                            <th class="date-col sortable" data-column="4" data-sort-type="date">Last Played</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
        ${modalsHtml}
    `;
    
    // Reinitialize table sorting
    initTableSort();
}

/**
 * Display villain statistics table
 */
function displayVillainStats(villains, allHits) {
    const container = document.getElementById('villain-stats-table');
    if (!container) return;

    if (villains.length === 0) {
        container.innerHTML = '<p>No villain data available</p>';
        return;
    }

    // Generate villain table
    const { tableRowsHtml, modalsHtml } = renderSortedVillainStats(villains, currentVillainSortState, allHits);
    
    container.innerHTML = `
        <div>
            <h3>Villain Statistics</h3>
            <div class="table-container">
                <table class="stats-table villain-stats">
                    <thead>
                        <tr>
                            <th class="villain-col sortable" data-column="0" data-sort-type="string">Villain</th>
                            <th class="number-col sortable" data-column="1" data-sort-type="number">Plays</th>
                            <th class="number-col sortable" data-column="2" data-sort-type="number">Hero Wins</th>
                            <th class="number-col sortable" data-column="3" data-sort-type="number">Hero Win %</th>
                            <th class="date-col sortable" data-column="4" data-sort-type="date">Last Played</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
        ${modalsHtml}
    `;
    
    // Reinitialize table sorting
    initTableSort();
}

/**
 * Display team statistics (aggregated team compositions)
 */
function displayTeamStats(allHits) {
    const container = document.getElementById('hero-stats-table');
    if (!container) return;

    console.log('📊 displayTeamStats called with', allHits.length, 'hits');
    
    // Filter to only team plays
    const teamHits = filterTeamPlays(allHits);
    
    if (teamHits.length === 0) {
        console.log('❌ No team plays found');
        container.innerHTML = `
            <div>
                <h3>Team Statistics</h3>
                <p>No team data available. Team games should have team_composition field with multiple heroes.</p>
                <p><strong>Debug Info:</strong></p>
                <ul>
                    <li>Total plays checked: ${allHits.length}</li>
                    <li>Team plays found: ${teamHits.length}</li>
                    <li>Looking for format: "Hero1 + Hero2" or similar</li>
                </ul>
            </div>
        `;
        return;
    }

    // Group hits by team composition
    const teamStats = {};
    
    teamHits.forEach(hit => {
        const parsedHeroes = parseTeamComposition(hit);
        const displayHeroes = parsedHeroes.slice(0, 2);
        const heroList = displayHeroes.length > 0 ? [...displayHeroes] : [];
        while (heroList.length < 2) {
            heroList.push('');
        }

        const fallbackTeamName = (() => {
            if (typeof hit.team_composition === 'string' && hit.team_composition.trim()) {
                return hit.team_composition.trim();
            }
            if (Array.isArray(hit.team_composition) && hit.team_composition.length > 0) {
                const normalized = hit.team_composition
                    .map(normalizeTeamHeroName)
                    .filter(Boolean);
                if (normalized.length > 0) {
                    return normalized.join(' + ');
                }
                return hit.team_composition.map(part => String(part).trim()).filter(Boolean).join(' + ');
            }
            if (displayHeroes.length > 0) {
                return displayHeroes.join(' + ');
            }
            const fallbackFromHeroFields = [hit.hero1, hit.hero2, hit.hero]
                .map(normalizeTeamHeroName)
                .filter(Boolean);
            if (fallbackFromHeroFields.length > 0) {
                return fallbackFromHeroFields.join(' + ');
            }
            return hit.id ? `Team ${hit.id}` : 'Unknown Team';
        })();

        const displayHeroNames = displayHeroes.filter(Boolean);
        const teamName = displayHeroNames.length >= 2
            ? displayHeroNames.join(' + ')
            : fallbackTeamName;

        if (!teamStats[teamName]) {
            teamStats[teamName] = {
                name: teamName,
                plays: 0,
                wins: 0,
                winRate: 0,
                lastPlayedDate: 0,
                heroes: heroList
            };
        } else if (!teamStats[teamName].heroes || teamStats[teamName].heroes.every(hero => !hero)) {
            teamStats[teamName].heroes = heroList;
        }

        teamStats[teamName].plays++;
        if (hit.win) {
            teamStats[teamName].wins++;
        }
        
        const hitDate = hit.date ? new Date(hit.date).getTime() : 0;
        if (hitDate > teamStats[teamName].lastPlayedDate) {
            teamStats[teamName].lastPlayedDate = hitDate;
        }
    });
    
    // Calculate win rates and convert to array
    const teams = Object.values(teamStats).map(team => {
        team.winRate = team.plays > 0 ? Math.round((team.wins / team.plays) * 100) : 0;
        return team;
    });
    
    console.log('🎯 Team stats calculated:', teams.length, 'teams');
    
    // Sort teams by plays (descending)
    teams.sort((a, b) => b.plays - a.plays);
    
    // Generate team table rows with hero images
    const tableRowsHtml = teams.map((team, index) => {
        const lastPlayedFormatted = formatMonthYear(team.lastPlayedDate);
        const lastPlayedTooltip = formatDayMonthYear(team.lastPlayedDate);
        const highlightLastPlayed = isWithinLastMonth(team.lastPlayedDate) ? ' style="color: red;"' : '';
        
        // Generate hero image cells
        const hero1Html = generateHeroImageCell(team.heroes[0] || '', 0);
        const hero2Html = generateHeroImageCell(team.heroes[1] || '', 1);
        
        return `
            <tr class="team-row">
                <td class="hero-cell" style="padding: 4px; width: 80px;">
                    ${hero1Html}
                </td>
                <td class="hero-cell" style="padding: 4px; width: 80px;">
                    ${hero2Html}
                </td>
                <td class="number-col">${team.plays}</td>
                <td class="number-col">${team.wins}</td>
                <td class="number-col">${team.winRate}%</td>
                <td class="date-col"${highlightLastPlayed} data-timestamp="${team.lastPlayedDate}" title="${lastPlayedTooltip}">${lastPlayedFormatted}</td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = `
        <div>
            <h3>Team Statistics</h3>
            <div class="table-container">
                <table class="stats-table team-stats">
                    <thead>
                        <tr>
                            <th class="hero-col" style="width: 80px;">Hero 1</th>
                            <th class="hero-col" style="width: 80px;">Hero 2</th>
                            <th class="number-col sortable" data-column="2" data-sort-type="number">Plays</th>
                            <th class="number-col sortable" data-column="3" data-sort-type="number">Wins</th>
                            <th class="number-col sortable" data-column="4" data-sort-type="number">Win %</th>
                            <th class="date-col sortable" data-column="5" data-sort-type="date">Last Played</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    console.log('✅ Team stats table rendered with', teams.length, 'teams');
}

// Filter team plays function
function filterTeamPlays(allHits) {
    console.log('🔍 filterTeamPlays: Starting with', allHits.length, 'total hits');
    const debugTeamCompSamples = [];

    const teamPlays = allHits.filter(hit => {
        const teamComp = hit.team_composition;
        
        // Debug individual record - coerce id to string before searching to avoid TypeError
        if (hit.id != null) {
            const idStr = String(hit.id);
            if (idStr.includes('11') || idStr.includes('12')) { // Sample a few records
                console.log('🔍 Sample hit:', {
                    id: hit.id,
                    team_composition: teamComp,
                    hasTeamComp: !!teamComp,
                    type: typeof teamComp
                });
            }
        }
        
        if (debugTeamCompSamples.length < 10) {
            debugTeamCompSamples.push({
                id: hit.id,
                team_composition: teamComp,
                team_comp_type: typeof teamComp,
                play_type: hit.play_type,
                hero: hit.hero,
                hero1: hit.hero1,
                hero2: hit.hero2,
                heroes: hit.heroes,
                participants: hit.participants
            });
        }

        // Check if team_composition exists and has content
        if (!teamComp) return false;
        
        // If it's a string, check if it contains multiple heroes (commas or semicolons)
        if (typeof teamComp === 'string') {
            const trimmed = teamComp.trim();
            if (!trimmed) return false;
            
            // Normalize separator characters and look for separators that indicate multiple heroes
            // Common separators: comma, semicolon, plus, ampersand, 'and', fullwidth slash, forward slash
            const normalized = trimmed.replace(/\uFF0F/g, '/') // fullwidth slash to regular
                                     .replace(/\s*\+\s*/g, '+')
                                     .replace(/\s*&\s*/g, '&')
                                     .replace(/\s+and\s+/ig, ' and ');

            const hasMultipleHeroes = normalized.includes(',') ||
                                     normalized.includes(';') ||
                                     normalized.includes(' and ') ||
                                     normalized.includes(' & ') ||
                                     normalized.includes('+') ||
                                     normalized.includes('/');
            
            return hasMultipleHeroes;
        }
        
        // If it's an array, check if it has multiple elements
        if (Array.isArray(teamComp)) {
            return teamComp.length > 1;
        }
        
        return false;
    });
    
    console.log('🔍 filterTeamPlays: Found', teamPlays.length, 'team plays out of', allHits.length, 'total');
    if (debugTeamCompSamples.length > 0) {
        console.log('🔍 Sample team_composition values:', debugTeamCompSamples);
    } else {
        console.log('🔍 No hits with team_composition captured in samples.');
    }
    
    // Sample some team plays for debugging
    if (teamPlays.length > 0) {
        console.log('🔍 Sample team plays:', teamPlays.slice(0, 3).map(hit => ({
            id: hit.id,
            team_composition: hit.team_composition,
            hero1: hit.hero1,
            hero2: hit.hero2
        })));
    }
    
    return teamPlays;
}

function parseTeamComposition(hit) {
    if (!hit) return [];

    const names = [];
    const seen = new Set();
    const addName = candidate => {
        if (!candidate) return;
        const normalized = normalizeTeamHeroName(candidate);
        if (!normalized) return;
        const key = normalizeNameForComparison(normalized);
        if (!key || seen.has(key)) return;
        seen.add(key);
        names.push(normalized);
    };

    const teamComp = hit.team_composition;

    if (Array.isArray(teamComp)) {
        teamComp.forEach(addName);
    } else if (typeof teamComp === 'string') {
        const cleaned = teamComp.replace(/&amp;/gi, '&').trim();
        if (cleaned) {
            const segments = cleaned.split(/\s*(?:\+|&|\/|,|;|\band\b)\s*/i).filter(Boolean);
            if (segments.length > 0) {
                segments.forEach(addName);
            } else {
                addName(cleaned);
            }
        }
    } else if (teamComp && typeof teamComp === 'object') {
        if (Array.isArray(teamComp.names)) {
            teamComp.names.forEach(addName);
        } else if (teamComp.name) {
            addName(teamComp.name);
        }
    }

    if (Array.isArray(hit.heroes)) {
        hit.heroes.forEach(entry => {
            if (typeof entry === 'string') {
                addName(entry);
            } else if (entry && typeof entry === 'object') {
                addName(entry.name || entry.hero || entry.alias);
            }
        });
    }

    addName(hit.hero1);
    addName(hit.hero2);
    addName(hit.hero3);
    addName(hit.hero);

    if (Array.isArray(hit.participants)) {
        hit.participants.forEach(addName);
    } else if (typeof hit.participants === 'string') {
        hit.participants.split(/\s*(?:,|;|\/|\+|&|\band\b)\s*/i).forEach(addName);
    }

    return names;
}

function findHeroImageKey(heroName) {
    if (!heroName || !heroImageData) return null;

    const target = normalizeNameForComparison(heroName);
    if (!target) return null;

    let bestMatch = null;
    let bestScore = 0;

    for (const key in heroImageData) {
        if (!Object.prototype.hasOwnProperty.call(heroImageData, key)) continue;
        const normalizedKey = normalizeNameForComparison(key);
        if (!normalizedKey) continue;

        if (normalizedKey === target) {
            return key;
        }

        if (target.startsWith(normalizedKey) || normalizedKey.startsWith(target)) {
            if (normalizedKey.length > bestScore) {
                bestScore = normalizedKey.length;
                bestMatch = key;
            }
        }
    }

    return bestMatch;
}

function generateHeroImageCell(heroName, slotIndex) {
    const positionLabel = slotIndex + 1;

    if (!heroName) {
        return `
            <div class="team-hero-card team-hero-card--empty" style="position: relative; width: 72px; height: ${HERO_IMAGE_HEIGHT}px; border-radius: 6px; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.6); font-size: 0.65rem;">
                Hero ${positionLabel}
            </div>
        `;
    }

    let normalizedHero = normalizeTeamHeroName(heroName);
    if (!normalizedHero) {
        normalizedHero = String(heroName).trim();
    }

    if (!normalizedHero) {
        return `
            <div class="team-hero-card team-hero-card--empty" style="position: relative; width: 72px; height: ${HERO_IMAGE_HEIGHT}px; border-radius: 6px; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.6); font-size: 0.65rem;">
                Hero ${positionLabel}
            </div>
        `;
    }

    const displayName = escapeHTML(normalizedHero);
    const imageKey = findHeroImageKey(normalizedHero);

    if (imageKey && heroImageData && heroImageData[imageKey] && heroImageData[imageKey].image) {
        const imageUrl = escapeHTML(heroImageData[imageKey].image);
        return `
            <div class="team-hero-card" title="${displayName}" style="position: relative; width: 72px; height: ${HERO_IMAGE_HEIGHT}px; border-radius: 6px; overflow: hidden; background: rgba(0,0,0,0.3); display: flex; align-items: flex-end; justify-content: center;">
                <div style="position: absolute; inset: 0; background-image: url('${imageUrl}'); background-size: cover; background-position: center;"></div>
                <span style="position: relative; z-index: 1; font-size: 0.65rem; font-weight: 600; color: rgba(255,255,255,0.9); text-shadow: 0 0 5px rgba(0,0,0,0.85); padding: 0 4px 2px; text-align: center;">${displayName}</span>
            </div>
        `;
    }

    return `
        <div class="team-hero-card team-hero-card--fallback" title="${displayName}" style="position: relative; width: 72px; height: ${HERO_IMAGE_HEIGHT}px; border-radius: 6px; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; padding: 4px;">
            <span style="font-size: 0.7rem; font-weight: 600; color: rgba(255,255,255,0.85); text-align: center;">${displayName}</span>
        </div>
    `;
}

function initTableSort() {
    // Remove existing event listeners to prevent duplicates
    document.querySelectorAll('.sortable').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
    });
    
    // Add new event listeners
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', function() {
            const column = parseInt(this.getAttribute('data-column'));
            const sortType = this.getAttribute('data-sort-type');
            const table = this.closest('table');
            
            if (table.classList.contains('hero-stats') || table.classList.contains('team-stats')) {
                // Hero/Team table sorting
                const currentAsc = currentHeroSortState.column === column ? !currentHeroSortState.asc : false;
                currentHeroSortState = {
                    column: column,
                    asc: currentAsc,
                    sortType: sortType
                };
                
                // Re-render with new sort state
                console.log('Hero table sort:', currentHeroSortState);
                const hits = getCurrentHits();
                if (hits.length > 0) {
                    const stats = computeStats(hits);
                    if (currentTab === 'team') {
                        displayTeamStats(hits);
                    } else {
                        displayHeroStats(stats.heroes, hits);
                    }
                }
            } else if (table.classList.contains('villain-stats')) {
                // Villain table sorting
                const currentAsc = currentVillainSortState.column === column ? !currentVillainSortState.asc : false;
                currentVillainSortState = {
                    column: column,
                    asc: currentAsc,
                    sortType: sortType
                };
                
                // Re-render with new sort state
                console.log('Villain table sort:', currentVillainSortState);
                const hits = getCurrentHits();
                if (hits.length > 0) {
                    const stats = computeStats(hits);
                    displayVillainStats(stats.villains, hits);
                }
            }
            
            // Update sort indicators
            updateSortIndicators(table, column, currentHeroSortState.asc || currentVillainSortState.asc);
        });
    });
}

// Custom hit rendering function
function renderHit(hit) {
    if (hit.play_type === 'team') {
        return `
            <div class="play-card team-play">
                <h2>${hit.villain}</h2>
                <div class="play-details">
                    <p>Team: ${hit.team_composition}</p>
                    <p>Result: ${hit.win ? 'Victory! 🎉' : 'Defeat 💀'}</p>
                    <p>Date: ${hit.date}</p>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="play-card">
                <h2>${hit.villain}</h2>
                <div class="play-details">
                    <p>Hero: ${hit.hero}</p>
                    <p>Result: ${hit.win ? 'Victory! 🎉' : 'Defeat 💀'}</p>
                    <p>Date: ${hit.date}</p>
                </div>
            </div>
        `;
    }
}

// Tab functionality for solo vs team games
let currentTab = 'solo';

function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update search filters
    updateSearchFilters();
}

function updateSearchFilters() {
    const targetFilter = currentTab === 'team' ? 'play_type:team' : 'play_type:solo';
    const existingState = search.getUiState()[ALGOLIA_INDEX_NAME] || {};
    const nextConfigure = {
        ...(existingState.configure || {}),
        filters: targetFilter,
        hitsPerPage: 1000
    };

    search.setUiState({
        [ALGOLIA_INDEX_NAME]: {
            ...existingState,
            configure: nextConfigure
        }
    });

    if (search.helper) {
        search.helper.setQueryParameter('filters', targetFilter);
        search.helper.setQueryParameter('hitsPerPage', 1000);
        search.helper.search();
    } else {
        console.warn('Search helper not ready; queued filter update for', targetFilter);
    }
}

// Add missing functions
function enableFastDateTooltips() {
    // Fast tooltip functionality
    let tooltipDiv = null;
    document.body.addEventListener('mouseover', function(e) {
        const td = e.target.closest('.date-col');
        if (td && td.hasAttribute('title')) {
            td.setAttribute('data-tooltip', td.getAttribute('title'));
            td.removeAttribute('title');
            tooltipDiv = document.createElement('div');
            tooltipDiv.className = 'fast-tooltip';
            const tip = td.getAttribute('data-tooltip');
            tooltipDiv.textContent = tip;
            document.body.appendChild(tooltipDiv);
            const rect = td.getBoundingClientRect();
            tooltipDiv.style.left = (rect.left + window.scrollX + rect.width/2 - tooltipDiv.offsetWidth/2) + 'px';
            tooltipDiv.style.top = (rect.top + window.scrollY - tooltipDiv.offsetHeight - 6) + 'px';
        }
    });
    document.body.addEventListener('mouseout', function(e) {
        const td = e.target.closest('.date-col');
        if (td && td.hasAttribute('data-tooltip')) {
            td.setAttribute('title', td.getAttribute('data-tooltip'));
            td.removeAttribute('data-tooltip');
        }
        if (tooltipDiv) {
            tooltipDiv.remove();
            tooltipDiv = null;
        }
    });
}


function updateSortIndicators(table, activeColumn, ascending) {
    // Remove all existing sort indicators
    table.querySelectorAll('.sortable').forEach((header, index) => {
        header.classList.remove('sort-asc', 'sort-desc');
        if (index === activeColumn) {
            header.classList.add(ascending ? 'sort-asc' : 'sort-desc');
        }
    });
}

function getCurrentHits() {
    // Get current hits from InstantSearch
    const uiState = search.getUiState();
    const results = search.helper.lastResults;
    if (results && results.hits) {
        return results.hits;
    }
    return [];
}

function initializeTabs() {
    // Add tab click handlers
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    // Initialize functions
    initTableSort();
    
    // Don't call switchTab here - let InstantSearch start first
}

document.addEventListener('DOMContentLoaded', function() {
    enableFastDateTooltips();
    initializeTabs();
    
    // Load image data when the page loads
    loadImageData().then(() => {
        imageDataLoaded = true;
        console.log('Image data loaded, processing any pending stats update');
        if (pendingStatsUpdate) {
            computeStats(pendingStatsUpdate);
            pendingStatsUpdate = null;
        }
    });
    
    // Set initial tab state after InstantSearch has started (it starts immediately after widgets are added)
    setTimeout(() => {
        switchTab('solo');
    }, 100);
});

// Modal functionality for hero and villain details
function showHeroDetail(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function hideHeroDetail(modalId, event) {
    // Add a small delay to prevent hiding when moving between hero cell and modal
    setTimeout(() => {
        const modal = document.getElementById(modalId);
        if (modal && !modal.matches(':hover') && !event.relatedTarget?.closest(`#${modalId}`)) {
            modal.style.display = 'none';
        }
    }, 100);
}

function showVillainDetail(modalId, event) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function hideVillainDetail(modalId, event) {
    // Add a small delay to prevent hiding when moving between villain cell and modal
    setTimeout(() => {
        const modal = document.getElementById(modalId);
        if (modal && !modal.matches(':hover') && !event.relatedTarget?.closest(`#${modalId}`)) {
            modal.style.display = 'none';
        }
    }, 100);
}

/**
 * Initialize table sorting functionality
 */

