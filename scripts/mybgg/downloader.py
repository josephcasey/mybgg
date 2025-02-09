# imports the BGGClient and CacheBackendSqlite classes from the mybgg.bgg_client module
from mybgg.bgg_client import BGGClient
from mybgg.bgg_client import CacheBackendSqlite
# imports the BoardGame class from the mybgg.models module
from mybgg.models import BoardGame
import re

# Define ANSI escape codes for colors
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

class Downloader():
    def __init__(self, project_name, cache_bgg, debug=False):
        # Initialize the BGGClient with or without caching based on cache_bgg flag
        if cache_bgg:
            self.client = BGGClient(
                cache=CacheBackendSqlite(
                    path="{project_name}-cache.sqlite",  # Path for the cache file
                    ttl=60 * 60 * 24,  # Time-to-live for the cache (1 day)
                ),
                debug=debug,  # Enable debugging if debug flag is True
            )
        else:
            self.client = BGGClient(
                debug=debug,  # Enable debugging if debug flag is True
            )

    def collection(self, user_name, extra_params):   
        def extract_expansion_fragments(input_string):
            # Define the regular expression pattern
            pattern = r'\[geekurl=.*?\]\n(.*?)／(.*?)\n'
            # Find all occurrences of the pattern in the input_strings
            matches = re.findall(pattern, input_string)
            # Split the matches by "/" and return the fragments
            fragments = [match.split('/') for match in matches]
            return fragments

        def extract_fragments(input_string):
            #pattern = r'(.*)#bgstats'
            pattern = r'(.*)[\n]?#bgstats'
            matches = re.findall(pattern, input_string)
            if (matches == [] or matches == [''] or matches == [' ']):
                if "Played as expansion" in input_string: 
                    # Define the adjusted regular expression pattern
                    pattern = r'\n(.*)\n'
                else:
                    # Define the regular expression pattern
                    pattern = r'\n\n(.*)\s#bgstats'
                # Find all occurrences of the pattern in the input_strings
                matches = re.findall(pattern, input_string)
            if (matches == [] or matches == [''] or matches == [' ']):
                print("No matches found")
            # Split the matches by "/" and return the fragments
            # print("\nVillain :",re.findall(r'[\w+\s*]+1/2', matches),"\n")
            return matches
        
        def extract_villain(fragment_input):
            # Define the regular expression pattern to match Nebula 1/2 eg
            pattern = r'[\w+\s*]+\d/\d'
            # Find all occurrences of the pattern in the input_strings
            villain = re.findall(pattern, fragment_input)
            #print(f"{Colors.FAIL}This is red text{Colors.ENDC}")
            if (not villain or villain == [] or villain == [''] or villain == [' ']):
                print("No villain found1")
                # Define the regular expression pattern to match Magog A eg
                pattern = r'(\w+\s[A-C])'
                villain = re.findall(pattern, fragment_input)
                if (not villain or villain == [] or villain == [''] or villain == [' ']):
                    print("No villain found2")
                    pattern = r'(.*)\s'    
                    villain = re.findall(pattern, fragment_input)
                    if (not villain or villain == [] or villain == [''] or villain == [' ']):
                        print("No villain found3")
                        return ''
            return villain[0]
        
        def extract_heros(players_array):
            # Define the regular expression pattern
            pattern = r'[\w+\s*]+'
            # Find all occurrences of the pattern in the input_strings
            heros = re.findall(pattern, players_array)
            return heros
        
        def most_battled_hero(villain_dictionary, villain):
            # Create a dictionary mapping heroes to the number of battles
            hero_battles = {}
            # Iterate over the heroes and battles in the villain dictionary
            for hero, battles in villain_dictionary[villain].items():
                # Update the hero_battles dictionary with the hero and battles
                # hero_battles[hero] = battles["count"]
                # Update the hero_battles dictionary with the hero, count of battles, and play IDs
                hero_battles[hero] = {"count": battles["count"], "play_ids": battles["play_ids"]} 
            # Sort the hero_battles dictionary by the number of battles in descending order
            sorted_hero_battles = sorted(hero_battles.items(), key=lambda x: x[1]["count"], reverse=True)
            # Return the sorted hero_battles dictionary
            return sorted_hero_battles
    
    
        collection_data = []
        plays_data = []

        # Check if extra_params is a list and iterate over it to fetch collection data
        if isinstance(extra_params, list):
            for params in extra_params:
                collection_data += self.client.collection(
                    user_name=user_name,
                    **params
                )
        else:
            # Fetch collection data with the provided extra_params
            collection_data = self.client.collection(
                user_name=user_name,
                **extra_params
            )

        # Fetch plays data for the user
        plays_data = self.client.plays(
            user_name=user_name
        )

        # Fetch game list data for the games in the collection
        game_list_data = self.client.game_list([game_in_collection["id"] for game_in_collection in collection_data])
        # Create a dictionary mapping game IDs to tags
        game_id_to_tags = {game["id"]: game["tags"] for game in collection_data}
        # Create a dictionary mapping game IDs to image URLs
        game_id_to_image = {game["id"]: game["image_version"] or game["image"] for game in collection_data}
        # Create a dictionary mapping game IDs to number of plays
        game_id_to_numplays = {game["id"]: game["numplays"] for game in collection_data}
        # Create a dictionary mapping game IDs to previous players
        game_id_to_players = {game["id"]: [] for game in collection_data}
        # Create a dictionary mapping game IDs to plays
        game_id_to_plays = {game["id"]: [] for game in collection_data}
        villain_dictionary = {}

        champions_plays = 0
        # for each play in plays_data
        for play in plays_data:
            # if the game ID for this play is in game_id_to_players
            if play["game"]["gameid"] in game_id_to_players:
                
                #game_id_to_players[play["game"]["gameid"]].extend(play["players"])
                print("Players:", play["players"])
                
                if ("Marvel Champions" in play["game"]["gamename"]): #or "Marvel Champions" in play["gamecomments"]):
                    champions_plays += 1
                    print("\n\nPlayID Game & GameName:",champions_plays,play["playid"],play["game"]["gamename"])
                    print("\nstartcomment--",play["gamecomments"],"--endcomment\n")
                    if 93657508== play["playid"]:
                        print("\nPlayID 93657508\n")
                    game_id_to_plays[play["game"]["gameid"]].append(play)  # Change extend to append
                    # Extract string fragments from gamecomments
                    fragments = extract_fragments(play["gamecomments"])
                    # Print the extracted fragments for debugging purposes
                    print("--Fragments--", fragments,"\n--EndFragments--\n")
                    if (not fragments or fragments == [] or fragments == [' '] or fragments == ['']):
                        print("No fragments found")
                    else:
                        found_villain = extract_villain(fragments[0])
                        print(f"{Colors.FAIL}\nVillain :",found_villain,"\n")
                        print(f"{Colors.ENDC}")
                        if ( not found_villain or found_villain == [] or found_villain == [' '] or found_villain  == ['']):
                            print("No villain found")
                        else:
                            # Extract the heros from the fragments
                            
                            for player in play["players"]:
                                print(f"{Colors.OKGREEN}Hero:", player["color"])
                                print(f"{Colors.ENDC}")
                                hero = player["color"]
                                play_id = play["playid"]
                                # Update the villain dictionary
                                if found_villain not in villain_dictionary:
                                    villain_dictionary[found_villain] = {}
                                if hero not in villain_dictionary[found_villain]:
                                    villain_dictionary[found_villain][hero] = {"count": 1, "play_ids": [play_id]}
                                    print(f"{Colors.OKBLUE}Add Hero:", hero)
                                else:
                                    print(f"{Colors.OKBLUE}Increment Hero:", hero)
                                    villain_dictionary[found_villain][hero]["count"] += 1
                                    villain_dictionary[found_villain][hero]["play_ids"].append(play_id)

        # Print the villain dictionary for debugging purposes
        print(f"{Colors.OKCYAN}Villain Dictionary:{Colors.ENDC}", villain_dictionary)
        for villain in villain_dictionary:
            print(f"{Colors.OKBLUE}\n\nVillain",villain)
            print(f"{Colors.ENDC}")
            print(" : ", most_battled_hero(villain_dictionary, villain))
            #game_id_to_players[play["game"]["gameid"]] = list(set(game_id_to_players[play["game"]["gameid"]]))
        print("Champions plays processed:", champions_plays)
        games_data = list(filter(lambda x: x["type"] == "boardgame", game_list_data))
        expansions_data = list(filter(lambda x: x["type"] == "boardgameexpansion", game_list_data))

        game_id_to_expansion = {game["id"]: [] for game in games_data}
        for expansion_data in expansions_data:
            for expansion in expansion_data["expansions"]:
                if expansion["inbound"] and expansion["id"] in game_id_to_expansion:
                    game_id_to_expansion[expansion["id"]].append(expansion_data)

        games = [
            BoardGame(
                game_data,
                image=game_id_to_image[game_data["id"]],
                tags=game_id_to_tags[game_data["id"]],
                numplays=game_id_to_numplays[game_data["id"]],
                previous_players=game_id_to_players[game_data["id"]],
                expansions=[
                    BoardGame(expansion_data)
                    for expansion_data in game_id_to_expansion[game_data["id"]]
                ]
            )
            for game_data in games_data
        ]
        return games
