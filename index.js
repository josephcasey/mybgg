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
                                <tbody>${renderSortedHeroStats(stats.heroes, currentSortState)}</tbody>
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
                                <tbody>${renderSortedVillainStats(stats.villains, currentVillainSortState)}</tbody>
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
    // Filter hits for this villain
    const villainHits = hits.filter(hit => hit.villain === villainName);
    
    // Group by hero
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
    
    // Calculate win rates and convert to array
    return Object.values(heroStats).map(h => {
        h.winRate = h.plays > 0 ? Math.round((h.wins / h.plays) * 100) : 0;
        return h;
    }).sort((a, b) => b.plays - a.plays); // Sort by most played heroes first
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

function renderSortedVillainStats(villains, sortState) {
    const { column, asc, sortType } = sortState;
    const colMap = ['name', 'plays', 'wins', 'winRate'];

    const sorted = [...villains].sort((a, b) => {
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

    return sorted.map((villain, index) => {
        const heroStats = computeVillainHeroStats(villain.name, search.helper?.lastResults?.hits || []);
        const villainId = `villain-${index}-${villain.name.replace(/\W+/g, '')}`;
        
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
    }).join('') + `
        ${sorted.map((villain, index) => {
            const heroStats = computeVillainHeroStats(villain.name, search.helper?.lastResults?.hits || []);
            const villainId = `villain-${index}-${villain.name.replace(/\W+/g, '')}`;
            return `
            <div id="${villainId}" class="villain-modal" style="
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
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: white;
                    border: 2px solid #990000;
                    border-radius: 8px;
                    padding: 15px;
                    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                    min-width: 300px;
                    max-width: 90%;
                    max-height: 90%;
                    overflow: auto;
                    pointer-events: auto;
                ">
                    <div style="background-color: #e0e8ff; padding: 10px; margin-bottom: 10px; border-bottom: 1px solid #0000aa; border-radius: 5px;">
                        <h3 style="margin: 0; color: black; font-size: 18px; font-weight: bold; text-align: center;">HEROES FACED BY ${villain.name.toUpperCase()}</h3>
                    </div>
                    <div style="padding: 10px; background-color: white;">
                        <table style="width: 100%; border-collapse: collapse; background-color: white;">
                            <thead style="background-color: #cccccc;">
                                <tr>
                                    <th style="padding: 8px; text-align: left; color: black; border: 1px solid #cccccc; font-weight: bold;">Hero</th>
                                    <th style="padding: 8px; text-align: right; color: black; border: 1px solid #cccccc; font-weight: bold;">Plays</th>
                                    <th style="padding: 8px; text-align: right; color: black; border: 1px solid #cccccc; font-weight: bold;">Wins</th>
                                    <th style="padding: 8px; text-align: right; color: black; border: 1px solid #cccccc; font-weight: bold;">Win%</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${heroStats.map(h => `
                                    <tr style="background-color: white; border-bottom: 1px solid #dddddd;">
                                        <td style="padding: 8px; text-align: left; color: black; border: 1px solid #eeeeee;">${h.hero}</td>
                                        <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.plays}</td>
                                        <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.wins}</td>
                                        <td style="padding: 8px; text-align: right; color: black; border: 1px solid #eeeeee;">${h.winRate}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div style="margin-top: 15px; text-align: right; display: none;">
                        <button style="padding: 8px 15px; background-color: #f0f0f0; color: black; border: 1px solid #ddd; border-radius: 5px;">
                            Close
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('')}
    `;
}

// Update only this function to make it more efficient and cleaner
function showVillainDetail(id) {
    const modal = document.getElementById(id);
    if (modal) {
        // Show modal without affecting page scroll
        modal.style.display = 'block';
    }
}

function hideVillainDetail(id, event) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    const contentContainer = modal.querySelector('div');
    
    // Check if we're moving to the modal content itself
    if (event && event.relatedTarget && 
        (contentContainer.contains(event.relatedTarget) || contentContainer === event.relatedTarget)) {
        
        // Use a unique identifier for this handler to avoid multiple attachments
        const handlerId = `handler-${id}`;
        
        // Remove any existing handler to prevent duplicates
        if (contentContainer[handlerId]) {
            contentContainer.removeEventListener('mouseout', contentContainer[handlerId]);
        }
        
        // Create handler function
        contentContainer[handlerId] = function(e) {
            if (!contentContainer.contains(e.relatedTarget)) {
                modal.style.display = 'none';
                contentContainer.removeEventListener('mouseout', contentContainer[handlerId]);
                delete contentContainer[handlerId];
            }
        };
        
        // Add the handler
        contentContainer.addEventListener('mouseout', contentContainer[handlerId]);
        return;
    }
    
    // Otherwise, hide the modal
    modal.style.display = 'none';
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

// Update initialization to be more robust
document.addEventListener('DOMContentLoaded', function() {
    // Start the search
    search.start();
    
    // Initialize table sorting with better approach
    initTableSort();
});