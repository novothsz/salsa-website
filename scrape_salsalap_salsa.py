#!/usr/bin/env python3
import json
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://salsalap.hu"
START_URL = f"{BASE_URL}/videotar/salsa"

# Map CSS classes to level labels (you can rename these later in your UI)
LEVEL_MAP = {
    "beginer1menu": "beginer1",       # Kezdő 1
    "beginer2menu": "beginer2",       # Kezdő 2
    "intermediatemenu": "intermediate",  # Középhaladó
    "advancedmenu": "advanced",       # Haladó
    # add more if you discover other *menu classes (e.g. workshop)
}

# Section headings under "Típus szerinti tartalomjegyzék"
TYPE_HEADERS = [
    "ELEMENTOS",
    "ENCHUFLA",
    "VACILA",
    "SETENTA",
    "SIETE",
    "SOMBRERO",
    "RUEDA",
    "PASEALA",
    "ADIOS",
    "MEDIO-SOMBRERO",
    "BACK-TO-BACK",
    "OTHER",
]


def fetch_soup(url: str) -> BeautifulSoup:
    """Download a page and return a BeautifulSoup object."""
    print(f"GET {url}")
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def iter_type_sections(main_soup: BeautifulSoup):
    """
    Yield (type_name, menu_div) pairs for all moves listed
    under the 'Típus szerinti tartalomjegyzék' headers.
    """
    for div in main_soup.find_all("div"):
        header_text = div.get_text(strip=True)
        if header_text in TYPE_HEADERS:
            type_name = header_text  # keep as-is; you can normalize later
            # Walk following siblings until the next header or non-menu div
            sib = div.find_next_sibling("div")
            while sib:
                classes = sib.get("class") or []
                # menu entries have classes like beginer1menu, beginer2menu, intermediatemenu, advancedmenu
                if any(cls.endswith("menu") for cls in classes):
                    yield type_name, sib
                    sib = sib.find_next_sibling("div")
                else:
                    break


def get_level_from_div(div) -> str:
    """Infer level from the div's CSS class."""
    classes = div.get("class") or []
    for cls in classes:
        if cls in LEVEL_MAP:
            return LEVEL_MAP[cls]
    return "unknown"


def has_no_video_icon(div) -> bool:
    """
    On the main page, moves without video have an <img src=\"/img/novideo.jpg\"> icon.
    """
    img = div.find("img", src=True)
    if not img:
        return False
    return "/img/novideo.jpg" in img["src"]


def extract_youtube_iframes(detail_url: str) -> list[str]:
    """
    On a figura detail page, videos are embedded as <iframe src=\"...youtube...\">.
    Return a list of iframe src URLs (normalized to https:// if needed).
    """
    soup = fetch_soup(detail_url)
    urls = []
    for iframe in soup.find_all("iframe", src=True):
        src = iframe["src"]
        if "youtu" not in src:
            continue
        # normalize protocol-relative URLs like //www.youtube.com/...
        if src.startswith("//"):
            src = "https:" + src
        urls.append(src)
    return urls


def main():
    main_soup = fetch_soup(START_URL)

    moves_by_slug = {}

    for type_name, menu_div in iter_type_sections(main_soup):
        # Each menu_div contains an <a href=\"/videotar/salsa/figura/...\">Name</a>
        a = menu_div.find("a", href=True)
        if not a:
            continue

        name = a.get_text(strip=True)
        relative_href = a["href"]
        detail_url = urljoin(BASE_URL, relative_href)

        # slug is the last part of the URL (/videotar/salsa/figura/<slug>)
        slug = relative_href.rstrip("/").split("/")[-1]

        level = get_level_from_div(menu_div)
        no_video = has_no_video_icon(menu_div)

        if slug not in moves_by_slug:
            moves_by_slug[slug] = {
                "name": name,
                "slug": slug,
                "type": type_name,        # e.g. \"ELEMENTOS\", \"ENCHUFLA\", ...
                "level": level,           # e.g. \"beginer1\", \"intermediate\", ...
                "detail_url": detail_url,
                "youtube_urls": [],
                "has_video": not no_video,
            }
        else:
            # If the same slug shows up under multiple types, you can decide how to handle it.
            # For now, we keep the first type.
            pass

    # Now fetch YouTube URLs for moves that have video
    for slug, move in moves_by_slug.items():
        if not move["has_video"]:
            continue

        try:
            move["youtube_urls"] = extract_youtube_iframes(move["detail_url"])
        except Exception as e:
            print(f"Failed to fetch videos for {slug}: {e}")
            move["youtube_urls"] = []
        # Be polite to the site
        time.sleep(0.5)

    # Save as JSON
    moves = list(moves_by_slug.values())
    with open("salsa_moves.json", "w", encoding="utf-8") as f:
        json.dump(moves, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(moves)} moves to salsa_moves.json")


if __name__ == "__main__":
    main()