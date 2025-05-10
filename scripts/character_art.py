import requests
from bs4 import BeautifulSoup
import time

hero_pages = {
    "X-23": "https://hallofheroeslcg.com/x-23-laura-kinney/",
    "Captain Marvel": "https://hallofheroeslcg.com/core-set-2/",
    "Spider-Man": "https://hallofheroeslcg.com/core-set-2/",
    "Vision": "https://hallofheroeslcg.com/vision/",
    "Silk": "https://hallofheroeslcg.com/silk-cindy-moon/",
    "Maria Hill": "https://hallofheroeslcg.com/maria-hill/",
    "Iceman": "https://hallofheroeslcg.com/iceman/",
    "Bishop": "https://hallofheroeslcg.com/bishop/",
    "Deadpool": "https://hallofheroeslcg.com/deadpool/",
    "Wolverine": "https://hallofheroeslcg.com/wolverine/",
    "Black Panther": "https://hallofheroeslcg.com/core-set-2/",
    "Daredevil": "https://hallofheroeslcg.com/daredevil/",
    "Phoenix": "https://hallofheroeslcg.com/phoenix/",
    "Agent 13": "https://hallofheroeslcg.com/agent-13-sharon-carter/",
    "Hawkeye": "https://hallofheroeslcg.com/hawkeye/",
    "Spider-Woman": "https://hallofheroeslcg.com/spider-woman/",
    "Groot": "https://hallofheroeslcg.com/groot/",
    "Venom": "https://hallofheroeslcg.com/venom/",
    "Captain America": "https://hallofheroeslcg.com/captain-america/",
    "Miles Morales": "https://hallofheroeslcg.com/miles-morales/",
    "War Machine": "https://hallofheroeslcg.com/war-machine/",
    "Cable": "https://hallofheroeslcg.com/cable/",
    "Nova": "https://hallofheroeslcg.com/nova/",
    "Doctor Strange": "https://hallofheroeslcg.com/doctor-strange/",
    "Magik": "https://hallofheroeslcg.com/magik/",
    "Ant-Man": "https://hallofheroeslcg.com/ant-man/",
    "Hulk": "https://hallofheroeslcg.com/core-set-2/",
    "Storm": "https://hallofheroeslcg.com/storm/",
    "Nebula": "https://hallofheroeslcg.com/nebula/",
    "Scarlet Witch": "https://hallofheroeslcg.com/scarlet-witch/",
    "Ghost-Spider": "https://hallofheroeslcg.com/ghost-spider/",
    "Black Widow": "https://hallofheroeslcg.com/black-widow/",
    "Jubilee": "https://hallofheroeslcg.com/jubilee/",
    "Rogue": "https://hallofheroeslcg.com/rogue/",
    "Nightcrawler": "https://hallofheroeslcg.com/nightcrawler/",
    "Spider-Ham": "https://hallofheroeslcg.com/spider-ham/",
    "She-Hulk": "https://hallofheroeslcg.com/core-set-2/",
    "Ironheart": "https://hallofheroeslcg.com/ironheart/",
    "Gamora": "https://hallofheroeslcg.com/gamora/",
    "Ms. Marvel": "https://hallofheroeslcg.com/ms-marvel/",
    "Colossus": "https://hallofheroeslcg.com/colossus/",
    "Wasp": "https://hallofheroeslcg.com/wasp/",
    "Iron Man": "https://hallofheroeslcg.com/core-set-2/",
    "Rocket Raccoon": "https://hallofheroeslcg.com/rocket-raccoon/",
    "Nick Fury": "https://hallofheroeslcg.com/nick-fury/",
    "Psylocke": "https://hallofheroeslcg.com/psylocke/",
    "Valkyrie": "https://hallofheroeslcg.com/valkyrie/",
    "Shadowcat": "https://hallofheroeslcg.com/shadowcat/",
    "Gambit": "https://hallofheroeslcg.com/gambit/",
    "Quicksilver": "https://hallofheroeslcg.com/quicksilver/",
    "Winter Soldier": "https://hallofheroeslcg.com/winter-soldier/",
    "Magneto": "https://hallofheroeslcg.com/magneto/",
    "Thor": "https://hallofheroeslcg.com/thor/",
    "Shuri": "https://hallofheroeslcg.com/shuri/",
    "Angel": "https://hallofheroeslcg.com/angel/",
    "Cyclops": "https://hallofheroeslcg.com/cyclops/",
    "Jessica Jones": "https://hallofheroeslcg.com/jessica-jones/",
    "Star-Lord": "https://hallofheroeslcg.com/star-lord/",
}

