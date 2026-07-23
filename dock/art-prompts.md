# 🎨 Промты для генерации графики (по одному на ассет)

Каждый промт **самодостаточный** — бери и вставляй как есть (стиль уже внутри).
Все на английском (модели понимают лучше). Игровые спрайты — **PNG, прозрачный
фон, вид сбоку**. Имя файла указано рядом (важно для кода).

---

## 🦸 Герои — спрайтшит 6 кадров (цикл стрельбы), 1536×256, прозрачный фон

**Стрелок** — `hero-gunner.png`
```
2D game character sprite sheet, 6 frames of a shooting loop, side view facing right, lean wasteland gunfighter in a long tattered duster coat and cowboy hat, bandana over gas-mask goggles, holding a rusty rifle, hand-painted cartoon style, thick dark outlines, rust-orange and sand colors, transparent background
```

**Бугай** — `hero-brute.png`
```
2D game character sprite sheet, 6 frames of an attack loop, side view facing right, huge hulking tank in bulky red riveted armor with massive shoulder pads and giant metal fists, tiny head with welding visor, hand-painted cartoon style, thick dark outlines, red and steel colors, transparent background
```

**Механик** — `hero-mechanic.png`
```
2D game character sprite sheet, 6 frames of a shooting loop, side view facing right, wiry engineer in a blue-grey jumpsuit, welder mask with glowing green visor, antenna, a mechanical prosthetic arm and backpack, hand-painted cartoon style, thick dark outlines, blue-grey and toxic green colors, transparent background
```

**Мародёр** — `hero-scavenger.png`
```
2D game character sprite sheet, 6 frames of a shooting loop, side view facing right, scrappy scavenger with a huge backpack full of junk and pipes, gas mask, patched green jacket, holding a rusty crowbar, hand-painted cartoon style, thick dark outlines, green and rust colors, transparent background
```

---

## 👾 Монстры — спрайтшит с рядами idle / walk / death, вид сбоку смотрят влево, прозрачный фон

**Радкрыса** — `enemy-radrat.png`
```
2D monster sprite sheet with three animation rows (idle, walk, death), side view facing left, oversized irradiated green-brown rat with a glowing red eye, long naked tail and buck teeth, hand-painted cartoon style, thick outlines, toxic green palette, transparent background
```

**Ползун** — `enemy-crawler.png`
```
2D monster sprite sheet with three animation rows (idle, walk, death), side view facing left, brown segmented centipede-worm with many little legs, mandibles and red eyes, hand-painted cartoon style, thick outlines, rust brown palette, transparent background
```

**Радоса** — `enemy-wasp.png`
```
2D monster sprite sheet with three animation rows (idle, fly, death), side view facing left, giant yellow-black radioactive wasp with translucent wings and a stinger, hand-painted cartoon style, thick outlines, toxic yellow-green palette, transparent background
```

**Гуль** — `enemy-ghoul.png`
```
2D monster sprite sheet with three animation rows (idle, walk, death), side view facing left, gaunt green humanoid ghoul with exposed ribs, glowing acid-green eyes and tattered flesh, hand-painted cartoon style, thick outlines, sickly green palette, transparent background
```

**Рейдер** — `enemy-raider.png`
```
2D monster sprite sheet with three animation rows (idle, walk, death), side view facing left, human raider in brown scrap armor with a spiked mohawk helmet, red goggles and a cruel grin, hand-painted cartoon style, thick outlines, rust brown palette, transparent background
```

**Пёс-мутант** — `enemy-dog.png`
```
2D monster sprite sheet with three animation rows (idle, run, death), side view facing left, grey mutant dog with exposed muscle, a spiked back and red eyes, hand-painted cartoon style, thick outlines, grey and toxic green palette, transparent background
```

**Тень** — `enemy-lurker.png`
```
2D monster sprite sheet with three animation rows (idle, glide, death), side view facing left, dark purple shadowy hooded creature with glowing violet eyes and a wispy cloak, hand-painted cartoon style, thick outlines, dark purple palette, transparent background
```

**Плевун** — `enemy-spitter.png`
```
2D monster sprite sheet with three animation rows (idle, walk, death), side view facing left, bloated green toad-like creature spitting acid, glowing green sacs and big yellow eyes, hand-painted cartoon style, thick outlines, toxic green palette, transparent background
```

**Пузырь** — `enemy-bloat.png`
```
2D monster sprite sheet with three animation rows (idle, waddle, death burst), side view facing left, huge round bloated green gas-bag creature with tiny limbs ready to burst, hand-painted cartoon style, thick outlines, toxic green palette, transparent background
```

**Громила** — `enemy-brute.png`
```
2D monster sprite sheet with three animation rows (idle, walk, death), side view facing left, massive red muscular mutant brute with huge fists, armor plates and a tiny angry head, hand-painted cartoon style, thick outlines, red and rust palette, transparent background
```

