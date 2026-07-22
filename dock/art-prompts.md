# 🎨 Промты для генерации графики (нейросеть)

Готовые промты под весь арт «Ядрён-Пустоши». Стиль общий для всех ассетов, чтобы
не было визуального разнобоя. Подходит для Midjourney / SDXL / DALL·E / Kandinsky
и т.п. Английские промты — модели лучше их понимают; при необходимости переводи.

> ⚠️ Все игровые спрайты — **PNG с прозрачным фоном** (alpha), если явно не указано
> иное (фон/меню/обложка — непрозрачные). Персонажи и монстры — вид **сбоку**
> (side-view), смотрят **вправо**. Единый источник света сверху-слева.

---

## 0. Общий стайлгайд (добавляй к каждому промту)

**STYLE PREAMBLE (вставляй в начало):**
```
2D game art, hand-painted cartoon style with thick dark outlines, semi-realistic
proportions, post-apocalyptic wasteland theme with a touch of dark humor, gritty
but readable, soft top-left lighting with rim light, clean silhouette, high detail.
```

**PALETTE (вставляй в промт):**
```
color palette: rust orange (#b5652f), toxic green (#8fbf3f), sand (#c9a76a),
steel grey (#6b6b73), dark ink (#120d09), warm gold caps (#d8b64a)
```

**NEGATIVE (для SDXL/локальных моделей):**
```
photo, realistic photo, blurry, low-res, jpeg artifacts, watermark, text, signature,
extra limbs, cut off, cropped, drop shadow on ground baked in, colored background,
white background, multiple characters, frame border
```

