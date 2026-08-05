# -*- coding: utf-8 -*-
"""Готовит спрайт-листы врагов из картинок нейросети.

Отличия от tools/sprite-cut.py (герои):
  * хромакей определяется сам — фиолетовый или зелёный;
  * лист не обязан быть сеткой 2x2: если фигуры разложены как попало
    (а нейросеть иногда рисует 6 штук вразнобой), они находятся по связным
    областям, берутся четыре самые крупные и раскладываются в ровную сетку;
  * убираются подписи «FRAME 1 — ...», разделительные линии и линия пола;
  * лист можно отзеркалить: в игре все враги идут ВЛЕВО, на героя.

Запуск:
  python tools/mob-cut.py art-in/mobs/ghoul.jpg public/sprites/enemy-ghoul.png
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

TOL_CORE, TOL_EDGE = 58.0, 120.0
ERODE = 1
PAD = 6
TARGET_FRAME_H = 320     # враги на экране мельче героя
QUANT_COLORS = 255
GLUE = 0.05              # доля кадра: мелочь ближе этого прилипает к фигуре


def bg_color(a):
    h, w = a.shape[:2]
    k = max(8, min(h, w) // 40)
    c = np.concatenate([a[:k, :k].reshape(-1, 3), a[:k, -k:].reshape(-1, 3),
                        a[-k:, :k].reshape(-1, 3), a[-k:, -k:].reshape(-1, 3)])
    return np.median(c, axis=0)


def key_out(rgb, bg):
    d = np.sqrt(((rgb.astype(np.float32) - bg) ** 2).sum(axis=2))
    a = (d - TOL_CORE) / (TOL_EDGE - TOL_CORE)
    return (np.clip(a, 0.0, 1.0) * 255).astype(np.uint8)


def despill(rgb, alpha, bg):
    out = rgb.astype(np.float32)
    a = (alpha.astype(np.float32) / 255.0)[..., None]
    partial = ((alpha > 0) & (alpha < 250))[..., None]
    fixed = np.divide(out - (1.0 - a) * bg, np.maximum(a, 1e-3))
    return np.clip(np.where(partial, fixed, out), 0, 255).astype(np.uint8)


def defringe(rgb, alpha, green_key):
    """Гасит кайму цвета фона на краях."""
    a = alpha > 24
    f = rgb.astype(np.float32) / 255.0
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    mx, mn = f.max(axis=2), f.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    if green_key:
        bad = a & (sat > 0.18) & (g > r + 0.10) & (g > b + 0.10)
        lim = np.maximum(np.maximum(r, b), mn)
        out = f.copy()
        out[..., 1] = np.where(bad, np.minimum(g, lim + 0.06), g)
    else:
        bad = a & (sat > 0.18) & (b > g + 0.10) & (r > g + 0.05) & (b > 0.25)
        lim = np.maximum(g, mn)
        out = f.copy()
        out[..., 0] = np.where(bad, np.minimum(r, lim + 0.06), r)
        out[..., 2] = np.where(bad, np.minimum(b, lim + 0.06), b)
    return (np.clip(out, 0, 1) * 255).astype(np.uint8), int(bad.sum())


def _runs(flags):
    """Непрерывные отрезки True в булевом массиве."""
    out, start = [], None
    for i, v in enumerate(flags):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append((start, i)); start = None
    if start is not None:
        out.append((start, len(flags)))
    return out


def strip_lines(alpha):
    """Убирает разделительные линии сетки и линию пола.

    Линия — это ТОНКАЯ (до 6 px) полоса, тянущаяся почти во всю ширину или
    высоту листа. Порог намеренно высокий: широкое тело (шина, червь) занимает
    много ширины, но толстое, и под это правило не попадает.
    """
    h, w = alpha.shape
    killed = 0
    solid = alpha > 24
    for s, e in _runs(solid.sum(axis=1) > w * 0.80):
        if e - s <= 6:
            killed += int(solid[s:e].sum()); alpha[s:e] = 0
    solid = alpha > 24
    for s, e in _runs(solid.sum(axis=0) > h * 0.80):
        if e - s <= 6:
            killed += int(solid[:, s:e].sum()); alpha[:, s:e] = 0
    return alpha, killed


def is_texty(rgb_sel):
    """Подписи нейросети — почти белые и без цвета."""
    m = rgb_sel.mean(axis=0)
    return m.min() > 165 and (m.max() - m.min()) < 34


def find_figures(alpha, rgb, green_key):
    """Находит фигуры: крупные куски + прилипшие к ним мелкие эффекты.

    Крупные куски НИКОГДА не сливаются между собой — иначе два соседних кадра
    склеиваются в один. Мелочь либо приклеивается к ближайшей фигуре (вспышка,
    искры), либо отбрасывается как мусор или подпись «FRAME 1 — ...».
    """
    lab, n = ndimage.label(alpha > 24)
    if n == 0:
        return []
    sizes = np.bincount(lab.ravel())
    sizes[0] = 0
    boxes = ndimage.find_objects(lab)
    h, w = alpha.shape
    parts = []
    for i in range(1, n + 1):
        if sizes[i] < 200:
            continue
        sl = boxes[i - 1]
        parts.append([sl[1].start, sl[0].start, sl[1].stop, sl[0].stop,
                      int(sizes[i]), i, sl])
    if not parts:
        return []
    biggest = max(p[4] for p in parts)
    big = [p for p in parts if p[4] >= biggest * 0.15]
    smalls = [p for p in parts if p[4] < biggest * 0.15]
    reach = int(min(h, w) * GLUE)
    keep_ids = [p[5] for p in big]
    # Подпись нейросети — это РЯД из нескольких мелких пятен (букв) на одной
    # базовой линии. Признак надёжнее цвета: сглаженные буквы бывают серыми.
    caption = set()
    lows = [s for s in smalls if (s[3] - s[1]) < h * 0.10]
    for s in lows:
        base = s[3]
        row = [q for q in lows if abs(q[3] - base) <= 8]
        if len(row) >= 4:
            caption.update(q[5] for q in row)
    for s in smalls:
        # Подпись нейросети — невысокая, почти белая и бесцветная. Ограничение
        # по высоте защищает крупную бледную фигуру (стеклянный колосс).
        sel = (lab[s[6]] == s[5])
        low = (s[3] - s[1]) < h * 0.10
        if s[5] in caption or (low and is_texty(rgb[s[6]][sel])):
            continue                      # подпись: не приклеиваем и не оставляем
        best, bd = None, None
        for b in big:
            dx = max(0, b[0] - s[2], s[0] - b[2])
            dy = max(0, b[1] - s[3], s[1] - b[3])
            d = dx + dy
            if bd is None or d < bd:
                bd, best = d, b
        if best is not None and bd <= reach:
            best[0] = min(best[0], s[0]); best[1] = min(best[1], s[1])
            best[2] = max(best[2], s[2]); best[3] = max(best[3], s[3])
            keep_ids.append(s[5])
    # ВАЖНО: всё, что не вошло в фигуры (подписи, точки, обрывки), стираем из
    # маски. Иначе оно уцелеет при нарезке по квадрантам.
    keep = np.zeros(int(lab.max()) + 1, bool)
    keep[keep_ids] = True
    alpha[~keep[lab]] = 0
    figs = sorted(big, key=lambda p: -p[4])[:4]
    # порядок чтения: сверху вниз, слева направо
    rows = sorted(figs, key=lambda p: p[1])
    tol = max(1, int(h * 0.12))
    ordered, cur = [], [rows[0]]
    for p in rows[1:]:
        if abs(p[1] - cur[0][1]) <= tol:
            cur.append(p)
        else:
            ordered += sorted(cur, key=lambda q: q[0]); cur = [p]
    ordered += sorted(cur, key=lambda q: q[0])
    return ordered


def is_clean_grid(figs, shape):
    """Ровная сетка 2x2 — тогда вертикальное движение кадров надо сохранить."""
    if len(figs) != 4:
        return False
    h, w = shape
    cy = sorted((p[1] + p[3]) / 2 for p in figs)
    cx = sorted((p[0] + p[2]) / 2 for p in figs)
    return (cy[1] - cy[0] < h * 0.15 and cy[3] - cy[2] < h * 0.15
            and cy[2] - cy[1] > h * 0.2
            and cx[1] - cx[0] < w * 0.15 and cx[3] - cx[2] < w * 0.15
            and cx[2] - cx[1] > w * 0.2)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    mirror = len(sys.argv) > 3 and sys.argv[3] == 'mirror'
    im = Image.open(src).convert('RGB')
    a = np.asarray(im)
    bg = bg_color(a)
    green_key = bg[1] > bg[0] and bg[1] > bg[2]

    alpha = key_out(a, bg)
    alpha = ndimage.minimum_filter(alpha, size=2 * ERODE + 1)
    alpha, lines = strip_lines(alpha)
    rgb = despill(a, alpha, bg)
    figs = find_figures(alpha, rgb, green_key)
    if len(figs) < 4:
        print(f'{dst}: НАЙДЕНО ТОЛЬКО {len(figs)} фигур — нужен другой лист')
        return
    rgb, fringe = defringe(rgb, alpha, green_key)
    rgba = np.dstack([rgb, alpha])

    H, W = alpha.shape
    if is_clean_grid(figs, (H, W)):
        # ровная сетка: режем квадранты и обрезаем их одинаково —
        # так сохраняется подпрыгивание/приседание между кадрами
        fh, fw = H // 2, W // 2
        cells = [rgba[(i // 2) * fh:(i // 2) * fh + fh, (i % 2) * fw:(i % 2) * fw + fw]
                 for i in range(4)]
        ys, xs = [], []
        for c in cells:
            m = c[..., 3] > 24
            yy, xx = np.where(m)
            ys += [yy.min(), yy.max()]; xs += [xx.min(), xx.max()]
        y0, y1 = max(0, min(ys) - PAD), min(fh - 1, max(ys) + PAD)
        x0, x1 = max(0, min(xs) - PAD), min(fw - 1, max(xs) + PAD)
        cuts = [c[y0:y1 + 1, x0:x1 + 1] for c in cells]
        mode = 'сетка 2x2'
    else:
        # вразнобой: выравниваем по низу фигуры (ноги на одной линии)
        cw = max(p[2] - p[0] for p in figs) + PAD * 2
        ch = max(p[3] - p[1] for p in figs) + PAD * 2
        cuts = []
        for x0, y0, x1, y1 in [(p[0], p[1], p[2], p[3]) for p in figs]:
            cell = np.zeros((ch, cw, 4), np.uint8)
            piece = rgba[y0:y1, x0:x1]
            ph, pw = piece.shape[:2]
            ox = (cw - pw) // 2
            oy = ch - PAD - ph
            cell[oy:oy + ph, ox:ox + pw] = piece
            cuts.append(cell)
        mode = f'вразнобой, {len(figs)} фигур → выравнивание по низу'

    ch, cw = cuts[0].shape[:2]
    sheet = Image.new('RGBA', (cw * 2, ch * 2), (0, 0, 0, 0))
    for i, c in enumerate(cuts):
        sheet.paste(Image.fromarray(c, 'RGBA'), ((i % 2) * cw, (i // 2) * ch))
    if mirror:
        sheet = sheet.transpose(Image.FLIP_LEFT_RIGHT)
        # после зеркала порядок кадров в ряду меняется — возвращаем
        fixed = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
        for i in range(4):
            box = ((i % 2) * cw, (i // 2) * ch, (i % 2) * cw + cw, (i // 2) * ch + ch)
            src_i = (i // 2) * 2 + (1 - i % 2)
            sbox = ((src_i % 2) * cw, (src_i // 2) * ch,
                    (src_i % 2) * cw + cw, (src_i // 2) * ch + ch)
            fixed.paste(sheet.crop(sbox), box)
        sheet = fixed

    if ch > TARGET_FRAME_H:
        k = TARGET_FRAME_H / ch
        cw, ch = max(1, int(round(cw * k))), TARGET_FRAME_H
        sheet = sheet.resize((cw * 2, ch * 2), Image.LANCZOS)

    arr = np.asarray(sheet)
    al = arr[..., 3].copy()
    q = Image.fromarray(arr[..., :3], 'RGB').quantize(
        colors=QUANT_COLORS, method=Image.MAXCOVERAGE).convert('RGB')
    Image.fromarray(np.dstack([np.asarray(q), al]), 'RGBA').save(dst, optimize=True)

    print(f'{dst}: {mode}; кадр {cw}x{ch}; хромакей '
          f'{"зелёный" if green_key else "фиолетовый"}; линий {lines} px; '
          f'каймы {fringe} px{"; отзеркалено" if mirror else ""}')


if __name__ == '__main__':
    main()