def get_hero_image_url(hero_name, hero_url):
    """Scrape the hero's page and try to find the main hero card art image URL."""
    try:
        resp = requests.get(hero_url, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # Try to find the first .wp-block-image img or first .card img
        img = soup.select_one(".wp-block-image img, .card img")
        if img and img.get("src"):
            return img["src"]
        # Fallback: find first image in content
        img = soup.find("img")
        if img and img.get("src"):
            return img["src"]
    except Exception as e:
        print(f"Error fetching {hero_name}: {e}")
    return None

def scrape_all_hero_images(hero_pages):
    """Scrape all hero pages and return a dict of hero name -> image url."""
    results = {}
    for hero, url in hero_pages.items():
        print(f"Scraping {hero} ...")
        img_url = get_hero_image_url(hero, url)
        results[hero] = img_url
        print(f"  -> {img_url}")
        time.sleep(1)  # Be polite to the server
    return results

def extract_slug(url):
    """Extract the last non-empty part of the URL as the slug."""
    return url.rstrip('/').split('/')[-1].lower()

def fallback_big_box_image(hero, hero_slug, big_box_urls):
    import re
    print(f"[FALLBACK DEBUG] Searching big box pages for hero: {hero} (slug: {hero_slug})")
    hero_norm = re.sub(r'[^a-z0-9]', '', hero.lower())
    for url in big_box_urls:
        print(f"[FALLBACK DEBUG]   Checking URL: {url}")
        try:
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            h2s = soup.find_all("h2", class_="wp-block-heading")
            h2_list = [(h2.get("id", ""), h2.get_text(strip=True)) for h2 in h2s]
            print(f"[FALLBACK DEBUG]     h2s found: {h2_list}")
            found_h2 = None
            for h2 in h2s:
                h2_id = h2.get("id", "").lower()
                h2_text = h2.get_text(strip=True).lower()
                h2_id_norm = re.sub(r'[^a-z0-9]', '', h2_id)
                h2_text_norm = re.sub(r'[^a-z0-9]', '', h2_text)
                if hero_norm in h2_id_norm or hero_norm in h2_text_norm:
                    found_h2 = h2
                    print(f"[FALLBACK DEBUG]     Fuzzy match found: id='{h2_id}', text='{h2_text}'")
                    break
            if found_h2:
                # Try both class names for gallery
                gallery = found_h2.find_next(class_="tiled-gallery_gallery")
                if not gallery:
                    gallery = found_h2.find_next(class_="tiled-gallery__gallery")
                if gallery:
                    print(f"[FALLBACK DEBUG]     Found gallery after <h2>")
                    imgs = gallery.find_all("img")
                    print(f"[FALLBACK DEBUG]     Found {len(imgs)} images in gallery")
                    if len(imgs) >= 2:
                        img_url = imgs[1].get("src")
                        print(f"[FALLBACK DEBUG]     Fallback image found: {img_url}")
                        return img_url
                    else:
                        print(f"[FALLBACK DEBUG]     Not enough images in gallery for fallback")
                else:
                    print(f"[FALLBACK DEBUG]     No gallery found after <h2>")
            else:
                print(f"[FALLBACK DEBUG]     No fuzzy-matching <h2> found for hero '{hero}' on this page")
        except Exception as e:
            print(f"[FALLBACK DEBUG]     Fallback error for {hero} on {url}: {e}")
    print(f"[FALLBACK DEBUG]   No fallback image found for hero: {hero}")
    return None

def scrape_hero_images_from_browse(hero_pages, browse_url="https://hallofheroeslcg.com/browse/"):
    big_box_urls = [
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
    try:
        resp = requests.get(browse_url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        results = {}
        a_hrefs = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            img = a.find("img")
            a_hrefs.append({
                "href": href,
                "img_src": img["src"] if img and img.get("src") else None
            })
        for hero, url in hero_pages.items():
            hero_fragment = hero.lower().replace(' ', '-')
            hero_norm = ''.join(c for c in hero.lower() if c.isalnum())
            tried_hrefs = []
            image = None
            for a in a_hrefs:
                href_norm = ''.join(c for c in a["href"].lower() if c.isalnum())
                if hero_fragment in a["href"].lower() or hero_norm in href_norm:
                    tried_hrefs.append(a["href"])
                    a_tag = soup.find('a', href=a["href"])
                    if a_tag:
                        parent_div = a_tag.find_parent('div')
                        if parent_div:
                            img_tag = parent_div.find('img')
                            if img_tag and img_tag.get('src'):
                                image = img_tag['src']
            if image:
                reason = "Matched by hero name fragment and image found in parent div"
            else:
                # Fallback: try big box pages
                fallback_img = fallback_big_box_image(hero, hero_fragment, big_box_urls)
                if fallback_img:
                    image = fallback_img
                    reason = "Fallback: found image in big box page"
                elif tried_hrefs:
                    reason = "Matching href found by hero name fragment, but no image present in parent div or big box pages"
                else:
                    reason = "No matching href found by hero name fragment in browse page or big box pages"
                # Debug output for unmatched heroes
                print(f"[DEBUG] No image found for hero: {hero}")
                print(f"[DEBUG] Tried hrefs: {tried_hrefs}")
            results[hero] = {
                "image": image,
                "reason": reason,
                "tried_hrefs": tried_hrefs
            }
        return results
    except Exception as e:
        print(f"Error scraping browse page: {e}")
        return {hero: {"image": None, "reason": f"Error: {e}", "tried_hrefs": []} for hero in hero_pages}

if __name__ == "__main__":
    hero_images = scrape_hero_images_from_browse(hero_pages)
    # Save results to a file
    import json
    with open("hero_images.json", "w") as f:
        json.dump(hero_images, f, indent=2)
    print("Done. Results saved to hero_images.json")
    # After processing and saving hero_images.json
    with open("hero_images.json") as f:
        data = json.load(f)
    total = len(data)
    matched = sum(1 for v in data.values() if v["image"])
    unmatched = [k for k, v in data.items() if not v["image"]]
    print(f"[SUMMARY] Total heroes: {total}")
    print(f"[SUMMARY] Matched heroes: {matched}")
    print(f"[SUMMARY] Unmatched heroes: {len(unmatched)}")
    if unmatched:
        print(f"[SUMMARY] Unmatched hero names: {', '.join(unmatched)}")