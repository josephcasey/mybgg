import requests
from bs4 import BeautifulSoup
import time
import re
import json
from PIL import Image
import io
import os
import tempfile
import math
import argparse
from urllib.parse import urljoin, urlparse # Added urljoin and urlparse

# OCR API configuration
OCR_API_KEY = "K83990485088957"  # OCR.space API key

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
    
    # Hero alias mapping to handle nicknames and variations
    hero_aliases = {
        "Dr. Strange": "Doctor Strange",
        "Dr Strange": "Doctor Strange", 
        "Spidey": "Spider-Man",
        "Wolvie": "Wolverine"
    }
    
    # Apply aliases to hero names (including partial matches for nicknames with aspects)
    resolved_hero_names = []
    for name in hero_names_from_cache:
        resolved_name = name
        
        # Check for exact matches first
        if name in hero_aliases:
            resolved_name = hero_aliases[name]
        else:
            # Check for partial matches (nickname followed by aspect)
            for nickname, proper_name in hero_aliases.items():
                if name.startswith(nickname + " "):
                    # Replace the nickname part while keeping any aspect suffix
                    resolved_name = name.replace(nickname, proper_name, 1)
                    break
        
        if resolved_name != name:
            print(f"  Resolving alias: '{name}' -> '{resolved_name}'")
        resolved_hero_names.append(resolved_name)
    
    hero_to_url = {name: None for name in resolved_hero_names}
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


        for hero_name in resolved_hero_names:
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
        print(f"Finished building hero to URL map: {mapped_count}/{len(resolved_hero_names)} heroes mapped.")
                
    except requests.exceptions.RequestException as e:
        print(f"Error fetching or parsing browse page {browse_url}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred in build_hero_to_url_map: {e}")
    return hero_to_url

def get_hero_image_urls(hero_name, hero_url):
    """Scrape the hero's page and try to find the first and second hero card art image URLs from a tiled gallery."""
    try:
        resp = requests.get(hero_url, timeout=10)
        resp.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
        soup = BeautifulSoup(resp.text, "html.parser")
        
        image_urls = []
        
        # Find the tiled gallery div
        gallery = soup.find("div", class_="tiled-gallery__gallery")
        if gallery:
            # Find the first two figure elements with class 'tiled-gallery__item' within the gallery
            gallery_items = gallery.find_all("figure", class_="tiled-gallery__item", limit=2)
            
            for item in gallery_items:
                # Find the img tag within each item
                img_tag = item.find("img")
                if img_tag:
                    # Prioritize 'data-orig-file' as it often holds the full-resolution image
                    if img_tag.get("data-orig-file"):
                        image_urls.append(img_tag["data-orig-file"])
                    # Fallback to 'src' if 'data-orig-file' is not present
                    elif img_tag.get("src"):
                        image_urls.append(img_tag["src"])
        
        return image_urls
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching URL for {hero_name} ({hero_url}): {e}")
    except Exception as e:
        # Catch any other exceptions during parsing or processing
        print(f"An unexpected error occurred while processing {hero_name} ({hero_url}): {e}")
    return []

def scrape_all_hero_images(hero_page_urls_map):
    """
    Scrape all hero pages based on the mapped URLs.
    Falls back to big box pages if necessary.
    Returns a dict of hero name -> {image, image2, reason, source_url}.
    """
    results = {}
    for hero, mapped_hero_page_url in hero_page_urls_map.items():
        print(f"Processing {hero} (Mapped URL from browse: {mapped_hero_page_url}) ...")
        img_urls = []
        reason_parts = []
        
        primary_attempt_url_for_record = mapped_hero_page_url if mapped_hero_page_url else "N/A (no browse page match)"

        if mapped_hero_page_url:
            img_urls = get_hero_image_urls(hero, mapped_hero_page_url)
            if img_urls:
                reason_parts.append(f"Fetched {len(img_urls)} image(s) from mapped hero page gallery")
            else:
                reason_parts.append("Attempted mapped hero page, not found in gallery")
        else:
            reason_parts.append("No specific hero page URL found on /browse/")

        # If no images found, try fallback (keeping original fallback logic for first image)
        if not img_urls:
            fallback_reason_prefix = reason_parts[-1] if reason_parts else "Initial attempt failed"
            print(f"  -> {fallback_reason_prefix}. Attempting fallback for {hero} on big box pages...")
            
            hero_slug_for_fallback = hero.lower().replace(' ', '-').replace('.', '')
            fallback_img_urls = fallback_big_box_images(hero, hero_slug_for_fallback, BIG_BOX_URLS)
            
            if fallback_img_urls:
                img_urls = fallback_img_urls  # Use all fallback images found
                reason_parts.append(f"Fallback: Found {len(fallback_img_urls)} images in big box pages")
            else:
                reason_parts.append("Fallback: No image found in big box pages either")
        
        final_reason = "; ".join(reason_parts)
        
        # Use OCR to determine hero vs alter-ego if we have multiple images
        if len(img_urls) >= 2:
            print(f"  -> Running OCR analysis for {hero}...")
            ocr_result = determine_hero_vs_alter_ego_with_ocr(img_urls, hero)
            
            # Structure the result with OCR-determined assignments
            result_data = {
                "image": ocr_result['hero_image'],
                "image2": ocr_result['alter_ego_image'],
                "reason": final_reason + f" | OCR: {ocr_result['ocr_details']}",
                "source_url": primary_attempt_url_for_record,
                "ocr_confidence": ocr_result['ocr_confidence']
            }
        else:
            # Structure the result with separate fields for first and second images (no OCR needed)
            result_data = {
                "image": img_urls[0] if len(img_urls) > 0 else None,
                "image2": img_urls[1] if len(img_urls) > 1 else None,
                "reason": final_reason,
                "source_url": primary_attempt_url_for_record 
            }
        
        results[hero] = result_data
        
        image_count_msg = f"Found {len(img_urls)} image(s)" if img_urls else "Not found"
        print(f"  -> Result for {hero}: {image_count_msg} (Reason: {final_reason})")
        time.sleep(0.25) # Slightly reduced sleep
    return results

