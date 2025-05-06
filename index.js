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
            item: `
                <div class="play-card">
                    <h2>{{villain}}</h2>
                    <div class="play-details">
                        <p>Hero: {{hero}}</p>
                        <p>Result: {{#win}}Victory! 🎉{{/win}}{{^win}}Defeat 💀{{/win}}</p>
                        <p>Date: {{date}}</p>
                    </div>
                </div>
            `,
            showMoreText: 'Load more'
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
            text(results, { html }) {
                // Debug logging
                console.log('Stats widget state:', {
                    hasResults: Boolean(results),
                    hasHits: Boolean(results?.hits),
                    hitCount: results?.hits?.length,
                    totalHits: results?.nbHits,
                    helper: Boolean(search.helper),
                    helperResults: Boolean(search.helper?.lastResults)
                });

                // Use helper results if widget results aren't available yet
                const hits = results?.hits || search.helper?.lastResults?.hits || [];
                
                if (!hits.length) {
                    return '<p>Loading statistics...</p>';
                }

                const stats = computeStats(hits);
                console.log('Computed stats:', stats);

                if (!stats.heroes.length && !stats.villains.length) {
                    return '<p>No statistics available</p>';
                }

                currentHeroData = stats.heroes; // Store hero data for sorting
                currentVillainData = stats.villains;

                // Generate main table HTML
                const heroTableHtml = renderSortedHeroStats(stats.heroes, currentSortState);
                const villainTableHtml = renderSortedVillainStats(stats.villains, currentVillainSortState, hits); // Pass hits for modal generation

                // Call fixVillainModals here, ensuring it has access to currentVillainData and the correct hits
                // Use a setTimeout to allow the DOM to update with modals before fixing them.
                setTimeout(() => fixVillainModals(currentVillainData, hits), 0); 

                return `
                    <div class="statistics">
                        <div class="hero-stats">
                            <h3>Hero Statistics (${stats.heroes.length} heroes)</h3>
                            <table class="stats-table sortable">
                                <thead>
                                    <tr>
                                        <th data-sort="string" class="hero-col">Hero</th>
                                        <th data-sort="number" class="number-col">Plays</th>
                                        <th data-sort="number" class="number-col">Wins</th>
                                        <th data-sort="number" class="number-col win-rate-col" style="display: table-cell;">Win %</th>
                                    </tr>
                                </thead>
                                <tbody>${heroTableHtml}</tbody>
                            </table>
                        </div>
                        <div class="villain-stats">
                            <h3>Villain Statistics (${stats.villains.length} villains)</h3>
                            <table class="stats-table sortable">
                                <thead>
                                    <tr>
                                        <th data-sort="string" class="villain-col">Villain</th>
                                        <th data-sort="number" class="number-col">Plays</th>
                                        <th data-sort="number" class="number-col">Hero Wins</th>
                                        <th data-sort="number" class="number-col win-rate-col number-col" style="display: table-cell;">Win %</th>
                                    </tr>
                                </thead>
                                <tbody>${villainTableHtml}</tbody>
                            </table>
                        </div>
                    </div>
                `;
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
    // Cache check is done by callers like ensureVillainDataAndGetStats or renderSortedVillainStats

    console.log(`COMPUTE_VILLAIN_HERO_STATS: Computing for villainName: "${villainName}" (length ${villainName.length})`);
    let villainNameCharCodes = "";
    for (let i = 0; i < villainName.length; i++) {
        villainNameCharCodes += villainName.charCodeAt(i) + " ";
    }
    console.log(`COMPUTE_VILLAIN_HERO_STATS: villainName "${villainName}" char codes: [${villainNameCharCodes.trim()}]`);

    let matchEverFoundDuringFilter = false;
    const villainHits = hits.filter(hit => {
        if (!hit || typeof hit.villain !== 'string') return false; // Guard against undefined/null hit.villain
        const match = hit.villain === villainName;
        if (match) matchEverFoundDuringFilter = true;
        return match;
    });

    console.log(`COMPUTE_VILLAIN_HERO_STATS: Found ${villainHits.length} hits for villain "${villainName}" from ${hits.length} total hits. Match during filter: ${matchEverFoundDuringFilter}`);

    if (villainHits.length === 0 && hits.length > 0 && !matchEverFoundDuringFilter) {
        console.log(`COMPUTE_VILLAIN_HERO_STATS: No hits found for "${villainName}". Comparing with sample hit.villain values:`);
        let potentialMatches = 0;
        for (let i = 0; i < Math.min(hits.length, 500); i++) { // Check more samples if needed
            if (!hits[i] || typeof hits[i].villain !== 'string') continue;
            
            // Direct comparison log for the specific villain we are looking for
            if (hits[i].villain.toUpperCase().includes(villainName.substring(0,4).toUpperCase())) { // Log if first few chars match, case insensitive
                potentialMatches++;
                let hitVillainCharCodes = "";
                for (let j = 0; j < hits[i].villain.length; j++) {
                    hitVillainCharCodes += hits[i].villain.charCodeAt(j) + " ";
                }
                console.log(`  - Sample hit.villain: "${hits[i].villain}" (len ${hits[i].villain.length}, codes: [${hitVillainCharCodes.trim()}])`);
                if (hits[i].villain.trim() === villainName.trim() && hits[i].villain !== villainName) {
                    console.log(`    WARNING: Exact match if trimmed: source="${hits[i].villain}", target="${villainName}"`);
                }
                if (hits[i].villain.toLowerCase() === villainName.toLowerCase() && hits[i].villain !== villainName) {
                    console.log(`    WARNING: Exact match if lowercased: source="${hits[i].villain}", target="${villainName}"`);
                }
            }
        }
        if(potentialMatches === 0) {
            console.log(`COMPUTE_VILLAIN_HERO_STATS: No potential matches found even with relaxed search for "${villainName.substring(0,4)}" in samples.`);
        }
    }
    
    const heroStats = {};
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
 * Generates hero stats HTML based on sort state
 */
function renderSortedHeroStats(heroes, sortState) {
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
        const bVal = column === 0 ? b.name :
                    column === 1 ? b.plays :
                    column === 2 ? b.wins :
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
    
    return sorted.map(hero => {
        return `
            <tr class="hero-row">
                <td class="hero-name">${hero.name}</td>
                <td class="number-col">${hero.plays}</td>
                <td class="number-col">${hero.wins}</td>
                <td class="number-col">${hero.winRate}%</td>
            </tr>
        `;
    }).join('');
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
        const bVal = column === 0 ? b.name :
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
    const rows = sorted.map((villain, index) => {
        const safeVillainName = villain.name.replace(/[^a-zA-Z0-9]/g, '');
        const villainId = `villain-${index}-${safeVillainName}`;
        
        return `
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
    }).join('');
    
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
        return `
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
    
    return rows + modals;
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

// And debug computeVillainHeroStats function
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

// Update the initTableSort function to be more efficient
function initTableSort() {
    // Create a mutation observer to attach event handlers when tables are available
    const observer = new MutationObserver((mutations) => {
        const heroHeaders = document.querySelectorAll('.hero-stats table.sortable th');
        const villainHeaders = document.querySelectorAll('.villain-stats table.sortable th');
        
        if (heroHeaders.length > 0 || villainHeaders.length > 0) {
            observer.disconnect(); // Stop observing once we have tables
            
            // Set up hero sorting
            heroHeaders.forEach((headerCell, idx) => {
                headerCell.addEventListener('click', () => {
                    if (isEditing) return;
                    
                    const sortType = headerCell.getAttribute('data-sort') || 'string';
                    
                    if (currentSortState.column === idx) {
                        currentSortState.asc = !currentSortState.asc;
                    } else {
                        currentSortState.column = idx;
                        currentSortState.asc = false;
                        currentSortState.sortType = sortType;
                    }
                    
                    const heroTbody = document.querySelector('.hero-stats table.sortable tbody');
                    if (heroTbody) {
                        // Use requestAnimationFrame to avoid forced reflows
                        requestAnimationFrame(() => {
                            heroTbody.innerHTML = renderSortedHeroStats(currentHeroData, currentSortState);
                            
                            // Update sort indicator classes
                            heroHeaders.forEach(th => th.classList.remove('th-sort-asc', 'th-sort-desc'));
                            headerCell.classList.toggle('th-sort-asc', currentSortState.asc);
                            headerCell.classList.toggle('th-sort-desc', !currentSortState.asc);
                        });
                    }
                });
            });
            
            // Set up villain sorting
            villainHeaders.forEach((headerCell, idx) => {
                headerCell.addEventListener('click', () => {
                    if (isEditing) return;
                    
                    const sortType = headerCell.getAttribute('data-sort') || 'string';
                    
                    if (currentVillainSortState.column === idx) {
                        currentVillainSortState.asc = !currentVillainSortState.asc;
                    } else {
                        currentVillainSortState.column = idx;
                        currentVillainSortState.asc = false;
                        currentVillainSortState.sortType = sortType;
                    }
                    
                    const villainTbody = document.querySelector('.villain-stats table.sortable tbody');
                    if (villainTbody) {
                        // Use requestAnimationFrame to avoid forced reflows
                        requestAnimationFrame(() => {
                            villainTbody.innerHTML = renderSortedVillainStats(currentVillainData, currentVillainSortState);
                            
                            // Update sort indicator classes
                            villainHeaders.forEach(th => th.classList.remove('th-sort-asc', 'th-sort-desc'));
                            headerCell.classList.toggle('th-sort-asc', currentVillainSortState.asc);
                            headerCell.classList.toggle('th-sort-desc', !currentVillainSortState.asc);
                        });
                    }
                });
            });
        }
    });
    
    // Start observing the document for changes
    observer.observe(document.body, { 
        childList: true, 
        subtree: true 
    });
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
        
        console.log(`FIX_MODALS: Processing modal ${modalId} for villain: "${villainName}" (expected original case)`);
        // Use the passed allHitsFromStats for re-computation if needed
        const heroStats = ensureVillainDataAndGetStats(villainName);
        
        console.log(`FIX_MODALS: For villain "${villainName}", heroStats length: ${heroStats.length}. Rebuilding modal content.`);
        
        let heroRowsHtml = '';
        if (heroStats && heroStats.length > 0) {
            heroRowsHtml = heroStats.map(h => `
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
                console.log(`SHOW_DETAIL: Matched header to original name: "${villainName}" for ${id}`);
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
});