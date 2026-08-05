# -*- coding: utf-8 -*-
"""Контактный лист: по одному кадру с каждого листа врагов, на тёмном фоне.
Нужен, чтобы глазами проверить вырезку и направление (все должны идти ВЛЕВО).
"""
import glob
import os
import sys
from PIL import Image, ImageDraw

FRAME = int(sys.argv[1]) if len(sys.argv) > 1 else 0   # какой кадр показывать
CELL = 210
COLS = 7

files = sorted(glob.glob('art-out/mobs/*.png'))
rows = (len(files) + COLS - 1) // COLS
sheet = Image.new('RGB', (CELL * COLS, (CELL + 22) * rows), (38, 31, 24))
d = ImageDraw.Draw(sheet)
c = 14
for y in range(sheet.height):
    for x in range(0, sheet.width, c):
        if ((x // c) + (y // c)) % 2 == 0:
            d.point([(x + i, y) for i in range(c)], fill=(52, 43, 33))

for i, p in enumerate(files):
    im = Image.open(p).convert('RGBA')
    fw, fh = im.width // 2, im.height // 2
    fx, fy = (FRAME % 2) * fw, (FRAME // 2) * fh
    fr = im.crop((fx, fy, fx + fw, fy + fh))
    k = min(CELL / fr.width, CELL / fr.height)
    fr = fr.resize((max(1, int(fr.width * k)), max(1, int(fr.height * k))), Image.LANCZOS)
    cx = (i % COLS) * CELL + (CELL - fr.width) // 2
    cy = (i // COLS) * (CELL + 22) + (CELL - fr.height)
    sheet.alpha_composite(fr, (cx, cy)) if sheet.mode == 'RGBA' else sheet.paste(fr, (cx, cy), fr)
    d.text(((i % COLS) * CELL + 4, (i // COLS) * (CELL + 22) + CELL + 4),
           os.path.basename(p)[:-4], fill=(220, 210, 190))

sheet.save('art-out/_mobs-preview.png')
print('кадр', FRAME, '->', 'art-out/_mobs-preview.png', sheet.size)
