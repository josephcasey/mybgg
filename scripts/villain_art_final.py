import requests
from bs4 import BeautifulSoup
import time
import re
import json
from PIL import Image
import io
import os
from urllib.parse import urljoin, urlparse

# URLs for encounter packs and big box expansions that contain villain art
ENCOUNTER_URLS = [
    "https://hallofheroeslcg.com/the-rise-of-red-skull/",
    "https://hallofheroeslcg.com/galaxys-most-wanted-encounters-and-mods/",
    "https://hallofheroeslcg.com/the-mad-titans-shadow-encounters-and-mods/",
    "https://hallofheroeslcg.com/sinister-motives/",
    "https://hallofheroeslcg.com/mutant-genesis/",
    "https://hallofheroeslcg.com/next-evolution/",
    "https://hallofheroeslcg.com/the-age-of-apocalypse/",
    "https://hallofheroeslcg.com/agents-of-shield/",
    "https://hallofheroeslcg.com/core-set-2/",
    # Additional specific pack pages that might contain missing villains
    "https://hallofheroeslcg.com/morlock-siege/",
    "https://hallofheroeslcg.com/marauders/",
    "https://hallofheroeslcg.com/sinister-six/",
    "https://hallofheroeslcg.com/drang/",
    "https://hallofheroeslcg.com/wolverine/",
    "https://hallofheroeslcg.com/psylocke/",
    "https://hallofheroeslcg.com/phoenix/",
    "https://hallofheroeslcg.com/angel/",
    "https://hallofheroeslcg.com/iceman/",
    "https://hallofheroeslcg.com/rogue/",
    "https://hallofheroeslcg.com/gambit/"
]

# Additional specific villain pages
VILLAIN_SPECIFIC_URLS = [
    "https://hallofheroeslcg.com/green-goblin/",
    "https://hallofheroeslcg.com/the-wrecking-crew/",
    "https://hallofheroeslcg.com/the-once-and-future-kang/",
    "https://hallofheroeslcg.com/mojo-mania/",
    "https://hallofheroeslcg.com/the-hood/",
    "https://hallofheroeslcg.com/ronan-the-accuser/",
]

def normalize_villain_name(villain_name):
    """
    Normalize villain names by removing difficulty indicators and cleaning up the name
    for better matching with Hall of Heroes page names.
    """
    # Remove difficulty indicators: 1/2, 2/3, A, A1/A2, etc.
    # Pattern matches: space + (digit/digit OR letter OR letter+digit/letter+digit) at end
    # Also handles cases like "Crossbones1/2" (no space before difficulty)
    normalized = re.sub(r'\s*(\d+/\d+|[A-Z]\d*/[A-Z]\d*|[A-Z]\d+|[A-Z])$', '', villain_name)
    
    # Remove trailing spaces
    normalized = normalized.strip()
    
    # Handle specific parenthetical variations
    if "(Mutagen Formula)" in normalized:
        normalized = normalized.replace(" (Mutagen Formula)", "")
    elif "(Standard)" in normalized:
        normalized = normalized.replace(" (Standard)", "")
    elif "(Escape the Museum)" in normalized:
        normalized = "Collector"
    elif "(Infiltrate the Museum)" in normalized:
        normalized = "Collector"
    elif "(Gotta Get Away)" in normalized:
        normalized = "Marauders"
    elif "(Morlock Seige)" in normalized:
        normalized = "Marauders"
    elif "(Corvus/Proxima)" in normalized:
        normalized = "Tower Defense"
    
    return normalized

def get_special_search_terms(villain_name):
    """Get special search terms for problematic villains."""
    normalized = normalize_villain_name(villain_name)
    
    # Special cases for the missing villains
    special_terms = {
        "Drang": ["drang", "thor", "asgard", "d4a", "d1a"],
        "Marauders": ["marauders", "marauder", "gotta get away", "morlock siege", "m4a", "m1a"],
        "Morlock Seige": ["morlock", "siege", "morlock siege", "marauders", "m4a", "m1a"],
        "Sinister 6": ["sinister 6", "sinister six", "sinister-6", "sinister-six", "s6", "s4a", "s1a"],
    }
    
    if normalized in special_terms:
        return special_terms[normalized]
    
    # Default search terms
    return [
        normalized.lower(),
        normalized.lower().replace(' ', ''),
        normalized.lower().replace(' ', '-'),
        villain_name.lower(),  # Also try original name
    ]

