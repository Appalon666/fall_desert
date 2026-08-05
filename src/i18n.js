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
  'Понятно!': 'Got it!',
  '🖱  КЛИК / ТАП по врагу — выстрел. Пуля бьёт БЛИЖАЙШЕГО, целься в опасных.':
    '🖱  CLICK / TAP an enemy to shoot. The bullet hits the NEAREST one — aim at dangerous ones.',
  '☢  SPACE или кнопка УЛЬТА — залп по ВСЕЙ волне (копится от попаданий).':
    '☢  SPACE or the ULT button — blast the WHOLE wave (charges from hits).',
  '🍾  Крышки за убийства → «Апгрейды»: урон, броня, картечь, крит, союзники.':
    '🍾  Caps from kills → “Upgrades”: damage, armor, buckshot, crit, allies.',
  '🤖  Союзники бьют сами и приносят доход, пока игра закрыта (офлайн).':
    '🤖  Allies fight on their own and earn while the game is closed (offline).',
  '💥  Каждые 20 убийств в зоне волна пополняется врагом — под конец жарче.':
    '💥  Every 20 kills in a zone adds one more enemy per wave — it heats up.',
  '🚪  В конце каждой зоны — БОСС-ВОРОТА: пробей, чтобы идти дальше.':
    '🚪  Each zone ends with a BOSS GATE: break it to advance.',
  '🦸  За уровни героя — очки в Силу / Живучесть / Удачу (раздел «Герой»).':
    '🦸  Hero levels grant points into Strength / Vitality / Luck (“Hero” screen).',
  '🎁  С врагов падает ЛУТ. Хлам разбирай в металлолом, куй новое на «Верстаке».':
    '🎁  Enemies drop LOOT. Scrap junk into metal, craft new gear at the “Workbench”.',
  '🎨  Редкость: Хлам ‹ Годное ‹ Редкое ‹ Легенда ‹ РЕЛИКВИЯ (оранж). Выше — сильнее бонус.':
    '🎨  Rarity: Junk ‹ Fine ‹ Rare ‹ Legendary ‹ RELIC (orange). Higher = stronger bonus.',
  '⚒  Чем дороже сборка на «Верстаке», тем выше шанс редкого предмета.':
    '⚒  The pricier the craft at the “Workbench”, the higher the chance of a rare item.',
  '☢  ПЕРЕРОЖДЕНИЕ откроется после босса 4-й локации и даёт 4 ЯДРА.':
    '☢  PRESTIGE unlocks after the 4th location boss and grants 4 CORES.',
  '💠  Ядра — на вечные бонусы (урон/HP/крышки/старт). Забег сбрасывается.':
    '💠  Spend Cores on permanent bonuses (damage/HP/caps/head-start). The run resets.',
  '🔥  Каждое перерождение делает врагов на +5% сильнее — пустошь звереет.':
    '🔥  Each prestige makes enemies +5% stronger — the wasteland grows fiercer.',
  '⚠️  Враги крепнут по мере твоего роста — качайся и не зевай удары!':
    '⚠️  Enemies grow stronger as you do — level up and don’t take hits!',
  // — Оффлайн —
  'С возвращением, выживший!': 'Welcome back, survivor!',
  'Отряд работал {t}\nи собрал:': 'Your squad worked for {t}\nand gathered:',
  'Забрать': 'Claim',
  // — Бой —
  'Наведись на врага и КЛИКАЙ — стреляй!\nКрышки трать в «Мастерской», Space — ульта.':
    'Aim at an enemy and CLICK — shoot!\nSpend caps in the “Workshop”, Space — ult.',
  'Целься по врагам и КЛИКАЙ — пуля бьёт ближайшего.\nВыбивай опасных первыми! Крышки трать в «Мастерской», Space — ульта (по всем).':
    'Aim and CLICK — the bullet hits the nearest.\nTake out dangerous ones first! Spend caps in the “Workshop”, Space — ult (hits all).',
  'Ульта не заряжена': 'Ult not charged',
  'ЗОНА {z} · {name}': 'ZONE {z} · {name}',
  'БОСС-ВОРОТА!': 'BOSS GATE!',
  'Зачистка: {a}/{b}': 'Clear: {a}/{b}',
  'Зачистка: {a}/{b}   ·   Всего убито: {t}': 'Clear: {a}/{b}   ·   Total kills: {t}',
  '{prog}   ·   Всего убито: {t}': '{prog}   ·   Total kills: {t}',
  'Урон клика: {n}': 'Click damage: {n}',
  'Крит: {n}%': 'Crit: {n}%',
  'Союзники: {n}/сек': 'Allies: {n}/sec',
  '☠  БОСС': '☠  BOSS',
  '☠  БОСС-ВОРОТА': '☠  BOSS GATE',
  '⟵ В лагерь': '⟵ To camp',
  'Ты пал на пустоши': 'You fell in the wasteland',
  // п.4.5.1 — на кнопках rewarded video текст прямо называет рекламу.
  '📺 Реклама: возродиться': '📺 Watch ad: revive',
  '📺 Реклама: ×2': '📺 Watch ad: ×2',
  'Смириться (откат зоны)': 'Give up (zone reset)',
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
  '⟵ В лагерь': '⟵ To camp',

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
  // — союзники —
  'Верный пёс': 'Loyal Dog', 'Турель': 'Turret', 'Снайпер': 'Sniper', 'Боевой мех': 'Battle Mech',
  // — апгрейды —
  'Калибр': 'Caliber', 'Броня': 'Armor', 'Выучка отряда': 'Squad Training',
  'Картечь': 'Buckshot', 'Меткий глаз': 'Keen Eye',
  'Урон клика ×1.15 за уровень': 'Click damage ×1.15 per level',
  'Макс. HP ×1.13 за уровень': 'Max HP ×1.13 per level',
  '+25% к урону союзников за уровень': '+25% ally damage per level',
  '+10% урона по врагам рядом с целью за уровень': '+10% splash damage to enemies near the target per level',
  '+1% шанс крита за уровень': '+1% crit chance per level',
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
  'Богатая': 'Rich', 'Бронированная': 'Armored', 'Шустрая': 'Swift', 'Ядрёная': 'Nuclear',
  // — характеристики героя —
  'Сила': 'Strength', 'Живучесть': 'Vitality', 'Удача': 'Luck',
  '+2 к урону клика': '+2 click damage', '+25 к макс. HP': '+25 max HP',
  '+1% крит и лучше лут': '+1% crit and better loot',
  // — престиж-бонусы —
  'Наследие бойца': 'Fighter’s Legacy', 'Схрон': 'Stash',
  'Крепкий род': 'Hardy Bloodline', 'Быстрый старт': 'Quick Start',
  '+10% урон клика за уровень': '+10% click damage per level',
  '+10% крышек за уровень': '+10% caps per level',
  '+8% макс. HP за уровень': '+8% max HP per level',
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
  'Аноним': 'Anonymous',
  // — Hero —
  'ГЕРОЙ': 'HERO',
  'Уровень {l}    Опыт {a}/{b}': 'Level {l}    XP {a}/{b}',
  'Свободных очков: {n}': 'Free points: {n}', 'Нет свободных очков': 'No free points',
  '⟲ Сброс': '⟲ Reset', '⟲ Сброс (debug)': '⟲ Reset (debug)',
  'Стереть весь прогресс?\nЭто нельзя отменить.': 'Erase all progress?\nThis cannot be undone.',
  'Стереть': 'Erase',
  'Урон клика: {n}': 'Click dmg: {n}', 'Макс. HP: {n}': 'Max HP: {n}',
  'Крит: {n}%': 'Crit: {n}%', 'Урон союзников: {n}/сек': 'Ally dmg: {n}/sec',
  // — Inventory / Forge —
  'ИНВЕНТАРЬ': 'INVENTORY', 'ВЕРСТАК': 'WORKBENCH',
  'Экипировка': 'Equipment', 'Рюкзак': 'Backpack', 'Пусто': 'Empty',
  'Снять': 'Unequip', 'Надеть': 'Equip', 'Продать': 'Sell', 'В лом': 'Scrap',
  'Металлолом: {n}': 'Scrap: {n}',
  'Разобрать хлам': 'Scrap junk', 'Скрафтить': 'Craft',
  'Инвентарь пуст — иди на пустошь за лутом!': 'Inventory is empty — go loot the wasteland!',
  'ДОБЫЧА': 'LOOT', '🔩 Разобрать хлам': '🔩 Scrap junk',
  '— пусто —': '— empty —',
  'От экипировки:  {parts}': 'From gear:  {parts}', 'Экипировка пуста': 'No gear equipped',
  'Пусто. Иди в поход за лутом!': 'Empty. Go raid for loot!',
  '…и ещё {n} предметов': '…and {n} more items',
  'Не удалось открыть инвентарь.\nВернись в лагерь.': 'Couldn’t open inventory.\nReturn to camp.',
  '🔨 ВЕРСТАК': '🔨 WORKBENCH',
  'Разбирай лишнее в инвентаре → металлолом. Здесь куй снаряжение.\nДороже сборка — выше шанс редкого.':
    'Break down spare gear in the inventory → scrap. Forge equipment here.\nPricier builds — higher rare chance.',
  '{n} металлолома': '{n} scrap', 'редкое+: ~{n}%': 'rare+: ~{n}%',
  'Ковать': 'Forge', 'Мало 🔩': 'Low 🔩', 'скован!': 'forged!',
}

export function t(ru, params) {
  let s = (LANG === 'en' && ru in EN) ? EN[ru] : ru
  if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k])
  return s
}