> Боссы генерировать отдельно не обязательно — в игре босс = увеличенный монстр с
> красной аурой. Если хочешь: тот же промт монстра + `larger, battle-scarred, cracked armor, glowing red aura, boss version`.

---

## 🔫 Оружие — иконка сбоку, 128×64, прозрачный фон

**Обрез** — `weapon-obrez.png`
```
2D game weapon icon, side view, sawn-off double-barrel shotgun with a wooden grip, rusty scavenged post-apocalyptic look, hand-painted cartoon style, thick outlines, transparent background
```

**Гвоздомёт** — `weapon-gvozdomet.png`
```
2D game weapon icon, side view, improvised nailgun made of pipes and a canister, rusty scavenged look, hand-painted cartoon style, thick outlines, transparent background
```

**Пистоль** — `weapon-pistol.png`
```
2D game weapon icon, side view, battered heavy revolver pistol, rusty scavenged look, hand-painted cartoon style, thick outlines, transparent background
```

**Дробовик** — `weapon-drobovik.png`
```
2D game weapon icon, side view, long pump-action shotgun with a taped grip, rusty scavenged look, hand-painted cartoon style, thick outlines, transparent background
```

**Самопал** — `weapon-samopal.png`
```
2D game weapon icon, side view, crude homemade zip-gun made of scrap metal, hand-painted cartoon style, thick outlines, transparent background
```

---

## 🖼️ Интерфейс и фон

**Иконка игры** — `icon.png` (512×512, БЕЗ прозрачности)
```
game app icon, 512x512, a grinning gas-mask survivor head with glowing toxic-green goggle lenses, a golden bottle cap and a rusty gun crossed behind, bold and readable, hand-painted cartoon style, thick outlines, rust and toxic green palette, filled background, no text
```

**Обложка** — `cover.png` (800×470, БЕЗ прозрачности)
```
horizontal game cover 800x470, a survivor hero firing at a horde of cartoon mutants across a rusty wasteland arena, flying bottle caps and toxic green explosions, a boss looming, energetic, hand-painted cartoon style, rust and toxic green palette, no text, filled background
```

**Главное меню (фон)** — `menu-bg.png` (1280×720, БЕЗ прозрачности)
```
post-apocalyptic wasteland key art 1280x720, a lone survivor silhouette on a cracked desert ridge, ruined city skyline in the smoggy distance, toxic green haze, hazy sun, scattered wreckage, cinematic, hand-painted cartoon style, no text, no UI
```

**Кнопка** — `button.png` (192×64, прозрачный фон)
```
horizontal UI button plate, riveted rusty metal panel with a thin toxic-green border and worn edges, empty center for text, flat game UI, hand-painted style, transparent background, no text
```

---

## 🏞️ Параллакс-фон по зонам — 1920×720, слева-направо бесшовный, без персонажей и текста

**Зона 1 — Ржавый Пустырь** — `parallax-rust.png`
```
seamless side-scroller game background 1920x720, rusty desert wasteland with ochre dunes, a broken highway and ruined structures in layers, warm hazy sun, hand-painted cartoon style, rust orange palette, tileable left-right, no characters, no text
```

**Зона 2 — Руины Города** — `parallax-city.png`
```
seamless side-scroller game background 1920x720, ruined grey city with collapsed skyscrapers in layers, dust and smog, cold light, hand-painted cartoon style, grey palette with rust accents, tileable left-right, no characters, no text
```

**Зона 3 — Токсичный Бункер** — `parallax-bunker.png`
```
seamless side-scroller game background 1920x720, toxic underground bunker with pipes, vats and acid puddles in layers, green glow, hand-painted cartoon style, toxic green palette, tileable left-right, no characters, no text
```

**Зона 4 — Логово Босса** — `parallax-lair.png`
```
seamless side-scroller game background 1920x720, dark blood-red boss lair with jagged rocks and bone piles in layers, ominous red glow, hand-painted cartoon style, dark red palette, tileable left-right, no characters, no text
```

---

## 🧪 Иконки апгрейдов — квадрат 96×96, прозрачный фон

Одинаковый стиль: чёткая читаемая иконка предмета крупным планом по центру, без фона.

**Калибр** (урон клика) — `up-damage.png`
```
2D game upgrade icon, single object centered, a glowing golden bullet cartridge with a spark, post-apocalyptic, hand-painted cartoon style, thick dark outlines, rust and gold palette, transparent background, no text
```

**Броня** (макс. HP) — `up-hp.png`
```
2D game upgrade icon, single object centered, a riveted steel armor plate shield, post-apocalyptic, hand-painted cartoon style, thick dark outlines, steel-blue palette, transparent background, no text
```

