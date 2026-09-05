// Лут: редкости, слоты «как в шутерах» и генерация предметов.
// Каждый предмет даёт один % бонус к стату, зависящий от слота.

export const RARITIES = [
  { id: 'common',   name: 'Хлам',     color: 0x9a9a9a, css: '#9a9a9a', weight: 56, mul: 1.0 },
  { id: 'uncommon', name: 'Годное',   color: 0x6fbf4f, css: '#6fbf4f', weight: 27, mul: 1.8 },
  { id: 'rare',     name: 'Редкое',   color: 0x4f9fef, css: '#4f9fef', weight: 13, mul: 3.0 },
  { id: 'epic',     name: 'Легенда',  color: 0xb96ff0, css: '#b96ff0', weight: 3.4, mul: 5.0 },
  // mul реликвии = РОВНО ВДВОЕ от легенды (5.0 → 10.0). Так высший тир и
  // ощущается высшим: полный комплект даёт ×6.0 к урону клика против ×3.3 у
  // легендарного. Разрыв стережёт тест «реликвия сильнее легенды».
  // Красный — намеренно: это ВЫСШИЙ тир, и он обязан читаться как другой класс
  // вещей, а не как «ещё немного лучше легенды». Оранжевый слишком близок к
  // рыжей палитре пустоши (ржавчина, огонь верстака, крышки) и терялся в ней.
  { id: 'relic',    name: 'Реликвия', color: 0xff3b30, css: '#ff3b30', weight: 0.6, mul: 10.0 },
]

// Слоты экипировки. accessory занимает два гнезда (acc1/acc2).
export const SLOTS = [
  { id: 'weapon',    name: 'Оружие',    icon: '🔫', stat: 'clickMul' },
  { id: 'helmet',    name: 'Шлем',      icon: '⛑️', stat: 'critChance' },
  { id: 'armor',     name: 'Броня',     icon: '🦺', stat: 'hpMul' },
  { id: 'boots',     name: 'Обувь',     icon: '🥾', stat: 'capsMul' },
  { id: 'accessory', name: 'Аксессуар', icon: '📿', stat: 'any' },
]

// Ключи гнёзд экипировки в GameState.equipment.
export const EQUIP_KEYS = ['weapon', 'helmet', 'armor', 'boots', 'acc1', 'acc2']

// Человекочитаемые ярлыки статов.
export const STAT_LABEL = {
  clickMul: 'урон клика',
  hpMul: 'макс. HP',
  critChance: 'шанс крита',
  allyMul: 'урон союзников',
  capsMul: 'крышек',
}

// Значки статов — для карточек «куклы», где на три стата есть одна строка
// шириной 150 px. Словами туда не влезть: минимальный кегль в игре 16 px
// (требование Яндекса 1.8 к читаемости, см. MIN_FONT в main.js), мельче нельзя.
export const STAT_ICON = {
  clickMul: '🔫',
  hpMul: '❤️',
  critChance: '🎯',
  allyMul: '🐕',
  capsMul: '🍾',
}

// Короткие ярлыки: в строке инвентаря теперь три стата вместо одного, и
// полными названиями («урон союзников») они туда не помещаются.
export const STAT_SHORT = {
  clickMul: 'урон',
  hpMul: 'HP',
  critChance: 'крит',
  allyMul: 'союзники',
  capsMul: 'крышки',
}

const ANY_STATS = ['clickMul', 'hpMul', 'critChance', 'allyMul', 'capsMul']
// Локальная карта слотов: экспортируемая SLOT_BY_ID объявлена ниже по файлу,
// а rollItem нужна раньше.
const SLOT_BY_ID_INTERNAL = Object.fromEntries(SLOTS.map(s => [s.id, s]))