def extract_slug(url):
    """Extract the last non-empty part of the URL as the slug."""
    return url.rstrip('/').split('/')[-1].lower()

def fallback_big_box_images(hero, hero_slug, big_box_urls):
    """
    Search big box URLs for hero images if not found on the individual hero page.
    Now returns ALL suitable images found (both hero and alter-ego potentially).
    Returns: list of image URLs or empty list
    """
    print(f"  -> Initiating fallback search for '{hero}' on big box pages...") # Keep this high-level
    hero_norm = re.sub(r'[^a-z0-9]', '', hero.lower())
    
    # Define acceptable aspect ratio range for hero cards (portrait)
    # Typical card: 2.5 x 3.5 inches => ratio = 2.5/3.5 = ~0.714
    # Let's use a range like 0.6 to 0.9
    MIN_ASPECT_RATIO = 0.6
    MAX_ASPECT_RATIO = 0.9

    found_images = []  # Collect ALL suitable images instead of returning first match

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
                                    found_images.append(img_url)  # Collect instead of immediately returning
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
    
    if found_images:
        print(f"  -> Found {len(found_images)} fallback images for '{hero}' on big box pages.")
        return found_images
    else:
        print(f"  -> No fallback images found for '{hero}' after checking all big box pages.") # Keep this
        return []

def crop_hero_text_region(image_url):
    """
    Download image and crop to the region where HERO/ALTER-EGO text typically appears.
    Uses improved 3x wider crop region for better OCR accuracy.
    
    Args:
        image_url (str): URL of the image to crop
        
    Returns:
        str: Path to the cropped image file, or None if failed
    """
    try:
        # Download the image
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        
        # Open image with PIL
        image = Image.open(io.BytesIO(response.content))
        width, height = image.size
        
        # Use improved cropping logic: 3x wider region
        # Position: 65% from left, 55% from top
        center_x = int(width * 0.65)
        center_y = int(height * 0.55)
        
        # Calculate crop dimensions (3x wider than original)
        crop_height = 150  # Fixed height
        crop_width = 450   # 3x width for better text capture
        
        # Calculate crop box (left, top, right, bottom) centered on the target position
        half_width = crop_width // 2
        half_height = crop_height // 2
        
        left = max(0, center_x - half_width)
        top = max(0, center_y - half_height)
        right = min(width, center_x + half_width)
        bottom = min(height, center_y + half_height)
        
        # Crop the image
        cropped = image.crop((left, top, right, bottom))
        
        # Save to temporary file
        temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
        cropped.save(temp_file.name, 'JPEG', quality=95)
        temp_file.close()
        
        return temp_file.name
        
    except Exception as e:
        print(f"    Error cropping image: {e}")
        return None

