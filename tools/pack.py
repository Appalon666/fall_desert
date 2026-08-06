# Сборка архива для заливки на Яндекс.Игры.
#
# Требования площадки, которые здесь проверяются:
#   - index.html лежит В КОРНЕ архива (не во вложенной папке);
#   - в путях нет кириллицы и пробелов;
#   - размер укладывается в лимит.
#
# Запуск:  npx vite build && python tools/pack.py

import os
import re
import zipfile

ROOT = 'dist'
OUT = 'yadryon-pustosh.zip'
SEP = chr(92)  # обратный слэш, чтобы не воевать с экранированием

if not os.path.isdir(ROOT):
    raise SystemExit('Нет папки dist — сначала выполните: npx vite build')

if os.path.exists(OUT):
    os.remove(OUT)

bad_paths = []
count = 0
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for dirpath, _, files in os.walk(ROOT):
        for name in files:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT).replace(SEP, '/')
            if re.search(r'[^\x20-\x7e]', rel) or ' ' in rel:
                bad_paths.append(rel)
            z.write(full, rel)
            count += 1

names = zipfile.ZipFile(OUT).namelist()
size_mb = os.path.getsize(OUT) / 1024 / 1024
print('файлов: %d, размер: %.1f МБ' % (count, size_mb))
print('index.html в корне:', 'index.html' in names)
print('проблемные пути:', bad_paths if bad_paths else 'нет')
