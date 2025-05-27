#!/usr/bin/env python3

import sys
import json
print("Starting villain extraction script...")
sys.path.append('scripts')

try:
    from mybgg.downloader import Downloader
    print("Successfully imported Downloader")
except ImportError as e:
    print(f"ImportError: {e}")
    sys.exit(1)

def main():
    print("Loading config...")
    try:
        # Load settings
        SETTINGS = json.load(open("config.json", "rb"))
        print("Config loaded successfully")
    except Exception as e:
        print(f"Error loading config: {e}")
        return
    
    print("Creating downloader...")
    try:
        # Create downloader
        downloader = Downloader(
            project_name=SETTINGS["project"]["name"],
            cache_bgg=True,  # Use cache to avoid re-downloading
            debug=False,
        )
        print("Downloader created successfully")
    except Exception as e:
        print(f"Error creating downloader: {e}")
        return
    
    print("Getting play data...")
    try:
        # Get play data
        play_data = downloader.collection(
            user_name=SETTINGS["boardgamegeek"]["user_name"],
            extra_params=SETTINGS["boardgamegeek"]["extra_params"],
        )
        print(f"Got {len(play_data) if play_data else 0} plays")
    except Exception as e:
        print(f"Error getting play data: {e}")
        return
    
    # Extract villain names
    villains = set()
    heroes = set()
    
    print("Processing plays...")
    for i, play in enumerate(play_data):
        if hasattr(play, 'villain') and play.villain:
            villains.add(play.villain)
        if hasattr(play, 'hero') and play.hero:
            heroes.add(play.hero)
        
        if i < 5:  # Show first 5 plays for debugging
            print(f"  Play {i}: hero='{getattr(play, 'hero', 'N/A')}', villain='{getattr(play, 'villain', 'N/A')}'")
    
    print(f"Found {len(villains)} unique villains:")
    for villain in sorted(villains):
        print(f"  - {villain}")
    
    print(f"\nFound {len(heroes)} unique heroes for reference:")
    for hero in sorted(list(heroes)[:10]):  # Show first 10 heroes
        print(f"  - {hero}")
    
    # Save to file for later use
    villain_list = list(sorted(villains))
    with open("cached_villain_names.json", "w") as f:
        json.dump(villain_list, f, indent=2)
    
    print(f"\nSaved villain names to cached_villain_names.json")

if __name__ == "__main__":
    main()
