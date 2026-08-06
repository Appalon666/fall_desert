# -*- coding: utf-8 -*-
"""Готовит фон локации из картинки нейросети.

Задачи две:
  * убрать «звёздочку» генератора — белый четырёхлучевой блик, который тот
    ставит в правом нижнем углу примерно в одну и ту же точку кадра;
  * ужать под вес: фоны грузятся в BattleScene, и каждая лишняя сотня
    килобайт задерживает вход в бой.

Про звёздочку. Пробовали замазывать заплаткой и вычитать как полупрозрачный
слой — на рисованном фоне и то и другое оставляет след: то белёсый ореол, то
тёмное пятно. Поэтому правый край просто отрезается. В бою фон всё равно
масштабируется «по большей стороне» под арену 960x720, так что обрезанный
кадр растянется и потери по краю не видно, а артефактов нет вовсе.

Запуск:
  python tools/bg-prep.py art-in/bg/swamp.jpg public/bg/swamp.jpg
  python tools/bg-prep.py art-in/bg/swamp.jpg out.jpg --keep-right   # не резать
  python tools/bg-prep.py art-in/bg/swamp.jpg out.jpg --right=900    # своя граница
"""
import os
import sys
import cv2

TARGET_W = 1024       # шире не нужно: арена 960 px
QUALITY = 84
KEEP_RIGHT = 880      # до какого x оставляем кадр (знак начинается около 885)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    flags = sys.argv[3:]
    img = cv2.imread(src, cv2.IMREAD_COLOR)
    if img is None:
        print(f'{dst}: не читается {src}')
        return

    note = 'край оставлен как есть'
    if '--keep-right' not in flags:
        arg = next((f for f in flags if f.startswith('--right=')), None)
        cut = int(arg[8:]) if arg else KEEP_RIGHT
        if 0 < cut < img.shape[1]:
            was = img.shape[1]
            img = img[:, :cut]
            note = f'правый край срезан {was} → {cut} px (вместе со знаком)'

    if img.shape[1] > TARGET_W:
        k = TARGET_W / img.shape[1]
        img = cv2.resize(img, (TARGET_W, int(round(img.shape[0] * k))), interpolation=cv2.INTER_AREA)

    cv2.imwrite(dst, img, [cv2.IMWRITE_JPEG_QUALITY, QUALITY, cv2.IMWRITE_JPEG_OPTIMIZE, 1])
    print(f'{dst}: {img.shape[1]}x{img.shape[0]}, {os.path.getsize(dst) // 1024} КБ; {note}')


if __name__ == '__main__':
    main()