**Выучка отряда** (урон союзников) — `up-allyPower.png`
```
2D game upgrade icon, single object centered, a rusty megaphone with a small banner, post-apocalyptic, hand-painted cartoon style, thick dark outlines, sand and rust palette, transparent background, no text
```

**Картечь** (мультивыстрел) — `up-multishot.png`
```
2D game upgrade icon, single object centered, a shotgun shell bursting into spreading pellets, post-apocalyptic, hand-painted cartoon style, thick dark outlines, red and orange palette, transparent background, no text
```

**Меткий глаз** (крит) — `up-crit.png`
```
2D game upgrade icon, single object centered, a red target crosshair with a glinting eye, post-apocalyptic, hand-painted cartoon style, thick dark outlines, red and toxic green palette, transparent background, no text
```

---

## 🐾 Иконки союзников — квадрат 96×96, прозрачный фон

**Верный пёс** — `ally-dog.png`
```
2D game unit icon, single character centered, a scrappy loyal wasteland dog with a spiked collar, post-apocalyptic, hand-painted cartoon style, thick dark outlines, brown and rust palette, transparent background, no text
```

**Стрелок** — `ally-gunner.png`
```
2D game unit icon, single character bust centered, a grinning gunslinger in a cowboy hat and bandana holding a rifle, post-apocalyptic, hand-painted cartoon style, thick dark outlines, rust-orange palette, transparent background, no text
```

**Турель** — `ally-turret.png`
```
2D game unit icon, single object centered, an automated scrap-metal machine-gun turret on a tripod, post-apocalyptic, hand-painted cartoon style, thick dark outlines, steel-grey palette, transparent background, no text
```

**Снайпер** — `ally-sniper.png`
```
2D game unit icon, single character bust centered, a hooded sniper with a scoped long rifle and a medal, post-apocalyptic, hand-painted cartoon style, thick dark outlines, green and rust palette, transparent background, no text
```

**Боевой мех** — `ally-mech.png`
```
2D game unit icon, single robot centered, a bulky battle mech with glowing blue eyes and gun arms, post-apocalyptic, hand-painted cartoon style, thick dark outlines, steel-blue palette, transparent background, no text
```

---

## 🎒 Иконки слотов инвентаря — квадрат 96×96, прозрачный фон

Пустой слот = эта иконка приглушённо; занятый = арт предмета.

**Оружие** — `slot-weapon.png`
```
2D game equipment slot icon, single object centered, a crossed rusty pistol and knife, post-apocalyptic, hand-painted cartoon style, thick dark outlines, rust palette, transparent background, no text
```

**Шлем** — `slot-helmet.png`
```
2D game equipment slot icon, single object centered, a battered riveted combat helmet with a cracked visor, post-apocalyptic, hand-painted cartoon style, thick dark outlines, steel and rust palette, transparent background, no text
```

**Броня** — `slot-armor.png`
```
2D game equipment slot icon, single object centered, a patched scrap-metal chest armor vest, post-apocalyptic, hand-painted cartoon style, thick dark outlines, rust and steel palette, transparent background, no text
```

**Обувь** — `slot-boots.png`
```
2D game equipment slot icon, single object centered, a pair of worn armored combat boots, post-apocalyptic, hand-painted cartoon style, thick dark outlines, brown and steel palette, transparent background, no text
```

**Аксессуар** — `slot-accessory.png`
```
2D game equipment slot icon, single object centered, a lucky charm amulet made of bottle caps and a mutant tooth, post-apocalyptic, hand-painted cartoon style, thick dark outlines, gold and rust palette, transparent background, no text
```

---

## 💰 Ресурсы (валюты) — квадрат 96×96, прозрачный фон

Крупным планом по центру, читается на маленьком размере, единый стиль.

**Крышки** (основная валюта за убийства) — `res-caps.png`
```
2D game currency icon, single object centered, a shiny golden bottle cap with a bottle-cap crown edge and a tiny star stamp, post-apocalyptic, hand-painted cartoon style, thick dark outlines, gold and rust palette, transparent background, no text
```

**Металлолом** (для крафта на верстаке) — `res-scrap.png`
```
2D game currency icon, single object centered, a small pile of rusty scrap metal: bolts, gears and a bent nut, post-apocalyptic, hand-painted cartoon style, thick dark outlines, steel-grey and rust palette, transparent background, no text
```

**Ядра** (валюта перерождения / престижа) — `res-core.png`
```
2D game currency icon, single object centered, a glowing radioactive fuel core, a green energy sphere inside a cracked metal casing with a yellow radiation trefoil, ominous glow, post-apocalyptic, hand-painted cartoon style, thick dark outlines, toxic green palette, transparent background, no text
```

---

## Порядок (рекомендация)
Иконка → обложка → 4 героя → 10 монстров → 5 оружий → 4 фона. Как сгенеришь PNG —
присылай, впаяю в код (спрайтшиты, анимации, разные выстрелы, параллакс).
