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

let heroImageData = {}; // To store hero image data

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
        } else { // Win % (column 3)
            aVal = parseFloat(a.winRate);
            bVal = parseFloat(b.winRate);
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
        console.log('DEBUG: renderSortedHeroStats - First 3 sorted:', sorted.slice(0, 3).map(h => ({ name: h.name, plays: h.plays, wins: h.wins, winRate: h.winRate })));
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
        let heroNameDisplay = escapeHTML(hero.name);
        
        const baseTargetHeroName = "Shadowcat";
        const heroNameIsString = typeof hero.name === 'string';
        const heroNameStartsWithTarget = heroNameIsString && hero.name.startsWith(baseTargetHeroName);

        if (heroNameIsString && heroNameStartsWithTarget) { 
            if (heroImageData && heroImageData[baseTargetHeroName] && heroImageData[baseTargetHeroName].image) {
                const imageUrl = escapeHTML(heroImageData[baseTargetHeroName].image);
                heroNameDisplay += ` <img src="${imageUrl}" alt="${escapeHTML(baseTargetHeroName)}" style="max-height: 20px; max-width: 30px; vertical-align: middle; margin-left: 5px; border-radius: 3px;">`;
            }
        }

        tableRowsHtml += `
            <tr class="hero-row">
                <td class="hero-name" style="position: relative; cursor: pointer;" 
                    onmouseover="showHeroDetail('${heroModalId}');"
                    onmouseout="hideHeroDetail('${heroModalId}', event);">
                    ${heroNameDisplay}
                </td>
                <td class="number-col">${hero.plays}</td>
                <td class="number-col">${hero.wins}</td>
                <td class="number-col">${hero.winRate}%</td>
            </tr>
            <tr class="bar-row">
                <td colspan="4">
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
                max-width: 90%;
                max-height: 90%;
                overflow: auto;
                pointer-events: auto;
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
        } else { // Win % (column 3)
            aVal = parseFloat(a.winRate);
            bVal = parseFloat(b.winRate);
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
        console.log('DEBUG: renderSortedVillainStats - First 3 sorted:', sorted.slice(0, 3).map(v => ({ name: v.name, plays: v.plays, wins: v.wins, winRate: v.winRate })));
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

    sorted.forEach((villain, index) => {
        const safeVillainName = villain.name.replace(/[^a-zA-Z0-9]/g, '');
        const villainId = `villain-${index}-${safeVillainName}`;
        
        tableRowsHtml += `
            <tr class="villain-row">
                <td class="villain-name" style="position: relative; cursor: pointer;" 
                    onmouseover="showVillainDetail('${villainId}');"
                    onmouseout="hideVillainDetail('${villainId}', event);">
                    ${escapeHTML(villain.name)}
                </td>
                <td class="number-col">${villain.plays}</td>
                <td class="number-col">${villain.wins}</td>
                <td class="number-col win-rate-col">${villain.winRate}%</td>
            </tr>
            <tr class="bar-row">
                <td colspan="4">
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
                max-width: 90%;
                max-height: 90%;
                overflow: auto;
                pointer-events: auto;
                color: black;
            ">
                <div class="villain-modal-header" style="background-color: #ffe0e0; padding: 10px; margin-bottom: 10px; border-bottom: 1px solid #990000; border-radius: 5px;">
                     <h3 style="margin: 0; color: black; font-size: 18px; font-weight: bold; text-align: center;">HEROES FACED BY ${escapeHTML(villain.name).toUpperCase()}</h3>
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

function initTableSort() {
    console.log("DEBUG: initTableSort called");
    const headers = document.querySelectorAll('table.sortable th[data-sort]');
    console.log('DEBUG: Table headers found:', {
        count: headers.length,
        headers: Array.from(headers).map(h => ({
            text: h.textContent,
            classes: h.className,
            sortType: h.getAttribute('data-sort')
        }))
    });

    headers.forEach(headerCell => {
        if (window.tableSortHandlers.has(headerCell)) {
            headerCell.removeEventListener('click', window.tableSortHandlers.get(headerCell));
            window.tableSortHandlers.delete(headerCell);
        }

        const newHandler = (event) => {
            console.log(`DEBUG: Header clicked: ${headerCell.textContent}`);
            
            if (isEditing) {
                console.log('Sorting prevented - editing in progress');
                return;
            }

            const tableElement = headerCell.closest('table.sortable');
            if (!tableElement) {
                console.error("DEBUG: Could not find parent table.sortable for header:", headerCell);
                return;
            }
            
            const headerIndex = Array.prototype.indexOf.call(headerCell.parentElement.children, headerCell);
            const sortType = headerCell.getAttribute('data-sort') || 'string';
            
            let newAscending;
            let targetSortState = null;

            if (tableElement.closest('.left-box-sbs')) {
                targetSortState = currentSortState;
                console.log("DEBUG: Identified Hero table, using currentSortState:", currentSortState);
            } else if (tableElement.closest('.right-box-sbs')) {
                targetSortState = currentVillainSortState;
                console.log("DEBUG: Identified Villain table, using currentVillainSortState:", currentVillainSortState);
            }


            if (targetSortState) {
                if (targetSortState.column === headerIndex) {
                    newAscending = !targetSortState.asc;
                    console.log(`DEBUG: Same column (${headerIndex}), toggling asc to ${newAscending}`);
                } else {
                    newAscending = false; // New column, default to descending
                    console.log(`DEBUG: New column (${headerIndex}), setting asc to false (descending)`);
                }
                targetSortState.column = headerIndex;
                targetSortState.asc = newAscending; // This should be a boolean
                targetSortState.sortType = sortType;
            } else {
                console.warn("DEBUG: targetSortState not identified. Using visual fallback for sort direction.");
                if (headerCell.classList.contains('th-sort-asc') || headerCell.classList.contains('th-sort-desc')) {
                    newAscending = headerCell.classList.contains('th-sort-desc'); 
                } else {
                    newAscending = false; // Default to descending for a fresh click
                }
                console.log(`DEBUG: Fallback: newAscending set to ${newAscending}`);
            }
            
            tableElement.querySelectorAll('th[data-sort]').forEach(th => {
                th.classList.remove('th-sort-asc', 'th-sort-desc');
            });
            headerCell.classList.add(newAscending === true ? 'th-sort-asc' : 'th-sort-desc');
            
            event.stopPropagation();
            
            sortTableByColumn(tableElement, headerIndex, newAscending, sortType);
        };

        headerCell.addEventListener('click', newHandler);
        window.tableSortHandlers.set(headerCell, newHandler);
        console.log(`DEBUG: Added click handler to header: ${headerCell.textContent}`);
    });
}

// sortTableByColumn function (as provided in your last context, lines 965-1017)
function sortTableByColumn(table, column, asc = true, sortType = 'string') {
    console.log(`DEBUG: sortTableByColumn called:`, {
        table: table ? table.className : 'null', // Avoid logging full element
        column: column,
        asc: asc,
        sortType: sortType
    });
    
    const dirModifier = asc ? 1 : -1;
    const tBody = table.tBodies[0];
    if (!tBody) {
        console.error("DEBUG: tBody not found in table:", table);
        return;
    }
    console.log(`DEBUG: tBody found`);
    
    const rowPairs = [];
    // Ensure we only select direct children tr elements of tbody that are not .bar-row
    const rows = Array.from(tBody.children).filter(tr => tr.tagName === 'TR' && !tr.classList.contains('bar-row'));
    console.log(`DEBUG: Found ${rows.length} data rows to sort`);
    
    rows.forEach((row, i) => {
        const col = row.querySelector(`td:nth-child(${column + 1})`);
        const value = col?.textContent?.trim() || '';
        let sortValue;
        
        if (sortType === 'number') {
            sortValue = parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
            if (value.includes('%')) { // Handle percentages correctly
                 sortValue = parseFloat(value.replace('%', '')) || 0;
            }
        } else {
            sortValue = value.toLowerCase(); // Case-insensitive sort for strings
        }
        
        const barRow = row.nextElementSibling;
        if (barRow?.classList.contains('bar-row')) {
            rowPairs.push({ row, barRow, sortValue });
        } else {
            // If no barRow, push only the data row. This handles tables without bar rows.
            rowPairs.push({ row, sortValue }); 
        }
        
        if (i < 3) { // Log first few for brevity
            // console.log(`DEBUG: Row ${i} data:`, { text: value, sortValue: sortValue, hasBarRow: !!(barRow?.classList.contains('bar-row')) });
        }
    });

    console.log(`DEBUG: About to sort ${rowPairs.length} row pairs. First pair sortValue: ${rowPairs.length > 0 ? rowPairs[0].sortValue : 'N/A'}`);
    
    rowPairs.sort((a, b) => {
        if (sortType === 'number') {
            // Handle NaN values to prevent sort errors, typically by pushing them to one end
            if (isNaN(a.sortValue) && isNaN(b.sortValue)) return 0;
            if (isNaN(a.sortValue)) return asc ? 1 : -1; // NaNs last for asc, first for desc
            if (isNaN(b.sortValue)) return asc ? -1 : 1; // NaNs last for asc, first for desc
            return (a.sortValue - b.sortValue) * dirModifier;
        }
        // String comparison
        return a.sortValue.localeCompare(b.sortValue) * dirModifier;
    });

    // console.log(`DEBUG: First 3 rows after sorting:`, rowPairs.slice(0, 3).map(p => ({ sortValue: p.sortValue, text: p.row.cells[column]?.textContent.trim() })));
    
    console.log(`DEBUG: Clearing table body`);
    while (tBody.firstChild) {
        tBody.removeChild(tBody.firstChild);
    }

    console.log(`DEBUG: Adding sorted rows back to table`);
    rowPairs.forEach(pair => {
        tBody.appendChild(pair.row);
        if (pair.barRow) { // Only append barRow if it exists for this pair
            tBody.appendChild(pair.barRow);
        }
    });

    console.log(`DEBUG: Updating sort indicators in sortTableByColumn`);
    table.querySelectorAll('th[data-sort]').forEach(th => th.classList.remove('th-sort-asc', 'th-sort-desc'));
    const headerCell = table.querySelector(`th:nth-child(${column + 1})`);
    if (headerCell && headerCell.hasAttribute('data-sort')) {
        headerCell.classList.add(asc === true ? 'th-sort-asc' : 'th-sort-desc');
    }
    
    console.log(`DEBUG: Table sort complete for column ${column}`);
}

// Functions to show/hide hero detail modals
function showHeroDetail(id) {
    console.log(`Showing hero detail for ID: ${id}`);
    const modal = document.getElementById(id);
    if (!modal) {
        console.error(`Modal NOT found for ID ${id}`);
        return;
    }
    // Ensure content is up-to-date if dynamic loading were added, but here it's pre-rendered.
    // Forcing a check and potential rebuild if table is missing.
    const heroName = modal.dataset.heroName; // Assumes heroName is stored in data-hero-name
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

// Functions to show/hide villain detail modals
function showVillainDetail(id) {
    console.log(`SHOW_DETAIL: Showing villain detail for ID: ${id}`);
    const modal = document.getElementById(id);
    if (!modal) {
        console.error(`SHOW_DETAIL: Modal NOT found for ID ${id}`);
        return;
    }

    let villainName = modal.dataset.villainName; // Original case from data attribute

    // Fallback logic for villainName if data attribute is missing
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
        // Add more specific fallbacks if necessary, e.g., for names with slashes
        if (!villainName && id.includes('Crossbones12')) villainName = 'Crossbones1/2'; // Example
        if (!villainName && id.includes('Crossbones23')) villainName = 'Crossbones 2/3'; // Example
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
    
    const table = modal.querySelector('table.villain-heroes-table');
    const noDataRow = modal.querySelector('td[colspan="4"]'); // Check for "No hero data" message
    const heroStatsForModal = window.heroStatsCache ? (window.heroStatsCache[villainName] || []) : [];

    if (!table || (noDataRow && heroStatsForModal.length > 0)) {
        console.warn(`SHOW_DETAIL: Table missing or incorrect for ${id} ("${villainName}"). Forcing rebuild. Cached stats count: ${heroStatsForModal.length}`);
        
        const bodyDiv = modal.querySelector('.villain-modal-body');
        if (bodyDiv) {
            let heroRowsHtml = '';
            if (heroStatsForModal.length > 0) {
                heroRowsHtml = heroStatsForModal.map(h => `
                    <tr style="background-color: white !important; border-bottom: 1px solid #dddddd;">
                        <td style="padding: 8px; text-align: left; color: black !important; border: 1px solid #eeeeee;">${escapeHTML(h.hero) || 'Unknown'}</td>
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

function hideVillainDetail(id, event) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    const contentContainer = modal.querySelector('div'); // Assuming the first div is the main content wrapper
    
    // Check if we're moving to the modal content itself
    if (event && event.relatedTarget && contentContainer &&
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
                        delete contentContainer._hideTimeout;
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

document.addEventListener('DOMContentLoaded', function() {
    // ... (search.start(), fetch hero_images.json, overlay/box creation, style element) ...
    // (Assuming these parts are as per your existing file and don't need collation here unless specified)
    search.start();

    fetch('hero_images.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            heroImageData = data;
            console.log('Hero image data loaded successfully for in-row display.');
        })
        .catch(error => console.error('Error loading hero_images.json:', error));

    const staticTestContainer = document.getElementById('static-hero-image-test-container');
    if (staticTestContainer) {
        staticTestContainer.remove();
    }

    const overlay = document.getElementById('side-by-side-experiment') || document.createElement('div');
    if (!overlay.id) { // If newly created
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
        document.body.appendChild(overlay);
    }


    const leftBox = overlay.querySelector('.left-box-sbs') || document.createElement('div');
    if (!leftBox.classList.contains('left-box-sbs')) {
        leftBox.classList.add('left-box-sbs');
        leftBox.style.flex = '1 1 50%';
        leftBox.style.height = '100%';
        leftBox.style.overflowY = 'auto';
        leftBox.innerHTML = ''; // Clear if re-attaching
        if (!overlay.contains(leftBox)) overlay.appendChild(leftBox);
    }


    const rightBox = overlay.querySelector('.right-box-sbs') || document.createElement('div');
     if (!rightBox.classList.contains('right-box-sbs')) {
        rightBox.classList.add('right-box-sbs');
        rightBox.style.flex = '1 1 50%';
        rightBox.style.height = '100%';
        rightBox.style.overflowY = 'auto';
        rightBox.innerHTML = ''; // Clear if re-attaching
        if (!overlay.contains(rightBox)) overlay.appendChild(rightBox);
    }

    // Ensure leftBox is first child, rightBox is second if they were just created/found
    if (overlay.children[0] !== leftBox && overlay.contains(leftBox)) overlay.insertBefore(leftBox, overlay.firstChild);
    if (overlay.children[1] !== rightBox && overlay.contains(rightBox)) {
        if (overlay.children[0] === leftBox) overlay.insertBefore(rightBox, leftBox.nextSibling);
        else overlay.appendChild(rightBox);
    }


    const style = document.getElementById('sbs-styles') || document.createElement('style');
    if(!style.id) {
        style.id = 'sbs-styles';
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
          .statistics { /* This is your main stats container for flex */
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
          .hero-stats, .villain-stats { /* These are children of .statistics */
            flex: 1 1 50% !important;
            min-width: 300px !important; /* Or your preferred min-width */
            max-width: 48% !important; /* Allows for gap */
            box-sizing: border-box !important;
            overflow: auto !important; /* Important for content scroll */
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
            background: #f5f5f5; /* Or your theme's header background */
            z-index: 2; /* Keeps header above scrolling content */
          }
        `;
        document.head.appendChild(style);
    }

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
        
        const { tableRowsHtml, modalsHtml } = renderSortedHeroStats(stats.heroes, currentSortState, hits);
        const heroTableHtml = `
          <div style="font-weight:bold;margin-bottom:8px;">Hero Table (Direct Render)</div>
          <table class="stats-table sortable">
            <thead>
              <tr>
                <th data-sort="string" class="hero-col" style="width: 40%;">Hero</th>
                <th data-sort="number" class="number-col" style="width: 20%;">Plays</th>
                <th data-sort="number" class="number-col" style="width: 20%;">Wins</th>
                <th data-sort="number" class="number-col win-rate-col" style="width: 20%; display: table-cell;">Win %</th>
              </tr>
            </thead>
            <tbody>${tableRowsHtml}</tbody>
          </table>
          ${modalsHtml}
        `;
        if (leftBox) leftBox.innerHTML = heroTableHtml;

        const { tableRowsHtml: villainRowsHtml, modalsHtml: villainModalsHtml } = renderSortedVillainStats(stats.villains, currentVillainSortState, hits);
        const villainTableHtml = `
          <div style="font-weight:bold;margin-bottom:8px;">Villain Table (Direct Render)</div>
          <table class="stats-table sortable">
            <thead>
              <tr>
                <th data-sort="string" class="villain-col" style="width: 40%;">Villain</th>
                <th data-sort="number" class="number-col" style="width: 20%;">Plays</th>
                <th data-sort="number" class="number-col" style="width: 20%;">Hero Wins</th>
                <th data-sort="number" class="number-col win-rate-col" style="width: 20%; display: table-cell;">Win %</th>
              </tr>
            </thead>
            <tbody>${villainRowsHtml}</tbody>
          </table>
          ${villainModalsHtml}
        `;
        if (rightBox) rightBox.innerHTML = villainTableHtml;
        
        if (typeof initTableSort === 'function') {
          initTableSort();
        }

        // Apply initial sort indicators
        console.log(`DEBUG: DOMContentLoaded - Applying initial indicators. Hero asc: ${currentSortState.asc}, Villain asc: ${currentVillainSortState.asc}`);
        if (leftBox) {
            const heroTableElement = leftBox.querySelector('table.stats-table');
            if (heroTableElement) {
                const headerCells = heroTableElement.querySelectorAll('thead tr th');
                headerCells.forEach(th => th.classList.remove('th-sort-asc', 'th-sort-desc'));
                const targetHeroHeader = headerCells[currentSortState.column];
                if (targetHeroHeader) {
                    targetHeroHeader.classList.add(currentSortState.asc === true ? 'th-sort-asc' : 'th-sort-desc');
                }
            }
        }
        if (rightBox) {
            const villainTableElement = rightBox.querySelector('table.stats-table');
            if (villainTableElement) {
                const headerCells = villainTableElement.querySelectorAll('thead tr th');
                headerCells.forEach(th => th.classList.remove('th-sort-asc', 'th-sort-desc'));
                const targetVillainHeader = headerCells[currentVillainSortState.column];
                if (targetVillainHeader) {
                    targetVillainHeader.classList.add(currentVillainSortState.asc === true ? 'th-sort-asc' : 'th-sort-desc');
                }
            }
        }
    }, 500);
});

search.on('render', () => {
    const results = search.helper?.lastResults;
    if (results?.hits) {
        const allHits = results.hits;
        const statsData = computeStats(allHits);

        currentHeroData = statsData.heroes;
        currentVillainData = statsData.villains;

        console.log(`DEBUG: search.on('render') - BEFORE hero render. currentSortState.asc: ${currentSortState.asc} (type: ${typeof currentSortState.asc})`);
        console.log(`DEBUG: search.on('render') - BEFORE villain render. currentVillainSortState.asc: ${currentVillainSortState.asc} (type: ${typeof currentVillainSortState.asc})`);

        setTimeout(() => {
            const leftBox = document.querySelector('#side-by-side-experiment .left-box-sbs');
            const rightBox = document.querySelector('#side-by-side-experiment .right-box-sbs');

            if (leftBox && rightBox) {
                const { tableRowsHtml: heroRows, modalsHtml: heroModals } = renderSortedHeroStats(statsData.heroes, currentSortState, allHits);
                const heroTableHtml = `
                  <div style="font-weight:bold;margin-bottom:8px;">Hero Table (Render Event)</div>
                  <table class="stats-table sortable">
                    <thead>
                      <tr>
                        <th data-sort="string" class="hero-col" style="width: 40%;">Hero</th>
                        <th data-sort="number" class="number-col" style="width: 20%;">Plays</th>
                        <th data-sort="number" class="number-col" style="width: 20%;">Wins</th>
                        <th data-sort="number" class="number-col win-rate-col" style="width: 20%; display: table-cell;">Win %</th>
                      </tr>
                    </thead>
                    <tbody>${heroRows}</tbody>
                  </table>
                  ${heroModals}
                `;
                leftBox.innerHTML = heroTableHtml;

                const { tableRowsHtml: villainRows, modalsHtml: villainModals } = renderSortedVillainStats(statsData.villains, currentVillainSortState, allHits);
                const villainTableHtml = `
                  <div style="font-weight:bold;margin-bottom:8px;">Villain Table (Render Event)</div>
                  <table class="stats-table sortable">
                    <thead>
                      <tr>
                        <th data-sort="string" class="villain-col" style="width: 40%;">Villain</th>
                        <th data-sort="number" class="number-col" style="width: 20%;">Plays</th>
                        <th data-sort="number" class="number-col" style="width: 20%;">Hero Wins</th>
                        <th data-sort="number" class="number-col win-rate-col" style="width: 20%; display: table-cell;">Win %</th>
                      </tr>
                    </thead>
                    <tbody>${villainRows}</tbody>
                  </table>
                  ${villainModals}
                `;
                rightBox.innerHTML = villainTableHtml;
            }
            
            initTableSort();

            console.log(`DEBUG: search.on('render') - Applying indicators. Hero asc: ${currentSortState.asc}, Villain asc: ${currentVillainSortState.asc}`);
            if (leftBox) {
                const heroTableElement = leftBox.querySelector('table.stats-table');
                if (heroTableElement) {
                    const headerCells = heroTableElement.querySelectorAll('thead tr th');
                    headerCells.forEach(th => th.classList.remove('th-sort-asc', 'th-sort-desc'));
                    const targetHeroHeader = headerCells[currentSortState.column];
                    if (targetHeroHeader) {
                        targetHeroHeader.classList.add(currentSortState.asc === true ? 'th-sort-asc' : 'th-sort-desc');
                    }
                }
            }
            if (rightBox) {
                const villainTableElement = rightBox.querySelector('table.stats-table');
                if (villainTableElement) {
                    const headerCells = villainTableElement.querySelectorAll('thead tr th');
                    headerCells.forEach(th => th.classList.remove('th-sort-asc', 'th-sort-desc'));
                    const targetVillainHeader = headerCells[currentVillainSortState.column];
                    if (targetVillainHeader) {
                        targetVillainHeader.classList.add(currentVillainSortState.asc === true ? 'th-sort-asc' : 'th-sort-desc');
                    }
                }
            }

            if (typeof fixVillainModals === 'function') {
                fixVillainModals(statsData.villains, allHits);
            }
            
            // --- BEGIN DIAGNOSTIC FLEXBOX DEBUG ---
            const statsContainer = document.querySelector('.statistics'); // This is the main flex container for stats
            if (statsContainer) {
                // ... (your flexbox debug code) ...
            }
            // --- END DIAGNOSTIC FLEXBOX DEBUG ---
        }, 500);
    } else {
        const leftBox = document.querySelector('#side-by-side-experiment .left-box-sbs');
        const rightBox = document.querySelector('#side-by-side-experiment .right-box-sbs');
        if (leftBox) leftBox.innerHTML = '<p style="text-align:center; padding-top:20px;">No hero data to display.</p>';
        if (rightBox) rightBox.innerHTML = '<p style="text-align:center; padding-top:20px;">No villain data to display.</p>';
    }
});