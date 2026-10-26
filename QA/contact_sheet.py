from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

base = Path(__file__).parent / 'production-ui-2026-10-26'
for kind, crop_height, cell in [('desktop', 1100, (360, 310)), ('mobile', 1300, (220, 420))]:
    files = sorted(base.glob(f'*-{kind}.png'))
    columns = 4
    width, height = cell
    sheet = Image.new('RGB', (width * columns, height * ((len(files) + columns - 1) // columns)), 'white')
    draw = ImageDraw.Draw(sheet)
    for index, file in enumerate(files):
        source = Image.open(file).convert('RGB')
        source = source.crop((0, 0, source.width, min(source.height, crop_height)))
        thumb = ImageOps.contain(source, (width - 12, height - 36))
        x, y = (index % columns) * width + 6, (index // columns) * height
        sheet.paste(thumb, (x, y + 25))
        draw.text((x, y + 6), file.stem.replace('-' + kind, '')[:28], fill='black')
    target = base / f'{kind}-contact-sheet.jpg'
    sheet.save(target, quality=85)
    print(target, len(files))