def check_image_for_hero_with_ocr(image_url):
    """
    Download, crop, and OCR an image to check for HERO text.
    
    Args:
        image_url (str): The URL of the image to process
        
    Returns:
        tuple: (contains_hero_boolean, extracted_text, cropped_file_path)
    """
    cropped_file = None
    try:
        # First, crop the image to focus on the hero text region
        cropped_file = crop_hero_text_region(image_url)
        if not cropped_file:
            return False, None, None
            
        # Upload the cropped image for OCR
        with open(cropped_file, 'rb') as f:
            files = {'file': f}
            payload = {
                'apikey': OCR_API_KEY,
                'language': 'eng',
                'isOverlayRequired': 'false',
                'OCREngine': '2'
            }
            
            response = requests.post('https://api.ocr.space/parse/image', 
                                   files=files, data=payload, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('IsErroredOnProcessing', False):
                    print(f"    OCR Error: {result.get('ErrorMessage', 'Unknown error')}")
                    return False, None, cropped_file
                else:
                    text = result.get('ParsedResults', [{}])[0].get('ParsedText', '').strip()
                    contains_hero = 'hero' in text.lower()
                    return contains_hero, text, cropped_file
            else:
                print(f"    OCR API error: {response.status_code}")
                return False, None, cropped_file
                
    except Exception as e:
        print(f"    OCR processing error: {e}")
        return False, None, cropped_file

def determine_hero_vs_alter_ego_with_ocr(image_urls, hero_name):
    """
    Use OCR to determine which image is the hero card and which is the alter-ego card.
    
    Args:
        image_urls (list): List of image URLs (typically 2 images)
        hero_name (str): Name of the hero for logging
        
    Returns:
        dict: {
            'hero_image': URL of hero card,
            'alter_ego_image': URL of alter-ego card,
            'ocr_confidence': confidence level,
            'ocr_details': detailed results
        }
    """
    if len(image_urls) < 2:
        # Fallback to URL pattern if only one image or can't OCR
        return determine_hero_vs_alter_ego_by_pattern(image_urls, hero_name)
    
    print(f"  -> Using OCR to identify hero vs alter-ego for {hero_name}")
    
    ocr_results = []
    temp_files = []
    
    try:
        for i, url in enumerate(image_urls[:2], 1):
            print(f"    Testing image {i}: {url}")
            contains_hero, text, temp_file = check_image_for_hero_with_ocr(url)
            
            ocr_results.append({
                'url': url,
                'contains_hero': contains_hero,
                'text': text[:50] + '...' if text and len(text) > 50 else text,
                'image_index': i
            })
            
            if temp_file:
                temp_files.append(temp_file)
            
            # Small delay for API rate limiting
            time.sleep(1)
        
        # Analyze results
        hero_images = [r for r in ocr_results if r['contains_hero']]
        alter_ego_images = [r for r in ocr_results if not r['contains_hero']]
        
        if len(hero_images) == 1 and len(alter_ego_images) == 1:
            # Perfect case: found exactly one hero and one alter-ego
            result = {
                'hero_image': hero_images[0]['url'],
                'alter_ego_image': alter_ego_images[0]['url'],
                'ocr_confidence': 'high',
                'ocr_details': f"OCR clearly identified hero (img {hero_images[0]['image_index']}) and alter-ego (img {alter_ego_images[0]['image_index']})"
            }
            print(f"    ✓ OCR Success: Hero=img{hero_images[0]['image_index']}, Alter-ego=img{alter_ego_images[0]['image_index']}")
        else:
            # Fallback to URL pattern
            print(f"    → OCR inconclusive (hero texts found: {len(hero_images)}), using URL pattern fallback")
            pattern_result = determine_hero_vs_alter_ego_by_pattern(image_urls, hero_name)
            pattern_result['ocr_confidence'] = 'low'
            pattern_result['ocr_details'] = f"OCR found {len(hero_images)} hero texts, fell back to URL pattern"
            result = pattern_result
    
    finally:
        # Clean up temporary files
        for temp_file in temp_files:
            try:
                os.unlink(temp_file)
            except:
                pass
    
    return result

def determine_hero_vs_alter_ego_by_pattern(image_urls, hero_name):
    """
    Fallback method: Use URL patterns to determine hero vs alter-ego cards.
    Based on the convention that 'a.jpg' files are typically hero cards.
    """
    if len(image_urls) < 2:
        return {
            'hero_image': image_urls[0] if image_urls else None,
            'alter_ego_image': None,
            'ocr_confidence': 'pattern',
            'ocr_details': 'Only one image available, assumed to be hero'
        }
    
    # Check URL patterns
    url1, url2 = image_urls[0], image_urls[1]
    
    if url1.endswith('a.jpg') and url2.endswith('b.jpg'):
        return {
            'hero_image': url1,
            'alter_ego_image': url2,
            'ocr_confidence': 'pattern',
            'ocr_details': 'Used URL pattern: a.jpg=hero, b.jpg=alter-ego'
        }
    elif url1.endswith('b.jpg') and url2.endswith('a.jpg'):
        return {
            'hero_image': url2,
            'alter_ego_image': url1,
            'ocr_confidence': 'pattern',
            'ocr_details': 'Used URL pattern: a.jpg=hero, b.jpg=alter-ego (swapped)'
        }
    else:
        # Default: assume first is hero, second is alter-ego
        return {
            'hero_image': url1,
            'alter_ego_image': url2,
            'ocr_confidence': 'pattern',
            'ocr_details': 'Used default assumption: first=hero, second=alter-ego'
        }

def parse_arguments():
    """Parse command line arguments for the script"""
    parser = argparse.ArgumentParser(description='Scrape Marvel Champions character art from Hall of Heroes')
    parser.add_argument('--mode', choices=['full', 'update'], default='full',
                       help='full: Process all heroes (default), update: Only process heroes with single images to find missing alter-ego cards')
    return parser.parse_args()

def load_existing_hero_data(output_file):
    """Load existing hero_images.json if it exists"""
    try:
        with open(output_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"No existing {output_file} found. Running in full mode.")
        return {}
    except json.JSONDecodeError:
        print(f"Error reading {output_file}. Running in full mode.")
        return {}

def filter_heroes_for_update_mode(hero_names, existing_data):
    """Filter heroes to only those with single images (missing alter-ego cards)"""
    heroes_needing_update = []
    
    for hero_name in hero_names:
        if hero_name in existing_data:
            hero_data = existing_data[hero_name]
            # Check if hero has primary image but missing secondary image
            if hero_data.get('image') and not hero_data.get('image2'):
                heroes_needing_update.append(hero_name)
                print(f"  -> {hero_name}: Has primary image, missing alter-ego card")
        else:
            # Hero not in existing data at all
            heroes_needing_update.append(hero_name)
            print(f"  -> {hero_name}: Not in existing data")
    
    return heroes_needing_update

if __name__ == "__main__":
    # Parse command line arguments
    args = parse_arguments()
    
    cached_hero_names_path = "../cached_hero_names.json" # Path from scripts directory
    output_file = "../hero_images.json"
    
    # Load hero names
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

    # Load existing data if in update mode
    existing_data = {}
    if args.mode == 'update':
        print(f"\n=== UPDATE MODE ===")
        print("Loading existing hero data...")
        existing_data = load_existing_hero_data(output_file)
        
        # Filter heroes to only those needing updates
        print(f"Filtering heroes for update mode...")
        heroes_to_process = filter_heroes_for_update_mode(hero_names, existing_data)
        
        if not heroes_to_process:
            print("No heroes need updating. All heroes already have both images or don't exist.")
            exit()
        
        print(f"\nFound {len(heroes_to_process)} heroes needing updates:")
        for hero in heroes_to_process:
            print(f"  - {hero}")
        print()
    else:
        print(f"\n=== FULL MODE ===")
        print("Processing all heroes...")
        heroes_to_process = hero_names

    # Step 1: Build the map from hero names to their URLs on the browse page
    hero_url_map = build_hero_to_url_map(heroes_to_process)

    # Step 2: Scrape images using the new map
    hero_images_data = scrape_all_hero_images(hero_url_map)
    
    # Step 3: Merge with existing data if in update mode
    if args.mode == 'update' and existing_data:
        print(f"\nMerging new data with existing data...")
        # Start with existing data
        final_data = existing_data.copy()
        # Update with new results
        final_data.update(hero_images_data)
        hero_images_data = final_data

    # Step 4: Save results
    with open(output_file, "w") as f:
        json.dump(hero_images_data, f, indent=2)
    print(f"Done. Results saved to {output_file}")

    # Summary
    total = len(hero_images_data)
    heroes_with_primary_image = sum(1 for v in hero_images_data.values() if v["image"])
    heroes_with_secondary_image = sum(1 for v in hero_images_data.values() if v["image2"])
    heroes_with_both_images = sum(1 for v in hero_images_data.values() if v["image"] and v["image2"])
    unmatched_heroes = [k for k, v in hero_images_data.items() if not v["image"]]
    
    print(f"\\n[SUMMARY]")
    print(f"Mode: {args.mode.upper()}")
    if args.mode == 'update':
        print(f"Heroes processed in this update: {len(heroes_to_process)}")
    print(f"Total heroes in dataset: {total}")
    print(f"Heroes with primary images found: {heroes_with_primary_image}")
    print(f"Heroes with secondary images found: {heroes_with_secondary_image}")
    print(f"Heroes with both images found: {heroes_with_both_images}")
    print(f"Heroes without any images: {len(unmatched_heroes)}")
    if unmatched_heroes:
        print(f"Unmatched hero names: {', '.join(unmatched_heroes)}")