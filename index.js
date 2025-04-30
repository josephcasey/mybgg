const searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY);

const search = instantsearch({
    indexName: ALGOLIA_INDEX_NAME,
    searchClient,
    initialUiState: {
        [ALGOLIA_INDEX_NAME]: {
            query: '',
            menu: {
                date: undefined
            }
        }
    }
});

// Single configure widget with correct settings
search.addWidgets([
    instantsearch.widgets.configure({
        hitsPerPage: 1000,  // Set high enough to get all plays
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
            text(results) {
                const allHits = search.helper?.lastResults?.hits || [];
                
                // Wait for initial load
                if (!allHits.length) {
                    return '<p>Loading statistics...</p>';
                }

                const stats = computeStats(allHits);
                
                console.log('Stats computation:', {
                    totalHits: results.nbHits,
                    processedHits: allHits.length,
                    heroCount: stats.heroes.length,
                    villainCount: stats.villains.length
                });

                // Return the stats template
                return `
                    <div class="statistics">
                        <div class="hero-stats">
                            <h3>Hero Statistics (${stats.heroes.length} heroes)</h3>
                            <table class="stats-table">
                                <thead>
                                    <tr>
                                        <th>Hero</th>
                                        <th>Plays</th>
                                        <th>Wins</th>
                                        <th>Win Rate</th>
                                    </tr>
                                </thead>
                                <tbody>${renderHeroStats(stats.heroes)}</tbody>
                            </table>
                        </div>
                        <div class="villain-stats">
                            <h3>Villain Statistics (${stats.villains.length} villains)</h3>
                            <table class="stats-table">
                                <thead>
                                    <tr>
                                        <th>Villain</th>
                                        <th>Plays</th>
                                        <th>Hero Wins</th>
                                        <th>Win Rate</th>
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
});

// Helper function to compute statistics
function computeStats(hits) {
    if (!Array.isArray(hits) || hits.length === 0) {
        return { heroes: [], villains: [] };
    }

    const heroStats = {};
    const villainStats = {};

    hits.forEach(hit => {
        // Process hero stats
        const hero = hit.hero;
        if (hero) {
            if (!heroStats[hero]) {
                heroStats[hero] = { plays: 0, wins: 0 };
            }
            heroStats[hero].plays++;
            if (hit.win) heroStats[hero].wins++;
        }

        // Process villain stats
        const villain = hit.villain;
        if (villain) {
            if (!villainStats[villain]) {
                villainStats[villain] = { plays: 0, wins: 0 };
            }
            villainStats[villain].plays++;
            if (hit.win) villainStats[villain].wins++;
        }
    });

    // Convert to sorted arrays
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
            <td class="${getDifficultyClass(villain.winRate)}">${getDifficultyLabel(villain.winRate)}</td>
        </tr>
    `).join('');
}

// Add error handling for search
search.on('error', (error) => {
    console.error('Search error:', error);
});

// Start search
search.start();