def build_villain_to_url_map(villain_names_from_cache):
    """
    Build a mapping for the few villains that have dedicated pages.
    Most villains will be None and rely on encounter page fallback.
    """
    print("Building villain to URL map for dedicated villain pages...")
    
    # Create a set of normalized villain names for better matching
    normalized_villains = {}
    for original_name in villain_names_from_cache:
        normalized = normalize_villain_name(original_name)
        if normalized not in normalized_villains:
            normalized_villains[normalized] = []
        normalized_villains[normalized].append(original_name)
    
    print("Normalized", len(villain_names_from_cache), "villain names to", len(normalized_villains), "unique base names")
    
    # Manual mapping for known dedicated villain pages
    known_villain_pages = {
        "Green Goblin": "https://hallofheroeslcg.com/green-goblin/",
        "Wrecking Crew": "https://hallofheroeslcg.com/the-wrecking-crew/",
        "Kang": "https://hallofheroeslcg.com/the-once-and-future-kang/",
        "Mojo": "https://hallofheroeslcg.com/mojo-mania/",
        "Hood": "https://hallofheroeslcg.com/the-hood/",
        "Ronan": "https://hallofheroeslcg.com/ronan-the-accuser/",
        "Nebula": "https://hallofheroeslcg.com/nebula/",
        "Venom": "https://hallofheroeslcg.com/venom/",
        "Magneto": "https://hallofheroeslcg.com/magneto-erik-lehnsherr/",
        "Black Widow": "https://hallofheroeslcg.com/natasha-romanoff-black-widow/"
    }
    
    # Build the mapping
    villain_url_map = {}
    matched_count = 0
    
    for normalized_name, original_names in normalized_villains.items():
        # Check if this normalized name has a known dedicated page
        dedicated_url = None
        
        for known_name, known_url in known_villain_pages.items():
            if normalized_name.lower() == known_name.lower() or known_name.lower() in normalized_name.lower():
                dedicated_url = known_url
                break
        
        # Map all original names to the found URL (or None)
        for original_name in original_names:
            villain_url_map[original_name] = dedicated_url
            if dedicated_url:
                print(f"✓ Mapped '{original_name}' -> '{normalized_name}' -> {dedicated_url}")
                matched_count += 1
    
    print(f"Found dedicated pages for {matched_count}/{len(villain_names_from_cache)} villains")
    print("Note: Most villains will use encounter page fallback search")
    
    return villain_url_map

