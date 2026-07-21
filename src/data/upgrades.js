// Апгрейды за крышки. Цена растёт экспоненциально: cost = base * costMult^level.
// kind:'pow'  — мультипликативный (сила ×mul за уровень) — главные драйверы роста.
// kind:'add'  — аддитивный (+perLevel к сумме) — вторичные/крит.

export const UPGRADES = [
  {
    id: 'damage', name: 'Калибр', icon: '🔫',
    desc: 'Урон клика ×1.15 за уровень',
    baseCost: 15, costMult: 1.16, kind: 'pow', stat: 'clickPow', mul: 1.15,
  },
  {
    id: 'hp', name: 'Броня', icon: '🛡️',
    desc: 'Макс. HP ×1.13 за уровень',
    baseCost: 22, costMult: 1.15, kind: 'pow', stat: 'hpPow', mul: 1.13,
  },
  {
    id: 'allyPower', name: 'Выучка отряда', icon: '📣',
    desc: '+25% к урону союзников за уровень',
    baseCost: 70, costMult: 1.22, kind: 'add', stat: 'allyMul', perLevel: 0.25,
  },
  {
    id: 'multishot', name: 'Картечь', icon: '💥',
    desc: '+8% к урону клика за уровень',
    baseCost: 50, costMult: 1.28, kind: 'add', stat: 'clickMul', perLevel: 0.08,
  },
  {
    id: 'crit', name: 'Меткий глаз', icon: '🎯',
    desc: '+1% шанс крита за уровень',
    baseCost: 40, costMult: 1.30, kind: 'add', stat: 'critChance', perLevel: 0.01,
  },
]

export function upgradeCost(def, level) {
  return Math.floor(def.baseCost * Math.pow(def.costMult, level))
}
