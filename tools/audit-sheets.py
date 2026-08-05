# -*- coding: utf-8 -*-
"""Приёмка листов от нейросети: раскладка, мусор, направление.

Для каждого файла печатает:
  - цвет фона (фиолетовый или зелёный хромакей);
  - сколько крупных фигур найдено и как они разложены (2x2 / другое);
  - есть ли подписи-текст и разделительные линии;
  - в какую сторону смотрит фигура в каждом кадре (по «тяжёлому» краю силуэта).
"""
import glob
import os
import numpy as np
from PIL import Image
from scipy import ndimage

TOL_CORE, TOL_EDGE = 58.0, 120.0


def bg_color(a):
    h, w = a.shape[:2]
    k = max(8, min(h, w) // 40)
    c = np.concatenate([a[:k, :k].reshape(-1, 3), a[:k, -k:].reshape(-1, 3),
                        a[-k:, :k].reshape(-1, 3), a[-k:, -k:].reshape(-1, 3)])
    return np.median(c, axis=0)


def mask_of(a, bg):
    d = np.sqrt(((a.astype(np.float32) - bg) ** 2).sum(axis=2))
    return d > TOL_EDGE


def facing(sub):
    """Куда смотрит фигура: сравниваем массу левой и правой трети силуэта.
    У большинства зверей голова тяжелее хвоста, поэтому это грубая, но
    рабочая подсказка — окончательное решение всё равно за глазами."""
    w = sub.shape[1]
    left = sub[:, :w // 3].sum()
    right = sub[:, -w // 3:].sum()
    if left == right:
        return '?'
    return 'влево' if left > right else 'вправо'


for p in sorted(glob.glob('art-in/mobs/*.jpg')):
    a = np.asarray(Image.open(p).convert('RGB'))
    bg = bg_color(a)
    kind = 'зелёный' if bg[1] > bg[0] and bg[1] > bg[2] else 'фиолетовый'
    m = mask_of(a, bg)
    lab, n = ndimage.label(m)
    if n == 0:
        print(f'{os.path.basename(p):18} пусто'); continue
    sizes = np.bincount(lab.ravel()); sizes[0] = 0
    big = np.flatnonzero(sizes >= sizes.max() * 0.12)   # крупные фигуры
    small = int((sizes[1:] > 200).sum() - big.size)      # мелочь: подписи/эффекты
    objs = ndimage.find_objects(lab)
    boxes = [objs[i - 1] for i in big]
    # признак разделительных линий: очень длинные тонкие компоненты
    lines = 0
    for i in np.flatnonzero(sizes[1:] > 200) + 1:
        sl = objs[i - 1]
        hh, ww = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if (ww > a.shape[1] * 0.9 and hh < 12) or (hh > a.shape[0] * 0.9 and ww < 12):
            lines += 1
    rows = sorted(set(round((s[0].start + s[0].stop) / 2 / a.shape[0], 1) for s in boxes))
    faces = [facing(m[s]) for s in boxes]
    print(f'{os.path.basename(p):18} {kind:12} фигур={big.size:2} мелочи={small:2} '
          f'линий={lines} ряды={len(rows)} направления={faces}')
