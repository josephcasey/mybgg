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
                                <tbody>${renderHeroStats(stats.heroes)}</tbody>
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
    const headers = document.querySelectorAll('table.sortable th');
    console.log('Table headers found:', {
        count: headers.length,
        headers: Array.from(headers).map(h => ({
            text: h.textContent,
            classes: h.className,
            sortType: h.getAttribute('data-sort')
        }))
    });

    headers.forEach(headerCell => {
        headerCell.addEventListener('click', () => {
            // Don't sort if currently editing
            if (isEditing) {
                console.log('Sorting prevented - editing in progress');
                return;
            }

            const tableElement = headerCell.parentElement.parentElement.parentElement;
            const headerIndex = Array.prototype.indexOf.call(headerCell.parentElement.children, headerCell);
            const currentIsAscending = headerCell.classList.contains('th-sort-asc');
            const sortType = headerCell.getAttribute('data-sort') || 'string';

            // Clear sort indicators from other columns
            tableElement.querySelectorAll('th').forEach(th => {
                if (th !== headerCell) {
                    th.classList.remove('th-sort-asc', 'th-sort-desc');
                }
            });

            sortTableByColumn(tableElement, headerIndex, !currentIsAscending, sortType);
        });
    });
}

function sortTableByColumn(table, column, asc = true, sortType = 'string') {
    const dirModifier = asc ? 1 : -1;
    const tBody = table.tBodies[0];
    const rowPairs = [];
    const rows = Array.from(tBody.querySelectorAll('tr:not(.bar-row)'));
    
    // Find maximum plays for bar scaling
    const maxPlays = Math.max(...Array.from(table.querySelectorAll('td:nth-child(2)'))
        .map(cell => parseInt(cell.textContent) || 0));
    
    // Create pairs of rows and their data
    rows.forEach(row => {
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
            // Get plays and wins for this hero
            const plays = parseInt(row.querySelector('td:nth-child(2)').textContent) || 0;
            const wins = parseInt(row.querySelector('td:nth-child(3)').textContent) || 0;
            
            // Calculate bar widths relative to maxPlays
            const winsWidth = (wins / maxPlays) * 100;
            const lossesWidth = ((plays - wins) / maxPlays) * 100;
            
            // Update bar widths
            const winsBar = barRow.querySelector('.play-bar.wins');
            const lossesBar = barRow.querySelector('.play-bar.losses');
            if (winsBar) winsBar.style.width = `${winsWidth}%`;
            if (lossesBar) {
                lossesBar.style.width = `${lossesWidth}%`;
                lossesBar.style.left = `${winsWidth}%`;
            }
            
            rowPairs.push({ row, barRow, sortValue });
        } else {
            rowPairs.push({ row, sortValue });
        }
    });

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