// Локализация. RU — язык по умолчанию; EN подставляется автоматически для
// не-русских игроков (Яндекс отдаёт язык через SDK, см. Platform.lang()).
//
// Подход: русские строки остаются «ключами». t('русский текст') возвращает EN-
// перевод из словаря, если язык english, иначе — сам русский текст. Для строк с
// подстановкой — плейсхолдеры {x}: t('Зона {n}', { n: 3 }).

let LANG = 'ru'

export function setLang(code) {
  LANG = String(code || '').toLowerCase().startsWith('en') ? 'en' : 'ru'
  return LANG
}
export function getLang() { return LANG }
export function isEn() { return LANG === 'en' }

// EN-переводы, ключ = русская строка-исходник.
const EN = {
  // — Hub / меню —
  // Название игры пишем ОДИНАКОВО в игре и в черновике (п.5.1.3):
  // RU — «Ядрён-Пустошь», EN — «Atomic Wasteland». Слоганов/подзаголовков
  // рядом с названием не показываем, чтобы название читалось однозначно.
  'Ядрён-Пустошь': 'Atomic Wasteland',
  'Готовим вылазку…': 'Preparing the raid…',
  'Рекорд: {n} убийств': 'Best: {n} kills',
  'Зона {z} · ур. {l}': 'Zone {z} · lvl {l}',
  '🏆 Рекорды': '🏆 Scores',
  '❔ Как играть': '❔ How to play',
  '🔇 Звук выкл': '🔇 Sound off',
  '🔊 Звук вкл': '🔊 Sound on',
  '⚙ Настройки': '⚙ Settings',
  'НАСТРОЙКИ': 'SETTINGS',
  '🔇 Звук выключен': '🔇 Sound is OFF',
  '🔊 Звук включён': '🔊 Sound is ON',
  'Звук': 'Sound',
  'Музыка': 'Music',
  'Закрыть': 'Close',
  'Уровень {l}': 'Level {l}',
  '+{n} очков!': '+{n} points!',
  'ПОХОД': 'RAID',
  'Апгрейды и союзники': 'Upgrades & allies',
  'Инвентарь': 'Inventory',
  'Верстак (крафт)': 'Workbench (craft)',
  'Герой (+{n})': 'Hero (+{n})',
  'Герой': 'Hero',
  'Перерождение (+{n})': 'Prestige (+{n})',
  'Перерождение': 'Prestige',
  '{n} ядер': '{n} cores',
  // — Как играть —
  '❔  КАК ИГРАТЬ': '❔  HOW TO PLAY',
  'КАК ИГРАТЬ': 'HOW TO PLAY',
  'Понятно!': 'Got it!',
  // Первая страница «Как играть»: три карточки, по строчке на каждую.
  'Кликай по врагу': 'Click the enemy',
  'Пуля летит в точку клика': 'The bullet flies where you click',
  'Крышки — в силу': 'Caps buy power',
  'Апгрейды, союзники, снаряга': 'Upgrades, allies, gear',
  'Босс — ворота зоны': 'Boss guards the gate',
  'Пробей его, чтобы идти дальше': 'Break through to move on',
  '☢  SPACE — залп по всей волне': '☢  SPACE — blast the whole wave',
  'Что дальше →': 'What comes next →',
  '← Назад': '← Back',
  // Вторая страница: то, что нужно не в первую минуту.
  'С врагов падает снаряга — надевай в «Инвентаре»': 'Enemies drop gear — equip it in the Inventory',
  'Лишнее разбирай в металлолом и куй новое на «Верстаке»':
    'Scrap spares into metal and forge new gear at the Workbench',
  'За уровни дают очки: Сила, Живучесть, Удача': 'Levels grant points: Strength, Vitality, Luck',
  'После 4-й локации откроется Перерождение — вечные бонусы':
    'Prestige unlocks after the 4th location — permanent bonuses',
  // — Подсказки в бою —
  '🖱  КЛИКАЙ ПО ВРАГУ': '🖱  CLICK THE ENEMY',
  '☢  Ульта заряжена — SPACE': '☢  Ult ready — press SPACE',
  // — Оффлайн —
  'С возвращением, выживший!': 'Welcome back, survivor!',
  'Отряд работал {t}\nи собрал:': 'Your squad worked for {t}\nand gathered:',
  'Забрать': 'Claim',
  // — Бой —
  'Ульта не заряжена': 'Ult not charged',
  'ЗОНА {z} · {name}': 'ZONE {z} · {name}',
  'БОСС-ВОРОТА!': 'BOSS GATE!',
  'Зачистка: {a}/{b}': 'Clear: {a}/{b}',
  'Зачистка: {a}/{b}   ·   Всего убито: {t}': 'Clear: {a}/{b}   ·   Total kills: {t}',
  '{prog}   ·   Всего убито: {t}': '{prog}   ·   Total kills: {t}',
  // 'Урон клика: {n}' и 'Крит: {n}% ×{m}' объявлены ниже, в блоке экрана героя —
  // дубли молча перетирали друг друга, поэтому здесь их нет.
  'Союзники: {n}/сек': 'Allies: {n}/sec',
  'ЛОКАЦИЯ ВЗЯТА!': 'ZONE CLEARED!',
  'Впереди зона {z} · {name}': 'Next up: zone {z} · {name}',
  'Собрано: {n}': 'Collected: {n}',
  'Идти дальше ⟶': 'Push on ⟶',
  '☠  БОСС': '☠  BOSS',
  '☠  БОСС-ВОРОТА': '☠  BOSS GATE',
  '⟵ В лагерь': '⟵ To camp',
  'Ты пал на пустоши': 'You fell in the wasteland',
  // п.4.5.1 — на кнопках rewarded video текст прямо называет рекламу.
  '📺 Реклама: возродиться': '📺 Watch ad: revive',
  '📺 Реклама: ×2': '📺 Watch ad: ×2',
  'Награда не начислена: ролик не досмотрен': 'No reward: the ad was not watched to the end',
  'НОВОЕ': 'NEW',
  'Реликтовая ковка': 'Relic forge',
  'реликвия: {n}%': 'relic: {n}%',
  'Разбирай лишнее в инвентаре → металлолом. Здесь куй снаряжение.\nДороже сборка — выше шанс редкого. Реликтовая ковка даёт реликвию или легенду.':
    'Scrap what you do not need in the inventory → salvage. Forge gear here.\nPricier the build, better the odds. Relic forge yields a relic or a legendary.',
  '↑ пусто': '↑ empty slot',
  '↑ лучше': '↑ better',
  '↓ хуже': '↓ worse',
  '= как есть': '= same',
  'Смириться и продолжить': 'Accept it and go on',
  '☢  УЛЬТА (Space)': '☢  ULT (Space)',
  'HP героя': 'Hero HP',
  'Заряд ульты': 'Ult charge',
  'Комбо x{m} ({n})': 'Combo x{m} ({n})',
  // — Выбор класса —
  'ВЫБЕРИ ГЕРОЯ': 'CHOOSE A HERO',
  'Выбор навсегда для этого забега — потом можно сменить через перерождение':
    'Choice is permanent for this run — change later via prestige',
  'Играть за {name}': 'Play as {name}',
  // — общее —
  'Отмена': 'Cancel',
  'В лагерь': 'To camp',
  // единицы длительности (fmtDuration) — уходят в окно офлайн-дохода
  'ч': 'h', 'мин': 'min', 'сек': 'sec',

  // — классы —
  'Стрелок': 'Gunner',
  'Бугай': 'Brute',
  'Механик': 'Mechanic',
  'Мародёр': 'Scavenger',
  'Мастер точного выстрела. Пули ПРОБИВАЮТ строй врагов насквозь.':
    'A precise shooter. Bullets PIERCE straight through the enemy line.',
  'Ходячий шкаф. Лечится от нанесённого урона и держит удар босса.':
    'A walking wall. Heals from damage dealt and tanks boss hits.',
  'Командир железа. Отряд бьёт сильнее, а офлайн-доход заметно жирнее.':
    'Iron commander. Allies hit harder and offline income is much fatter.',
  'Нюх на добро. Больше крышек, лучше лут — экономика на первом месте.':
    'A nose for loot. More caps, better drops — economy first.',
  '🎯 пуля бьёт до 2 врагов': '🎯 bullet hits up to 2 enemies',
  '+30% урон клика, +6% крит, +35% HP': '+30% click damage, +6% crit, +35% HP',
  '🩸 +4.5% урона возвращается в HP': '🩸 +4.5% of damage returned as HP',
  '+50% макс. HP, старт +3 живучести': '+50% max HP, start +3 vitality',
  '⚙️ +35% урон союзников': '⚙️ +35% ally damage',
  '📦 +60% офлайн-дохода, старт с псом': '📦 +60% offline income, start with a dog',
  '🍾 +18% крышек': '🍾 +18% caps',
  '🎁 заметно лучший лут, +2% крит': '🎁 much better loot, +2% crit',
  // — враги —
  'Радкрыса': 'Radrat', 'Ползун': 'Crawler', 'Радоса': 'Radwasp', 'Гуль': 'Ghoul',
  'Рейдер': 'Raider', 'Пёс-мутант': 'Mutt', 'Тень': 'Lurker', 'Плевун': 'Spitter',
  'Пузырь': 'Bloat', 'Громила': 'Brute',
  'Светяк': 'Glowrot', 'Пекло-пёс': 'Hellhound',
  'Стервятник': 'Vulture', 'Клещ': 'Tick', 'Катала': 'Wheeler', 'Утопленник': 'Drowned',
  'Пиявка': 'Leech', 'Слизняк': 'Slug', 'Стеклокраб': 'Glass Crab', 'Мясник': 'Butcher',
  // — боссы зон —
  'Крысиный Король': 'Rat King', 'Червь-Бурильщик': 'Borer Worm', 'Кран-Шагоход': 'Crane Walker',
  'Кувалда': 'Sledge', 'Жаба-Жрун': 'Gulper Toad', 'Печь-Голем': 'Furnace Golem',
  'Мать Выводка': 'Brood Mother', 'Тиран': 'Tyrant', 'Колосс': 'Colossus',
  // — союзники —
  'Верный пёс': 'Loyal Dog', 'Турель': 'Turret', 'Снайпер': 'Sniper', 'Боевой мех': 'Battle Mech',
  // — апгрейды —
  'Калибр': 'Caliber', 'Броня': 'Armor', 'Выучка отряда': 'Squad Training',
  'Картечь': 'Buckshot', 'Меткий глаз': 'Keen Eye',
  'Урон клика ×1.15 за уровень': 'Click damage ×1.15 per level',
  'Макс. HP ×1.13 за уровень': 'Max HP ×1.13 per level',
  '+25% к урону союзников за уровень': '+25% ally damage per level',
  '+10% урона по врагам рядом с целью за уровень': '+10% splash damage to enemies near the target per level',
  '+1% шанс крита за уровень (сверх потолка — крит-урон)': '+1% crit chance per level (past the cap — crit damage)',
  // — лут: редкости/слоты/статы/крафт —
  'Хлам': 'Junk', 'Годное': 'Decent', 'Редкое': 'Rare', 'Легенда': 'Legend', 'Реликвия': 'Relic',
  'Оружие': 'Weapon', 'Шлем': 'Helmet', 'Обувь': 'Boots', 'Аксессуар': 'Accessory',
  'урон клика': 'click damage', 'макс. HP': 'max HP', 'шанс крита': 'crit chance',
  'урон союзников': 'ally damage', 'крышек': 'caps',
  'На коленке': 'Rough Job', 'Годная сборка': 'Decent Build',
  'Точная работа': 'Fine Work', 'Мастерская ковка': 'Master Forge',
  // — зоны / аффиксы —
  'Ржавый Пустырь': 'Rusty Wastes', 'Руины Города': 'City Ruins',
  'Токсичный Бункер': 'Toxic Bunker', 'Логово Босса': 'Boss Lair',
  'Автосвалка': 'Scrapyard', 'Мёртвая Топь': 'Dead Marsh', 'Затопленное Метро': 'Flooded Metro',
  'Зелёный Кратер': 'Green Crater', 'Литейный Цех': 'Foundry', 'Стеклянная Пустошь': 'Glass Waste',
  'Богатая': 'Rich', 'Бронированная': 'Armored', 'Шустрая': 'Swift', 'Ядрёная': 'Nuclear',
  // — характеристики героя —
  'Сила': 'Strength', 'Живучесть': 'Vitality', 'Удача': 'Luck',
  '+2 к урону клика': '+2 click damage', '+30 к макс. HP': '+30 max HP',
  '+1% крит (сверх потолка — крит-урон) и лучше лут': '+1% crit (past the cap — crit damage) and better loot',
  // — престиж-бонусы —
  'Наследие бойца': 'Fighter’s Legacy', 'Схрон': 'Stash',
  'Крепкий род': 'Hardy Bloodline', 'Быстрый старт': 'Quick Start',
  '+20% урон клика за уровень': '+20% click damage per level',
  '+20% крышек за уровень': '+20% caps per level',
  '+15% макс. HP за уровень': '+15% max HP per level',
  '+300 крышек и +1 ур. «Калибра» на старте за уровень':
    '+300 caps and +1 Caliber level at start, per level',

  // — общие ярлыки —
  'ур.': 'lvl', 'ур. {l}': 'lvl {l}', '+{n} урона/сек': '+{n} dmg/sec',
  '{n} убийств': '{n} kills',
  // — ShopScene —
  'МАСТЕРСКАЯ': 'WORKSHOP', 'АПГРЕЙДЫ': 'UPGRADES', 'СОЮЗНИКИ (idle)': 'ALLIES (idle)',
  'Покупать:': 'Buy:',
  // — ClassSelect —
  'КТО ТЫ НА ПУСТОШИ?': 'WHO ARE YOU IN THE WASTELAND?',
  'Класс определяет твой стиль. Выбор — навсегда.': 'Your class defines your style. The choice is permanent.',
  'Выбрать': 'Choose',
  // — Prestige —
  'ПЕРЕРОЖДЕНИЕ': 'PRESTIGE',
  'Потеряешь крышки, апгрейды, уровень и зоны — но Ядра и их бонусы останутся навсегда.\nЭкипировка и рекорд сохраняются.':
    'You lose caps, upgrades, level and zones — but Cores and their bonuses stay forever.\nGear and record are kept.',
  'ВЕЧНЫЕ БОНУСЫ (за Ядра)': 'PERMANENT BONUSES (for Cores)',
  'За этот забег получишь: +{g} ☢   (убито {k})': 'This run grants: +{g} ☢   ({k} kills)',
  'Нужно больше убийств за забег (сейчас {k}). Копи прогресс и возвращайся.':
    'Need more kills this run (now {k}). Build progress and come back.',
  'Перерождение — после босса 4-й локации (ты в зоне {z}).':
    'Prestige unlocks after the 4th location boss (you are in zone {z}).',
  '☢ Переродиться (+{g})': '☢ Prestige (+{g})', '☢ Пока рано': '☢ Not yet',
  'Переродиться за +{g} ☢ ?\nПрогресс забега сбросится.': 'Prestige for +{g} ☢ ?\nRun progress resets.',
  'Переродиться': 'Prestige',
  // — Leaderboard —
  '🏆 РЕКОРДЫ': '🏆 SCORES',
  'Твой рекорд: {n} убийств': 'Your best: {n} kills',
  'Загрузка таблицы…': 'Loading leaderboard…',
  'Онлайн-таблица доступна в версии на Яндекс.Играх.\nЗдесь — твой личный рекорд.':
    'Online leaderboard is available in the Yandex Games version.\nHere — your personal best.',
  'В таблице пока пусто.\nТвой рекорд отправлен — загляни позже.':
    'The leaderboard is still empty.\nYour score has been sent — check back later.',
  'Аноним': 'Anonymous',
  // — Hero —
  'ГЕРОЙ': 'HERO',
  'Уровень {l}    Опыт {a}/{b}': 'Level {l}    XP {a}/{b}',
  'Свободных очков: {n}': 'Free points: {n}', 'Нет свободных очков': 'No free points',
  '⟲ Сброс': '⟲ Reset', '⟲ Сброс (debug)': '⟲ Reset (debug)',
  'Стереть весь прогресс?\nЭто нельзя отменить.': 'Erase all progress?\nThis cannot be undone.',
  'Стереть': 'Erase',
  'Урон клика: {n}': 'Click dmg: {n}', 'Макс. HP: {n}': 'Max HP: {n}',
  'Крит: {n}% ×{m}': 'Crit: {n}% ×{m}', 'Урон союзников: {n}/сек': 'Ally dmg: {n}/sec',
  // — Inventory / Forge —
  'ИНВЕНТАРЬ': 'INVENTORY', 'ВЕРСТАК': 'WORKBENCH',
  'Экипировка': 'Equipment', 'Рюкзак': 'Backpack', 'Пусто': 'Empty',
  'Снять': 'Unequip', 'Надеть': 'Equip', 'Продать': 'Sell', 'В лом': 'Scrap',
  'Металлолом: {n}': 'Scrap: {n}',
  'Разобрать хлам': 'Scrap junk', 'Скрафтить': 'Craft',
  'Инвентарь пуст — иди на пустошь за лутом!': 'Inventory is empty — go loot the wasteland!',
  'ДОБЫЧА': 'LOOT',
  '🔩 Хлам и годное': '🔩 Junk & decent', '🔩 Всё в лом': '🔩 Scrap all', '💰 Продать всё': '💰 Sell all',
  'В рюкзаке пусто — разбирать нечего.': 'The backpack is empty — nothing to clear out.',
  'Разобрать {n} предметов в металлолом?\nНадетое останется на герое.\nПолучишь 🔩 {g}':
    'Scrap {n} items for parts?\nEquipped gear stays on the hero.\nYou get 🔩 {g}',
  'Продать {n} предметов за крышки?\nНадетое останется на герое.\nПолучишь 🍾 {g}':
    'Sell {n} items for caps?\nEquipped gear stays on the hero.\nYou get 🍾 {g}',
  '— пусто —': '— empty —',
  'От экипировки:  {parts}': 'From gear:  {parts}', 'Экипировка пуста': 'No gear equipped',
  'Пусто. Иди в поход за лутом!': 'Empty. Go raid for loot!',
  '…и ещё {n} предметов': '…and {n} more items',
  'Не удалось открыть инвентарь.\nВернись в лагерь.': 'Couldn’t open inventory.\nReturn to camp.',
  '🔨 ВЕРСТАК': '🔨 WORKBENCH',
  '{n} металлолома': '{n} scrap', 'редкое+: ~{n}%': 'rare+: ~{n}%',
  'Ковать': 'Forge', 'Мало 🔩': 'Low 🔩', 'скован!': 'forged!',
  // — реликвии (части, набор, ковка) —
  'НАБОР РЕЛИКВИИ  {a}/{b}': 'RELIC SET  {a}/{b}',
  '🔥 Выковать': '🔥 Forge it',
  'Части падают с босса 10-й локации': 'Parts drop from the zone 10 boss',
  'Собери все части — выкуешь случайную реликвию': 'Collect every part to forge a random relic',
  'Босс 10-й локации роняет части реликвии — собери 5 и куй': 'The zone 10 boss drops relic parts — collect 5 and forge',
  'НАБОР СОБРАН! Кузни реликвию в инвентаре': 'SET COMPLETE! Forge the relic in your inventory',
  '🔩 {part} (повтор) +{n}': '🔩 {part} (duplicate) +{n}',
  '⭐ {name}': '⭐ {name}',
  'Шестерня Ядра': 'Core Gear',
  'Сердечник': 'Power Cell',
  'Катушка Теслы': 'Tesla Coil',
  'Мутная Линза': 'Murky Lens',
  'Рукоять Предка': 'Elder Grip',
  // — части имён предметов (см. PREFIX/NOUN в loot.js и itemName ниже) —
  'Ржавый': 'Rusty', 'Кривой': 'Crooked', 'Самопальный': 'Homemade', 'Треснутый': 'Cracked',
  'Ядрёный': 'Atomic', 'Липкий': 'Sticky', 'Гудящий': 'Humming', 'Счастливый': 'Lucky',
  'Помятый': 'Dented', 'Фонящий': 'Glowing',
  'обрез': 'sawed-off', 'гвоздомёт': 'nailgun', 'пистоль': 'pistol', 'дробовик': 'shotgun',
  'самопал': 'zip gun',
  'каска': 'helm', 'шлем': 'helmet', 'котелок': 'pot', 'противогаз': 'gas mask', 'капюшон': 'hood',
  'жилет': 'vest', 'нагрудник': 'breastplate', 'куртка': 'jacket', 'щиток': 'plate', 'броник': 'flak vest',
  'берцы': 'boots', 'сапоги': 'high boots', 'кроссы': 'sneakers', 'ботинки': 'shoes', 'галоши': 'galoshes',
  'зуб': 'tooth', 'амулет': 'amulet', 'подкова': 'horseshoe', 'жетон': 'dog tag',
  'крышка-талисман': 'lucky-cap',
}

// Имя предмета собирается в рантайме из прилагательного и существительного
// («Ржавый обрез», см. loot.js) и лежит в сейве уже собранной строкой, поэтому
// целиком в словаре его не найти. Переводим по словам: и новые предметы, и те,
// что уже сохранены у игрока со старой версии.
export function itemName(name) {
  if (LANG !== 'en' || typeof name !== 'string') return name
  return name.split(' ').map(w => (w in EN ? EN[w] : w)).join(' ')
}

export function t(ru, params) {
  let s = (LANG === 'en' && ru in EN) ? EN[ru] : ru
  if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k])
  return s
}
