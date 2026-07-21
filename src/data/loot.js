// Лут: редкости, слоты «как в шутерах» и генерация предметов.
// Каждый предмет даёт один % бонус к стату, зависящий от слота.

export const RARITIES = [
  { id: 'common',   name: 'Хлам',    color: 0x9a9a9a, css: '#9a9a9a', weight: 56, mul: 1.0 },
  { id: 'uncommon', name: 'Годное',  color: 0x6fbf4f, css: '#6fbf4f', weight: 27, mul: 1.8 },
  { id: 'rare',     name: 'Редкое',  color: 0x4f9fef, css: '#4f9fef', weight: 13, mul: 3.0 },
  { id: 'epic',     name: 'Легенда', color: 0xb96ff0, css: '#b96ff0', weight: 4,  mul: 5.0 },
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

function pickRarity(rng, luckBonus = 0) {
  const table = RARITIES.map((r, i) => ({ r, w: r.weight * (i >= 2 ? 1 + luckBonus : 1) }))
  const total = table.reduce((s, t) => s + t.w, 0)
  let roll = rng() * total
  for (const t of table) { if ((roll -= t.w) <= 0) return t.r }
  return RARITIES[0]
}
function choose(rng, arr) { return arr[Math.floor(rng() * arr.length)] }

export function rollItem(rng, level = 1, luckBonus = 0) {
  const slotDef = choose(rng, SLOTS)
  const rarity = pickRarity(rng, luckBonus)
  const stat = slotDef.stat === 'any' ? choose(rng, ANY_STATS) : slotDef.stat

  let value
  if (stat === 'critChance') {
    value = +(0.01 * rarity.mul * (1 + level * 0.03)).toFixed(3)
  } else {
    value = +(0.05 * rarity.mul * (1 + level * 0.04)).toFixed(3)
  }
  const name = `${choose(rng, PREFIX)} ${choose(rng, NOUN[slotDef.id])}`
  return {
    uid: `${Date.now().toString(36)}${Math.floor(rng() * 1e9).toString(36)}`,
    slot: slotDef.id, rarity: rarity.id, name, stat, value, level,
  }
}

export const RARITY_BY_ID = Object.fromEntries(RARITIES.map(r => [r.id, r]))
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]))