def get_villain_image_url(villain_name, villain_url):
    """Scrape the villain's page and try to find the main villain card art image URL from a gallery."""
    try:
        resp = requests.get(villain_url, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        
        # Find the tiled gallery div
        gallery = soup.find("div", class_="tiled-gallery__gallery")
        if gallery:
            # Find the first figure element with class 'tiled-gallery__item' within the gallery
            first_item = gallery.find("figure", class_="tiled-gallery__item")
            if first_item:
                # Find the img tag within the first item
                img_tag = first_item.find("img")
                if img_tag:
                    # Prioritize 'data-orig-file' as it often holds the full-resolution image
                    if img_tag.get("data-orig-file"):
                        return img_tag["data-orig-file"]
                    # Fallback to 'src' if 'data-orig-file' is not present
                    elif img_tag.get("src"):
                        return img_tag["src"]
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching URL for {villain_name} ({villain_url}): {e}")
    except Exception as e:
        print(f"An unexpected error occurred while processing {villain_name} ({villain_url}): {e}")
    
    return None

def search_page_for_villain_images(url, search_terms, villain_name):
    """Enhanced page search with better image detection for specific villains."""
    try:
        print(f"    -> Checking {url}")
        print(f"       Fetching page content...")
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        print(f"       Got response ({len(resp.text)} chars), parsing HTML...")
        soup = BeautifulSoup(resp.text, "html.parser")
        
        # Define acceptable aspect ratio range for villain cards (portrait format)
        # Villain cards are typically in portrait format (height > width)
        # Standard card ratio is around 2.5" x 3.5" = 0.714, so we want ratios < 1.0
        MIN_ASPECT_RATIO = 0.5  # Not too tall/narrow
        MAX_ASPECT_RATIO = 0.95  # Portrait format (height > width)
        
        # Get normalized villain name for search
        normalized_villain = normalize_villain_name(villain_name)
        
        # Look for H2 headings that might contain villain names (focus on H2 for big box expansions)
        print(f"       Searching for H2 headings that match search terms...")
        headings = soup.find_all("h2", class_=["wp-block-heading", "entry-title"])
        print(f"       Found {len(headings)} H2 headings to check")
        
        found_section = None
        best_match_heading = None
        
        # Try to find an H2 heading that matches our villain
        for heading in headings:
            heading_text = heading.get_text(strip=True).lower()
            heading_id = heading.get("id", "").lower()
            print(f"         Checking H2 heading: '{heading_text}'")
            
            # Check if any search term matches the heading
            for search_term in search_terms:
                if search_term in heading_text or search_term in heading_id:
                    found_section = heading
                    best_match_heading = heading_text
                    print(f"      -> Found matching H2 heading: '{heading_text}'")
                    break
            
            if found_section:
                break
        
        if found_section:
            print(f"       Looking for the first portrait image after the matched H2 heading...")
            
            # Find the first portrait format image after this H2 heading
            # Look through all subsequent elements for any img tags
            current = found_section
            for _ in range(20):  # Check next 20 elements after the heading
                current = current.find_next()
                if not current:
                    break
                
                # Look for any img tag in this element or its children
                img_tags = current.find_all("img") if current.name else []
                if current.name == "img":
                    img_tags = [current]
                elif hasattr(current, 'find_all'):
                    img_tags = current.find_all("img")
                
                for img_tag in img_tags:
                    img_url = None
                    if img_tag.get("data-orig-file"):
                        img_url = img_tag["data-orig-file"]
                    elif img_tag.get("src"):
                        img_url = img_tag["src"]
                    
                    if img_url:
                        print(f"          Found image after H2: {img_url}")
                        try:
                            # Check if this is a portrait format image
                            print(f"          Checking dimensions...")
                            img_resp = requests.get(img_url, timeout=10, stream=True)
                            img_resp.raise_for_status()
                            
                            content_type = img_resp.headers.get('content-type')
                            if not content_type or not content_type.startswith('image/'):
                                continue

                            image_content = img_resp.content
                            pil_image = Image.open(io.BytesIO(image_content))
                            width, height = pil_image.size
                            pil_image.close()

                            if height == 0:
                                continue
                            
                            aspect_ratio = width / height
                            print(f"          -> Image {img_url}: {width}x{height}, ratio: {aspect_ratio:.3f}")

                            # Check if this is a portrait format villain card
                            if MIN_ASPECT_RATIO <= aspect_ratio <= MAX_ASPECT_RATIO:
                                print(f"    -> ✓ Found portrait villain card after H2 '{best_match_heading}': {img_url}")
                                return img_url, url
                            else:
                                print(f"          -> Skipping: aspect ratio {aspect_ratio:.3f} not portrait ({MIN_ASPECT_RATIO}-{MAX_ASPECT_RATIO})")
                        
                        except (requests.exceptions.RequestException, IOError, Exception) as e:
                            print(f"          -> Error checking image: {e}")
                            continue
        
        # If no H2 heading match, skip the broader search for now
        # (Big box villains should be found via H2 headings)
        print(f"      -> No H2 heading match found for '{normalized_villain}' - skipping broader search")

    except Exception as e:
        print(f"      -> Error checking {url}: {e}")
        print(f"         Error type: {type(e).__name__}")
        import traceback
        print(f"         Traceback: {traceback.format_exc()}")
    
    print(f"      -> Finished checking {url} - no suitable image found")
    return None, None

def fallback_encounter_image(villain, encounter_urls):
    """Search for villain images in encounter/expansion pack pages using improved matching."""
    normalized_villain = normalize_villain_name(villain)
    print(f"  -> Searching for '{normalized_villain}' (from '{villain}') on encounter pages...")
    
    # Get special search terms for this villain
    search_terms = get_special_search_terms(villain)
    
    # Remove duplicates while preserving order
    search_terms = list(dict.fromkeys(search_terms))
    print(f"    -> Using search terms: {search_terms}")
    print(f"    -> Will check {len(encounter_urls)} encounter URLs...")

    for i, url_item in enumerate(encounter_urls, 1):
        print(f"    -> Checking URL {i}/{len(encounter_urls)}: {url_item}")
        result = search_page_for_villain_images(url_item, search_terms, villain)
        if result[0]:  # Found an image
            print(f"    -> ✓ SUCCESS: Found image on URL {i}")
            return result
        else:
            print(f"    -> No match on URL {i}, continuing...")
    
    print(f"  -> FAILED: No suitable image found for '{normalized_villain}' in any of {len(encounter_urls)} encounter pages")
    return None, None

def scrape_all_villain_images(villain_page_urls_map):
    """
    Scrape all villain images. Try dedicated pages first, then encounter pages.
    Returns a dict of villain name -> {image_url, reason, source_url}.
    """
    results = {}
    total_villains = len(villain_page_urls_map)
    
    for i, (villain, mapped_villain_page_url) in enumerate(villain_page_urls_map.items(), 1):
        print(f"\n=== PROCESSING VILLAIN {i}/{total_villains}: '{villain}' ===")
        img_url = None
        reason_parts = []
        source_url = "N/A"

        # Try dedicated villain page first (if exists)
        if mapped_villain_page_url:
            print(f"  -> Trying dedicated page: {mapped_villain_page_url}")
            img_url = get_villain_image_url(villain, mapped_villain_page_url)
            if img_url:
                reason_parts.append("Found on dedicated villain page")
                source_url = mapped_villain_page_url
            else:
                reason_parts.append("Dedicated page exists but no suitable image found")

        # If no image found, try encounter pages (this is the main method for most villains)
        if not img_url:
            if mapped_villain_page_url:
                print(f"  -> Dedicated page unsuccessful, trying encounter pages...")
            else:
                print(f"  -> No dedicated page, searching encounter pages...")
            
            fallback_result = fallback_encounter_image(villain, ENCOUNTER_URLS + VILLAIN_SPECIFIC_URLS)
            if fallback_result[0]:  # fallback_result is (img_url, source_url)
                img_url = fallback_result[0]
                source_url = fallback_result[1]
                reason_parts.append("Found in encounter pack page")
            else:
                reason_parts.append("No suitable image found in encounter pages")
        
        # Compile final result
        if not reason_parts:
            reason_parts.append("No search attempted")
        
        final_reason = "; ".join(reason_parts)
        results[villain] = {
            "image": img_url,
            "reason": final_reason,
            "source_url": source_url
        }
        
        status = "✓ FOUND" if img_url else "✗ NOT FOUND"
        print(f"  -> {status}: {final_reason}")
        
        # Progress indicator
        if i % 5 == 0 or img_url:
            print(f"\n[PROGRESS] Completed {i}/{total_villains} villains. Found images for {sum(1 for r in results.values() if r['image'])} villains so far.")
        
        # Small delay to be respectful
        time.sleep(0.5)
    
    return results

if __name__ == "__main__":
    cached_villain_names_path = "../cached_villain_names.json"
    villain_names = []
    
    try:
        with open(cached_villain_names_path, "r") as f:
            villain_names = json.load(f)
        if not villain_names:
            print(f"Warning: {cached_villain_names_path} is empty or contains no villain names.")
        else:
            print(f"Loaded {len(villain_names)} villain names from {cached_villain_names_path}.")
    except FileNotFoundError:
        print(f"Error: {cached_villain_names_path} not found. Please run the villain extraction script first.")
        exit()
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {cached_villain_names_path}.")
        exit()

    if not villain_names:
        print("No villain names to process. Exiting.")
        exit()

    # Test the normalization function
    print("\n=== Testing name normalization ===")
    test_names = villain_names[:10]
    for name in test_names:
        normalized = normalize_villain_name(name)
        if normalized != name:
            print(f"'{name}' -> '{normalized}'")

    # Step 1: Build the map from villain names to their URLs on the browse page
    villain_url_map = build_villain_to_url_map(villain_names)

    # Step 2: Scrape images using the new map
    villain_images_data = scrape_all_villain_images(villain_url_map)
    
    output_file = "../villain_images_final.json"
    with open(output_file, "w") as f:
        json.dump(villain_images_data, f, indent=2)
    print(f"Done. Results saved to {output_file}")

    # Summary
    total = len(villain_images_data)
    matched = sum(1 for v in villain_images_data.values() if v["image"])
    unmatched_villains = [k for k, v in villain_images_data.items() if not v["image"]]
    
    print(f"\n[SUMMARY]")
    print(f"Total villains processed: {total}")
    print(f"Villains with images found: {matched}")
    print(f"Villains without images: {len(unmatched_villains)}")
    if unmatched_villains:
        print(f"Unmatched villain names: {', '.join(unmatched_villains)}")
