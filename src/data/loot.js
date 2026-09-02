// Лут: редкости, слоты «как в шутерах» и генерация предметов.
// Каждый предмет даёт один % бонус к стату, зависящий от слота.

export const RARITIES = [
  { id: 'common',   name: 'Хлам',     color: 0x9a9a9a, css: '#9a9a9a', weight: 56, mul: 1.0 },
  { id: 'uncommon', name: 'Годное',   color: 0x6fbf4f, css: '#6fbf4f', weight: 27, mul: 1.8 },
  { id: 'rare',     name: 'Редкое',   color: 0x4f9fef, css: '#4f9fef', weight: 13, mul: 3.0 },
  { id: 'epic',     name: 'Легенда',  color: 0xb96ff0, css: '#b96ff0', weight: 3.4, mul: 5.0 },
  { id: 'relic',    name: 'Реликвия', color: 0xff8a2a, css: '#ff8a2a', weight: 0.6, mul: 8.0 },
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

const ANY_STATS = ['clickMul', 'hpMul', 'critChance', 'allyMul', 'capsMul']

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
export function rollItem(rng, level = 1, luckBonus = 0, forceRarityId = null) {
  const slotDef = choose(rng, SLOTS)
  const rarity = (forceRarityId && RARITY_BY_ID[forceRarityId]) || pickRarity(rng, luckBonus)
  const stat = slotDef.stat === 'any' ? choose(rng, ANY_STATS) : slotDef.stat

  const value = itemPower(rarity.mul, level, stat === 'critChance')
  const nouns = NOUN[slotDef.id]
  const nounIdx = Math.floor(rng() * nouns.length)
  const name = `${choose(rng, PREFIX)} ${nouns[nounIdx]}`
  const item = {
    uid: `${Date.now().toString(36)}${Math.floor(rng() * 1e9).toString(36)}`,
    slot: slotDef.id, rarity: rarity.id, name, stat, value, level,
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
]
