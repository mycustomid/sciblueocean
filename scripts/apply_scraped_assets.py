import os
import shutil
import glob
import re

repo_root = r"D:\code\sciblueocean"
scraped_dir = os.path.join(repo_root, "public", "experience", "assets", "scraped")
exp_assets_dir = os.path.join(repo_root, "public", "experience", "assets")
public_dir = os.path.join(repo_root, "public")

# 1. Copy images to both public/experience/assets/ and public/
# so that both /experience/assets/foo.webp and /foo.webp work seamlessly!
images = [f for f in os.listdir(scraped_dir) if f.endswith(('.webp', '.svg', '.png', '.jpg'))]
print(f"Deploying {len(images)} images to public and assets directories...")

for img in images:
    src = os.path.join(scraped_dir, img)
    # copy to public/experience/assets/
    dst1 = os.path.join(exp_assets_dir, img)
    shutil.copy2(src, dst1)
    # copy to public/ (root)
    dst2 = os.path.join(public_dir, img)
    shutil.copy2(src, dst2)
    print(f"  [+] Synced {img} -> public/ and public/experience/assets/")

# 2. Update all HTML files in public/experience/ and src/pages/ to use local paths
# Replace https://sciblueocean.com/foo.webp with /experience/assets/foo.webp
targets = glob.glob(os.path.join(repo_root, "public", "experience", "**", "*.html"), recursive=True)
targets += glob.glob(os.path.join(repo_root, "src", "**", "*.astro"), recursive=True)

modified_count = 0
for file_path in targets:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_content = content
    for img in images:
        # replace https://sciblueocean.com/img.webp with /experience/assets/img.webp
        new_content = re.sub(
            rf'https://sciblueocean\.com/{re.escape(img)}',
            f'/experience/assets/{img}',
            new_content
        )

    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        modified_count += 1
        print(f"  [*] Updated asset links in {os.path.relpath(file_path, repo_root)}")

print(f"\nDone! Updated {modified_count} files to use local authentic assets.")