// СКОЛЬКО СТАТОВ НА ПРЕДМЕТЕ И КАК МЕЖДУ НИМИ ДЕЛИТСЯ СИЛА.
//
// Раньше слот жёстко задавал один стат: шлем — всегда шанс крита, сапоги —
// всегда крышки. Предметы одного слота отличались только числом, выбирать было
// не из чего, и весь лут сводился к «больше процент — надеть».
//
// Теперь у предмета три стата: первый — родной для слота (у аксессуара
// случайный), два других — случайные из оставшихся, без повторов. Пять статов и
// три места дают 6 наборов на слот, и это на КАЖДОМ из тиров — то есть предметы
// одного вида перестали быть одинаковыми.
//
// Доли — от силы предмета его тира и уровня (itemPower). Сумма БОЛЬШЕ единицы
// намеренно: три размазанных стата слабее одного собранного, потому что часть
// из них не работает на текущую сборку. Сумму держим здесь одним числом —
// после правки прогонять `node sim/gear-sim.mjs` и `npm run sim`.
export const STAT_SHARES = [0.7, 0.3, 0.2]
export const STATS_PER_ITEM = STAT_SHARES.length

const PREFIX = ['Ржавый', 'Кривой', 'Самопальный', 'Треснутый', 'Ядрёный', 'Липкий', 'Гудящий', 'Счастливый', 'Помятый', 'Фонящий']
const NOUN = {
  weapon: ['обрез', 'гвоздомёт', 'пистоль', 'дробовик', 'самопал'],
  helmet: ['каска', 'шлем', 'котелок', 'противогаз', 'капюшон'],
  armor: ['жилет', 'нагрудник', 'куртка', 'щиток', 'броник'],
  boots: ['берцы', 'сапоги', 'кроссы', 'ботинки', 'галоши'],
  accessory: ['зуб', 'амулет', 'подкова', 'жетон', 'крышка-талисман'],
}

// ПОТОЛОК ВКЛАДА УРОВНЯ. Уровень предмета = enemyLevel() и растёт ЛИНЕЙНО от
// числа убийств, а HP врагов — ЭКСПОНЕНЦИАЛЬНО. Из-за этого экипировка ломалась
// с обоих концов: через 20 минут игры полный серый комплект давал ×9 к урону
// клика (ваншот всего подряд), синий ×26, фиолетовый ×42 — а к 5000 убийств
// тот же комплект становился мусором, потому что враги уходили в отрыв.
// С потолком гир — сильный, но соразмерный множитель: полный комплект даёт
// примерно ×2-4 и остаётся осмысленным на любой глубине.
// Замерять: node sim/gear-sim.mjs
export const ITEM_LEVEL_CAP = 50

// Сила одного предмета (доля бонуса к стату) по редкости и уровню.
export function itemPower(rarityMul, level, isCrit = false) {
  const lv = Math.min(Math.max(1, level || 1), ITEM_LEVEL_CAP)
  return +((isCrit ? 0.01 : 0.05) * rarityMul * (1 + lv * (isCrit ? 0.03 : 0.04))).toFixed(3)
}

// Статы предмета единым списком. Понимает и старую форму ({stat, value} одним
// полем) — сейвы с ней ещё живы у всех, кто играл до этой версии.
export function itemStats(item) {
  if (!item) return []
  if (Array.isArray(item.stats)) return item.stats
  return item.stat ? [{ stat: item.stat, value: item.value }] : []
}

// Первый (главный) стат — им предмет и представляется там, где место только на
// одну строку. Для родного слота это всегда его собственный стат.
export function mainStat(item) { return itemStats(item)[0] || null }

// «Качество» предмета — его сила В ДОЛЯХ от потолка своего тира и стата (0..1).
//
// Зачем: сырое item.value сравнивать между статами нельзя. У шанса крита
// коэффициент 0.01, у всех остальных 0.05, поэтому предельная реликвия-шлем
// даёт value 0.2, а предельные эпические сапоги — 0.75. Сортировка по value
// ставила лучший шлем НИЖЕ обычных сапог, и в списке на шесть строк свежая
// реликвия просто не показывалась: игрок ковал её и не находил.
export function itemQuality(item) {
  const rar = item && RARITY_BY_ID[item.rarity]
  if (!rar) return 0
  const list = itemStats(item)
  if (!list.length) return 0
  // Складываем доли каждого стата от ЕГО потолка и нормируем на сумму долей:
  // у предельного предмета получается ровно 1, сколько бы статов он ни нёс.
  let got = 0
  for (const st of list) {
    if (!st || !Number.isFinite(st.value)) continue
    const max = itemPower(rar.mul, ITEM_LEVEL_CAP, st.stat === 'critChance')
    if (max > 0) got += st.value / max
  }
  const full = STAT_SHARES.slice(0, list.length).reduce((a, b) => a + b, 0)
  return full > 0 ? Math.min(1, got / full) : 0
}

