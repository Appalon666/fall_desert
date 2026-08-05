# -*- coding: utf-8 -*-
"""
Готовит спрайт-лист героя из картинки нейросети (сетка 2x2, хромакей).

Что делает:
  1. Определяет цвет фона по углам и вырезает его в прозрачность
     (с мягким краем и очисткой цветной каймы).
  2. Убирает watermark и прочий мусор — мелкие «острова» пикселей,
     не связанные с персонажем.
  3. Убирает линию пола под ногами, если нейросеть её всё-таки нарисовала.
  4. Считает общий bounding box по ВСЕМ четырём кадрам и обрезает их
     одинаково — так ноги остаются на одной линии.
  5. Собирает обратно сетку 2x2 и сохраняет оптимизированный PNG.
  6. Печатает размер кадра и footY для classes.js.

Запуск:
  python tools/sprite-cut.py art-in/gunner.png public/sprites/hero-gunner.png
"""
import sys
import numpy as np
from PIL import Image

TOL_CORE = 58.0     # ближе этого к фону — точно фон (запас на шум JPEG)
TOL_EDGE = 120.0    # дальше этого — точно персонаж; между — полупрозрачный край
ERODE = 1           # на сколько px поджать матовую маску, срезая кайму фона
MIN_ISLAND = 120    # острова мельче (в пикселях) считаем мусором
FLOOR_ZONE = 0.30   # нижняя доля кадра, где ищем линию пола
FLOOR_WIDE = 0.55   # строка шире этой доли ширины кадра — кандидат в линию пола
FLOOR_MAX_H = 10    # линия пола не толще стольких строк
PAD = 6             # поле вокруг персонажа после обрезки
TARGET_FRAME_H = 400  # высота кадра после сжатия (герой на экране ~225 px)
QUANT_COLORS = 0      # >0 — квантовать палитру (задаётся 3-м аргументом)