**Технично:** прозрачный фон (transparent background / cutout), центрирование,
запас пустого поля по краям ~10%. Если модель не умеет прозрачность — генерируй на
ровном сплошном фоне (magenta #ff00ff) и вырезай (remove.bg / Photoshop).

**Именование файлов** — строго как ждёт код (иначе не подхватится):
- Герои: `hero-gunner.png`, `hero-brute.png`, `hero-mechanic.png`, `hero-scavenger.png`
- Монстры (спрайтшиты): `enemy-<id>-idle.png`, `enemy-<id>-walk.png`, `enemy-<id>-death.png`
  где `<id>` ∈ radrat, crawler, wasp, ghoul, raider, dog, lurker, spitter, bloat, brute
- Оружие: `weapon-<name>.png`, снаряды: `bullet-<name>.png`
- UI: `icon.png` (512×512), `cover.png` (800×470), `menu-bg.png`, `button.png`
- Параллакс: `parallax-<zone>-<layer>.png`

---

## 1. Герои (4 класса) — спрайт по 6 кадров

Формат: **горизонтальный спрайтшит из 6 кадров**, каждый кадр **256×256 px**
(итоговый файл 1536×256), прозрачный фон. Анимация — **цикл стрельбы/дыхания**
(idle→прицел→выстрел с отдачей→возврат), для плавного лупа кадр 6 близок к кадру 1.

**PROMPT (общая рамка, подставь описание класса):**
```
{STYLE PREAMBLE} {PALETTE}
6-frame horizontal sprite sheet, side view facing right, a wasteland survivor:
{CLASS DESCRIPTION}. Frames show a smooth shooting/breathing loop: idle stance,
raise weapon, aim, fire with slight recoil, settle, back to idle. Consistent
character size and position across all 6 frames, transparent background, full body,
game character sprite.
```

**CLASS DESCRIPTION по классам:**
- **Стрелок** (`hero-gunner.png`): `lean gunfighter in a long tattered duster coat, cowboy hat, bandana over gas-mask goggles, holding a rusty rifle, orange-tan colors`
- **Бугай** (`hero-brute.png`): `huge hulking tank in bulky red riveted armor, massive shoulder pauldrons, tiny head with a welding visor, giant metal fists, red-and-steel colors`
- **Механик** (`hero-mechanic.png`): `wiry engineer in a blue-grey jumpsuit, welder mask with a glowing green visor, antenna, a mechanical prosthetic arm, tool belt and backpack`
- **Мародёр** (`hero-scavenger.png`): `scrappy scavenger with a huge backpack full of junk and pipes, gas mask, patched green jacket, holding a rusty crowbar, lucky charms`

---

## 2. Монстры — спрайтшиты idle / walk / death (×10)

Для КАЖДОГО монстра — **3 файла** (idle, walk, death). Формат: горизонтальный
спрайтшит, кадр **192×192 px**, прозрачный фон, вид сбоку, смотрит **влево**
(враги идут на героя справа налево).
- **idle** — 4 кадра (лёгкое покачивание/дыхание), лупится.
- **walk** — 6 кадров (цикл ходьбы/ползания), лупится.
- **death** — 5 кадров (гибель: удар→развал→оседание/растворение), НЕ лупится.

**PROMPT (рамка):**
```
{STYLE PREAMBLE} {PALETTE}
horizontal sprite sheet, {N} frames, side view facing left, a mutant creature:
{MONSTER DESCRIPTION}. Animation: {ANIM}. Consistent size and baseline across
frames, transparent background, game enemy sprite.
```
где `{ANIM}` = `subtle idle breathing loop` (idle, N=4) / `walk/crawl cycle` (walk, N=6) /
`death sequence: hit, break apart, collapse` (death, N=5).

**MONSTER DESCRIPTION (id → описание):**
- `radrat` — **Радкрыса**: `oversized green-brown irradiated rat with glowing red eye, long naked tail, buck teeth`
- `crawler` — **Ползун**: `brown segmented centipede-worm with many little legs and red eyes, mandibles`
- `wasp` — **Радоса**: `giant yellow-black radioactive wasp with translucent wings and a stinger`
- `ghoul` — **Гуль**: `gaunt green humanoid ghoul, exposed ribs, glowing acid-green eyes, tattered flesh`
- `raider` — **Рейдер**: `human raider in brown scrap armor, spiked mohawk helmet, red goggles, cruel grin`
- `dog` — **Пёс-мутант**: `grey mutant dog with two heads hint, exposed muscle, spiked back, red eyes`
- `lurker` — **Тень**: `dark purple shadowy hooded creature, glowing violet eyes, wispy cloak`
- `spitter` — **Плевун**: `bloated green toad-like creature spitting acid, glowing green sacs, big yellow eyes`
- `bloat` — **Пузырь**: `huge round bloated green gas-bag creature, tiny limbs, ready to burst`
- `brute` — **Громила**: `massive red muscular mutant brute, huge fists, tiny angry head, armor plates`

### Боссы
Отдельные файлы не обязательны — в игре босс = увеличенный монстр с красной аурой.
Но при желании: `boss-<id>-idle/walk/death.png`, кадр **384×384**, тот же промт +
`larger, meaner, battle-scarred, cracked armor, glowing red aura, boss version`.

---

## 3. Оружие (для разных выстрелов и инвентаря)

Спрайты оружия (вид сбоку, смотрит вправо), **128×64 px**, прозрачный фон. Плюс
снаряд каждого оружия — **32×16 px** (для разных выстрелов по экипировке).

**PROMPT:**
```
{STYLE PREAMBLE} {PALETTE}
side view weapon icon, {WEAPON}, rusty scavenged post-apocalyptic look, thick
outline, transparent background, game item sprite, no background.
```
**WEAPON (name → описание):**
- `weapon-obrez` — **Обрез**: `sawn-off double-barrel shotgun, wooden grip`
- `weapon-gvozdomet` — **Гвоздомёт**: `improvised nailgun made of pipes and a canister`
- `weapon-pistol` — **Пистоль**: `battered heavy revolver-pistol`
- `weapon-drobovik` — **Дробовик**: `long pump-action shotgun, taped grip`
- `weapon-samopal` — **Самопал**: `crude homemade zip-gun of scrap metal`

**Снаряды (bullet-<name>.png, 32×16):** `glowing tracer projectile`, цвет под оружие:
обрез/дробовик — оранжевая картечь, гвоздомёт — стальной гвоздь, пистоль — жёлтая
пуля, самопал — красный самодельный заряд. Промт: `{PALETTE} small glowing bullet
tracer projectile, {DESC}, side view, transparent background, additive glow`.

---

## 4. Главное меню / ключевой арт

Файл `menu-bg.png`, **1280×720**, НЕ прозрачный (фон).
```
{STYLE PREAMBLE} {PALETTE}
post-apocalyptic wasteland key art, wide landscape: a lone survivor silhouette on a
cracked desert ridge, rusty ruined city skyline in the smoggy distance, toxic green
haze, dramatic hazy sun, scattered wreckage and bottle caps in the foreground,
cinematic, atmospheric, no text, no logo, no UI, 16:9.
```

---

## 5. Иконка — `icon.png` 512×512 PNG

```
{STYLE PREAMBLE} {PALETTE}
game app icon, 512x512, bold and readable at small size, centered composition: a
grinning gas-mask survivor head with glowing toxic-green goggle lenses, a golden
bottle cap and a rusty gun crossed behind, radioactive trefoil hint, thick outline,
vivid, high contrast, no text, filled background (not transparent), square.
```
> Иконку проверяй на читаемость в мелком размере (даунскейл до 64×64).

---

## 6. Обложка — `cover.png` 800×470 PNG

```
{STYLE PREAMBLE} {PALETTE}
horizontal game cover banner 800x470, dynamic scene: the survivor hero firing at a
horde of cartoon mutants across a rusty wasteland arena, bottle caps flying, toxic
green explosions, boss silhouette looming, energetic and punchy, leave clear space
on one side for a title, no text, no UI, filled background.
```
> Название допишешь в редакторе (в самой обложке текста быть не должно по промту).

---

## 7. Кнопки — `button.png`

9-slice кнопка (растягиваемая), **192×64 px**, прозрачный фон, + при желании
`button-hover.png`.
```
{STYLE PREAMBLE} {PALETTE}
horizontal UI button plate for a wasteland game, riveted rusty metal panel with a
thin toxic-green border and worn edges, empty center for text, flat game UI asset,
transparent background, no text.
```

---

## 8. Параллакс-фон (по слоям, для каждой зоны)

Для эффекта параллакса — отдельные слои, **прозрачные PNG** (кроме неба). Ширина
**1920 px** (шире экрана, чтобы двигать), высота под слой. Зоны и их id:
`rust` (Ржавый Пустырь), `city` (Руины Города), `bunker` (Токсичный Бункер),
`lair` (Логово Босса).

Слои (для каждой зоны 4 файла):
1. `parallax-<zone>-sky.png` (1920×720, НЕ прозрачный) — небо-градиент + солнце/смог.
2. `parallax-<zone>-far.png` (1920×400, прозрачный) — дальние силуэты руин/гор.
3. `parallax-<zone>-mid.png` (1920×360, прозрачный) — средние руины/объекты.
4. `parallax-<zone>-ground.png` (1920×260, прозрачный) — передняя земля с обломками.

**PROMPT (рамка):**
```
{STYLE PREAMBLE} {PALETTE}
seamless horizontal parallax background layer, {LAYER}, {ZONE MOOD}, side-scroller
game background, tileable left-right, no characters, no UI, no text.
```
**ZONE MOOD:**
- `rust` — `rusty desert wasteland, ochre dunes, broken highway, warm hazy sun`
- `city` — `ruined grey city, collapsed skyscrapers, dust and smog, cold light`
- `bunker` — `toxic underground bunker, green glow, pipes and vats, acid puddles`
- `lair` — `dark blood-red boss lair, jagged rocks, ominous red glow, bone piles`

**LAYER:**
- sky: `sky gradient with a smoggy sun, distant haze`
- far: `far silhouette of ruins and mountains, low opacity, transparent background`
- mid: `mid-ground ruined structures and wreckage, transparent background`
- ground: `foreground ground strip with rubble, debris and cracks, transparent background`

---

## Порядок работ (рекомендация)
1. Иконка + обложка (нужны для карточки в первую очередь).
2. Персонажи (4) и монстры (10×3) — основа геймплея.
3. Оружие + снаряды (для разных выстрелов по экипировке).
4. Параллакс-фон по зонам.
5. Кнопки/меню — по желанию (сейчас процедурные, работают).

После генерации присылай PNG — я впаяю их в код (загрузка спрайтшитов, анимации
Phaser, разные снаряды по оружию, параллакс-слои).
