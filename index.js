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
                                        <th data-sort="string">Hero</th>
                                        <th data-sort="number">Plays</th>
                                        <th data-sort="number">Wins</th>
                                        <th data-sort="number">Win Rate</th>
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
                                        <th data-sort="string">Villain</th>
                                        <th data-sort="number">Plays</th>
                                        <th data-sort="number">Hero Wins</th>
                                        <th data-sort="number">Win Rate</th>
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

// Add sorting functionality first
function initTableSort() {
    document.querySelectorAll('table.sortable th').forEach(headerCell => {
        headerCell.addEventListener('click', () => {
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
    const rows = Array.from(tBody.querySelectorAll('tr'));

    const sortedRows = rows.sort((a, b) => {
        const aCol = a.querySelector(`td:nth-child(${column + 1})`);
        const bCol = b.querySelector(`td:nth-child(${column + 1})`);
        let aColText = aCol.textContent.trim();
        let bColText = bCol.textContent.trim();

        if (sortType === 'number') {
            // Remove % and convert to number
            const aNum = parseFloat(aColText.replace('%', ''));
            const bNum = parseFloat(bColText.replace('%', ''));
            if (aNum === bNum) {
                return 0;
            }
            return aNum > bNum ? dirModifier : -dirModifier;
        } else {
            // String comparison
            if (aColText === bColText) {
                return 0;
            }
            return aColText > bColText ? dirModifier : -dirModifier;
        }
    });

    // Remove existing rows
    while (tBody.firstChild) {
        tBody.removeChild(tBody.firstChild);
    }

    // Add sorted rows
    tBody.append(...sortedRows);

    // Update sort indicators
    table.querySelectorAll('th').forEach(th => {
        th.classList.remove('th-sort-asc', 'th-sort-desc');
    });
    const headerCell = table.querySelector(`th:nth-child(${column + 1})`);
    headerCell.classList.toggle('th-sort-asc', asc);
    headerCell.classList.toggle('th-sort-desc', !asc);
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

    // Initialize table sorting
    setTimeout(initTableSort, 100);
});

// Add debug logging for stats computation
function computeStats(hits) {
    console.log('Computing stats for hits:', hits.length);
    
    const heroStats = {};
    const villainStats = {};

    hits.forEach(hit => {
        const hero = hit.hero;
        const villain = hit.villain;
        const win = hit.win;

        // Process hero stats
        if (hero) {
            if (!heroStats[hero]) {
                heroStats[hero] = { plays: 0, wins: 0 };
            }
            heroStats[hero].plays++;
            if (win) heroStats[hero].wins++;
        }

        // Process villain stats
        if (villain) {
            if (!villainStats[villain]) {
                villainStats[villain] = { plays: 0, wins: 0 };
            }
            villainStats[villain].plays++;
            if (win) villainStats[villain].wins++;
        }
    });

    // Convert to arrays and sort by plays
    const heroes = Object.entries(heroStats)
        .map(([name, stats]) => ({
            name,
            plays: stats.plays,
            wins: stats.wins,
            winRate: ((stats.wins / stats.plays) * 100).toFixed(1)
        }))
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
        villainCount: villains.length 
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

function renderHeroStats(heroes) {
    return heroes.map(hero => `
        <tr>
            <td>${hero.name}</td>
            <td>${hero.plays}</td>
            <td>${hero.wins}</td>
            <td class="${getWinRateClass(hero.winRate)}">${hero.winRate}%</td>
        </tr>
    `).join('');
}

function renderVillainStats(villains) {
    return villains.map(villain => `
        <tr>
            <td>${villain.name}</td>
            <td>${villain.plays}</td>
            <td>${villain.wins}</td>
            <td class="${getDifficultyClass(villain.winRate)}">${villain.winRate}%</td>
        </tr>
    `).join('');
}

// Add error handling for search
search.on('error', (error) => {
    console.error('Search error:', error);
});

// Start search
search.start();