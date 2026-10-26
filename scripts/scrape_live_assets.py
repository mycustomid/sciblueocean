"""
Blackhole Asset Scraper for https://sciblueocean.com/
Crawls pages, Next.js static assets, media, images, CSS, fonts, and saves them to:
  D:\code\sciblueocean\scraped_assets\
and automatically mirrors key images into:
  D:\code\sciblueocean\public\experience\assets\scraped\
"""

import os
import re
import ssl
import sys
import shutil
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "https://sciblueocean.com"
OUTPUT_DIR = r"D:\code\sciblueocean\scraped_assets"
EXPERIENCE_ASSETS_DIR = r"D:\code\sciblueocean\public\experience\assets\scraped"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(EXPERIENCE_ASSETS_DIR, exist_ok=True)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
}

discovered_urls = set()
downloaded_urls = set()
discovered_pages = set([
    "/",
    "/properties/miague",
    "/properties/ebene",
    "/properties/amara",
    "/policies",
    "/robots.txt",
    "/sitemap.xml",
    "/signin",
    "/signup",
    "/manage",
    "/staff",
    "/bonapriso",
    "/contact",
    "/faq",
    "/about",
    "/our-story",
    "/journal"
])

def fetch_url(url, is_binary=False):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            data = resp.read()
            return resp.status, resp.headers, data
    except Exception as e:
        return None, None, str(e)

def extract_links_from_text(text, source_url):
    urls = set()
    # 1. Standard attributes (href, src, data-src, srcset)
    pattern = r'(?:href|src|data-src|poster)=["\']([^"\'#\s>]+)["\']'
    for match in re.findall(pattern, text, re.IGNORECASE):
        urls.add(match)

    # 2. srcset
    for srcset in re.findall(r'srcset=["\']([^"\']+)["\']', text, re.IGNORECASE):
        parts = srcset.split(',')
        for p in parts:
            clean = p.strip().split(' ')[0]
            if clean:
                urls.add(clean)

    # 3. CSS url(...)
    for css_url in re.findall(r'url\(\s*["\']?([^"\'\)\s]+)["\']?\s*\)', text, re.IGNORECASE):
        urls.add(css_url)

    # 4. Next.js image optimizer url=...
    for n_url in re.findall(r'/_next/image\?url=([^&"\'\s>]+)', text):
        unq = urllib.parse.unquote(n_url)
        urls.add(unq)
        # Also include the optimized /_next/image version if useful
        urls.add(f"/_next/image?url={n_url}&w=1920&q=85")
        urls.add(f"/_next/image?url={n_url}&w=1200&q=85")
        urls.add(f"/_next/image?url={n_url}&w=828&q=85")

    # 5. Scan inside Next.js chunk scripts for asset paths (like /images/..., /_next/static/media/...)
    asset_literals = re.findall(r'["\'](/images/[^"\'\s]+\.(?:webp|png|jpg|jpeg|svg|avif|ico|mp4|webm))["\']', text, re.IGNORECASE)
    for al in asset_literals:
        urls.add(al)

    media_literals = re.findall(r'["\'](/_next/static/media/[^"\'\s]+)["\']', text, re.IGNORECASE)
    for ml in media_literals:
        urls.add(ml)

    css_literals = re.findall(r'["\'](/_next/static/css/[^"\'\s]+\.css)["\']', text, re.IGNORECASE)
    for cl in css_literals:
        urls.add(cl)

    chunk_literals = re.findall(r'["\'](/_next/static/chunks/[^"\'\s]+\.js)["\']', text, re.IGNORECASE)
    for ckl in chunk_literals:
        urls.add(ckl)

    resolved = set()
    for u in urls:
        if u.startswith('data:') or u.startswith('mailto:') or u.startswith('tel:') or u.startswith('javascript:'):
            continue
        abs_url = urllib.parse.urljoin(source_url, u)
        # Only download assets from same host or relative
        parsed = urllib.parse.urlparse(abs_url)
        if parsed.netloc == "sciblueocean.com" or parsed.netloc == "":
            resolved.add(abs_url)
    return resolved

def save_file(url, data):
    parsed = urllib.parse.urlparse(url)
    rel_path = parsed.path.lstrip('/')
    if not rel_path or rel_path.endswith('/'):
        rel_path = os.path.join(rel_path, 'index.html')
    elif '.' not in os.path.basename(rel_path):
        rel_path = rel_path + '.html'

    # Handle query strings if needed (sanitize for filesystem)
    if parsed.query:
        # if it's next image, extract target url
        qs = urllib.parse.parse_qs(parsed.query)
        if 'url' in qs:
            inner_name = os.path.basename(qs['url'][0])
            width = qs.get('w', ['orig'])[0]
            rel_path = os.path.join('_next_image', f'{width}_{inner_name}')
        else:
            safe_query = re.sub(r'[^a-zA-Z0-9_-]', '_', parsed.query)
            rel_path = f"{rel_path}_{safe_query}"

    local_path = os.path.join(OUTPUT_DIR, rel_path.replace('/', os.sep))
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, 'wb') as f:
        f.write(data)

    # If it is an image or font, also copy to experience assets dir
    ext = os.path.splitext(local_path)[1].lower()
    if ext in ['.webp', '.png', '.jpg', '.jpeg', '.svg', '.avif', '.ico']:
        filename = os.path.basename(local_path)
        dest_copy = os.path.join(EXPERIENCE_ASSETS_DIR, filename)
        with open(dest_copy, 'wb') as f:
            f.write(data)

    return local_path

def download_worker(url):
    if url in downloaded_urls:
        return []
    downloaded_urls.add(url)
    status, headers, data = fetch_url(url)
    if status != 200 or not isinstance(data, (bytes, bytearray)):
        print(f"[-] FAILED ({status}): {url}")
        return []

    local_file = save_file(url, data)
    print(f"[+] ({len(data)}B) {url} -> {os.path.relpath(local_file, OUTPUT_DIR)}")

    new_urls = []
    # If text/html, text/css, application/javascript, parse for more links
    content_type = headers.get('Content-Type', '') if headers else ''
    is_text = any(t in content_type for t in ['text', 'javascript', 'json', 'xml']) or any(url.endswith(e) for e in ['.html', '.css', '.js', '.xml', '.txt'])
    if is_text:
        try:
            text = data.decode('utf-8', errors='ignore')
            new_urls = extract_links_from_text(text, url)
        except Exception:
            pass
    return new_urls

def main():
    print(f"[*] Starting Blackhole scraper on {BASE_URL}...")
    to_visit = set([urllib.parse.urljoin(BASE_URL, p) for p in discovered_pages])

    with ThreadPoolExecutor(max_workers=8) as executor:
        while to_visit:
            current_batch = list(to_visit)
            to_visit.clear()
            futures = [executor.submit(download_worker, url) for url in current_batch]
            for f in futures:
                found = f.result()
                for u in found:
                    if u not in downloaded_urls:
                        to_visit.add(u)

    print("\n[+] Blackhole scrape complete!")
    print(f"[+] Total downloaded files: {len(downloaded_urls)}")
    print(f"[+] Scraped repository: {OUTPUT_DIR}")
    print(f"[+] Mirrored media in: {EXPERIENCE_ASSETS_DIR}")

if __name__ == "__main__":
    main()
