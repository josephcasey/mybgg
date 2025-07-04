import io
import re
import time
import json
import copy
import datetime

import colorgram
import requests
from algoliasearch.search_client import SearchClient
from PIL import Image, ImageFile

# Allow colorgram to read truncated files
ImageFile.LOAD_TRUNCATED_IMAGES = True

class Indexer:
    def __init__(self, app_id, apikey, index_name, hits_per_page):
        # Initialize the Algolia SearchClient with the provided app ID and API key
        client = SearchClient.create(
            app_id=app_id,
            api_key=apikey,
        )
        # Initialize the index with the provided index name
        index = client.init_index(index_name)

        # Print the Algolia credentials for config.js
        print("\nAlgolia credentials for config.js:")
        print("---------------------------------")
        print(f"ALGOLIA_APP_ID = '{app_id}';")
        print(f"ALGOLIA_SEARCH_API_KEY = '{apikey}';")
        print(f"ALGOLIA_INDEX_NAME = '{index_name}';\n")

        # Set the index settings
        index.set_settings({
            'searchableAttributes': [
                'villain',
                'hero',
                'hero1',
                'hero2', 
                'team_composition',
                'date',
                'location'
            ],
            'attributesForFaceting': [
                'searchable(villain)',
                'searchable(hero)',
                'searchable(hero1)',
                'searchable(hero2)',
                'searchable(team_composition)',
                'searchable(play_type)',
                'date',
                'win',
                'location'
            ],
            'customRanking': ['desc(date)'],
            'highlightPreTag': '<strong class="highlight">',
            'highlightPostTag': '</strong>',
            'hitsPerPage': hits_per_page,
        })

        self._init_replicas(client, index)

        self.index = index

    def _init_replicas(self, client, mainIndex):

        mainIndex.set_settings({
            'replicas': [
                mainIndex.name + '_rank_ascending',
                mainIndex.name + '_numrated_descending',
                mainIndex.name + '_numowned_descending',
            ]
        })

        replica_index = client.init_index(mainIndex.name + '_rank_ascending')
        replica_index.set_settings({'ranking': ['asc(rank)']})

        replica_index = client.init_index(mainIndex.name + '_numrated_descending')
        replica_index.set_settings({'ranking': ['desc(usersrated)']})

        replica_index = client.init_index(mainIndex.name + '_numowned_descending')
        replica_index.set_settings({'ranking': ['desc(numowned)']})

    @staticmethod
    def todict(obj):
        if isinstance(obj, str):
            return obj

        elif isinstance(obj, dict):
            return dict((key, Indexer.todict(val)) for key, val in obj.items())

        elif hasattr(obj, '__iter__'):
            return [Indexer.todict(val) for val in obj]

        elif hasattr(obj, '__dict__'):
            return Indexer.todict(vars(obj))

        return obj

    def _facet_for_num_player(self, num, type_):
        num_no_plus = num.replace("+", "")
        facet_types = {
            "best": {
                "level1": num_no_plus,
                "level2": f"{num_no_plus} > Best with {num}",
            },
            "recommended": {
                "level1": num_no_plus,
                "level2": f"{num_no_plus} > Recommended with {num}",
            },
            "expansion": {
                "level1": num_no_plus,
                "level2": f"{num_no_plus} > Expansion allows {num}",
            },
        }

        return facet_types[type_]

    def _smart_truncate(self, content, length=700, suffix='...'):
        if len(content) <= length:
            return content
        else:
            return ' '.join(content[:length + 1].split(' ')[0:-1]) + suffix

    def _pick_long_paragraph(self, content):
        content = content.strip()
        if "\n\n" not in content:
            return content

        paragraphs = content.split("\n\n")
        for paragraph in paragraphs[:3]:
            paragraph = paragraph.strip()
            if len(paragraph) > 80:
                return paragraph

        return content

    def _prepare_description(self, description):
        # Try to find a long paragraph from the beginning of the description
        description = self._pick_long_paragraph(description)

        # Remove unnessesary spacing
        description = re.sub(r"\s+", " ", description)

        # Cut at 700 characters, but not in the middle of a sentence
        description = self._smart_truncate(description)

        return description

    @staticmethod
    def _remove_game_name_prefix(expansion_name, game_name):
        def remove_prefix(text, prefix):
            if text.startswith(prefix):
                return text[len(prefix):]

        # Expansion name: Catan: Cities & Knights
        # Game name: Catan
        # --> Cities & Knights
        if game_name + ": " in expansion_name:
            return remove_prefix(expansion_name, game_name + ": ")

        # Expansion name: Shadows of Brimstone: Outlaw Promo Cards
        # Game name: Shadows of Brimstone: City of the Ancients
        # --> Outlaw Promo Cards
        elif ":" in game_name:
            game_name_prefix = game_name[0:game_name.index(":")]
            if game_name_prefix + ": " in expansion_name:
                return expansion_name.replace(game_name_prefix + ": ", "")

        return expansion_name

    def fetch_image(self, url, tries=0):
        try:
            # Attempt to fetch the image from the URL
            response = requests.get(url)
        except (requests.exceptions.ConnectionError, requests.exceptions.ChunkedEncodingError):
            # Retry fetching the image up to 3 times if a connection error occurs
            if tries < 3:
                time.sleep(2)
                return self.fetch_image(url, tries=tries + 1)

        # Return the image content if the request is successful
        if response.status_code == 200:
            return response.content

        # Return None if the request fails
        return None

    def add_objects_old(self, collection):
        # Convert the collection of games to dictionaries
        games = [Indexer.todict(game) for game in collection]
        for i, game in enumerate(games):
            # Print progress every 25 games
            if i != 0 and i % 25 == 0:
                print(f"Indexed {i} of {len(games)} games...")

            # Fetch and process the game image if it exists
            if game["image"]:
                image_data = self.fetch_image(game["image"])
                if image_data:
                    image = Image.open(io.BytesIO(image_data)).convert('RGBA')

                    try_colors = 10
                    colors = colorgram.extract(image, try_colors)
                    for i in range(min(try_colors, len(colors))):
                        color_r, color_g, color_b = colors[i].rgb.r, colors[i].rgb.g, colors[i].rgb.b

                        # Don't return very light or dark colors
                        luma = (
                            0.2126 * color_r / 255.0 +
                            0.7152 * color_g / 255.0 +
                            0.0722 * color_b / 255.0
                        )
                        if luma > 0.8 or luma < 0.2:
                            continue

                        # Add the color to the game dictionary
                        game[f"color_{i}_r"] = color_r
                        game[f"color_{i}_g"] = color_g
                        game[f"color_{i}_b"] = color_b

            game["objectID"] = f"bgg{game['id']}"

            # Turn players tuple into a hierarchical facet
            game["players"] = [
                self._facet_for_num_player(num, type_)
                for num, type_ in game["players"]
            ]

            # Algolia has a limit of 10kb per item, so remove unnessesary data from expansions
            attribute_map = {
                "id": lambda x: x,
                "name": lambda x: self._remove_game_name_prefix(x, game["name"]),
            }
            game["expansions"] = [
                {
                    attribute: func(expansion[attribute])
                    for attribute, func in attribute_map.items()
                    if func(expansion[attribute])
                }
                for expansion in game["expansions"]
            ]
            # Limit the number of expansions to 10 to keep the size down
            game["has_more_expansions"] = len(game["expansions"]) > 10
            game["expansions"] = game["expansions"][:10]

            # Make sure description is not too long
            game["description"] = self._prepare_description(game["description"])

        self.index.save_objects(games)

    def _get_hero_native_aspects(self):
        """Get the native/default aspect for each hero based on earliest play data"""
        # This is a lookup table for hero native aspects based on Marvel Champions lore
        # These are the aspects heroes start with in their base decks
        native_aspects = {
            'Spider-Woman': 'Justice',  # Spider-Woman (Jessica Drew) is dual-aspect Justice/Aggression
            'Spiderwoman': 'Justice',   # Alternative spelling
            'SP//DR': 'Protection',     # SP//dr is Protection in the game
            'Captain America': 'Leadership',
            'Iron Man': 'Aggression', 
            'Black Widow': 'Aggression',
            'Thor': 'Aggression',
            'Hulk': 'Aggression',
            'Captain Marvel': 'Leadership',
            'Ms. Marvel': 'Aggression',
            'Spider-Man': 'Aggression',
            'She-Hulk': 'Leadership',
            'Ant-Man': 'Leadership',
            'Wasp': 'Aggression',
            'Quicksilver': 'Protection',
            'Scarlet Witch': 'Justice',
            'Groot': 'Protection',
            'Rocket Raccoon': 'Aggression',
            'Star-Lord': 'Leadership',
            'Gamora': 'Aggression',
            'Drax': 'Protection',
            'Venom': 'Aggression',
            'Miles Morales': 'Aggression',
            'Ghost-Spider': 'Protection',
            'Spider-Ham': 'Justice',
            'Dr. Strange': 'Protection',
            'Adam Warlock': 'Leadership',
            'Spectrum': 'Leadership',
            'Nebula': 'Leadership',
            'War Machine': 'Leadership',
            'Valkyrie': 'Aggression',
            'Vision': 'Protection',
            'Hawkeye': 'Leadership',
            'Black Panther': 'Protection',
            'Winter Soldier': 'Aggression',
            'Falcon': 'Leadership',
            'Wolverine': 'Aggression',
            'Colossus': 'Protection',
            'Shadowcat': 'Aggression',
            'Cyclops': 'Leadership',
            'Phoenix': 'Justice',
            'Storm': 'Leadership',
            'Rogue': 'Aggression',
            'Gambit': 'Leadership',
            'Psylocke': 'Justice',
            'Bishop': 'Protection',
            'Cable': 'Leadership',
            'Domino': 'Aggression',
            'X-23': 'Aggression',
            'Deadpool': 'Aggression',
            'Angel': 'Protection',
            'Iceman': 'Protection',
            'Nightcrawler': 'Aggression',
            'Jubilee': 'Aggression',
            'Magik': 'Justice',
            'Magneto': 'Leadership',
            'Daredevil': 'Protection',
            'Silk': 'Protection',
            'Nova': 'Aggression',
            'Ironheart': 'Leadership'
        }
        return native_aspects

    def _is_special_dual_aspect_hero(self, hero_str):
        """Check if this is a special hero that requires two aspects (like Spider-Woman)"""
        # Clean the hero string
        hero = str(hero_str).strip()
        if hero.startswith('Team 1 - '):
            hero = hero[9:]
        elif hero.startswith('Team: '):
            hero = hero[6:]
            
        # Heroes that legitimately use two aspects in a single play
        dual_aspect_heroes = ['Spiderwoman', 'Spider-Woman']
        
        for dual_hero in dual_aspect_heroes:
            if dual_hero.lower() in hero.lower():
                # Check if it contains aspect indicators typical of dual-aspect play
                return ('Justice' in hero or 'Aggression' in hero or 
                        'Protection' in hero or 'Leadership' in hero or
                        '/' in hero)
        return False

    def _is_multi_hero(self, hero_str):
        """Helper to detect multi-hero plays"""
        if not hero_str:
            return False
            
        # Convert to string and clean up
        hero = str(hero_str).strip()
        
        # Remove 'Team 1 - ' prefix for checking
        if hero.startswith('Team 1 - '):
            hero = hero[9:]
        elif hero.startswith('Team: '):
            hero = hero[6:]
        
        # Check for special dual-aspect heroes first (these are NOT multi-hero)
        if self._is_special_dual_aspect_hero(hero_str):
            return False
            
        # Handle SP//DR as a single hero (not multi-hero)
        if 'SP//DR' in hero or 'SP//dr' in hero:
            return False
        
        # List of indicators for actual multi-hero games
        multi_hero_indicators = [
            '/',           # Regular slash
            '／',          # Full-width slash
            '//',         # Double slash (but not SP//DR)
            '\\',         # Backslash
            '，',         # Full-width comma
            ',',          # Regular comma
            ' and ',      # Text conjunction
        ]
        
        # Check for multi-hero indicators in the cleaned hero name
        return any(ind in hero for ind in multi_hero_indicators)

    def _find_hero_by_partial_name(self, partial_name):
        """Find hero by partial name match"""
        if not partial_name or len(partial_name) < 2:
            return None
            
        # Clean partial name
        partial_clean = partial_name.strip().lower()
        
        # Handle special cases first
        if partial_clean == 'sp/' or partial_clean == 'sp':
            return 'SP//dr'  # SP/ is clearly SP//dr truncated
            
        # Load cached hero names for matching
        try:
            with open('cached_hero_names.json', 'r') as f:
                hero_names = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            # Fallback list if file not available
            hero_names = ['Phoenix', 'Ghost-Spider', 'Shadowcat', 'Storm', 'Psylocke']
        
        # Try exact prefix match first
        for hero in hero_names:
            if hero.lower().startswith(partial_clean):
                return hero
                
        # Try contains match for very short partials
        if len(partial_clean) <= 3:
            for hero in hero_names:
                if partial_clean in hero.lower():
                    return hero
                    
        return None

    def _parse_hero_team(self, hero_str):
        """Parse multi-hero string into individual heroes"""
        if not hero_str:
            return []
            
        # Convert to string and clean up
        hero = str(hero_str).strip()
        
        # Remove team prefixes
        if hero.startswith('Team 1 - '):
            hero = hero[9:]
        elif hero.startswith('Team: '):
            hero = hero[6:]
        
        # Get native aspects for fallback
        native_aspects = self._get_hero_native_aspects()
        
        # Handle different separator types
        heroes = []
        
        # Try full-width slash first (most common in your data)
        if '／' in hero:
            parts = hero.split('／')
        elif '/' in hero:
            parts = hero.split('/')
        elif '//' in hero:
            parts = hero.split('//')
        elif '\\' in hero:
            parts = hero.split('\\')
        elif '，' in hero:
            parts = hero.split('，')
        elif ',' in hero:
            parts = hero.split(',')
        elif ' and ' in hero:
            parts = hero.split(' and ')
        else:
            parts = [hero]
        
        # Clean up each hero name
        for i, part in enumerate(parts):
            part = part.strip()
            if not part:
                continue
                
            # Handle very short partial names (likely truncated second heroes)
            if len(part) <= 3 and i > 0:  # Only for non-first parts
                # Try to find hero by partial match
                matched_hero = self._find_hero_by_partial_name(part)
                if matched_hero:
                    heroes.append(matched_hero)
                    continue
                else:
                    # Skip if we can't match the partial
                    continue
            
            # Extract hero name by removing aspect suffixes
            # Check for aspects at the end of the string first
            hero_name = part
            
            # Remove aspects (all 5 Marvel Champions aspects + common truncations)
            # Order matters - check longer strings first to avoid partial matches
            aspects = [
                # Full aspect names
                ' Protection', ' Aggression', ' Justice', ' Leadership', ' Pool',
                # Common truncations due to BGG field limits  
                ' Protectio', ' Agression', ' Aggressi', ' Leaders', ' Leadersh',
                ' Justic', ' Agres', ' Protec', ' Lead', ' Prot',
                # Very short truncations
                ' Party', ' CC', ' Agr', ' Jus', ' Pro', ' Lea'
            ]
            
            # Try to remove aspect suffixes
            for aspect in aspects:
                if hero_name.endswith(aspect):
                    hero_name = hero_name[:-len(aspect)].strip()
                    break
            
            # Handle cases where aspect might be mixed with hero name due to truncation
            # e.g., "Colossus Protectio" should become "Colossus"
            for aspect in ['Protectio', 'Agression', 'Aggressi', 'Leaders', 'Leadersh', 'Justic']:
                if aspect in hero_name and not hero_name.startswith(aspect):
                    # Split and take the part before the aspect
                    parts_with_aspect = hero_name.split(aspect)
                    if len(parts_with_aspect) > 1:
                        hero_name = parts_with_aspect[0].strip()
                        break
            
            # Handle truncated names (common in BGG data due to length limits)
            hero_name = self._expand_hero_name(hero_name)
            
            # Validate the hero name - skip if it's just an aspect or very short
            if (hero_name and len(hero_name) > 2 and 
                hero_name not in ['Aggression', 'Protection', 'Justice', 'Leadership', 'Pool',
                                 'Agression', 'Protectio', 'Justic', 'Leaders', 'Leadersh']):
                heroes.append(hero_name)
        
        return heroes

    def _expand_hero_name(self, name):
        """Expand truncated hero names based on BGG comment field truncation"""
        # Common truncations in Marvel Champions BGG data
        # These are based on character limits causing truncation
        expansions = {
            # Direct truncations
            'Sha': 'Shadowcat',
            'Shadowc': 'Shadowcat', 
            'Wol': 'Wolverine', 
            'Wolverin': 'Wolverine',
            'Phoe': 'Phoenix',
            'Ph': 'Phoenix',  # Very short truncation for Phoenix
            'Sca': 'Scarlet Witch',
            'Scarlet': 'Scarlet Witch',
            'Cap': 'Captain America',
            'Captain': 'Captain America',
            'Dr.': 'Dr. Strange',
            'Dr': 'Dr. Strange',
            'Strange': 'Dr. Strange',
            'Ghost-Spide': 'Ghost-Spider',
            'Gh': 'Ghost-Spider',  # Very short truncation for Ghost-Spider
            'Spiderwoman': 'Spider-Woman',
            'Spider-Woman': 'Spider-Woman',
            'Ant Man': 'Ant-Man',
            'AntMan': 'Ant-Man',
            'Man': 'Ant-Man',  # Context-dependent, but often Ant-Man in truncated strings
            'Marv': 'Captain Marvel',
            'Ms.': 'Ms. Marvel',
            'Spectru': 'Spectrum',
            'S': 'Storm',  # Very short truncation - context-dependent
            # Special character hero names
            'SP//DR': 'SP//dr',  # Normalize case
            'SP//dr': 'SP//dr',  # This is the canonical name for this hero
            'SP/DR': 'SP//dr',   # Handle single slash version
            # Standard hero names (already correct)
            'Colossus': 'Colossus',
            'Cyclops': 'Cyclops',
            'War Machine': 'War Machine',
            'Iron Man': 'Iron Man',
            'Black Widow': 'Black Widow',
            'Black Panther': 'Black Panther',
            'Hulk': 'Hulk',
            'She-Hulk': 'She-Hulk',
            'Thor': 'Thor',
            'Hawkeye': 'Hawkeye',
            'Groot': 'Groot',
            'Rocket Raccoon': 'Rocket Raccoon',
            'Rocket': 'Rocket Raccoon',
            'Star-Lord': 'Star-Lord',
            'Gamora': 'Gamora',
            'Nebula': 'Nebula',
            'Nova': 'Nova',
            'Venom': 'Venom',
            'Miles Morales': 'Miles Morales',
            'Spider-Ham': 'Spider-Ham',
            'Silk': 'Silk',
            'Valkyrie': 'Valkyrie',
            'Vision': 'Vision',
            'Quicksilver': 'Quicksilver',
            'Daredevil': 'Daredevil',
            'Psylocke': 'Psylocke',
            'Angel': 'Angel',
            'Bishop': 'Bishop',
            'Cable': 'Cable',
            'Domino': 'Domino',
            'Gambit': 'Gambit',
            'Iceman': 'Iceman',
            'Jubilee': 'Jubilee',
            'Magik': 'Magik',
            'Magneto': 'Magneto',
            'Nightcrawler': 'Nightcrawler',
            'Rogue': 'Rogue',
            'Storm': 'Storm',
            'Winter Soldier': 'Winter Soldier',
            'X-23': 'X-23',
            'Deadpool': 'Deadpool',
            'Wolverin': 'Wolverine',
            # Aspect-truncated combinations
            'Colossus Protectio': 'Colossus',  # Sometimes aspect gets partially truncated with name
            'Ghost-Spider Protectio': 'Ghost-Spider',
            'Captain America Leaders': 'Captain America',
            'Captain Marvel Leadersh': 'Captain Marvel',
            'Black Panther Protectio': 'Black Panther',
            'War Machine Leadership': 'War Machine',
            'Winter Soldier CC Agres': 'Winter Soldier',
            'Spiderwoman Justice/Agg': 'Spider-Woman',
            'Dr. Strange Justice': 'Dr. Strange',
            'She-Hulk Aggression': 'She-Hulk'
        }
        
        return expansions.get(name, name)

    def _analyze_multi_hero_games(self, play_data):
        """Analyze multi-hero games and print statistics"""
        total_multi_hero_detected = 0
        successfully_decoded_plays = []
        failed_parsing_examples = []
        
        # Collect multi-hero plays and track parsing success
        for play in play_data:
            hero = getattr(play, 'hero', '')
            if self._is_multi_hero(hero):
                total_multi_hero_detected += 1
                heroes = self._parse_hero_team(hero)
                
                if len(heroes) >= 2:  # Successfully decoded multi-hero team
                    successfully_decoded_plays.append({
                        'heroes': heroes,
                        'villain': getattr(play, 'villain', 'Unknown'),
                        'win': getattr(play, 'win', False),
                        'date': getattr(play, 'date', 'Unknown'),
                        'original_hero_str': hero
                    })
                else:
                    # Failed to parse or only got 1 hero
                    if len(failed_parsing_examples) < 10:  # Limit examples
                        failed_parsing_examples.append(hero)
        
        # Calculate decode success rate
        decode_success_rate = (len(successfully_decoded_plays) / total_multi_hero_detected * 100) if total_multi_hero_detected > 0 else 0
        failed_count = total_multi_hero_detected - len(successfully_decoded_plays)
        
        # Print detection vs parsing success stats
        print(f"\n🤝 Multi-Hero Detection & Parsing:")
        print(f"   Total multi-hero plays detected: {total_multi_hero_detected}")
        print(f"   Successfully decoded: {len(successfully_decoded_plays)} ({decode_success_rate:.1f}%)")
        print(f"   Failed to decode: {failed_count} ({100-decode_success_rate:.1f}%)")
        
        if failed_parsing_examples:
            print(f"\n❌ Failed parsing examples:")
            for example in failed_parsing_examples:
                print(f"   '{example}'")
        
        if not successfully_decoded_plays:
            print("   No successfully decoded multi-hero games found")
            return
        
        # Analyze team combinations using the correctly named variable
        team_stats = {}
        hero_partnerships = {}
        
        for play in successfully_decoded_plays:
            heroes = sorted(play['heroes'])  # Sort for consistent team names
            team_key = ' + '.join(heroes)
            
            # Track team performance
            if team_key not in team_stats:
                team_stats[team_key] = {'wins': 0, 'total': 0, 'villains': set()}
            
            team_stats[team_key]['total'] += 1
            team_stats[team_key]['villains'].add(play['villain'])
            if play['win']:
                team_stats[team_key]['wins'] += 1
            
            # Track individual hero partnerships
            for i, hero1 in enumerate(heroes):
                for hero2 in heroes[i+1:]:
                    pair_key = f"{hero1} & {hero2}"
                    if pair_key not in hero_partnerships:
                        hero_partnerships[pair_key] = {'wins': 0, 'total': 0}
                    
                    hero_partnerships[pair_key]['total'] += 1
                    if play['win']:
                        hero_partnerships[pair_key]['wins'] += 1
        
        # Print team analysis with proper data
        print(f"\n🏆 Team Performance Analysis:")
        print(f"   Successfully decoded games: {len(successfully_decoded_plays)}")
        print(f"   Unique team combinations: {len(team_stats)}")
        
        # Top performing teams
        print(f"\n🏆 Top Team Win Rates:")
        sorted_teams = sorted(team_stats.items(), 
                            key=lambda x: (x[1]['wins']/x[1]['total'], x[1]['total']), 
                            reverse=True)
        
        for team, stats in sorted_teams[:10]:
            win_rate = (stats['wins'] / stats['total']) * 100
            print(f"   {team}: {stats['wins']}/{stats['total']} ({win_rate:.1f}%)")
        
        # Most played partnerships
        print(f"\n🤜🤛 Most Frequent Partnerships:")
        sorted_partnerships = sorted(hero_partnerships.items(), 
                                   key=lambda x: x[1]['total'], 
                                   reverse=True)
        
        for pair, stats in sorted_partnerships[:10]:
            win_rate = (stats['wins'] / stats['total']) * 100 if stats['total'] > 0 else 0
            print(f"   {pair}: {stats['total']} games ({win_rate:.1f}% win rate)")

    def add_objects(self, play_data):
        # Initialize variables
        filtered_plays = []
        skipped_count = 0
        multi_hero_examples = set()
        
        # First, analyze multi-hero games before processing them
        self._analyze_multi_hero_games(play_data)
        
        # Separate solo and team plays for indexing
        print("\nProcessing play data for solo and team indexing...")
        solo_plays = []
        team_plays = []
        multi_hero_examples = set()
        skipped_count = 0
        
        for play in play_data:
            hero = getattr(play, 'hero', '')
            if self._is_multi_hero(hero):
                multi_hero_examples.add(hero)
                # Try to decode the team composition
                team_heroes = self._parse_hero_team(hero)
                if team_heroes and len(team_heroes) >= 2:
                    # Create a team play record
                    team_play = copy.deepcopy(play)
                    setattr(team_play, 'hero1', team_heroes[0])
                    setattr(team_play, 'hero2', team_heroes[1])
                    setattr(team_play, 'team_composition', ' + '.join(team_heroes))
                    setattr(team_play, 'play_type', 'team')
                    team_plays.append(team_play)
                else:
                    skipped_count += 1
                continue
                
            # Clean up hero name by removing team prefix for solo plays
            if isinstance(hero, str):
                if hero.startswith('Team 1 - '):
                    hero = hero[9:]
                elif hero.startswith('Team: '):
                    hero = hero[6:]
                setattr(play, 'hero', hero)
                setattr(play, 'play_type', 'solo')
                
            solo_plays.append(play)
        
        # Combine all plays for indexing
        filtered_plays = solo_plays + team_plays
        
        # Print processing summary with examples
        print(f"\nProcessing summary:")
        print(f"- Original count: {len(play_data)}")
        print(f"- Solo plays: {len(solo_plays)}")
        print(f"- Team plays: {len(team_plays)}")
        print(f"- Skipped (unparseable): {skipped_count}")
        print(f"- Total indexed: {len(filtered_plays)}")
        if multi_hero_examples:
            print("\nExamples of processed multi-hero plays:")
            for example in sorted(list(multi_hero_examples))[:5]:
                print(f"  - {example}")
        
        # Convert the filtered play data to dictionaries
        plays = []
        for play in filtered_plays:
            play_dict = self.todict(play)
            
            # Add objectID
            play_dict["objectID"] = f"play{play_dict.get('id', len(plays))}"
            
            # Format date consistently
            if isinstance(play_dict.get('date'), str):
                try:
                    date_obj = datetime.datetime.strptime(play_dict['date'], '%Y-%m-%d')
                    play_dict['date'] = date_obj.strftime('%Y-%m-%d')
                    play_dict['timestamp'] = int(date_obj.timestamp())
                except ValueError:
                    print(f"Warning: Invalid date format in play: {play_dict['date']}")
            
            plays.append(play_dict)

        if plays:
            print("\nSending to Algolia:")
            print(f"- Total plays being indexed: {len(plays)}")
            print("\nSample play data:")
            print(json.dumps(plays[0], indent=2))
            
            # Save objects to index
            self.index.save_objects(plays)
        else:
            print("\nNo plays to index after filtering")

        return len(plays)  # Return count of indexed plays

    def delete_objects_not_in(self, play_data):
        """
        Delete objects from the index that are not in the provided play_data
        """
        try:
            # Try to get all objectIDs from the current index
            existing_objects = self.index.browse_objects()
            existing_ids = set()
            for obj in existing_objects:
                if 'objectID' in obj:
                    existing_ids.add(obj['objectID'])
            
            # Get all objectIDs from the new play_data
            new_ids = set(f"play{play.id}" for play in play_data)
            
            # Find objects to delete (in existing but not in new)
            ids_to_delete = existing_ids - new_ids
            
            if ids_to_delete:
                print(f"\nDeleting {len(ids_to_delete)} obsolete objects from index")
                self.index.delete_objects(list(ids_to_delete))
            else:
                print("\nNo obsolete objects to delete from index")
                
        except Exception as e:
            if 'Index mygames does not exist' in str(e):
                print("\nIndex does not exist yet - skipping deletion step")
            else:
                # Re-raise other exceptions
                raise
