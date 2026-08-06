# Музыка: что используется и откуда

## Что стоит в игре сейчас

Оба трека — **CC0 1.0 (Public Domain)**: коммерческое использование разрешено,
указание авторства НЕ требуется. Источник и лицензия продублированы в тегах
самих файлов (`TITLE`, `ARTIST`, `LICENSE`, `SOURCE`) — модерации видно прямо
из файла, без переписки.

| Файл | Трек | Автор | Лицензия | Страница |
|---|---|---|---|---|
| `public/music/menu.ogg` | Post Apocalyptic Wastelands | Juhani Junkala (SubspaceAudio) | CC0 1.0 | https://opengameart.org/content/horror-atmosphere |
| `public/music/battle.ogg` | Action Track | LushoGames | CC0 1.0 | https://opengameart.org/content/action-track |

Оригиналы весили 14.2 МБ и 2.2 МБ. Перекодированы в Vorbis (menu — первые 2:30
с плавным затуханием, 88 кбит/с; battle — целиком, 96 кбит/с), итого 3.1 МБ
против 3.6 МБ у прежних треков.

Пересобрать из оригиналов:
```
ffmpeg -i menu-src.ogg -t 150 -af "afade=t=out:st=145:d=5" -c:a libvorbis -b:a 88k public/music/menu.ogg
ffmpeg -i battle-src.mp3 -c:a libvorbis -b:a 96k public/music/battle.ogg
```

## Что было до этого (и почему заменили)

Прежние `menu.ogg` и `battle.ogg` были скачаны неизвестно откуда: в тегах не
было ни автора, ни названия, ни лицензии — только следы программ, в которых их
делали (`Adobe Soundbooth CS5`, дата 2013; `Linux MultiMedia Studio`). Подтвердить
права было нечем, а модерация Яндекса запросила именно это (п.3.5). Заменены на
треки с проверяемой CC0.

## Если понадобится другая музыка

Держаться **CC0 / public domain** либо платной лицензии с правом коммерческого
использования. НЕ подходят:
- **CC BY** — требует указания автора в игре или описании;
- **CC BY-NC** — запрещает коммерческое использование, а в игре есть реклама.

Проверенные источники CC0:
- **OpenGameArt.org** — фильтр по лицензии CC0: https://opengameart.org/
- **Post-Apocalyptic Soundscapes** (38 треков, CC0):
  https://swarajthegreat.itch.io/post-apocalyptic-soundscapes
- **Pixabay Music** — своя лицензия, коммерческое использование без атрибуции:
  https://pixabay.com/music/

Движок работает и без музыки: если файлов нет, `src/audio/music.js` молча
бездействует, игра не ломается.
