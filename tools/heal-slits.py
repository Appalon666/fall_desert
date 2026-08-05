# -*- coding: utf-8 -*-
"""Заращивает следы «линии пола» в готовых листах врагов и боссов.

Нейросеть иногда рисует по кадру линию-подложку (уровень пола, разделитель
сетки). Хромакей в mob-cut.py её частично съедает, и на персонаже остаётся
тонкая ПРОРЕЗЬ (насквозь видно арену) плюс полоска чужого цвета по краям —
на крысином короле, матери выводка и кувалде это видно невооружённым глазом.

Ищем тонкие горизонтальные (и вертикальные) полосы, у которых ВНУТРИ фигуры
пробиты дыры: пиксель прозрачный, а в 4 строках выше и ниже — тело. Полосу
расширяем на соседние строки-«линейки» (длинный отрезок почти постоянного
цвета — так выглядит нарисованная линия и не выглядит живой рисунок) и
зарастаем линейной интерполяцией соседних чистых строк.

Запуск:
  python tools/heal-slits.py "public/sprites/*.png"
  python tools/heal-slits.py "public/sprites/boss-ratking.png" --dry
"""
import sys
import glob
import os
import numpy as np
from PIL import Image

REACH = 4          # на столько строк выше/ниже ищем тело, чтобы понять «дыра ли это»
MAX_BAND = 8       # полоса толще этой — не линия, а часть рисунка
MIN_HOLES = 0.08   # доля ширины: сколько дыр в строке считаем повреждением
FLAT_RUN = 0.12    # доля ширины: длина отрезка ровного цвета, выдающая «линейку»
FLAT_TOL = 14      # разброс канала внутри такого отрезка


def flat_run_len(rgba_row):
    """Самый длинный отрезок почти постоянного цвета среди непрозрачных пикселей."""
    a = rgba_row[..., 3] > 24
    rgb = rgba_row[..., :3].astype(np.int16)
    best = cur = 0
    start = None
    for x in range(len(a)):
        if not a[x]:
            cur = 0; start = None; continue
        if start is None:
            start = x; cur = 1
        else:
            seg = rgb[start:x + 1]
            if (seg.max(axis=0) - seg.min(axis=0)).max() <= FLAT_TOL:
                cur = x - start + 1
            else:
                start = x; cur = 1
        best = max(best, cur)
    return best


def damaged_rows(solid):
    """Строки, где внутри фигуры пробиты дыры (сверху и снизу тело есть)."""
    h, w = solid.shape
    out = np.zeros(h, bool)
    for y in range(REACH, h - REACH):
        holes = (~solid[y]) & solid[y - REACH] & solid[y + REACH]
        out[y] = holes.sum() > w * MIN_HOLES
    return out


def bands(flags):
    """Непрерывные группы True длиной до MAX_BAND."""
    out, start = [], None
    for i, v in enumerate(flags):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start <= MAX_BAND:
                out.append((start, i - 1))
            start = None
    if start is not None and len(flags) - start <= MAX_BAND:
        out.append((start, len(flags) - 1))
    return out


BODY = 200         # альфа, с которой пиксель считается плотным телом
MIN_RUN = 20       # длина горизонтального отрезка повреждения, выдающая линию


def _long_runs(flags, min_len):
    """Оставляет только отрезки True длиной от min_len."""
    out = np.zeros_like(flags)
    start = None
    for i, v in enumerate(flags):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                out[start:i] = True
            start = None
    if start is not None and len(flags) - start >= min_len:
        out[start:] = True
    return out


def close_holes(rgba, reach=REACH):
    """Закрывает тонкие следы линии внутри фигуры.

    Повреждение — это пиксель, который просвечивает (альфа ниже BODY), хотя и
    выше, и ниже него в пределах reach есть плотное тело. Хромакей режет линию
    неровно, поэтому от неё остаётся то дыра насквозь, то полупрозрачная
    полоска — оба случая ловятся одним правилом.

    Требование «отрезок длиной от MIN_RUN» отделяет линию от честного мягкого
    контура: обводка внутри рисунка короткая, линия — длинная.
    """
    solid = rgba[..., 3] >= BODY
    h = solid.shape[0]
    filled = 0
    for y in range(1, h - 1):
        # ближайшее тело сверху и снизу в пределах reach
        up = np.zeros_like(solid[y])
        dn = np.zeros_like(solid[y])
        up_src = np.zeros(solid.shape[1], int)
        dn_src = np.zeros(solid.shape[1], int)
        for d in range(1, reach + 1):
            if y - d >= 0:
                fresh = (~up) & solid[y - d]
                up_src[fresh] = y - d
                up |= fresh
            if y + d < h:
                fresh = (~dn) & solid[y + d]
                dn_src[fresh] = y + d
                dn |= fresh
        holes = _long_runs((~solid[y]) & up & dn, MIN_RUN)
        if not holes.any():
            continue
        xs = np.where(holes)[0]
        for x in xs:
            ya, yb = up_src[x], dn_src[x]
            f = (y - ya) / (yb - ya)
            rgba[y, x] = np.round(rgba[ya, x].astype(np.float32) * (1 - f)
                                  + rgba[yb, x].astype(np.float32) * f).astype(np.uint8)
        filled += len(xs)
    return rgba, filled


