# -*- coding: utf-8 -*-
"""Переводит спрайт-листы в PNG8 (палитра 255 цветов + альфа).

Зачем: листы врагов и боссов весят по 300-500 КБ, и все они грузятся перед
первым «Походом». Индексированная палитра ужимает их примерно вчетверо,
а на глаз разницы нет — арт плоский, с ограниченным числом оттенков.

Лист с большим количеством полупрозрачных пикселей (призрак, дым) проверяется
отдельно: если ошибка после сжатия great порога, файл остаётся как был.

Запуск:
  python tools/png8.py "public/sprites/*.png"
  python tools/png8.py "public/sprites/*.png" --dry
"""
import sys
import glob
import os
import numpy as np
from PIL import Image

COLORS = 255
MAX_ERR = 12.0     # средняя ошибка канала, выше которой сжатие отменяем


def convert(path, dry=False):
    before = os.path.getsize(path)
    orig = Image.open(path).convert('RGBA')
    small = orig.quantize(colors=COLORS, method=Image.FASTOCTREE)

    err = float(np.abs(np.asarray(orig).astype(np.int16)
                       - np.asarray(small.convert('RGBA')).astype(np.int16)).mean())
    if err > MAX_ERR:
        print(f'{os.path.basename(path):24} пропущен: ошибка {err:.1f} выше порога {MAX_ERR}')
        return before, before

    if dry:
        import io
        buf = io.BytesIO()
        small.save(buf, 'PNG', optimize=True)
        after = buf.tell()
    else:
        small.save(path, 'PNG', optimize=True)
        after = os.path.getsize(path)

    print(f'{os.path.basename(path):24} {before // 1024:4} КБ → {after // 1024:4} КБ '
          f'(−{100 - after * 100 // before}%), ошибка {err:.1f}')
    return before, after


def main():
    dry = '--dry' in sys.argv
    paths = [p for a in sys.argv[1:] if not a.startswith('--') for p in glob.glob(a)]
    if not paths:
        print('нечего сжимать: не найдено файлов')
        return
    tb = ta = 0
    for p in sorted(paths):
        b, a = convert(p, dry)
        tb += b; ta += a
    print(f'\nитого: {tb // 1024} КБ → {ta // 1024} КБ (−{100 - ta * 100 // tb}%)'
          f'{"  (пробный запуск, файлы не тронуты)" if dry else ""}')


if __name__ == '__main__':
    main()
