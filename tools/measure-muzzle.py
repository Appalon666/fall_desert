# -*- coding: utf-8 -*-
"""Находит точку вылета пули по вспышке в кадре выстрела (кадр 2, нижний левый).

Печатает смещение дула в долях кадра относительно точки-якоря спрайта
(центр по X, footY по Y) — ровно в том виде, как это ждёт classes.js.
"""
import sys
import numpy as np
from PIL import Image

FOOT = {'gunner': 0.988, 'brute': 0.986, 'mechanic': 0.988, 'scavenger': 0.988}

for name in ['gunner', 'brute', 'mechanic', 'scavenger']:
    im = Image.open(f'art-out/hero-{name}.png').convert('RGBA')
    a = np.asarray(im)
    H, W = a.shape[:2]
    fh, fw = H // 2, W // 2
    f = a[fh:fh + fh, 0:fw]          # нижний левый кадр = выстрел/удар
    rgb = f[..., :3].astype(np.float32)
    al = f[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if name == 'mechanic':
        flash = (al > 128) & (g > 200) & (r < 200) & (b < 200)      # зелёный плазма-выстрел
    else:
        flash = (al > 128) & (r > 215) & (g > 190) & (b < 170)      # жёлто-белая вспышка
    ys, xs = np.where(flash)
    if xs.size < 20:
        print(f'{name}: вспышка не найдена ({xs.size} px)')
        continue
    thr = np.percentile(xs, 60)      # самая правая часть вспышки = дуло
    sel = xs >= thr
    mx, my = float(xs[sel].mean()), float(ys[sel].mean())
    ox, oy = fw * 0.5, fh * FOOT[name]
    dx, dy = round((mx - ox) / fw, 3), round((oy - my) / fh, 3)
    print(f'{name}: muzzle {{ x: {dx}, y: {dy} }}   '
          f'(вспышка в {int(mx)},{int(my)}; кадр {fw}x{fh})')
