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

let currentVillainData = [];
let currentVillainSortState = {
    column: 1, // Default sort by Plays
    asc: false, // Default descending
    sortType: 'number'
};

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
            item: '' // Remove rendering of individual play tiles
        },
        escapeHTML: true,
        transformItems(items) {
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
                // Remove main statistics area rendering
                return '';
            }
        }
    })
]);


/**
 * Computes overall statistics from hit results
 */
function computeStats(hits) {
    console.log('Computing stats for hits:', hits.length);
    
    // Initialize counters and collections
    const heroStats = {};
    const villainStats = {};
    
    // Process each hit to build statistics
    hits.forEach(hit => {
        const hero = hit.hero;
        const villain = hit.villain;
        const win = Boolean(hit.win);
        
        // Update hero stats
        if (!heroStats[hero]) {
            heroStats[hero] = { name: hero, plays: 0, wins: 0, winRate: 0 };
        }
        heroStats[hero].plays++;
        if (win) {
            heroStats[hero].wins++;
        }
        
        // Update villain stats
        if (!villainStats[villain]) {
            villainStats[villain] = { name: villain, plays: 0, wins: 0, winRate: 0 };
        }
        villainStats[villain].plays++;
        if (win) {
            villainStats[villain].wins++;
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
function renderSortedHeroStats(heroes, sortState, allHits) { // Added allHits parameter
    const { column, asc, sortType } = sortState;
    
    console.log('Sorting Heroes');
    console.log('Sort Config:', {
        column,
        columnName: ['Hero', 'Plays', 'Wins', 'Win %'][column],
        asc,
        sortType,
        expectedDirection: asc ? 'ascending' : 'descending'
    });
    
    // Clone array to avoid modifying original
    const sorted = [...heroes].sort((a, b) => {
        const aVal = column === 0 ? a.name :
                    column === 1 ? a.plays :
                    column === 2 ? a.wins :
                    parseFloat(a.winRate);
        const bVal = column === 0 ? a.name :
                    column === 1 ? a.plays :
                    column === 2 ? a.wins :
                    parseFloat(b.winRate);
        
        // Descending by default
        const baseResult = column === 0 ?
            bVal.localeCompare(aVal) :  // Strings: Z to A
            bVal - aVal;                // Numbers: High to Low
            
        // Flip for ascending, default is descending
        return asc ? -baseResult : baseResult;
    });
    
    // Debug sort results
    if (sorted.length > 0) {
        console.log('Sort Results:', {
            beforeSort: heroes.slice(0, 3).map(h => h.name),
            afterSort: sorted.slice(0, 3).map(h => h.name),
            comparisons: sorted.slice(0, 3).map(h => `${h.name}: ${h.plays} plays, ${h.wins} wins, ${h.winRate}%`),
            fullSort: sorted.slice(0, 10).map(h => h.name)
        });
    }
    
    let tableRowsHtml = '';
    let modalsHtml = '';

    // Pre-compute all villain stats for heroes to populate cache if needed
    sorted.forEach(hero => {
        if (!window.villainStatsCache?.[hero.name]) {
            computeHeroVillainStats(hero.name, allHits);
        }
    });

    sorted.forEach((hero, index) => {
        const safeHeroName = hero.name.replace(/[^a-zA-Z0-9]/g, '');
        const heroModalId = `hero-detail-${index}-${safeHeroName}`;
        
        tableRowsHtml += `
            <tr class="hero-row">
                <td class="hero-name" style="position: relative; cursor: pointer;" 
                    onmouseover="showHeroDetail('${heroModalId}');"
                    onmouseout="hideHeroDetail('${heroModalId}', event);">
                    ${escapeHTML(hero.name)}
                </td>
                <td class="number-col">${hero.plays}</td>
                <td class="number-col">${hero.wins}</td>
                <td class="number-col">${hero.winRate}%</td>
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
            background-color: transparent; /* Allows clicks through overlay */
            z-index: 10000;
            pointer-events: none; /* Overlay doesn't catch mouse events */
        ">
            <div class="hero-modal-content" style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: white;
                border: 2px solid #0000aa; /* Blue border for hero modals */
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                min-width: 350px;
                max-width: 90%;
                max-height: 90%;
                overflow: auto;
                pointer-events: auto; /* Modal content catches mouse events */
                color: black;
            ">
                <div class="hero-modal-header" style="background-color: #e0e8ff; padding: 10px; margin-bottom: 10px; border-bottom: 1px solid #0000aa; border-radius: 5px;">
                    <h3 style="margin: 0; color: black; font-size: 18px; font-weight: bold; text-align: center;">VILLAINS FACED BY ${escapeHTML(hero.name).toUpperCase()}</h3>
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
    
    return { tableRowsHtml, modalsHtml }; // Return combined HTML for rows and modals
}

function renderVillainStats(villains) {
    return villains.map(villain => {
        return `
            <tr class="villain-row">
                <td class="villain-name">${villain.name}</td>
                <td class="number-col">${villain.plays}</td>
                <td class="number-col">${villain.wins}</td>
                <td class="number-col">${villain.winRate}%</td>
            </tr>
        `;
    }).join('');
}

// Optimize the renderSortedVillainStats function for performance
// Here's an updated version of your modal template with better CSS specificity
// Fixed implementation of renderSortedVillainStats
// Fixed renderSortedVillainStats function
function renderSortedVillainStats(villains, sortState, allHits) { // Added allHits parameter
    const { column, asc, sortType } = sortState;

    // Make sure we have the heroStatsCache
    window.heroStatsCache = window.heroStatsCache || {};
    
    // Sort the villains
    const sorted = [...villains].sort((a, b) => {
        const aVal = column === 0 ? a.name :
                    column === 1 ? a.plays :
                    column === 2 ? a.wins :
                    parseFloat(a.winRate);
        const bVal = column === 0 ? a.name :
                    column === 1 ? a.plays :
                    column === 2 ? a.wins :
                    parseFloat(b.winRate);

        const baseResult = column === 0 ?
            bVal.localeCompare(aVal) :
            bVal - aVal;
            
        return asc ? -baseResult : baseResult;
    });

    // Get hits from search helper
    const hits = search.helper?.lastResults?.hits || [];

    // Generate villain rows for the main table
    let tableRowsHtml = '';
    let modalsHtml = '';

    sorted.forEach((villain, index) => {
        const safeVillainName = villain.name.replace(/[^a-zA-Z0-9]/g, '');
        const villainId = `villain-${index}-${safeVillainName}`;
        
        tableRowsHtml += `
            <tr class="villain-row">
                <td class="villain-name" style="position: relative; cursor: pointer;" 
                    onmouseover="showVillainDetail('${villainId}');"
                    onmouseout="hideVillainDetail('${villainId}', event);">
                    ${villain.name}
                </td>
                <td class="number-col">${villain.plays}</td>
                <td class="number-col">${villain.wins}</td>
                <td class="number-col">${villain.winRate}%</td>
            </tr>
        `;
    });

    // Force computation of all hero stats before generating modals
    for (const villain of sorted) {
        const villainName = villain.name;
        if (!window.heroStatsCache[villainName]) {
            try {
                // Use the existing computeVillainHeroStats function
                const result = computeVillainHeroStats(villainName, allHits); // Use allHits
                // Cache is already handled in computeVillainHeroStats
                console.log(`Pre-computed stats for ${villainName}: ${result.length} heroes`);
            } catch (e) {
                console.error(`Failed to compute stats for ${villainName}:`, e);
                window.heroStatsCache[villainName] = [];
            }
        }
    }
    
    // Generate popup modals for each villain
    const modals = sorted.map((villain, index) => {
        const safeVillainName = villain.name.replace(/[^a-zA-Z0-9]/g, '');
        const villainId = `villain-${index}-${safeVillainName}`;
        
        // Get hero stats for this villain
        const heroStats = window.heroStatsCache[villain.name] || [];
        
        // Debug for Crossbones specifically
        const isCrossbones = villain.name.includes("Crossbones");
        if (isCrossbones) {
            console.log(`Modal for ${villain.name} - heroStats:`, {
                isCached: Boolean(window.heroStatsCache[villain.name]),
                length: heroStats.length,
                firstThree: heroStats.slice(0, 3).map(h => h.hero)
            });
        }
        
        // Generate hero rows HTML
        let heroRowsHtml = '';
        if (heroStats && heroStats.length > 0) {
            heroRowsHtml = heroStats.map(h => `
                <tr style="background-color: white; border-bottom: 1px solid #dddddd;">
                    <td style="padding: 8px; text-align: left; color: black; border: 1px solid #eeeeee;">${h.hero || 'Unknown'}</td>
                    <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.plays || 0}</td>
                    <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.wins || 0}</td>
                    <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.winRate || 0}%</td>
                </tr>
            `).join('');
        } else {
            heroRowsHtml = `
                <tr style="background-color: white;">
                    <td colspan="4" style="padding: 15px; text-align: center; color: black;">
                        No hero data available for this villain
                    </td>
                </tr>
            `;
        }
        
        // Complete rebuilt modal HTML structure for all villains
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
                max-width: 90%;
                max-height: 90%;
                overflow: auto;
                pointer-events: auto;
                color: black;
            ">
                <div class="villain-modal-header" style="background-color: #e0e8ff; padding: 10px; margin-bottom: 10px; border-bottom: 1px solid #0000aa; border-radius: 5px;">
                    <h3 style="margin: 0; color: black; font-size: 18px; font-weight: bold; text-align: center;">HEROES FACED BY ${villain.name.toUpperCase()}</h3>
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
    }).join('');
    
    return { tableRowsHtml, modalsHtml };
}

// Also implement a fixed showVillainDetail function
function showVillainDetail(id) {
    console.log(`Showing villain detail for ID: ${id}`);
    const modal = document.getElementById(id);
    if (!modal) {
        console.error(`Modal NOT found for ID ${id}`);
        return;
    }
    
    // For Crossbones, add special debugging
    if (id.includes('Crossbones')) {
        console.log("CROSSBONES POPUP:", {
            modal: modal,
            table: modal.querySelector('table'),
            tbody: modal.querySelector('tbody'),
            rows: modal.querySelectorAll('tbody tr'),
            html: modal.innerHTML
        });
        
        // Emergency fix for Crossbones table if it's missing
        if (!modal.querySelector('table')) {
            const contentDiv = modal.querySelector('.villain-modal-content');
            const bodyDiv = modal.querySelector('.villain-modal-body');
            
            if (bodyDiv && contentDiv) {
                // Retrieve the hero stats data
                const villainName = id.includes('Crossbones1') ? 'Crossbones1/2' : 'Crossbones 2/3';
                const heroStats = window.heroStatsCache[villainName] || [];
                
                console.log(`Emergency rebuild for ${villainName} popup with ${heroStats.length} heroes`);
                
                // Generate hero rows HTML
                let heroRowsHtml = '';
                if (heroStats && heroStats.length > 0) {
                    heroRowsHtml = heroStats.map(h => `
                        <tr style="background-color: white; border-bottom: 1px solid #dddddd;">
                            <td style="padding: 8px; text-align: left; color: black; border: 1px solid #eeeeee;">${h.hero || 'Unknown'}</td>
                            <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.plays || 0}</td>
                            <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.wins || 0}</td>
                            <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.winRate || 0}%</td>
                        </tr>
                    `).join('');
                } else {
                    heroRowsHtml = `
                        <tr style="background-color: white;">
                            <td colspan="4" style="padding: 15px; text-align: center; color: black;">
                                No hero data available for this villain
                            </td>
                        </tr>
                    `;
                }
                
                // Replace the body content with a properly formed table
                bodyDiv.innerHTML = `
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
                `;
                
                console.log("Table emergency fixed, new structure:", modal.innerHTML);
            }
        }
    }
    
    // Make modal visible
    modal.style.display = 'block';
    console.log(`Modal found for ID ${id}, displaying it`);
}

function hideVillainDetail(id, event) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    const contentContainer = modal.querySelector('div');
    
    // Check if we're moving to the modal content itself
    if (event && event.relatedTarget && 
        (contentContainer.contains(event.relatedTarget) || contentContainer === event.relatedTarget)) {
        
        const handlerId = `handler-${id}`;
        
        // Debounce the mouseout handler to avoid excessive processing
        if (!contentContainer[handlerId]) {
            contentContainer[handlerId] = function(e) {
                // Debounce the actual hiding
                if (contentContainer._hideTimeout) {
                    clearTimeout(contentContainer._hideTimeout);
                }
                
                contentContainer._hideTimeout = setTimeout(() => {
                    if (!contentContainer.contains(e.relatedTarget)) {
                        requestAnimationFrame(() => {
                            modal.style.display = 'none';
                        });
                        contentContainer.removeEventListener('mouseout', contentContainer[handlerId]);
                        delete contentContainer[handlerId];
                    }
                }, 50); // Small delay to reduce processing
            };
            
            contentContainer.addEventListener('mouseout', contentContainer[handlerId]);
        }
        return;
    }
    
    // Use requestAnimationFrame for DOM updates
    requestAnimationFrame(() => {
        modal.style.display = 'none';
    });
}

// Functions to show/hide hero detail modals (similar to villain modals)
function showHeroDetail(id) {
    console.log(`Showing hero detail for ID: ${id}`);
    const modal = document.getElementById(id);
    if (!modal) {
        console.error(`Modal NOT found for ID ${id}`);
        return;
    }
    // Ensure content is up-to-date if dynamic loading were added, but here it's pre-rendered.
    // Forcing a check and potential rebuild if table is missing, similar to showVillainDetail's emergency fix.
    const heroName = modal.dataset.heroName;
    const table = modal.querySelector('table.hero-villains-table');
    const noDataRow = modal.querySelector('td[colspan="4"]'); // Check for "No villain data" message
    const villainStatsForHero = window.villainStatsCache ? (window.villainStatsCache[heroName] || []) : [];

    if (!table || (noDataRow && villainStatsForHero.length > 0)) {
        console.warn(`Hero modal ${id} ("${heroName}") table missing or incorrect. Forcing rebuild. Cached stats count: ${villainStatsForHero.length}`);
        const bodyDiv = modal.querySelector('.hero-modal-body');
        if (bodyDiv) {
            let villainRowsHtml = '';
            if (villainStatsForHero.length > 0) {
                villainRowsHtml = villainStatsForHero.map(vStat => `
                    <tr style="background-color: white !important; border-bottom: 1px solid #dddddd;">
                        <td style="padding: 8px; text-align: left; color: black !important; border: 1px solid #eeeeee;">${escapeHTML(vStat.villain) || 'Unknown'}</td>
                        <td style="padding: 8px; text-align: right; color: black !important; border: 1px solid #eeeeee;">${vStat.plays || 0}</td>
                        <td style="padding: 8px; text-align: right; color: black !important; border: 1px solid #eeeeee;">${vStat.wins || 0}</td>
                        <td style="padding: 8px; text-align: right; color: black !important; border: 1px solid #eeeeee;">${vStat.winRate || 0}%</td>
                    </tr>
                `).join('');
            } else {
                villainRowsHtml = `
                    <tr style="background-color: white !important;">
                        <td colspan="4" style="padding: 15px; text-align: center; color: black !important;">
                            No villain data available for this hero (${escapeHTML(heroName)})
                        </td>
                    </tr>
                `;
            }
            bodyDiv.innerHTML = `
                <div class="table-container">
                    <table class="hero-villains-table" style="width: 100%; border-collapse: collapse; background-color: white;">
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
            `;
            console.log(`Hero modal ${id} ("${heroName}") emergency table rebuild complete.`);
        }
    }
    modal.style.display = 'block';
    console.log(`Hero modal found for ID ${id}, displaying it`);
}

function hideHeroDetail(id, event) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    // The first div child of the modal is assumed to be the content container
    const contentContainer = modal.querySelector('div'); 
    
    if (event && event.relatedTarget && contentContainer &&
        (contentContainer.contains(event.relatedTarget) || contentContainer === event.relatedTarget)) {
        
        const handlerId = `handler-${id}`; // Unique ID for the handler
        
        if (!contentContainer[handlerId]) { // Attach mouseout only once
            contentContainer[handlerId] = function(e) {
                if (contentContainer._hideTimeout) { // Debounce
                    clearTimeout(contentContainer._hideTimeout);
                }
                contentContainer._hideTimeout = setTimeout(() => {
                    // Check if the mouse has truly left the content container
                    if (!contentContainer.contains(e.relatedTarget)) {
                        requestAnimationFrame(() => {
                            modal.style.display = 'none';
                        });
                        // Clean up listener
                        contentContainer.removeEventListener('mouseout', contentContainer[handlerId]);
                        delete contentContainer[handlerId]; // Remove stored handler
                        delete contentContainer._hideTimeout; // Remove timeout reference
                    }
                }, 50); // Small delay
            };
            contentContainer.addEventListener('mouseout', contentContainer[handlerId]);
        }
        return; // Don't hide yet, mouse is over content
    }
    
    // If not hovering over content, hide immediately
    requestAnimationFrame(() => {
        modal.style.display = 'none';
    });
}

// Update the initTableSort function to use direct DOM manipulation for table sorting
// and to correctly manage listeners and update global sort state.
function initTableSort() {
    console.log("DEBUG: initTableSort called");
    const headers = document.querySelectorAll('table.sortable th');
    console.log('DEBUG: Table headers found:', {
        count: headers.length,
        headers: Array.from(headers).map(h => ({
            text: h.textContent,
            classes: h.className,
            sortType: h.getAttribute('data-sort')
        }))
    });

    headers.forEach(headerCell => {
        // Remove old listener if it exists for this specific cell to prevent multiple bindings
        if (window.tableSortHandlers.has(headerCell)) {
            headerCell.removeEventListener('click', window.tableSortHandlers.get(headerCell));
            window.tableSortHandlers.delete(headerCell); // Clean up map
        }

        const newHandler = (event) => {
            console.log(`DEBUG: Header clicked: ${headerCell.textContent}`);
            
            if (isEditing) {
                console.log('Sorting prevented - editing in progress');
                return;
            }

            const tableElement = headerCell.closest('table');
            if (!tableElement) {
                console.error("DEBUG: Could not find parent table for header:", headerCell);
                return;
            }
            console.log(`DEBUG: Found table:`, tableElement);
            
            const headerIndex = Array.prototype.indexOf.call(headerCell.parentElement.children, headerCell);
            console.log(`DEBUG: Header index: ${headerIndex}`);
            
            const currentIsAscending = headerCell.classList.contains('th-sort-asc');
            const newAscending = !currentIsAscending; // Determine the new sort direction
            console.log(`DEBUG: Current is ascending: ${currentIsAscending}, New is ascending: ${newAscending}`);
            
            const sortType = headerCell.getAttribute('data-sort') || 'string';
            console.log(`DEBUG: Sort type: ${sortType}`);

            // Update global sort state
            const isHeroTable = tableElement.closest('.hero-stats') !== null;
            const isVillainTable = tableElement.closest('.villain-stats') !== null;

            if (isHeroTable) {
                currentSortState.column = headerIndex;
                currentSortState.asc = newAscending;
                currentSortState.sortType = sortType;
                console.log("DEBUG: Updated currentSortState:", currentSortState);
            } else if (isVillainTable) {
                currentVillainSortState.column = headerIndex;
                currentVillainSortState.asc = newAscending;
                currentVillainSortState.sortType = sortType;
                console.log("DEBUG: Updated currentVillainSortState:", currentVillainSortState);
            } else {
                console.warn("DEBUG: Clicked header in an unknown table type. Sort state not updated.");
            }

            // Clear sort indicators from other columns in the same table
            tableElement.querySelectorAll('th').forEach(th => {
                if (th !== headerCell) {
                    th.classList.remove('th-sort-asc', 'th-sort-desc');
                }
            });
            
            event.stopPropagation();
            
            console.log(`DEBUG: About to call sortTableByColumn with newAscending: ${newAscending}`);
            sortTableByColumn(tableElement, headerIndex, newAscending, sortType);
        };

        headerCell.addEventListener('click', newHandler);
        window.tableSortHandlers.set(headerCell, newHandler); // Store the new handler
        console.log(`DEBUG: Added click handler to header: ${headerCell.textContent}`);
    });
}

function sortTableByColumn(table, column, asc = true, sortType = 'string') {
    console.log(`DEBUG: sortTableByColumn called:`, {
        table: table,
        column: column,
        asc: asc,
        sortType: sortType
    });
    
    const dirModifier = asc ? 1 : -1;
    const tBody = table.tBodies[0];
    console.log(`DEBUG: tBody found:`, tBody);
    
    const rowPairs = [];
    const rows = Array.from(tBody.querySelectorAll('tr:not(.bar-row)'));
    console.log(`DEBUG: Found ${rows.length} rows to sort`);
    
    // Create pairs of rows and their data
    rows.forEach((row, i) => {
        const col = row.querySelector(`td:nth-child(${column + 1})`);
        const value = col?.textContent?.trim() || '';
        let sortValue;
        
        if (sortType === 'number') {
            // Extract only numbers and decimal points
            sortValue = parseFloat(value.match(/[\d.]+/)?.[0]) || 0;
        } else {
            sortValue = value;
        }
        
        const barRow = row.nextElementSibling;
        if (barRow?.classList.contains('bar-row')) {
            rowPairs.push({ row, barRow, sortValue });
        } else {
            rowPairs.push({ row, sortValue });
        }
        
        if (i < 3) {
            console.log(`DEBUG: Row ${i} data:`, {
                text: value,
                sortValue: sortValue,
                hasBarRow: barRow?.classList.contains('bar-row') || false
            });
        }
    });

    console.log(`DEBUG: About to sort ${rowPairs.length} row pairs`);
    
    // Sort the pairs
    rowPairs.sort((a, b) => {
        if (sortType === 'number') {
            return (a.sortValue - b.sortValue) * dirModifier;
        }
        return a.sortValue.localeCompare(b.sortValue) * dirModifier;
    });

    console.log(`DEBUG: First 3 rows after sorting:`, rowPairs.slice(0, 3).map(p => p.sortValue));
    
    // Clear and rebuild table
    console.log(`DEBUG: Clearing table body`);
    while (tBody.firstChild) {
        tBody.removeChild(tBody.firstChild);
    }

    // Add sorted rows back
    console.log(`DEBUG: Adding sorted rows back to table`);
    rowPairs.forEach(pair => {
        tBody.appendChild(pair.row);
        if (pair.barRow) {
            tBody.appendChild(pair.barRow);
        }
    });

    // Update sort indicators
    console.log(`DEBUG: Updating sort indicators`);
    table.querySelectorAll('th').forEach(th => th.classList.remove('th-sort-asc', 'th-sort-desc'));
    const headerCell = table.querySelector(`th:nth-child(${column + 1})`);
    headerCell.classList.toggle('th-sort-asc', asc);
    headerCell.classList.toggle('th-sort-desc', !asc);
    
    console.log(`DEBUG: Table sort complete`);
}

// Add this function to fix any villain modal that might be missing its table
function fixVillainModals(currentVillainDataFromStats, allHitsFromStats) {
    console.log("FIX_MODALS: Starting comprehensive villain modal fix cycle...");
    
    if (!window.heroStatsCache) {
        console.warn("FIX_MODALS: heroStatsCache not found, initializing.");
        window.heroStatsCache = {};
    }
    
    const villainModals = document.querySelectorAll('.villain-modal');
    
    if (villainModals.length === 0) {
        console.log("FIX_MODALS: No villain modals found in DOM yet. This shouldn't happen if called from stats widget.");
        return; 
    }
    
    console.log(`FIX_MODALS: Found ${villainModals.length} villain modals to process.`);
    
    const ensureVillainDataAndGetStats = (villainName) => { // villainName must be original case
        if (!villainName) {
            console.error("FIX_MODALS: ensureVillainDataAndGetStats called with no villainName.");
            return [];
        }
        if (!window.heroStatsCache) window.heroStatsCache = {};

        // Check cache first (original case)
        if (window.heroStatsCache[villainName] && window.heroStatsCache[villainName].length > 0) {
            console.log(`FIX_MODALS: Cache hit for "${villainName}", ${window.heroStatsCache[villainName].length} heroes.`);
            return window.heroStatsCache[villainName];
        }
        
        // If not in cache or cache is empty, recompute using allHitsFromStats
        console.log(`FIX_MODALS: Cache miss or empty for "${villainName}". Recomputing using allHitsFromStats (${allHitsFromStats.length} hits)...`);
        try {
            // computeVillainHeroStats will set the cache with original cased key
            const computedStats = computeVillainHeroStats(villainName, allHitsFromStats) || []; 
            console.log(`FIX_MODALS: Recomputed stats for "${villainName}", ${computedStats.length} heroes.`);
            return computedStats;
        } catch (e) {
            console.error(`FIX_MODALS: Error recomputing stats for "${villainName}":`, e);
            return [];
        }
    };
    
    villainModals.forEach(modal => {
        const modalId = modal.id;
        const bodyDiv = modal.querySelector('.villain-modal-body');
        
        if (!bodyDiv) {
            console.error(`FIX_MODALS: Modal ${modalId} is missing its bodyDiv. Skipping.`);
            return; 
        }
        
        let villainName = modal.dataset.villainName; // PRIMARY: Use data attribute (original casing)
 
        if (!villainName) {
            console.warn(`FIX_MODALS: modal.dataset.villainName not found for ${modalId}. Falling back to header parsing.`);
            const headerText = modal.querySelector('.villain-modal-header h3')?.textContent || '';
            const headerMatch = headerText.match(/HEROES FACED BY (.+)/i);
            const parsedNameFromHeader = headerMatch ? headerMatch[1].trim() : null; // This is UPPERCASE

            if (parsedNameFromHeader && currentVillainDataFromStats) {
                console.log(`FIX_MODALS: Parsed "${parsedNameFromHeader}" (UPPERCASE) from header for ${modalId}. Attempting to find original case in currentVillainDataFromStats.`);
                // Find the original cased name from the passed currentVillainDataFromStats
                const foundVillain = currentVillainDataFromStats.find(v => v.name.toUpperCase() === parsedNameFromHeader.toUpperCase());
                if (foundVillain) {
                    villainName = foundVillain.name; // Assign original cased name
                    console.log(`FIX_MODALS: Matched header to original name: "${villainName}" for ${modalId}`);
                } else {
                    console.warn(`FIX_MODALS: Could not match parsed header name "${parsedNameFromHeader}" to any known villain in currentVillainDataFromStats for ${modalId}.`);
                }
            }
        }
        
        if (!villainName) {
            console.warn(`FIX_MODALS: Header parsing failed for ${modalId}. Trying index from ID into currentVillainDataFromStats.`);
            const idParts = modalId.split('-');
            const villainIndexStr = idParts[1];
            const villainIndex = parseInt(villainIndexStr, 10);
            if (currentVillainDataFromStats && !isNaN(villainIndex) && currentVillainDataFromStats[villainIndex]) {
                villainName = currentVillainDataFromStats[villainIndex].name; // This will be original case
                console.log(`FIX_MODALS: Fallback success: Got villain name "${villainName}" from currentVillainDataFromStats index ${villainIndex} for ${modalId}`);
            }
        }

        if (!villainName) {
            console.error(`FIX_MODALS: CRITICAL - Cannot determine villain name for modal ${modalId}. Aborting fix for this modal.`);
            bodyDiv.innerHTML = `<p style="color:red; text-align:center;">Error: Could not identify villain to load data for modal ${modalId}.</p>`;
            return; 
        }
        
        const finalTableExists = bodyDiv.querySelector('table') !== null;
        const finalRowCount = bodyDiv.querySelectorAll('tbody tr').length;
        console.log(`FIX_MODALS: Modal ${modalId} ("${villainName}") update complete: hasTable=${finalTableExists}, rowCount=${finalRowCount}`);
    });
    
    console.log("FIX_MODALS: Villain modal fix cycle finished.");
}

// Update your showVillainDetail function to check for missing tables in any villain modal
function showVillainDetail(id) {
    console.log(`SHOW_DETAIL: Showing villain detail for ID: ${id}`);
    const modal = document.getElementById(id);
    if (!modal) {
        console.error(`SHOW_DETAIL: Modal NOT found for ID ${id}`);
        return;
    }

    let villainName = modal.dataset.villainName; // Original case from data attribute

    // Fallback logic for villainName if data attribute is missing (should be rare now)
    if (!villainName) {
        console.warn(`SHOW_DETAIL: modal.dataset.villainName not found for ${id}. Attempting fallbacks.`);
        const headerText = modal.querySelector('.villain-modal-header h3')?.textContent || '';
        const headerMatch = headerText.match(/HEROES FACED BY (.+)/i);
        const parsedNameFromHeader = headerMatch ? headerMatch[1].trim() : null; // UPPERCASE

        if (parsedNameFromHeader && currentVillainData) { // currentVillainData should be available globally
            const foundVillain = currentVillainData.find(v => v.name.toUpperCase() === parsedNameFromHeader.toUpperCase());
            if (foundVillain) {
                villainName = foundVillain.name; // Original case
                console.log(`SHOW_DETAIL: Matched header to original name: ${villainName} for ${id}`);
            }
        }
        // Further fallbacks if needed, e.g., from ID, ensuring original case for cache keys
        if (!villainName && id.includes('Crossbones12')) villainName = 'Crossbones1/2';
        if (!villainName && id.includes('Crossbones23')) villainName = 'Crossbones 2/3';
    }

    if (!villainName) {
        console.error(`SHOW_DETAIL: CRITICAL - Cannot determine original-cased villain name for modal ${id}. Displaying error.`);
        const bodyDiv = modal.querySelector('.villain-modal-body');
        if (bodyDiv) {
            bodyDiv.innerHTML = `<p style="color:red; text-align:center;">Error: Could not identify villain for modal ${id}.</p>`;
        }
        modal.style.display = 'block';
        return;
    }
    
    // If table is missing or seems to have the "No data" message incorrectly, force a rebuild using correct villainName.
    const table = modal.querySelector('table');
    const noDataRow = modal.querySelector('td[colspan="4"]');
    const heroStatsForModal = window.heroStatsCache[villainName] || [];

    if (!table || (noDataRow && heroStatsForModal.length > 0)) {
        console.warn(`SHOW_DETAIL: Table missing or incorrect for ${id} ("${villainName}"). Forcing rebuild. Cached stats count: ${heroStatsForModal.length}`);
        
        const bodyDiv = modal.querySelector('.villain-modal-body');
        if (bodyDiv) {
            let heroRowsHtml = '';
            if (heroStatsForModal.length > 0) {
                heroRowsHtml = heroStatsForModal.map(h => `
                    <tr style="background-color: white !important; border-bottom: 1px solid #dddddd;">
                        <td style="padding: 8px; text-align: left; color: black !important; border: 1px solid #eeeeee;">${h.hero || 'Unknown'}</td>
                        <td style="padding: 8px; text-align: right; color: black !important; border: 1px solid #eeeeee;">${h.plays || 0}</td>
                        <td style="padding: 8px; text-align: right; color: black !important; border: 1px solid #eeeeee;">${h.wins || 0}</td>
                        <td style="padding: 8px; text-align: right; color: black !important; border: 1px solid #eeeeee;">${h.winRate || 0}%</td>
                    </tr>
                `).join('');
            } else {
                heroRowsHtml = `
                    <tr style="background-color: white !important;">
                        <td colspan="4" style="padding: 15px; text-align: center; color: black !important;">
                            No hero data available for this villain (${escapeHTML(villainName)})
                        </td>
                    </tr>
                `;
            }
            
            bodyDiv.innerHTML = `
                <div class="table-container">
                    <table class="villain-heroes-table" style="width: 100%; border-collapse: collapse; background-color: white;">
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
            `;
            console.log(`SHOW_DETAIL: Emergency table rebuild for ${id} ("${villainName}") complete.`);
        }
    }
    
    modal.style.display = 'block';
    console.log(`SHOW_DETAIL: Modal displayed for ID ${id} ("${villainName}")`);
}

// Add this line to the DOMContentLoaded event handler for earlier execution
document.addEventListener('DOMContentLoaded', function() {
    search.start();
    initTableSort();
    
    // Run the modal fix twice - once early and once after data is likely loaded
    setTimeout(fixVillainModals, 1000);
    setTimeout(fixVillainModals, 3000);

    // --- BEGIN SIDE-BY-SIDE LAYOUT EXPERIMENT ---
    const overlay = document.createElement('div');
    overlay.id = 'side-by-side-experiment';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '50%';
    overlay.style.width = '50vw';
    overlay.style.transform = 'translateX(-50%)';
    overlay.style.height = '100vh';
    overlay.style.minHeight = '80px';
    overlay.style.zIndex = '9999';
    overlay.style.background = 'rgba(255,255,255,0.95)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'row';
    overlay.style.justifyContent = 'space-between';
    overlay.style.alignItems = 'flex-start';
    overlay.style.gap = '20px';
    overlay.style.borderBottom = '2px solid #aaa';
    overlay.style.padding = '10px 0';

    const leftBox = document.createElement('div');
    leftBox.style.flex = '1 1 50%';
    leftBox.style.height = '100%';
    leftBox.style.overflowY = 'auto';
    leftBox.innerHTML = '';

    const rightBox = document.createElement('div');
    rightBox.style.flex = '1 1 50%';
    rightBox.style.height = '100%';
    rightBox.style.overflowY = 'auto';
    rightBox.innerHTML = '';

    overlay.appendChild(leftBox);
    overlay.appendChild(rightBox);
    document.body.appendChild(overlay);
    // --- END SIDE-BY-SIDE LAYOUT EXPERIMENT ---

    const style = document.createElement('style');
    style.textContent = `
      #side-by-side-experiment {
        border-left: 2px solid #aaa;
        border-right: 2px solid #aaa;
        transition: width 0.2s;
      }
      @media (max-width: 900px) {
        #side-by-side-experiment {
          width: 100vw !important;
          left: 0 !important;
          transform: none !important;
          border-left: none;
          border-right: none;
        }
      }
      /* Overlay experiment styles remain unchanged */
      // ...existing code...

      /* Main statistics flexbox layout */
      .statistics {
        display: flex !important;
        flex-direction: row !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        width: 100% !important;
        flex-wrap: nowrap !important;
        gap: 20px !important;
        box-sizing: border-box !important;
        min-height: 100px !important;
        margin-bottom: 20px !important;
      }
      .hero-stats, .villain-stats {
        flex: 1 1 50% !important;
        min-width: 300px !important;
        max-width: 48% !important;
        box-sizing: border-box !important;
        overflow: auto !important;
        padding: 10px !important;
        border: 1px solid #eee !important;
        border-radius: 5px !important;
      }
      .stats-table {
        width: 100% !important;
        table-layout: fixed !important;
        margin-bottom: 0 !important;
        border-collapse: collapse !important;
      }
      .stats-table thead th {
        position: sticky;
        top: 0;
        background: #f5f5f5;
        z-index: 2;
      }
    `;
    document.head.appendChild(style);

    // Remove any leftover blank tiles from the .hits container
    const hitsContainer = document.querySelector('.hits');
    if (hitsContainer) {
        hitsContainer.innerHTML = '';
        hitsContainer.style.display = 'none';
    }
    const aisHits = document.querySelector('.ais-Hits');
    if (aisHits) aisHits.style.display = 'none';
    const aisHitsList = document.querySelector('.ais-Hits-list');
    if (aisHitsList) aisHitsList.style.display = 'none';
    const aisHitsItems = document.querySelectorAll('.ais-Hits-item');
    aisHitsItems.forEach(item => item.style.display = 'none');

    setTimeout(() => {
        const hits = search.helper?.lastResults?.hits || [];
        const stats = computeStats(hits);
        // Render hero table in left pane
        const { tableRowsHtml, modalsHtml } = renderSortedHeroStats(stats.heroes, currentSortState, hits);
        const heroTableHtml = `
          <div style="font-weight:bold;margin-bottom:8px;">Hero Table (Direct Render)</div>
          <table class="stats-table sortable">
            <thead>
              <tr>
                <th data-sort="string" class="hero-col">Hero</th>
                <th data-sort="number" class="number-col">Plays</th>
                <th data-sort="number" class="number-col">Wins</th>
                <th data-sort="number" class="number-col win-rate-col" style="display: table-cell;">Win %</th>
              </tr>
            </thead>
            <tbody>${tableRowsHtml}</tbody>
          </table>
          ${modalsHtml}
        `;
        leftBox.innerHTML = heroTableHtml;
        // Render villain table in right pane
        const { tableRowsHtml: villainRowsHtml, modalsHtml: villainModalsHtml } = renderSortedVillainStats(stats.villains, currentVillainSortState, hits);
        const villainTableHtml = `
          <div style="font-weight:bold;margin-bottom:8px;">Villain Table (Direct Render)</div>
          <table class="stats-table sortable">
            <thead>
              <tr>
                <th data-sort="string" class="villain-col">Villain</th>
                <th data-sort="number" class="number-col">Plays</th>
                <th data-sort="number" class="number-col">Hero Wins</th>
                <th data-sort="number" class="number-col">Win %</th>
              </tr>
            </thead>
            <tbody>${villainRowsHtml}</tbody>
          </table>
          ${villainModalsHtml}
        `;
        rightBox.innerHTML = villainTableHtml;
        if (typeof initTableSort === 'function') {
          initTableSort();
        }
    }, 500);
});

// Add this to ensure that table sorting is initialized properly
search.on('render', () => {
    const results = search.helper?.lastResults;
    if (results?.hits) {
        // Initialize table sorting with debug
        console.log('DEBUG: render event fired, will initialize table sort');
        setTimeout(() => {
            console.log('DEBUG: Initializing table sort after render event (500ms delay)');
            initTableSort();

            // --- DIAGNOSTIC FLEXBOX DEBUG ---
            const statsContainer = document.querySelector('.statistics');
            if (statsContainer) {
                statsContainer.style.border = '3px dashed orange';
                statsContainer.style.background = 'rgba(255,200,0,0.07)';
                const heroStats = statsContainer.querySelector('.hero-stats');
                const villainStats = statsContainer.querySelector('.villain-stats');
                if (heroStats) heroStats.style.border = '2px solid blue';
                if (villainStats) villainStats.style.border = '2px solid red';
                console.log('FLEXBOX DEBUG:', {
                  statistics: {
                    display: getComputedStyle(statsContainer).display,
                    flexDirection: getComputedStyle(statsContainer).flexDirection,
                    children: Array.from(statsContainer.children).map(c => c.className)
                  },
                  heroStats: heroStats ? {
                    width: heroStats.offsetWidth,
                    display: getComputedStyle(heroStats).display,
                    flex: getComputedStyle(heroStats).flex
                  } : null,
                  villainStats: villainStats ? {
                    width: villainStats.offsetWidth,
                    display: getComputedStyle(villainStats).display,
                    flex: getComputedStyle(villainStats).flex
                  } : null
                });
            }
            // --- END DIAGNOSTIC FLEXBOX DEBUG ---
        }, 500); // Delay to ensure DOM is updated
    }
});