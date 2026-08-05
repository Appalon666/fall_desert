# -*- coding: utf-8 -*-
"""Отражает по горизонтали указанные кадры листа 2×2.

Нейросеть рисует часть кадров мордой в другую сторону, а mob-cut.py зеркалит
лист ЦЕЛИКОМ — поэтому внутри одного листа кадры могут смотреть врозь, и в игре
враг на ходу «разворачивается» (первым это поймали на радкрысе и стервятнике).

Кадры нумеруются как читаются: 1 2 / 3 4.

  python tools/flip-frames.py public/sprites/enemy-radrat.png 3 4

Режим --check только ПОДСКАЗЫВАЕТ, где направление может расходиться (сравнивает
каждый кадр с первым как есть и в зеркале). Подсказка ненадёжна на симметричных
силуэтах — решение всегда за глазами, поэтому она ничего не меняет сама.

  python tools/flip-frames.py "public/sprites/*.png" --check
"""
import sys
import glob
import os
import numpy as np
from PIL import Image

SIZE = 56


def cells(rgba):
    """Четыре кадра листа 2×2: (срез по y, срез по x)."""
    h, w = rgba.shape[:2]
    fh, fw = h // 2, w // 2
    return [(slice((i // 2) * fh, (i // 2) * fh + fh),
             slice((i % 2) * fw, (i % 2) * fw + fw)) for i in range(4)]


def thumb(cell):
    """Кадр → нормированный эскиз в оттенках серого (фон = 0)."""
    ys, xs = np.where(cell[..., 3] > 24)
    if not len(xs):
        return None
    box = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    arr = np.asarray(Image.fromarray(box, 'RGBA').resize((SIZE, SIZE), Image.BILINEAR)).astype(np.float32)
    g = arr[..., :3].mean(axis=2) * (arr[..., 3] / 255.0)
    g -= g.mean()
    return g / g.std() if g.std() > 1e-6 else None


def check(path):
    rgba = np.asarray(Image.open(path).convert('RGBA'))
    cs = cells(rgba)
    th = [thumb(rgba[sy, sx]) for sy, sx in cs]
    if th[0] is None:
        return
    hints = []
    for i in range(1, 4):
        if th[i] is None:
            continue
        same = float((th[i] * th[0]).mean())
        mir = float((th[i][:, ::-1] * th[0]).mean())
        if mir > same:
            hints.append(f'{i + 1} (зеркало лучше на {mir - same:+.2f})')
    if hints:
        print(f'{os.path.basename(path):24} возможно развёрнуты: {", ".join(hints)}')


def flip(path, frames):
    rgba = np.asarray(Image.open(path).convert('RGBA')).copy()
    cs = cells(rgba)
    for n in frames:
        sy, sx = cs[n - 1]
        # .copy() обязателен: без него справа стоит ВИД той же памяти, что и
        # слева, и numpy пишет поверх того, что ещё читает — часть кадров
        # переворачивается, часть остаётся как была.
        rgba[sy, sx] = rgba[sy, sx][:, ::-1].copy()
    Image.fromarray(rgba, 'RGBA').save(path, optimize=True)
    print(f'{os.path.basename(path)}: отражены кадры {frames}')


def main():
    if '--check' in sys.argv:
        for pat in [a for a in sys.argv[1:] if not a.startswith('--')]:
            for p in sorted(glob.glob(pat)):
                check(p)
        return
    args = sys.argv[1:]
    if len(args) < 2:
        print('нужно: путь_к_листу номера_кадров (например: ... enemy-radrat.png 3 4)'); return
    frames = [int(a) for a in args[1:] if a.isdigit()]
    if not all(1 <= n <= 4 for n in frames):
        print('номера кадров — от 1 до 4'); return
    flip(args[0], frames)


if __name__ == '__main__':
    main()
