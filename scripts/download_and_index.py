import sys
print(f"Running with Python executable: {sys.executable}")
print(f"Python version: {sys.version}")
import json
import datetime  # Import the datetime module

from mybgg.downloader import Downloader
from mybgg.indexer import Indexer
from setup_logging import setup_logging

def main(args):
    SETTINGS = json.load(open("config.json", "rb"))

    sys.stdout = open('output.txt', 'w')

    print(datetime.datetime.now())
    downloader = Downloader(
        project_name=SETTINGS["project"]["name"],
        cache_bgg=args.cache_bgg,
        debug=args.debug,
    )
    play_data = downloader.collection(
        user_name=SETTINGS["boardgamegeek"]["user_name"],
        extra_params=SETTINGS["boardgamegeek"]["extra_params"],
    )
    num_plays = len(play_data)
    print(f"Imported {num_plays} Marvel Champions plays from boardgamegeek.")

    # Extract and save hero names
    all_hero_names = set()
    # Define comprehensive aspect mappings for normalization
    aspects = [
        {"name": "Aggression", "keywords": ["aggression", "agg", "aggressive", "aggressi", "agression", "aggress", "agres"]},
        {"name": "Leadership", "keywords": ["leadership", "lead", "leader", "leaders", "leadersh", "leader"]},
        {"name": "Protection", "keywords": ["protection", "protec", "protect", "protectio", "protecti"]},
        {"name": "Justice", "keywords": ["justice", "just", "justicia", "justic", "justi"]},
        {"name": "Pool", "keywords": ["pool"]}  # Keep existing Pool aspect
    ]

    def normalize_aspect_in_hero_name(hero_name):
        """
        Normalize aspect contractions in hero names to canonical forms.
        Returns (cleaned_hero_name, detected_aspect)
        """
        name_to_process = str(hero_name).strip()
        detected_aspect = None

        # Strip team prefixes
        if name_to_process.startswith("Team 1 - "):
            name_to_process = name_to_process[len("Team 1 - "):].strip()
        elif name_to_process.startswith("Team: "):
            name_to_process = name_to_process[len("Team: "):].strip()

        # First try exact aspect name matches (case insensitive)
        for aspect in aspects:
            aspect_name = aspect["name"]
            if name_to_process.lower().endswith(aspect_name.lower()):
                detected_aspect = aspect_name
                name_to_process = name_to_process[:-len(aspect_name)].strip()
                break

        # If no exact match, try fuzzy matching with keywords
        if not detected_aspect:
            for aspect in aspects:
                for keyword in aspect["keywords"]:
                    if name_to_process.lower().endswith(keyword.lower()):
                        detected_aspect = aspect["name"]
                        name_to_process = name_to_process[:-len(keyword)].strip()
                        break
                if detected_aspect:
                    break

        # Remove "CC" if it's the last word after aspect removal
        words = name_to_process.split()
        if words and words[-1] == "CC":
            words.pop()
            name_to_process = " ".join(words).strip()

        return name_to_process, detected_aspect

    for play in play_data:
        hero_name = getattr(play, 'hero', None)
        if hero_name:
            cleaned_name, detected_aspect = normalize_aspect_in_hero_name(hero_name)
            
            # If we detected an aspect, update the play object with normalized hero name
            if detected_aspect and cleaned_name:
                # Store the normalized hero name with canonical aspect
                normalized_hero_name = f"{cleaned_name} {detected_aspect}"
                setattr(play, 'hero', normalized_hero_name)

            # Use cleaned name (without aspect) for the hero names cache
            if cleaned_name and '/' not in cleaned_name and '／' not in cleaned_name:
                all_hero_names.add(cleaned_name)
    
    if all_hero_names:
        with open("cached_hero_names.json", "w") as f:
            json.dump(list(all_hero_names), f, indent=2)
        print(f"Saved {len(all_hero_names)} unique hero names to cached_hero_names.json")
    else:
        print("No hero names found to cache.")

    if not len(play_data):
        assert False, "No plays imported, is the boardgamegeek part of config.json correctly set?"

    if not args.no_indexing:
        hits_per_page = SETTINGS["algolia"].get("hits_per_page", 48)
        indexer = Indexer(
            app_id=SETTINGS["algolia"]["app_id"],
            apikey=args.apikey,
            index_name=SETTINGS["algolia"]["index_name"],
            hits_per_page=hits_per_page,
        )
        indexed_count = indexer.add_objects(play_data)
        indexer.delete_objects_not_in(play_data)

        print(f"Indexed {indexed_count} Marvel Champions plays in algolia (filtered from {num_plays} total plays).")
    else:
        print("Skipped indexing.")
       # Close the file
    #sys.stdout.close()

    # Restore standard output to the console
    #sys.stdout = sys.__stdout__

    print("Done!")


if __name__ == '__main__':
    import argparse

    setup_logging()

    parser = argparse.ArgumentParser(description='Download and index some boardgames')
    parser.add_argument(
        '--apikey',
        type=str,
        required=True,
        help='The admin api key for your algolia site'
    )
    parser.add_argument(
        '--no_indexing',
        action='store_true',
        help=("Skip indexing in algolia. This is useful during development, when you want to fetch data from BGG over and over again, and don't want to use up your indexing quota with Algolia.")
    )
    parser.add_argument(
        '--cache_bgg',
        action='store_true',
        help=(
            "Enable a cache for all BGG calls. This makes script run very fast the second time it's run."
        )
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help="Print debug information, such as requests made and responses received."
    )

    args = parser.parse_args()

    main(args)
