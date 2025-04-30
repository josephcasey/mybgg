import io
import re
import time
import json
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
                'date',
                'location'
            ],
            'attributesForFaceting': [
                'searchable(villain)',
                'searchable(hero)',
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
        
        # List of indicators for actual multi-hero games
        multi_hero_indicators = [
            '/',           # Regular slash
            '／',          # Full-width slash
            '//',         # Double slash
            '\\',         # Backslash
            '，',         # Full-width comma
            ',',          # Regular comma
            ' and ',      # Text conjunction
        ]
        
        # Check for multi-hero indicators in the cleaned hero name
        return any(ind in hero for ind in multi_hero_indicators)

    def add_objects(self, play_data):
        # Initialize variables
        filtered_plays = []
        skipped_count = 0
        multi_hero_examples = set()
        
        # Filter out multi-hero games
        print("\nStarting play data filtering...")
        for play in play_data:
            hero = getattr(play, 'hero', '')
            if self._is_multi_hero(hero):
                multi_hero_examples.add(hero)
                skipped_count += 1
                continue
                
            # Clean up hero name by removing team prefix
            if isinstance(hero, str):
                if hero.startswith('Team 1 - '):
                    hero = hero[9:]
                elif hero.startswith('Team: '):
                    hero = hero[6:]
                setattr(play, 'hero', hero)
                
            filtered_plays.append(play)
        
        # Print filtering summary with examples
        print(f"\nFiltering summary:")
        print(f"- Original count: {len(play_data)}")
        print(f"- Skipped {skipped_count} multi-hero plays")
        print(f"- Final count: {len(filtered_plays)}")
        if multi_hero_examples:
            print("\nExamples of filtered multi-hero plays:")
            for example in sorted(list(multi_hero_examples))[:10]:
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