def heal(rgba):
    """Зарастить горизонтальные полосы. Возвращает (лист, сколько пикселей)."""
    h, w = rgba.shape[:2]
    solid = rgba[..., 3] > 24
    healed = 0
    for y0, y1 in bands(damaged_rows(solid)):
        # расширяем на соседние строки-«линейки» (остаток самой линии)
        top, bot = y0 - 1, y1 + 1
        while top > 0 and (bot - top) <= MAX_BAND + 2 * 2 and flat_run_len(rgba[top]) > w * FLAT_RUN:
            top -= 1
        while bot < h - 1 and (bot - top) <= MAX_BAND + 2 * 2 and flat_run_len(rgba[bot]) > w * FLAT_RUN:
            bot += 1
        if top < 0 or bot >= h:
            continue
        cols = solid[top] & solid[bot]
        if cols.sum() < w * MIN_HOLES:
            continue
        a, b = rgba[top].astype(np.float32), rgba[bot].astype(np.float32)
        span = bot - top
        for k in range(1, span):
            f = k / span
            row = np.round(a * (1 - f) + b * f).astype(np.uint8)
            rgba[top + k][cols] = row[cols]
        healed += int(cols.sum()) * (span - 1)
    return rgba, healed


def wipe_ghost_lines(rgba, reach=REACH):
    """Стирает бледные остатки линии ТАМ, ГДЕ ТЕЛА НЕТ.

    Часть линии проходит не по персонажу, а рядом (под лапами, у самого низа
    кадра). Зарастить её нечем — сверху и снизу пусто, — поэтому просто гасим:
    длинный горизонтальный отрезок полупрозрачных блёклых пикселей без плотного
    тела вокруг — это точно не рисунок.
    """
    a = rgba[..., 3]
    rgb = rgba[..., :3].astype(np.int16)
    solid = a >= BODY
    h = a.shape[0]
    wiped = 0
    for y in range(h):
        faint = (a > 0) & (a < BODY)
        pale = (rgb[y].max(axis=1) - rgb[y].min(axis=1)) < 60
        near = np.zeros_like(solid[y])
        for d in range(1, reach + 1):
            if y - d >= 0:
                near |= solid[y - d]
            if y + d < h:
                near |= solid[y + d]
        cand = _long_runs(faint[y] & pale & (~solid[y]) & (~near), MIN_RUN * 2)
        if cand.any():
            rgba[y, cand, 3] = 0
            wiped += int(cand.sum())
    return rgba, wiped


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry' in sys.argv
    paths = [p for a in args for p in glob.glob(a)]
    if not paths:
        print('нечего чинить: не найдено файлов'); return
    for path in sorted(paths):
        rgba = np.asarray(Image.open(path).convert('RGBA')).copy()
        rgba, h1 = heal(rgba)
        rgba, c1 = close_holes(rgba)
        rgba = np.transpose(rgba, (1, 0, 2)).copy()   # вертикальные полосы — тем же кодом
        rgba, h2 = heal(rgba)
        rgba, c2 = close_holes(rgba)
        rgba = np.transpose(rgba, (1, 0, 2)).copy()
        rgba, wiped = wipe_ghost_lines(rgba)
        if not (h1 + h2 + c1 + c2 + wiped):
            continue
        print(f'{os.path.basename(path)}: зарощено полос {h1}+{h2} px, '
              f'закрыто дыр {c1}+{c2} px, стёрто следов {wiped} px'
              f'{" (пробный запуск, файл не тронут)" if dry else ""}')
        if not dry:
            Image.fromarray(rgba, 'RGBA').save(path, optimize=True)


if __name__ == '__main__':
    main()