def background_color(a):
    """Цвет фона = медиана по четырём углам."""
    h, w = a.shape[:2]
    k = max(8, min(h, w) // 40)
    corners = np.concatenate([
        a[:k, :k].reshape(-1, 3), a[:k, -k:].reshape(-1, 3),
        a[-k:, :k].reshape(-1, 3), a[-k:, -k:].reshape(-1, 3),
    ])
    return np.median(corners, axis=0)


def key_out(rgb, bg):
    """Альфа 0..255 по расстоянию до цвета фона, с мягким краем."""
    d = np.sqrt(((rgb.astype(np.float32) - bg) ** 2).sum(axis=2))
    a = (d - TOL_CORE) / (TOL_EDGE - TOL_CORE)
    return (np.clip(a, 0.0, 1.0) * 255).astype(np.uint8)


def despill(rgb, alpha, bg):
    """Убирает цветную кайму фона на полупрозрачных краях."""
    out = rgb.astype(np.float32)
    a = (alpha.astype(np.float32) / 255.0)[..., None]
    partial = ((alpha > 0) & (alpha < 250))[..., None]
    # Из полупрозрачного пикселя вычитаем вклад фона: C = (P - (1-a)*BG) / a
    fixed = np.divide(out - (1.0 - a) * bg, np.maximum(a, 1e-3))
    out = np.where(partial, fixed, out)
    return np.clip(out, 0, 255).astype(np.uint8)


def label_islands(mask):
    """Разметка связных областей (4-связность). scipy быстрее, но не обязателен."""
    try:
        from scipy import ndimage
        lab, n = ndimage.label(mask)
        return lab.astype(np.int32), int(n)
    except Exception:
        pass
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    cur = 0
    stack = []
    for y0 in range(h):
        row = mask[y0]
        for x0 in range(w):
            if not row[x0] or lab[y0, x0]:
                continue
            cur += 1
            stack.append((y0, x0))
            lab[y0, x0] = cur
            while stack:
                y, x = stack.pop()
                if y > 0 and mask[y - 1, x] and not lab[y - 1, x]:
                    lab[y - 1, x] = cur; stack.append((y - 1, x))
                if y < h - 1 and mask[y + 1, x] and not lab[y + 1, x]:
                    lab[y + 1, x] = cur; stack.append((y + 1, x))
                if x > 0 and mask[y, x - 1] and not lab[y, x - 1]:
                    lab[y, x - 1] = cur; stack.append((y, x - 1))
                if x < w - 1 and mask[y, x + 1] and not lab[y, x + 1]:
                    lab[y, x + 1] = cur; stack.append((y, x + 1))
    return lab, cur


def erode_alpha(alpha, px=ERODE):
    """Поджимает маску на px пикселей: вместе с краем уходит кайма фона."""
    if px <= 0:
        return alpha
    try:
        from scipy import ndimage
        return ndimage.minimum_filter(alpha, size=2 * px + 1)
    except Exception:
        return alpha


def is_violet(mean_rgb):
    """Фиолетовый/сиреневый — цвет фона и watermark. У персонажей его нет."""
    r, g, b = [float(v) / 255.0 for v in mean_rgb]
    mx, mn = max(r, g, b), min(r, g, b)
    sat = 0.0 if mx <= 0 else (mx - mn) / mx
    return sat > 0.15 and b > g + 0.08 and r > g + 0.03 and b > 0.25


def drop_junk_islands(alpha, rgb):
    """Убирает мелкие острова И любые фиолетовые пятна — это watermark."""
    mask = alpha > 24
    lab, n = label_islands(mask)
    if n == 0:
        return alpha, 0
    sizes = np.bincount(lab.ravel(), minlength=n + 1)
    sizes[0] = 0
    keep = sizes >= MIN_ISLAND
    keep[0] = False
    # Средний цвет острова: фиолетовый — значит watermark, а не часть героя.
    solid = alpha > 128
    for idx in np.flatnonzero(keep):
        sel = (lab == idx) & solid
        if sel.sum() < 8:
            continue
        if is_violet(rgb[sel].mean(axis=0)):
            keep[idx] = False
    removed = int((~keep[1:]).sum())
    alpha = np.where(keep[lab], alpha, 0).astype(np.uint8)
    return alpha, removed


def defringe_violet(rgb, alpha):
    """Гасит остаточную фиолетовую кайму на краях, не трогая силуэт."""
    a = alpha > 24
    f = rgb.astype(np.float32) / 255.0
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    mx = f.max(axis=2)
    mn = f.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    bad = a & (sat > 0.18) & (b > g + 0.10) & (r > g + 0.05) & (b > 0.25)
    if not bad.any():
        return rgb, 0
    # Тянем красный и синий к зелёному — фиолетовое становится нейтральным.
    lim = np.maximum(g, mn)
    out = f.copy()
    out[..., 0] = np.where(bad, np.minimum(r, lim + 0.06), r)
    out[..., 2] = np.where(bad, np.minimum(b, lim + 0.06), b)
    return (np.clip(out, 0, 1) * 255).astype(np.uint8), int(bad.sum())


def drop_floor_line(alpha):
    """Стирает тонкую широкую линию под ногами, оставляя сами ноги."""
    h, w = alpha.shape
    solid = alpha > 24
    widths = solid.sum(axis=1)
    y_from = int(h * (1.0 - FLOOR_ZONE))
    cand = [y for y in range(y_from, h) if widths[y] > w * FLOOR_WIDE]
    if not cand:
        return alpha, 0
    # непрерывные полосы строк-кандидатов
    bands, run = [], [cand[0]]
    for y in cand[1:]:
        if y == run[-1] + 1:
            run.append(y)
        else:
            bands.append(run); run = [y]
    bands.append(run)
    erased = 0
    for band in bands:
        if len(band) > FLOOR_MAX_H:
            continue  # слишком толстая — это тело, не линия
        top = band[0]
        ref = solid[max(0, top - 20):top]           # что было прямо над полосой
        if ref.size == 0:
            continue
        cols = ref.any(axis=0)                       # колонки, занятые ногами
        cols_wide = np.convolve(cols.astype(np.int32), np.ones(9, np.int32), 'same') > 0
        for y in band:
            kill = solid[y] & ~cols_wide
            erased += int(kill.sum())
            alpha[y][kill] = 0
    return alpha, erased


def main():
    src, dst = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert('RGB')
    W, H = im.size
    fw, fh = W // 2, H // 2
    a = np.asarray(im)
    bg = background_color(a)

    frames = []
    stats = []
    for i in range(4):
        cx, cy = (i % 2) * fw, (i // 2) * fh
        rgb = a[cy:cy + fh, cx:cx + fw]
        alpha = key_out(rgb, bg)
        alpha = erode_alpha(alpha)
        alpha, erased = drop_floor_line(alpha)
        rgb = despill(rgb, alpha, bg)
        alpha, removed = drop_junk_islands(alpha, rgb)
        rgb, fringed = defringe_violet(rgb, alpha)
        frames.append(np.dstack([rgb, alpha]))
        stats.append((removed, erased, fringed))

    # Общий bbox по всем кадрам — кадры обязаны совпадать по сетке.
    ys, xs = [], []
    for f in frames:
        m = f[..., 3] > 24
        if not m.any():
            continue
        yy, xx = np.where(m)
        ys += [yy.min(), yy.max()]
        xs += [xx.min(), xx.max()]
    y0, y1 = max(0, min(ys) - PAD), min(fh - 1, max(ys) + PAD)
    x0, x1 = max(0, min(xs) - PAD), min(fw - 1, max(xs) + PAD)
    cw, ch = x1 - x0 + 1, y1 - y0 + 1

    # footY считаем ДО ресайза — это доля, но брать её надо от исходной высоты.
    m0 = frames[0][y0:y1 + 1, x0:x1 + 1, 3] > 24
    foot_row = int(np.where(m0.any(axis=1))[0].max()) if m0.any() else ch - 1
    foot_y = round((foot_row + 1) / ch, 3)

    sheet = Image.new('RGBA', (cw * 2, ch * 2), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        cut = Image.fromarray(f[y0:y1 + 1, x0:x1 + 1], 'RGBA')
        sheet.paste(cut, ((i % 2) * cw, (i // 2) * ch))

    # Ужимаем до рабочего разрешения: на экране герой ~225 px, хранить 500 незачем.
    target_h = int(sys.argv[3]) if len(sys.argv) > 3 else TARGET_FRAME_H
    if target_h and ch > target_h:
        k = target_h / ch
        cw, ch = max(1, int(round(cw * k))), target_h
        sheet = sheet.resize((cw * 2, ch * 2), Image.LANCZOS)

    # Арт плоский, cel-shaded — палитра из 255 цветов сжимает его в разы
    # почти без потерь. Альфу квантуем отдельно, чтобы не рвать сглаженный край.
    colors = int(sys.argv[4]) if len(sys.argv) > 4 else QUANT_COLORS
    if colors:
        arr = np.asarray(sheet)
        alpha = arr[..., 3].copy()
        rgbq = Image.fromarray(arr[..., :3], 'RGB').quantize(
            colors=colors, method=Image.MAXCOVERAGE).convert('RGB')
        sheet = Image.fromarray(np.dstack([np.asarray(rgbq), alpha]), 'RGBA')
    sheet.save(dst, optimize=True)

    print(f'{dst}')
    print(f'  фон {tuple(int(v) for v in bg)}  кадр {cw}x{ch}  лист {cw*2}x{ch*2}')
    print(f'  мусора убрано: {sum(s[0] for s in stats)} островов, '
          f'линии пола: {sum(s[1] for s in stats)} px, '
          f'каймы вычищено: {sum(s[2] for s in stats)} px')
    print(f'  footY = {foot_y}')


if __name__ == '__main__':
    main()