// Сила предмета в «единицах тира» — единственная величина, которой можно
// честно сравнить вещи с РАЗНЫМИ статами.
//
// Зачем. Игрок видит «Шлем · Реликвия · +20.0% шанс крита» и рядом «Обувь ·
// Легенда · +75% крышек» и делает вывод, что выковал вещь тиром ниже. На самом
// деле проценты разных статов между собой несравнимы: у шанса крита коэффициент
// в формуле 0.01, у всех прочих 0.05. В своём слоте реликвия ровно в 1.6 раза
// сильнее легенды — и здесь это наконец видно числом: у предельных предметов
// ранг равен множителю тира (легенда 5.0, реликвия 8.0).
export function itemRank(item) {
  const rar = item && RARITY_BY_ID[item.rarity]
  return rar ? rar.mul * itemQuality(item) : 0
}

function pickRarity(rng, luckBonus = 0) {
  const table = RARITIES.map((r, i) => ({ r, w: r.weight * (i >= 2 ? 1 + luckBonus : 1) }))
  const total = table.reduce((s, t) => s + t.w, 0)
  let roll = rng() * total
  for (const t of table) { if ((roll -= t.w) <= 0) return t.r }
  return RARITIES[0]
}
function choose(rng, arr) { return arr[Math.floor(rng() * arr.length)] }

// forceRarityId — выдать предмет заданной редкости вместо броска по таблице
// (ковка реликвии из частей, гарантированный эпик с босса десятой локации).
// forceSlotId — задать слот; нужно замеру полного комплекта (sim/gear-sim.mjs),
// в самой игре слот всегда случайный.
export function rollItem(rng, level = 1, luckBonus = 0, forceRarityId = null, forceSlotId = null) {
  const slotDef = (forceSlotId && SLOT_BY_ID_INTERNAL[forceSlotId]) || choose(rng, SLOTS)
  const rarity = (forceRarityId && RARITY_BY_ID[forceRarityId]) || pickRarity(rng, luckBonus)
  // Первый стат — родной для слота (у аксессуара любой), остальные добираем из
  // оставшихся без повторов: два одинаковых стата на одном предмете читались бы
  // как ошибка генерации.
  const first = slotDef.stat === 'any' ? choose(rng, ANY_STATS) : slotDef.stat
  const pool = ANY_STATS.filter(s => s !== first)
  const picked = [first]
  while (picked.length < STATS_PER_ITEM && pool.length) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  }
  const stats = picked.map((stat, i) => ({
    stat,
    value: +(itemPower(rarity.mul, level, stat === 'critChance') * STAT_SHARES[i]).toFixed(4),
  }))

  const nouns = NOUN[slotDef.id]
  const nounIdx = Math.floor(rng() * nouns.length)
  const name = `${choose(rng, PREFIX)} ${nouns[nounIdx]}`
  const item = {
    uid: `${Date.now().toString(36)}${Math.floor(rng() * 1e9).toString(36)}`,
    slot: slotDef.id, rarity: rarity.id, name, stats, level,
  }
  // Тип оружия (индекс NOUN.weapon) → визуал выстрела в бою.
  if (slotDef.id === 'weapon') item.wtype = nounIdx
  return item
}

