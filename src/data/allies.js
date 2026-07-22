// Наёмные союзники — источник idle-урона (DPS) и офлайн-дохода.
// Цена найма растёт экспоненциально с количеством уже нанятых.

export const ALLIES = [
  { id: 'dog',     name: 'Верный пёс',   icon: '🐕', baseCost: 50,    costMult: 1.15, dps: 2,    color: 0x9a7a4a },
  { id: 'gunner',  name: 'Стрелок',       icon: '🤠', baseCost: 300,   costMult: 1.16, dps: 12,   color: 0xd88a3a },
  { id: 'turret',  name: 'Турель',        icon: '🔩', baseCost: 1600,  costMult: 1.17, dps: 65,   color: 0x8a8a92 },
  { id: 'sniper',  name: 'Снайпер',       icon: '🎖️', baseCost: 9000,  costMult: 1.18, dps: 320,  color: 0x6fae5a },
  { id: 'mech',    name: 'Боевой мех',    icon: '🤖', baseCost: 55000, costMult: 1.19, dps: 1500, color: 0x5a9ad8 },
]

export function allyCost(def, owned) {
  return Math.floor(def.baseCost * Math.pow(def.costMult, owned))
}
