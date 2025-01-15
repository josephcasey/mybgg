# imports the BGGClient and CacheBackendSqlite classes from the mybgg.bgg_client module
from mybgg.bgg_client import BGGClient
from mybgg.bgg_client import CacheBackendSqlite
# imports the BoardGame class from the mybgg.models module
from mybgg.models import BoardGame

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
        # for each play in plays_data
        for play in plays_data:
            # if the game ID for this play is in game_id_to_players
            if play["game"]["gameid"] in game_id_to_players:
                #game_id_to_players[play["game"]["gameid"]].extend(play["players"])
                print(play["players"])
                if "Marvel Champions" in play["gamecomments"]:
                    print(play["gamecomments"])
                if "Marvel Champions" in play["game"]["gamename"]:
                    print(play["game"]["gamename"])
                game_id_to_plays[play["game"]["gameid"]].append(play)  # Change extend to append
                #game_id_to_players[play["game"]["gameid"]] = list(set(game_id_to_players[play["game"]["gameid"]]))
                print(play["game"]["gameid"])

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