// Визуал выстрела по типу оружия (порядок = NOUN.weapon). Только внешний вид,
// на урон не влияет. Индекс по умолчанию 2 (пистоль) — когда оружие не надето.
export const WEAPON_STYLES = [
  { id: 'obrez', tint: 0xffb060, trail: 0xffcf8a, scale: 2.7, speed: 1500, spread: 0.05 },
  { id: 'gvozdomet', tint: 0xcfd6e0, trail: 0xeef2f7, scale: 1.8, speed: 2050, spread: 0.02 },
  { id: 'pistol', tint: 0xffe08a, trail: 0xfff0b0, scale: 2.2, speed: 1600, spread: 0.02 },
  { id: 'drobovik', tint: 0xff9a4a, trail: 0xffc27a, scale: 2.5, speed: 1450, spread: 0.09 },
  { id: 'samopal', tint: 0xff5a4a, trail: 0xff8a6a, scale: 2.6, speed: 1350, spread: 0.10 },
]
export function weaponStyleFor(item) {
  const idx = (item && Number.isInteger(item.wtype)) ? item.wtype : 2
  return WEAPON_STYLES[idx] || WEAPON_STYLES[2]
}

// Ключ текстуры арта оружия по предмету (или null, если не оружие/нет типа).
export function weaponTexKey(item) {
  if (!item || item.slot !== 'weapon' || !Number.isInteger(item.wtype)) return null
  return `weapon-${item.wtype}`
}

export const RARITY_BY_ID = Object.fromEntries(RARITIES.map(r => [r.id, r]))
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]))

// Цена продажи предмета в крышках. Живёт рядом со scrapValue, потому что оба
// нужны инвентарю ещё и ДО действия: массовые «продать всё» / «в лом» обязаны
// показать в подтверждении, сколько именно игрок получит.
export function sellValue(item) {
  return 10 + (item.level || 1) * 3
}

// Сколько металлолома даёт разбор предмета (по редкости и уровню).
//
// Уровень режем тем же потолком ITEM_LEVEL_CAP, что и силу предмета. Без этого
// повторялась ровно та поломка, из-за которой потолок и появился: уровень
// предмета = enemyLevel() и растёт ЛИНЕЙНО от числа убийств, а цены на верстаке
// (CRAFT_TIERS) фиксированные. К 10 тысячам убийств серый хлам давал по 400
// металлолома за штуку — «Мастерская ковка» за 1500 окупалась четырьмя
// подобранными вещами, ковка становилась бесплатной, и реликвию можно было
// нафармить перебором за минуты в обход набора из пяти частей (см. relics.js).
// С потолком разбор одного предмета остаётся соразмерным тому, что предмет даёт.
const SCRAP_BASE = { common: 1, uncommon: 3, rare: 8, epic: 22, relic: 60 }
export function scrapValue(item) {
  const base = SCRAP_BASE[item.rarity] || 1
  const lv = Math.min(Math.max(1, item.level || 1), ITEM_LEVEL_CAP)
  return Math.ceil(base * (1 + lv * 0.08))
}

// Тиры крафта: больше металлолома → выше шанс качественного предмета (luck).
export const CRAFT_TIERS = [
  { id: 'cheap',  name: 'На коленке',      cost: 25,   luck: 0.2, css: '#9a9a9a' },
  { id: 'solid',  name: 'Годная сборка',   cost: 100,  luck: 1.5, css: '#6fbf4f' },
  { id: 'fine',   name: 'Точная работа',   cost: 400,  luck: 4,   css: '#4f9fef' },
  { id: 'master', name: 'Мастерская ковка', cost: 1500, luck: 10,  css: '#b96ff0' },
  // Реликтовая ковка — единственный тир с ГАРАНТИЕЙ: не бросок по таблице
  // редкостей, а монетка между реликвией и легендой. За 10000 лома игрок
  // покупает шанс, а не лотерею, где может выпасть хлам.
  //
  // Второй путь к реликвии, помимо набора из пяти частей с босса 10-й локации.
  // Пути намеренно разные: части — это цель на часы вперёд и гарантированный
  // результат, ковка — способ обменять накопленный лом, когда части не идут.
  // Счётчик relicsCrafted эта ковка НЕ трогает: он гейтит выпадение дублей
  // частей, и покупка за лом не должна портить дроп с босса.
  { id: 'relic',  name: 'Реликтовая ковка', cost: 10000, luck: 0, relicChance: 0.7, css: '#ff3b30' },
]
