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

def scrape_hero_images_from_browse(hero_pages, browse_url="https://hallofheroeslcg.com/browse/"):
    """Scrape the /browse/ page and map hero names to their card art image URLs using slug matching, with debug output and detailed match info."""
    try:
        resp = requests.get(browse_url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        results = {}
        slug_to_hero = {extract_slug(v): k for k, v in hero_pages.items()}
        # Gather all <a href> and their slugs from the browse page
        a_hrefs = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            slug = extract_slug(href)
            img = a.find("img")
            a_hrefs.append({
                "href": href,
                "slug": slug,
                "img_src": img["src"] if img and img.get("src") else None
            })
        # For each hero, match hero name to fragment of href URL and get image from the same parent div
        for hero, url in hero_pages.items():
            hero_fragment = hero.lower().replace(' ', '-')
            tried_hrefs = []
            image = None
            match_info = []
            for a in a_hrefs:
                match_info.append({
                    "hero_fragment": hero_fragment,
                    "candidate_href": a["href"]
                })
                if hero_fragment in a["href"].lower():
                    tried_hrefs.append(a["href"])
                    # Find the parent div and get the first <img> in it
                    # We need to re-find the <a> in the soup to get its parent
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
                if tried_hrefs:
                    reason = "Matching href found by hero name fragment, but no image present in parent div"
                else:
                    reason = "No matching href found by hero name fragment in browse page"
            results[hero] = {
                "image": image,
                "reason": reason,
                "tried_hrefs": tried_hrefs,
                ##"match_info": match_info
            }
        return results
    except Exception as e:
        print(f"Error scraping browse page: {e}")
        return {hero: {"image": None, "reason": f"Error: {e}", "tried_hrefs": [], "match_info": []} for hero in hero_pages}

if __name__ == "__main__":
    hero_images = scrape_hero_images_from_browse(hero_pages)
    # Save results to a file
    import json
    with open("hero_images.json", "w") as f:
        json.dump(hero_images, f, indent=2)
    print("Done. Results saved to hero_images.json")