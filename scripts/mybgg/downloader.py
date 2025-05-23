# imports the BGGClient and CacheBackendSqlite classes from the mybgg.bgg_client module
from mybgg.bgg_client import BGGClient
from mybgg.bgg_client import CacheBackendSqlite
# imports the BoardGame class from the mybgg.models module
from mybgg.models import BoardGame
import re
import sys

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

class PlayDataDTO:
    def __init__(self, id, villain, hero, win, date, location):
        self.id = id
        self.villain = villain
        self.hero = hero
        self.win = win
        self.date = date
        self.location = location

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
                    pattern = r'\n?／?(\w+\s\d/\d).*#bgstats'
                else:
                    # Define the regular expression pattern
                    pattern = r'\n(.*?1/2)'
                # Find all occurrences of the pattern in the input_strings
                matches = re.findall(pattern, input_string)
                if (matches == [] or matches == [''] or matches == [' ']):
                    print("No matches found")
                    # Define the regular expression pattern
                    pattern = r'\n(.*?1/2)'
                    matches = re.findall(pattern, input_string)
                    if (matches == [] or matches == [''] or matches == [' ']):
                        print("No matches found")
                        pattern = r'(\S.*?／.*?／.*?\(.*?\))\s#bgstats'
                        matches = re.findall(pattern, input_string)
                        if (matches == [] or matches == [''] or matches == [' ']):
                            print("No matches found")
                            pattern = r'\n(.*?)\n\s#bgstats'
                            matches = re.findall(pattern, input_string)
                            if (matches == [] or matches == [''] or matches == [' ']):
                                print("No matches found")
            # Split the matches by "/" and return the fragments
            # print("\nVillain :",re.findall(r'[\w+\s*]+1/2', matches),"\n")
            return matches
        
        def extract_villain(fragment_input):
            # Define the regular expression pattern to match Nebula 1/2 eg
            pattern = r'／?([^／]*?\d/\d)'
            # Find all occurrences of the pattern in the input_strings
            villain = re.findall(pattern, fragment_input)
            #print(f"{Colors.FAIL}This is red text{Colors.ENDC}")
            if (not villain or villain == [] or villain == [''] or villain == [' ']):
                print("No villain found1")
                # Define the regular expression pattern to match Magog A eg
                #pattern = r'(\w+\s[A-C]\d?)'
                #pattern = r'(\w+\s[A-C]{1}\d?)(?=／|\n)'
                pattern = r'([\w\s\(\)]+[A-C]\d?)(?=／|\s?$)'
                villain = re.findall(pattern, fragment_input)
                if (not villain or villain == [] or villain == [''] or villain == [' ']):
                    print("No villain found2")
                    # Define the regular expression pattern to match Magog A eg elsewhere in string
                    pattern = r'(\w+\s[A-C]\d?)(?=／|$)'
                    villain = re.findall(pattern, fragment_input)
                    if (not villain or villain == [] or villain == [''] or villain == [' ']):
                        print("No villain found3")
                        # Define the regular expression pattern to match just Nebula 1/2 (or at start of string eg Ebony Maw 1/2／Standard)
                        pattern = r'(.*?1/2)/?'    
                        villain = re.findall(pattern, fragment_input)
                        if (not villain or villain == [] or villain == [''] or villain == [' ']):
                            print("No villain found4")
                            # Define the regular expression pattern to match just Sinister 6 from Standard III／Sinister 6
                            pattern='／([^／]*?\d)$'
                            villain = re.findall(pattern, fragment_input)
                            if (not villain or villain == [] or villain == [''] or villain == [' ']):
                                print("No villain found5")
                                # Define the regular expression pattern to match just Sinister 6 from Standard III／Sinister 6 & 'Captain America Leadership／Sinister 6／Standard Core '
                                pattern='／?([^／]*?\d)(?=／|$)'
                                villain = re.findall(pattern, fragment_input)
                                if (not villain or villain == [] or villain == [''] or villain == [' ']):
                                    print("No villain found6")
                                    pattern='(\w+\s[A-C]\d?)(?=／|\s?$)'
                                    villain = re.findall(pattern, fragment_input)
                                    if (not villain or villain == [] or villain == [''] or villain == [' ']):
                                        print("No villain found7")
                                        pattern='([\w\s\(\)]+[A-C]\d/\d)(?=／|\s?$)'
                                        villain = re.findall(pattern, fragment_input)
                                        if (not villain or villain == [] or villain == [''] or villain == [' ']):
                                            print("No villain found8")
                                            return fragment_input
            return villain[0]
        
        def extract_heros(players_array):
            # Define the regular expression pattern
            pattern = r'[\w+\s*]+'
            # Find all occurrences of the pattern in the input_strings
            heros = re.findall(pattern, players_array)
            return heros
        
        def most_battled_hero(villain_dictionary, villain):
            # Create a dictionary mapping heroes to the number of battles and play IDs
            hero_battles = {}
            total_plays = 0
            
            unique_play_ids = set()
    
             # Iterate over the heroes and battles in the villain dictionary
            for hero, hero_data in villain_dictionary[villain].items():
                # Update the hero_battles dictionary with the hero, count of battles, and play IDs
                hero_battles[hero] = {"count": hero_data["count"], "play_ids": hero_data["play_ids"], "wins": hero_data["wins"]}
                # Increment the total plays only if the play ID is unique
                for play_id in hero_data["play_ids"]:
                    if play_id not in unique_play_ids:
                        unique_play_ids.add(play_id)
                        total_plays += 1
                        
            # Sort the hero_battles dictionary by the number of battles in descending order
            sorted_hero_battles = sorted(hero_battles.items(), key=lambda x: x[1]["count"], reverse=True)

            # Update the villain dictionary with sorted heroes
            sorted_hero_battles_dict = {hero: data for hero, data in sorted_hero_battles}
            #villain_dictionary[villain].update(sorted_hero_battles_dict)
            villain_dictionary[villain] = sorted_hero_battles_dict
           
            # Add the total number of plays to the villain dictionary
            villain_dictionary[villain]["total_plays"] = total_plays
            # Return the sorted hero_battles list
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

        play_data_list = []

        champions_plays = 0
        # for each play in plays_data
        for play in plays_data:
            # if the game ID for this play is in game_id_to_players
            if play["game"]["gameid"] in game_id_to_players:
                
                #game_id_to_players[play["game"]["gameid"]].extend(play["players"])
                print("Players:", play["players"])
                
                if ("Marvel Champions" in play["game"]["gamename"] and not 'parent play' in play["gamecomments"]): #or "Marvel Champions" in play["gamecomments"]):
                    # Omit plays with more than one hero
                    if len(play["players"]) > 1:
                        continue
                    
                    champions_plays += 1
                    print("\n\nPlayID Game & GameName:",champions_plays,play["playid"],play["playdate"],play["game"]["gamename"])
                    print("\nstartcomment--",play["gamecomments"],"--endcomment\n")
                    if 87396724 == play["playid"]:
                        print("\nProblem PlayID breakpoint\n")
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
                                win = player["win"]  # Get the win status, default to 0 if not present
                                # Update the villain dictionary
                                if found_villain not in villain_dictionary:
                                    villain_dictionary[found_villain] = {}
                                if hero not in villain_dictionary[found_villain]:
                                    villain_dictionary[found_villain][hero] = {"count": 1, "play_ids": [play_id], "wins": win}
                                    print(f"{Colors.OKBLUE}Add Hero:", hero)
                                else:
                                    print(f"{Colors.OKBLUE}Increment Hero:", hero)
                                    villain_dictionary[found_villain][hero]["count"] += 1
                                    villain_dictionary[found_villain][hero]["play_ids"].append(play_id)
                                    villain_dictionary[found_villain][hero]["wins"] += win

                                play_data = PlayDataDTO(
                                    id=play["playid"],
                                    villain=found_villain,
                                    hero=hero,
                                    win=win,
                                    date=play["playdate"],
                                    location=play.get("location", "Unknown")
                                )
                                play_data_list.append(play_data)

        # Print the villain dictionary for debugging purposes
        print(f"{Colors.OKCYAN}Villain Dictionary:{Colors.ENDC}", villain_dictionary)

        plays_processed = 0
        for villain, data in villain_dictionary.items():
            print(f"{Colors.OKBLUE}\n\nVillain: '",villain,"'")
            print(f"{Colors.ENDC}")
            print(" : ", most_battled_hero(villain_dictionary, villain))
            print("Total Plays: ", villain_dictionary[villain]["total_plays"])    
            plays_processed += villain_dictionary[villain]["total_plays"]
            print("plays processed: ", plays_processed,"\n")


        # Sort the villain dictionary by total plays
        villain_dictionary = sorted(villain_dictionary.items(), key=lambda x: x[1]["total_plays"], reverse=True)

        for villain, data in villain_dictionary:
            print(f"{Colors.OKBLUE}\n\nVillain: '",villain," (",data["total_plays"],")'")
            print(f"{Colors.ENDC}")

            villain_wins = 0
            total_hero_wins = 0
            #print(" : ", most_battled_hero(villain_dictionary, villain))
            #Iterate through the heroes played for the villain and print them
            for hero, hero_data in data.items():
                if hero != "total_plays":
                    hero_name = hero.replace("Team 1 - ", "")  # Remove the "Team 1 -" prefix
                    print(f"- {hero_name} (Won {hero_data['wins']}/{hero_data['count']})")
                    total_hero_wins += hero_data['wins']
            
            villain_wins = data["total_plays"] - total_hero_wins
            print(f"{Colors.OKBLUE}\n\nVillain Wins: {villain_wins} of {data['total_plays']}")
            
        #Print the villain dictionary for debugging purposes
        print(f"{Colors.OKCYAN}Villain Dictionary:{Colors.ENDC}", villain_dictionary)

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

        sys.stdout.close()

        # Restore standard output to the console
        sys.stdout = sys.__stdout__

        ##JC return games
        return play_data_list