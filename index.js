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
                                        <th data-sort="number" class="number-col">Win %</th>
                                    </tr>
                                </thead>
                                <tbody>${renderVillainStats(stats.villains)}</tbody>
                            </table>
                        </div>
                    </div>
                `;
            }
        }
    })
]);

// Modify the initTableSort function
function initTableSort() {
    const heroHeaders = document.querySelectorAll('.hero-stats table.sortable th');
    
    heroHeaders.forEach((headerCell, idx) => {
        headerCell.addEventListener('click', () => {
            if (isEditing) return;

            const sortType = headerCell.getAttribute('data-sort') || 'string';
            
            // Update sort state
            if (currentSortState.column === idx) {
                currentSortState.asc = !currentSortState.asc;
            } else {
                currentSortState.column = idx;
                currentSortState.asc = sortType === 'string';
                currentSortState.sortType = sortType;
            }

            // Update table content
            const heroTbody = document.querySelector('.hero-stats table.sortable tbody');
            if (heroTbody) {
                heroTbody.innerHTML = renderSortedHeroStats(currentHeroData, currentSortState);
            }

            // Update sort indicators
            heroHeaders.forEach(th => th.classList.remove('th-sort-asc', 'th-sort-desc'));
            headerCell.classList.toggle('th-sort-asc', currentSortState.asc);
            headerCell.classList.toggle('th-sort-desc', !currentSortState.asc);
        });
    });
}

function sortTableByColumn(table, column, asc = true, sortType = 'string') {
    const dirModifier = asc ? 1 : -1;
    const tBody = table.tBodies[0];
    const rowPairs = [];

    // Only select hero and bar rows for sorting
    const rows = Array.from(tBody.querySelectorAll('tr.hero-row, tr.bar-row'));

    // Find maximum plays for bar scaling (only from hero rows)
    const maxPlays = Math.max(
        ...rows
            .filter(row => row.classList.contains('hero-row'))
            .map(row => parseInt(row.querySelector('td:nth-child(2)')?.textContent) || 0)
    );

    // Pair hero rows with their bar rows
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.classList.contains('hero-row')) continue;

        const col = row.querySelector(`td:nth-child(${column + 1})`);
        const value = col?.textContent?.trim() || '';
        let sortValue;

        if (sortType === 'number') {
            // column: 1 = Plays, 2 = Wins, 3 = Win %
            if (column === 1 || column === 2) {
                // Plays or Wins: parse as integer
                sortValue = parseInt(value.replace(/,/g, ''), 10) || 0;
            } else if (column === 3) {
                // Win %: parse as float, remove %
                sortValue = parseFloat(value.replace('%', '')) || 0;
            } else {
                // fallback
                sortValue = parseFloat(value) || 0;
            }
        } else {
            sortValue = value;
        }

        // The next row should be the bar-row
        const barRow = rows[i + 1] && rows[i + 1].classList.contains('bar-row') ? rows[i + 1] : null;

        // Update bar widths if barRow exists
        if (barRow) {
            const plays = parseInt(row.querySelector('td:nth-child(2)')?.textContent) || 0;
            const wins = parseInt(row.querySelector('td:nth-child(3)')?.textContent) || 0;
            const winsWidth = (wins / maxPlays) * 100;
            const lossesWidth = ((plays - wins) / maxPlays) * 100;
            const winsBar = barRow.querySelector('.play-bar.wins');
            const lossesBar = barRow.querySelector('.play-bar.losses');
            if (winsBar) winsBar.style.width = `${winsWidth}%`;
            if (lossesBar) {
                lossesBar.style.width = `${lossesWidth}%`;
                lossesBar.style.left = `${winsWidth}%`;
            }
        }

        rowPairs.push({ row, barRow, sortValue });
        if (barRow) i++; // Skip the bar row in the next iteration
    }

    // Sort the pairs
    rowPairs.sort((a, b) => {
        if (sortType === 'number') {
            return (a.sortValue - b.sortValue) * dirModifier;
        }
        return a.sortValue.localeCompare(b.sortValue) * dirModifier;
    });

    // Clear and rebuild table
    while (tBody.firstChild) {
        tBody.removeChild(tBody.firstChild);
    }

    // Add sorted rows back
    rowPairs.forEach(pair => {
        tBody.appendChild(pair.row);
        if (pair.barRow) {
            tBody.appendChild(pair.barRow);
        }
    });

    // Update sort indicators
    table.querySelectorAll('th').forEach(th => th.classList.remove('th-sort-asc', 'th-sort-desc'));
    const headerCell = table.querySelector(`th:nth-child(${column + 1})`);
    headerCell.classList.toggle('th-sort-asc', asc);
    headerCell.classList.toggle('th-sort-desc', !asc);
}

function computeHeroVillainStats(heroName, hits) {
    // Initialize villain stats
    const villainStats = {};
    
    // Process all hits for this hero
    hits.forEach(hit => {
        if (hit.hero === heroName) {
            if (!villainStats[hit.villain]) {
                villainStats[hit.villain] = { plays: 0, wins: 0 };
            }
            villainStats[hit.villain].plays++;
            if (hit.win) {
                villainStats[hit.villain].wins++;
            }
        }
    });
    
    // Convert to array and sort by plays
    return Object.entries(villainStats)
        .map(([villain, stats]) => ({
            villain,
            plays: stats.plays,
            wins: stats.wins,
            winRate: ((stats.wins / stats.plays) * 100).toFixed(1)
        }))
        .sort((a, b) => b.plays - a.plays);
}

function renderHeroStats(heroes) {
    // Calculate maximum plays for scaling
    const maxPlays = Math.max(...heroes.map(hero => hero.plays));
    
    return heroes.map(hero => {
        const winRate = hero.plays > 0 ? ((hero.wins / hero.plays) * 100).toFixed(1) : '0.0';
        // Calculate widths as percentage of max plays
        const totalWidth = (hero.plays / maxPlays) * 100;
        const winsWidth = (hero.wins / maxPlays) * 100;
        const lossesWidth = ((hero.plays - hero.wins) / maxPlays) * 100;
        
        return `
            <tr class="hero-row">
                <td class="hero-name">${hero.name}
                    <div class="villain-details-popup">${renderVillainDetails(hero)}</div>
                </td>
                <td class="number-col">${hero.plays}</td>
                <td class="number-col">${hero.wins}</td>
                <td class="number-col">${winRate}%</td>
            </tr>
            <tr class="bar-row">
                <td colspan="4">
                    <div class="play-bar wins" style="width: ${winsWidth}%"></div>
                    <div class="play-bar losses" style="width: ${lossesWidth}%; left: ${winsWidth}%"></div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderSortedHeroStats(heroes, sortState) {
    const { column, asc, sortType } = sortState;
    
    // Sort heroes array
    const sorted = [...heroes].sort((a, b) => {
        let aVal, bVal;
        
        switch(column) {
            case 0: // Hero name
                return asc ? 
                    a.name.localeCompare(b.name) : 
                    b.name.localeCompare(a.name);
            case 1: // Plays
                return asc ? 
                    a.plays - b.plays : 
                    b.plays - a.plays;
            case 2: // Wins
                return asc ? 
                    a.wins - b.wins : 
                    b.wins - a.wins;
            case 3: // Win %
                const aRate = parseFloat(a.winRate);
                const bRate = parseFloat(b.winRate);
                return asc ? 
                    aRate - bRate : 
                    bRate - aRate;
            default:
                return 0;
        }
    });

    // Calculate max plays for bar scaling
    const maxPlays = Math.max(...sorted.map(hero => hero.plays));
    
    return sorted.map(hero => {
        const winsWidth = (hero.wins / maxPlays) * 100;
        const lossesWidth = ((hero.plays - hero.wins) / maxPlays) * 100;
        
        return `
            <tr class="hero-row">
                <td class="hero-name">${hero.name}
                    <div class="villain-details-popup">${renderVillainDetails(hero)}</div>
                </td>
                <td class="number-col">${hero.plays}</td>
                <td class="number-col">${hero.wins}</td>
                <td class="number-col">${hero.winRate}%</td>
            </tr>
            <tr class="bar-row">
                <td colspan="4">
                    <div class="play-bar wins" style="width: ${winsWidth}%"></div>
                    <div class="play-bar losses" style="width: ${lossesWidth}%; left: ${winsWidth}%"></div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderVillainStats(villains) {
    return villains.map(villain => {
        const winRate = villain.plays > 0 ? ((villain.wins / villain.plays) * 100).toFixed(1) : '0.0';
        return `
            <tr class="villain-row">
                <td>${villain.name}</td>
                <td class="number-col">${villain.plays}</td>
                <td class="number-col">${villain.wins}</td>
                <td class="number-col ${getDifficultyClass(winRate)}">${winRate}%</td>
            </tr>
        `;
    }).join('');
}

function renderVillainDetails(hero) {
    // Get villain stats for this hero
    const villainStats = computeHeroVillainStats(hero.name, search.helper?.lastResults?.hits || []);
    
    return `
        <div class="villain-details-header">
            <h4>${hero.name}'s Villain Record</h4>
        </div>
        <table class="villain-details-table">
            <thead>
                <tr>
                    <th>Villain</th>
                    <th>Plays</th>
                    <th>Wins</th>
                    <th>Win%</th>
                </tr>
            </thead>
            <tbody>
                ${villainStats.map(v => `
                    <tr>
                        <td>${v.villain}</td>
                        <td>${v.plays}</td>
                        <td>${v.wins}</td>
                        <td class="${getWinRateClass(v.winRate)}">${v.winRate}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Single render event listener
search.on('render', () => {
    const results = search.helper?.lastResults;
    if (results?.hits) {
        console.log('Search state:', {
            totalHits: results.nbHits,
            processedHits: results.hits.length,
            currentPage: results.page,
            totalPages: results.nbPages
        });
    }

    // Initialize table sorting only
    setTimeout(() => {
        initTableSort();
    }, 100);
});

// Add debug logging for stats computation
function computeStats(hits) {
    console.log('Computing stats for hits:', hits.length);
    
    const heroStats = {};
    const villainStats = {};

    hits.forEach(hit => {
        // Validate data first
        if (!hit.hero || !hit.villain) {
            console.log('Invalid hit data:', hit);
            return;
        }

        // Process hero stats - ensure we're only counting unique hero names
        const heroName = hit.hero.trim();
        if (!heroStats[heroName]) {
            heroStats[heroName] = { plays: 0, wins: 0 };
        }
        heroStats[heroName].plays++;
        if (hit.win) heroStats[heroName].wins++;

        // Process villain stats - ensure we're only counting unique villain names
        const villainName = hit.villain.trim();
        if (!villainStats[villainName]) {
            villainStats[villainName] = { plays: 0, wins: 0 };
        }
        villainStats[villainName].plays++;
        if (hit.win) villainStats[villainName].wins++;
    });

    // Convert to arrays and deduplicate
    const heroes = Object.entries(heroStats)
        .map(([name, stats]) => ({
            name,
            plays: stats.plays,
            wins: stats.wins,
            winRate: ((stats.wins / stats.plays) * 100).toFixed(1)
        }))
        .filter(hero => !hero.name.includes('1/2') && !hero.name.includes('2/3'))  // Filter out villain patterns
        .sort((a, b) => b.plays - a.plays);

    const villains = Object.entries(villainStats)
        .map(([name, stats]) => ({
            name,
            plays: stats.plays,
            wins: stats.wins,
            winRate: ((stats.wins / stats.plays) * 100).toFixed(1)
        }))
        .sort((a, b) => b.plays - a.plays);

    console.log('Stats computed:', { 
        heroCount: heroes.length, 
        villainCount: villains.length,
        heroNames: heroes.map(h => h.name)  // Debug output
    });

    return { heroes, villains };
}

// Helper function to determine win rate class
function getWinRateClass(winRate) {
    const rate = parseFloat(winRate);
    if (rate >= 70) return 'win-rate-high';
    if (rate >= 40) return 'win-rate-medium';
    return 'win-rate-low';
}

function getDifficultyClass(winRate) {
    const rate = parseFloat(winRate);
    if (rate >= 70) return 'difficulty-easy';
    if (rate >= 40) return 'difficulty-medium';
    return 'difficulty-hard';
}

function getDifficultyLabel(winRate) {
    const rate = parseFloat(winRate);
    if (rate >= 70) return 'Easy';
    if (rate >= 40) return 'Medium';
    return 'Hard';
}

// Add error handling for search
search.on('error', (error) => {
    console.error('Search error:', error);
});

// Start search
search.start();
search.on('error', (error) => {
    console.error('Search error:', error);
});