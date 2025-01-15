# Import necessary modules
import logging
import random
import time
from xml.etree.ElementTree import fromstring

import declxml as xml
import requests
from requests_cache import CachedSession

# Set up logging
logger = logging.getLogger(__name__)

# Define the BGGClient class
class BGGClient:
    # Base URL for the BoardGameGeek XML API
    BASE_URL = "https://www.boardgamegeek.com/xmlapi2"

    def __init__(self, cache=None, debug=False):
        # Initialize the requester with a cached session if cache is provided, otherwise use a regular session
        if not cache:
            self.requester = requests.Session()
        else:
            self.requester = cache.cache

        # Set logging level to DEBUG if debug is True
        if debug:
            logging.basicConfig(level=logging.DEBUG)

    def collection(self, user_name, **kwargs):
        # Copy additional parameters and add the username to the parameters
        params = kwargs.copy()
        params["username"] = user_name
        # Make a request to the collection endpoint with the provided parameters
        data = self._make_request("/collection?version=1", params)
        # Convert the collection data to a list of games
        collection = self._collection_to_games(data)
        # Return the collection of games
        return collection

    def plays(self, user_name):
        # Initialize parameters for the plays request, starting with page 1
        params = {
            "username": user_name,
            "page": 1,
        }
        # Initialize an empty list to store all plays
        all_plays = []

        # Make the first request to the plays endpoint
        data = self._make_request("/plays?version=1", params)
        # Convert the plays data to a list of games
        new_plays = self._plays_to_games(data)

        # Continue fetching plays data while there are new plays
        while (len(new_plays) > 0):
            # Add the new plays to the list of all plays
            all_plays = all_plays + new_plays
            # Increment the page number for the next request
            params["page"] += 1
            # Make the next request to the plays endpoint
            data = self._make_request("/plays?version=1", params)
            new_plays = self._plays_to_games(data)

        # Debug print statement to indicate that plays data has been fetched
        print("JCDEBUG: Got plays data")
        # Return the list of all plays
        return all_plays

    def game_list(self, game_ids):
        # Return an empty list if no game IDs are provided
        if not game_ids:
            return []

        # Split game_ids into smaller chunks to avoid "414 URI too long"
        def chunks(iterable, n):
            for i in range(0, len(iterable), n):
                yield iterable[i:i + n]

        games = []
        # Iterate over each chunk of game IDs
        for game_ids_subset in chunks(game_ids, 20):
            # Construct the URL for the request with the current chunk of game IDs
            url = "/thing/?stats=1&id=" + ",".join([str(id_) for id_ in game_ids_subset])
            # Make the request to the constructed URL
            data = self._make_request(url)
            # Convert the game list data to a list of games and add to the games list
            games += self._games_list_to_games(data)

        # Return the list of games
        return games

    def _make_request(self, url, params={}, tries=0):
        """
        Makes a request to the specified URL with the given parameters.

        Args:
            url (str): The URL to make the request to.
            params (dict, optional): The parameters to include in the request. Defaults to an empty dictionary.
            tries (int, optional): The number of times the request has been retried. Defaults to 0.

        Returns:
            str: The response text.

        Raises:
            BGGException: If the request encounters errors or the BGG API closes the connection prematurely.

        Notes:
            - This method uses exponential backoff and jitter for retrying failed requests.
            - If the request encounters HTTP errors (4xx or 5xx status codes), a `BGGException` is raised.
            - If the request encounters connection errors or chunked encoding errors, the method will retry the request up to 10 times.
            - If the request encounters a "Too Many Requests" error, the method will retry the request up to 3 times with a 30-second delay between retries.
            - If the response contains XML errors, a `BGGException` is raised with the specific error messages.
            - This method is recursive, meaning it calls itself if a retry is needed.
        """

        def sleep_with_backoff_and_jitter(base_time, tries=1, jitter_factor=0.5):
            """Sleep with exponential backoff and jitter."""
            sleep_time = base_time * 2 ** tries * random.uniform(1 - jitter_factor, 1 + jitter_factor)
            time.sleep(sleep_time)

        try:
            # Make the request to the URL with the provided parameters
            response = self.requester.get(BGGClient.BASE_URL + url, params=params)
            # Raise an HTTPError if the response contains an unsuccessful status code
            response.raise_for_status()
        except (
            requests.exceptions.HTTPError,
            requests.exceptions.ConnectionError,
            requests.exceptions.ChunkedEncodingError
        ):
            # Handle connection errors and retry the request with backoff and jitter
            if tries < 10:
                sleep_with_backoff_and_jitter(1, tries)
                return self._make_request(url, params=params, tries=tries + 1)
            else:
                raise BGGException("BGG API closed the connection prematurely, please try again...")
        except requests.exceptions.TooManyRequests:
            # Handle "Too Many Requests" errors and retry the request with backoff and jitter
            if tries < 3:
                logger.debug("BGG returned \"Too Many Requests\", waiting 30 seconds before trying again...")
                sleep_with_backoff_and_jitter(30, tries)
                return self._make_request(url, params=params, tries=tries + 1)
            else:
                raise BGGException("BGG returned status code {response.status_code} when requesting {response.url}")

        # Log the request URL and response
        logger.debug("REQUEST: " + response.url)
        logger.debug("RESPONSE: \n" + prettify_if_xml(response.text))

        # Parse the response text into an XML tree
        tree = fromstring(response.text)
        # Handle specific response messages
        if tree.tag == "message" and "Your request for this collection has been accepted" in tree.text:
            if tries < 10:
                # Retry the request with backoff and jitter if the request is accepted but not processed
                logger.debug("BGG returned \"Your request for this collection has been accepted\", waiting 10 seconds before trying again...")
                sleep_with_backoff_and_jitter(10, tries)
                return self._make_request(url, params=params, tries=tries + 1)
            else:
                raise BGGException("BGG API request not processed in time, please try again later.")

        # Handle errors in the response
        if tree.tag == "errors":
            raise BGGException("BGG returned errors while requesting {response.url} - " +
                str([subnode.text for node in tree for subnode in node])
            )

        # Return the response text
        return response.text

    def _plays_to_games(self, data):
        # Define a hook function to process player data after parsing
        def after_players_hook(_, status):
            # Return the player's name if it exists, otherwise return "Unknown"
            if not status.get("name"):
                #if "name" in status:
                # print(status["name"])
                #else:
                status["name"] = "Unknown"

            return status
            # return status["name"] if "name" in status else "Unknown"
        
        def new_after_players_hook(parsed_data, status):
            # Example conditional logic to modify the parsed data
            for play in parsed_data["plays"]:
                # Check if the player's name is missing or empty and set a default value
                for player in play["players"]:
                    if not player.get("name"):
                        player["name"] = "Unknown"
            return parsed_data

        # Define the XML processor for parsing plays data
        plays_processor = xml.dictionary("plays", [
            # Define an array of play dictionaries
            xml.array(
                xml.dictionary('play', [
                    # Parse the play ID as an integer
                    xml.integer(".", attribute="id", alias="playid"),
                    # Parse the play date as a string
                    xml.string(".", attribute="date", alias="playdate"),
                    # Define a nested dictionary for the game item
                    xml.dictionary('item', [
                        # Parse the game name as a string
                        xml.string(".", attribute="name", alias="gamename"),
                        # Parse the game ID as an integer
                        xml.integer(".", attribute="objectid", alias="gameid")
                    ], alias='game'),
                    # Parse the comments as a string, not required
                    xml.string("comments", required=False, alias="gamecomments"),
                    # Define an array of player dictionaries
                    xml.array(
                        xml.dictionary('players/player', [
                            # Parse the player's name as a string, default to "Unknown" if not provided
                            xml.string(".", attribute="name", required=False, default="Unknown"),
                            # Parse the player's color as a string, default to "Unknown" if not provided
                            xml.string(".", attribute="color", required=False, default="Unknown"),
                            # Parse the player's win status as an integer, default to "Unknown" if not provided
                            xml.integer(".", attribute="win", required=False, default="Unknown")
                        ], required=False, alias='players', hooks=xml.Hooks(after_parse=after_players_hook))
                        #], required=False, alias='players')
                    )
                ], required=False, alias="plays")
            )
        ])

        # print(data)

        try:
            plays = xml.parse_from_string(plays_processor, data)
        except xml.MissingValue as e:
            print(f"Error: {e}")
        
        plays = plays["plays"]
        return plays

    def _collection_to_games(self, data):
        def after_status_hook(_, status):
            return [tag for tag, value in status.items() if value == "1"]

        game_in_collection_processor = xml.dictionary("items", [
            xml.array(
                xml.dictionary('item', [
                    xml.integer(".", attribute="objectid", alias="id"),
                    xml.string("name"),
                    xml.string("thumbnail", required=False, alias="image"),
                    xml.string("version/item/thumbnail", required=False, alias="image_version"),
                    xml.dictionary("status", [
                        xml.string(".", attribute="fortrade"),
                        xml.string(".", attribute="own"),
                        xml.string(".", attribute="preordered"),
                        xml.string(".", attribute="prevowned"),
                        xml.string(".", attribute="want"),
                        xml.string(".", attribute="wanttobuy"),
                        xml.string(".", attribute="wanttoplay"),
                        xml.string(".", attribute="wishlist"),
                    ], alias='tags', hooks=xml.Hooks(after_parse=after_status_hook)),
                    xml.integer("numplays"),
                ], required=False, alias="items"),
            )
        ])
        collection = xml.parse_from_string(game_in_collection_processor, data)
        collection = collection["items"]
        return collection

    def _games_list_to_games(self, data):
        def numplayers_to_result(_, results):
            result = {result["value"].lower().replace(" ", "_"): int(result["numvotes"]) for result in results}

            if not result:
                result = {'best': 0, 'recommended': 0, 'not_recommended': 0}

            is_recommended = result['best'] + result['recommended'] > result['not_recommended']
            if not is_recommended:
                return "not_recommended"

            is_best = result['best'] > 10 and result['best'] > result['recommended']
            if is_best:
                return "best"

            return "recommended"

        def suggested_numplayers(_, numplayers):
            # Remove not_recommended player counts
            numplayers = [players for players in numplayers if players["result"] != "not_recommended"]

            # If there's only one player count, that's the best one
            if len(numplayers) == 1:
                numplayers[0]["result"] = "best"

            # Just return the numbers
            return [
                (players["numplayers"], players["result"])
                for players in numplayers
            ]

        def log_item(_, item):
            logger.debug("Successfully parsed: {} (id: {}).".format(item["name"], item["id"]))
            return item

        game_processor = xml.dictionary("items", [
            xml.array(
                xml.dictionary(
                    "item",
                    [
                        xml.integer(".", attribute="id"),
                        xml.string(".", attribute="type"),
                        xml.string("name[@type='primary']", attribute="value", alias="name"),
                        xml.string("description"),
                        xml.array(
                            xml.string(
                                "link[@type='boardgamecategory']",
                                attribute="value",
                                required=False
                            ),
                            alias="categories",
                        ),
                        xml.array(
                            xml.string(
                                "link[@type='boardgamemechanic']",
                                attribute="value",
                                required=False
                            ),
                            alias="mechanics",
                        ),
                        xml.array(
                            xml.dictionary(
                                "link[@type='boardgameexpansion']", [
                                    xml.integer(".", attribute="id"),
                                    xml.boolean(".", attribute="inbound", required=False),
                                ],
                                required=False
                            ),
                            alias="expansions",
                        ),
                        xml.array(
                            xml.dictionary("poll[@name='suggested_numplayers']/results", [
                                xml.string(".", attribute="numplayers"),
                                xml.array(
                                    xml.dictionary("result", [
                                        xml.string(".", attribute="value"),
                                        xml.integer(".", attribute="numvotes"),
                                    ], required=False),
                                    hooks=xml.Hooks(after_parse=numplayers_to_result)
                                )
                            ]),
                            alias="suggested_numplayers",
                            hooks=xml.Hooks(after_parse=suggested_numplayers),
                        ),
                        xml.string(
                            "statistics/ratings/averageweight",
                            attribute="value",
                            alias="weight"
                        ),
                        xml.string(
                            "statistics/ratings/ranks/rank[@friendlyname='Board Game Rank']",
                            attribute="value",
                            required=False,
                            alias="rank"
                        ),
                        xml.string(
                            "statistics/ratings/usersrated",
                            attribute="value",
                            alias="usersrated"
                        ),
                        xml.string(
                            "statistics/ratings/owned",
                            attribute="value",
                            alias="numowned"
                        ),
                        xml.string(
                            "statistics/ratings/bayesaverage",
                            attribute="value",
                            alias="rating"
                        ),
                        xml.string("playingtime", attribute="value", alias="playing_time"),
                        xml.string("minage", attribute="value", alias="min_age"),
                    ],
                    required=False,
                    alias="items",
                    hooks=xml.Hooks(after_parse=log_item),
                )
            )
        ])

        try:
            games = xml.parse_from_string(game_processor, data)
            games = games["items"]
        except MissingValue as e:
            print(f"Error: {e}")

        return games

class CacheBackendSqlite:
    def __init__(self, path, ttl):
        self.cache = CachedSession(
            cache_name=path,
            backend="sqlite",
            expire_after=ttl,
            extension="",
            fast_save=True,
            allowable_codes=(200,)
        )

class BGGException(Exception):
    pass

def prettify_if_xml(xml_string):
    import xml.dom.minidom
    import re
    xml_string = re.sub(r"\s+<", "<", re.sub(r">\s+", ">", re.sub(r"\s+", " ", xml_string)))
    if not xml_string.startswith("<?xml"):
        return xml_string

    parsed = xml.dom.minidom.parseString(xml_string)
    return parsed.toprettyxml()
