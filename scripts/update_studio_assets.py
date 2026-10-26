import os
import shutil
import glob
import re

repo_root = r"D:\code\sciblueocean"
scraped_dir = os.path.join(repo_root, "public", "experience", "assets", "scraped")
images = [f for f in os.listdir(scraped_dir) if f.endswith(('.webp', '.svg', '.png', '.jpg'))]

targets = glob.glob(os.path.join(repo_root, "public", "studio", "**", "*.html"), recursive=True)

for file_path in targets:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_content = content
    for img in images:
        new_content = re.sub(
            rf'https://sciblueocean\.com/{re.escape(img)}',
            f'/experience/assets/{img}',
            new_content
        )

    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated studio file: {file_path}")
