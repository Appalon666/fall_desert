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
  'ЯДРЁН-ПУСТОШЬ': 'ATOM-WASTELAND',
  'Крышки, пули и абсурд': 'Caps, bullets and absurd',
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
  '⚔  ПОХОД': '⚔  RAID',
  '🔧  Апгрейды и союзники': '🔧  Upgrades & allies',
  '🎒  Инвентарь': '🎒  Inventory',
  '🔨  Верстак (крафт)': '🔨  Workbench (craft)',
  '🦸  Герой (+{n})': '🦸  Hero (+{n})',
  '🦸  Герой': '🦸  Hero',
  '☢  Перерождение (+{n})': '☢  Prestige (+{n})',
  '☢  Перерождение': '☢  Prestige',
  '{n} ядер': '{n} cores',
  // — Как играть —
  '❔  КАК ИГРАТЬ': '❔  HOW TO PLAY',
  'Понятно!': 'Got it!',
  '🖱  КЛИК / ТАП по врагу — выстрел. Пуля бьёт БЛИЖАЙШЕГО — целься в опасных.':
    '🖱  CLICK / TAP an enemy to shoot. The bullet hits the NEAREST one — aim at dangerous ones.',
  '☢  SPACE или кнопка УЛЬТА — залп по ВСЕЙ волне (копится от попаданий).':
    '☢  SPACE or the ULT button — blast the WHOLE wave (charges from hits).',
  '🍾  Крышки за убийства → «Апгрейды»: урон, броня, союзники.':
    '🍾  Caps from kills → “Upgrades”: damage, armor, allies.',
  '🤖  Союзники бьют сами (и приносят доход, пока игра закрыта).':
    '🤖  Allies fight on their own (and earn while the game is closed).',
  '💥  В конце каждой зоны — БОСС-ВОРОТА: пробей, чтобы идти дальше.':
    '💥  Each zone ends with a BOSS GATE: break it to advance.',
  '🦸  За уровни — очки в Силу / Живучесть / Удачу (раздел «Герой»).':
    '🦸  Levels grant points into Strength / Vitality / Luck (“Hero” screen).',
  '🎁  С врагов падает лут → «Инвентарь» и «Верстак» (крафт за металлолом).':
    '🎁  Enemies drop loot → “Inventory” and “Workbench” (craft from scrap).',
  '☢  «Перерождение» — сброс забега ради ЯДЕР и вечных бонусов (урон/HP/крышки).':
    '☢  “Prestige” — reset the run for CORES and permanent bonuses (damage/HP/caps).',
  '💠  Ядра даёт ТОЛЬКО перерождение: чем дальше прошёл (выше зона) — тем больше Ядер.':
    '💠  Cores come ONLY from prestige: the deeper you got (higher zone), the more Cores.',
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
  '📺 Возродиться (реклама)': '📺 Revive (ad)',
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
}

export function t(ru, params) {
  let s = (LANG === 'en' && ru in EN) ? EN[ru] : ru
  if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k])
  return s
}
