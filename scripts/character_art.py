import requests
from bs4 import BeautifulSoup
import time
import re
import json
from PIL import Image
import io
import os
from urllib.parse import urljoin, urlparse # Added urljoin and urlparse

BIG_BOX_URLS = [
    "https://hallofheroeslcg.com/core-set-2/",
    "https://hallofheroeslcg.com/the-rise-of-red-skull-player-cards/",
    "https://hallofheroeslcg.com/galaxys-most-wanted/",
    "https://hallofheroeslcg.com/the-mad-titans-shadow/",
    "https://hallofheroeslcg.com/sinister-motives/",
    "https://hallofheroeslcg.com/mutant-genesis/",
    "https://hallofheroeslcg.com/next-evolution/",
    "https://hallofheroeslcg.com/the-age-of-apocalypse/",
    "https://hallofheroeslcg.com/agents-of-shield/",
]

def build_hero_to_url_map(hero_names_from_cache, browse_url="https://hallofheroeslcg.com/browse/"):
    """
    Fetches the browse page and maps hero names to their specific page URLs
    using a fuzzy matching score.
    """
    print(f"Building hero to URL map from {browse_url}...")
    hero_to_url = {name: None for name in hero_names_from_cache}
    try:
        resp = requests.get(browse_url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        
        all_links = soup.find_all("a", href=True)
        link_candidates_raw = []

        parsed_browse_url = urlparse(browse_url)
        base_url_for_resolve = f"{parsed_browse_url.scheme}://{parsed_browse_url.netloc}/"

        excluded_slugs_or_patterns = [
            # Campaign boxes / Expansions (often also in BIG_BOX_URLS but good to have here)
            "core-set", "the-rise-of-red-skull", "galaxys-most-wanted", 
            "the-mad-titans-shadow", "sinister-motives", "mutant-genesis", 
            "next-evolution", "the-age-of-apocalypse", "agents-of-shield",
            # Specific non-hero scenario packs or villain packs if we want to be strict
            # "green-goblin", "wrecking-crew", "the-once-and-future-kang", "mojo-mania", "the-hood", 
            # "ronan-the-accuser", # For now, let matching with hero_names handle these.
            
            # General site structure, categories, meta pages
            "encounters-and-mods", "player-cards", "all-basics", "aggression", 
            "leadership", "protection", "justice", "all-pool", "all-allies", 
            "all-player-side-schemes", "all-heroes", # "all-heroes" is a list page
            "custom-content", "extrasandpromosandcustomcontent", "errata-pack",
            "blog-feed", "latest-ffg-rulings-post-rrg-1-6", "community-resources",
            "interviews", "storage", "upcoming-releases", "contact", "about", "search",
            "wp-login", "wp-admin", "category", "tag", "author", "page",
            "feed", "privacy-policy", "terms-of-service", "sitemap",
            "cards", "promos-guides-data", "rulings", "resources", "release-dates",
            # Cycle overview pages
            "cycle-1", "cycle-2", "cycle-3", "cycle-4", "cycle-5", 
            "cycle-6", "cycle-7", "cycle-8", "cycle-9"
        ]
        
        for i in range(1, 15): # Catch any /cycle-N/ type pages
            if f"cycle-{i}" not in excluded_slugs_or_patterns:
                 excluded_slugs_or_patterns.append(f"cycle-{i}")


        for link_tag in all_links:
            href_raw = link_tag.get("href")
            if not href_raw or href_raw.startswith("#") or "javascript:void" in href_raw.lower():
                continue

            href = urljoin(base_url_for_resolve, href_raw)

            if not href.startswith(parsed_browse_url.scheme) or urlparse(href).netloc != parsed_browse_url.netloc:
                continue

            path_parts = href.rstrip('/').split('/')
            slug = path_parts[-1].lower() if path_parts and path_parts[-1] else ""

            if not slug or slug.isdigit() or len(slug) < 3: # Avoid empty, numeric, or too short slugs
                continue

            is_excluded = False
            # Check against exact BIG_BOX_URLS (which are full URLs)
            if href in BIG_BOX_URLS:
                is_excluded = True
            
            if not is_excluded:
                for pattern in excluded_slugs_or_patterns:
                    if slug == pattern or slug.startswith(pattern + "-"):
                        is_excluded = True
                        break
            
            if "player-cards" in slug or "encounters-and-mods" in slug or "expansion" in slug or "campaign" in slug:
                is_excluded = True
            
            # Exclude if path seems to indicate a sub-page of an excluded item, e.g. /core-set/something/
            # This is a bit broad, but can help.
            # For example, if "core-set" is an excluded slug, and URL is /core-set/hero-name/,
            # this logic might incorrectly exclude it if not careful.
            # The current slug check is on the last part.
            # Let's check if any part of the path is an excluded term (more aggressive).
            # path_segments = [seg for seg in href.replace(base_url_for_resolve, "").split('/') if seg]
            # for seg in path_segments[:-1]: # Check all but the last segment (slug)
            #     if seg in excluded_slugs_or_patterns:
            #         is_excluded = True
            #         break
            # This might be too aggressive. Sticking to slug-based exclusion for now.

            if is_excluded:
                continue
            
            # Derive text for matching from the slug
            text_for_matching = slug.replace('-', ' ').replace('_', ' ').lower()
            
            link_candidates_raw.append({
                "text": text_for_matching,
                "href": href,
                "slug": slug 
            })

        # Deduplicate link_candidates by href
        link_candidates = []
        seen_hrefs = set()
        for candidate in link_candidates_raw:
            if candidate["href"] not in seen_hrefs:
                link_candidates.append(candidate)
                seen_hrefs.add(candidate["href"])

        if not link_candidates:
            print("Warning: No suitable link candidates found on the browse page after filtering.")
            return hero_to_url
        else:
            print(f"Found {len(link_candidates)} potential hero page links for matching after filtering.")


        for hero_name in hero_names_from_cache:
            hero_name_lower = hero_name.lower()
            hero_slug_form = hero_name_lower.replace(' ', '-').replace('.', '')
            hero_words_set = set(hero_name_lower.split())

            best_href_for_hero = None
            max_score_for_hero = 0

            for candidate in link_candidates:
                current_score = 0
                link_text_lower = candidate["text"].lower()
                link_slug_lower = candidate["slug"].lower()

                # Scoring logic
                if hero_slug_form == link_slug_lower:
                    current_score += 100
                if hero_name_lower == link_text_lower: # Exact name match in text
                    current_score += 80
                
                link_text_words_set = set(link_text_lower.split())
                if hero_words_set == link_text_words_set: # All words match exactly and exclusively
                    current_score += 70
                elif hero_words_set.issubset(link_text_words_set): # All hero words are in link text
                    current_score += 50
                
                # Check slug parts if hero_slug_form is not an exact match to link_slug_lower
                # This helps if hero_slug_form is "hero" and link_slug_lower is "hero-subtitle"
                if hero_slug_form != link_slug_lower and hero_slug_form in link_slug_lower:
                    current_score += 30 # hero_slug is part of the link slug
                
                if hero_name_lower != link_text_lower and hero_name_lower in link_text_lower: # hero name is substring of link text
                    current_score += 20

                if current_score > max_score_for_hero:
                    max_score_for_hero = current_score
                    best_href_for_hero = candidate["href"]
            
            if best_href_for_hero:
                hero_to_url[hero_name] = best_href_for_hero
                # Removed verbose print for every successful map:
                # print(f"  Mapped '{hero_name}' to '{best_href_for_hero}' (Score: {max_score_for_hero})")
            else:
                print(f"  Could not map '{hero_name}' from browse page.")
        
        mapped_count = sum(1 for url in hero_to_url.values() if url is not None)
        print(f"Finished building hero to URL map: {mapped_count}/{len(hero_names_from_cache)} heroes mapped.")
                
    except requests.exceptions.RequestException as e:
        print(f"Error fetching or parsing browse page {browse_url}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred in build_hero_to_url_map: {e}")
    return hero_to_url

def get_hero_image_url(hero_name, hero_url):
    """Scrape the hero's page and try to find the main hero card art image URL from the first item in a tiled gallery."""
    try:
        resp = requests.get(hero_url, timeout=10)
        resp.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
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
        print(f"Error fetching URL for {hero_name} ({hero_url}): {e}")
    except Exception as e:
        # Catch any other exceptions during parsing or processing
        print(f"An unexpected error occurred while processing {hero_name} ({hero_url}): {e}")
    return None

def scrape_all_hero_images(hero_page_urls_map):
    """
    Scrape all hero pages based on the mapped URLs.
    Falls back to big box pages if necessary.
    Returns a dict of hero name -> {image_url, reason, source_url}.
    """
    results = {}
    for hero, mapped_hero_page_url in hero_page_urls_map.items():
        print(f"Processing {hero} (Mapped URL from browse: {mapped_hero_page_url}) ...")
        img_url = None
        reason_parts = []
        
        primary_attempt_url_for_record = mapped_hero_page_url if mapped_hero_page_url else "N/A (no browse page match)"

        if mapped_hero_page_url:
            img_url = get_hero_image_url(hero, mapped_hero_page_url)
            if img_url:
                reason_parts.append("Fetched from mapped hero page gallery")
            else:
                reason_parts.append("Attempted mapped hero page, not found in gallery")
        else:
            reason_parts.append("No specific hero page URL found on /browse/")

        if not img_url:
            fallback_reason_prefix = reason_parts[-1] if reason_parts else "Initial attempt failed"
            print(f"  -> {fallback_reason_prefix}. Attempting fallback for {hero} on big box pages...")
            
            hero_slug_for_fallback = hero.lower().replace(' ', '-').replace('.', '')
            fallback_img_url = fallback_big_box_image(hero, hero_slug_for_fallback, BIG_BOX_URLS)
            
            if fallback_img_url:
                img_url = fallback_img_url
                reason_parts.append("Fallback: Found image in big box page")
            else:
                reason_parts.append("Fallback: No image found in big box pages either")
        
        final_reason = "; ".join(reason_parts)
        results[hero] = {
            "image": img_url,
            "reason": final_reason,
            "source_url": primary_attempt_url_for_record 
        }
        print(f"  -> Result for {hero}: {'Found' if img_url else 'Not found'} (Reason: {final_reason})")
        time.sleep(0.25) # Slightly reduced sleep
    return results

def extract_slug(url):
    """Extract the last non-empty part of the URL as the slug."""
    return url.rstrip('/').split('/')[-1].lower()

def fallback_big_box_image(hero, hero_slug, big_box_urls):
    print(f"  -> Initiating fallback search for '{hero}' on big box pages...") # Keep this high-level
    hero_norm = re.sub(r'[^a-z0-9]', '', hero.lower())
    
    # Define acceptable aspect ratio range for hero cards (portrait)
    # Typical card: 2.5 x 3.5 inches => ratio = 2.5/3.5 = ~0.714
    # Let's use a range like 0.6 to 0.9
    MIN_ASPECT_RATIO = 0.6
    MAX_ASPECT_RATIO = 0.9

    for url_item in big_box_urls:
        # Removed: print(f"[FALLBACK DEBUG]   Checking URL: {url_item}")
        try:
            resp = requests.get(url_item, timeout=15)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            h2s = soup.find_all("h2", class_="wp-block-heading")
            # Removed: h2_list print
            # print(f"[FALLBACK DEBUG]     h2s found: {h2_list}")
            found_h2 = None
            for h2 in h2s:
                h2_id = h2.get("id", "").lower()
                h2_text = h2.get_text(strip=True).lower()
                h2_id_norm = re.sub(r'[^a-z0-9]', '', h2_id)
                h2_text_norm = re.sub(r'[^a-z0-9]', '', h2_text)
                if hero_norm in h2_id_norm or hero_norm in h2_text_norm:
                    found_h2 = h2
                    # Removed: print(f"[FALLBACK DEBUG]     Fuzzy match found: id='{h2_id}', text='{h2_text}'")
                    break
            if found_h2:
                # Try both class names for gallery
                gallery = found_h2.find_next(class_="tiled-gallery_gallery")
                if not gallery:
                    gallery = found_h2.find_next(class_="tiled-gallery__gallery")
                
                if gallery:
                    # Removed: print(f"[FALLBACK DEBUG]     Found gallery after <h2>")
                    imgs_tags = gallery.find_all("img")
                    # Removed: print(f"[FALLBACK DEBUG]     Found {len(imgs_tags)} images in gallery. Checking aspect ratios...")
                    
                    for img_tag in imgs_tags:
                        img_url = None
                        if img_tag.get("data-orig-file"):
                            img_url = img_tag["data-orig-file"]
                        elif img_tag.get("src"):
                            img_url = img_tag["src"]
                        
                        if img_url:
                            try:
                                # Removed: print(f"[FALLBACK RATIO DEBUG]       Attempting to fetch image for ratio check: {img_url}")
                                img_resp = requests.get(img_url, timeout=10, stream=True)
                                img_resp.raise_for_status()
                                
                                content_type = img_resp.headers.get('content-type')
                                if not content_type or not content_type.startswith('image/'):
                                    # Removed: print(f"[FALLBACK RATIO DEBUG]         Skipping non-image content: {content_type}")
                                    continue

                                image_content = img_resp.content
                                pil_image = Image.open(io.BytesIO(image_content))
                                width, height = pil_image.size
                                pil_image.close()

                                if height == 0:
                                    # Removed: print(f"[FALLBACK RATIO DEBUG]         Image has zero height. Skipping.")
                                    continue
                                
                                aspect_ratio = width / height
                                # Removed: print(f"[FALLBACK RATIO DEBUG]         Image: {img_url}, Dimensions: {width}x{height}, Ratio: {aspect_ratio:.3f}")

                                if MIN_ASPECT_RATIO <= aspect_ratio <= MAX_ASPECT_RATIO:
                                    print(f"    -> Fallback image found for '{hero}' with suitable aspect ratio: {img_url}") # Keep this
                                    return img_url
                                # else:
                                    # Removed: print(f"[FALLBACK RATIO DEBUG]         Aspect ratio {aspect_ratio:.3f} out of range ({MIN_ASPECT_RATIO}-{MAX_ASPECT_RATIO}).")
                            
                            except requests.exceptions.RequestException: # Simplified exception logging
                                # Removed: print(f"[FALLBACK RATIO DEBUG]         Error fetching image {img_url} for ratio check: {img_req_e}")
                                pass # Silently pass fetch errors for individual images during fallback
                            except IOError: # Catches PIL errors
                                # Removed: print(f"[FALLBACK RATIO DEBUG]         Error opening image {img_url} with PIL: {img_io_e}")
                                pass # Silently pass PIL errors
                            except Exception:
                                # Removed: print(f"[FALLBACK RATIO DEBUG]         Unexpected error processing image {img_url}: {img_e}")
                                pass # Silently pass other errors
                        # else:
                            # Removed: print(f"[FALLBACK RATIO DEBUG]       Skipping img tag with no src or data-orig-file.")
                    # Removed: print(f"[FALLBACK DEBUG]     No image with suitable aspect ratio found in this gallery.")
                # else:
                    # Removed: print(f"[FALLBACK DEBUG]     No gallery found after <h2>")
            # else:
                # Removed: print(f"[FALLBACK DEBUG]     No fuzzy-matching <h2> found for hero '{hero}' on this page")
        except Exception: # Simplified exception logging
            # Removed: print(f"[FALLBACK DEBUG]     Fallback error for {hero} on {url_item}: {e}")
            pass # Silently pass errors for an entire big box page
    print(f"  -> No fallback image found for '{hero}' after checking all big box pages.") # Keep this
    return None

if __name__ == "__main__":
    cached_hero_names_path = "cached_hero_names.json" # Assumes script run from project root
    hero_names = []
    try:
        with open(cached_hero_names_path, "r") as f:
            hero_names = json.load(f)
        if not hero_names:
            print(f"Warning: {cached_hero_names_path} is empty or contains no hero names.")
        else:
            print(f"Loaded {len(hero_names)} hero names from {cached_hero_names_path}.")
    except FileNotFoundError:
        print(f"Error: {cached_hero_names_path} not found. Please run download_and_index.py first.")
        exit()
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {cached_hero_names_path}.")
        exit()

    if not hero_names:
        print("No hero names to process. Exiting.")
        exit()

    # Step 1: Build the map from hero names to their URLs on the browse page
    hero_url_map = build_hero_to_url_map(hero_names)

    # Step 2: Scrape images using the new map
    hero_images_data = scrape_all_hero_images(hero_url_map)
    
    output_file = "hero_images.json"
    with open(output_file, "w") as f:
        json.dump(hero_images_data, f, indent=2)
    print(f"Done. Results saved to {output_file}")

    # Summary
    total = len(hero_images_data)
    matched = sum(1 for v in hero_images_data.values() if v["image"])
    unmatched_heroes = [k for k, v in hero_images_data.items() if not v["image"]]
    
    print(f"\\n[SUMMARY]")
    print(f"Total heroes processed: {total}")
    print(f"Heroes with images found: {matched}")
    print(f"Heroes without images: {len(unmatched_heroes)}")
    if unmatched_heroes:
        print(f"Unmatched hero names: {', '.join(unmatched_heroes)}")