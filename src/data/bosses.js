// Боссы-ворота зон (9). Раньше босс был обычным врагом, раздутым до bossScale;
// теперь у каждого свой арт (спрайт-лист 2×2, как у врагов) и свой характер.
//
// Поля — те же, что у врагов (см. enemies.js), плюс смысл множителей другой:
// они накладываются ПОВЕРХ босс-множителей из balance.js (bossHpMul и т.д.),
// поэтому держатся около 1.0 — это «оттенок» босса, а не его жирность.
// scale — высота на экране = ENEMY_H_PER_SCALE × scale, потолок ~3.8 (арена 590 px).

import { ENEMIES } from './enemies.js'

export const BOSSES = {
  ratking:  { name: 'Крысиный Король', tint: 0x6b7a3f, scale: 3.2, hpMul: 1.0, rewardMul: 1.0, dmgMul: 1.0, speedMul: 1.0 },
  worm:     { name: 'Червь-Бурильщик', tint: 0xa8543a, scale: 3.4, hpMul: 1.2, rewardMul: 1.1, dmgMul: 0.9, speedMul: 0.8 },
  crane:    { name: 'Кран-Шагоход',    tint: 0xb5652f, scale: 3.7, hpMul: 1.3, rewardMul: 1.2, dmgMul: 1.1, speedMul: 0.75 },
  sledge:   { name: 'Кувалда',         tint: 0x8a8a92, scale: 3.2, hpMul: 1.0, rewardMul: 1.0, dmgMul: 1.4, speedMul: 1.1 },
  toad:     { name: 'Жаба-Жрун',       tint: 0x6f9c3f, scale: 3.3, hpMul: 1.3, rewardMul: 1.2, dmgMul: 1.0, speedMul: 0.9 },
  furnace:  { name: 'Печь-Голем',      tint: 0xd07a2a, scale: 3.5, hpMul: 1.5, rewardMul: 1.3, dmgMul: 1.1, speedMul: 0.7 },
  mother:   { name: 'Мать Выводка',    tint: 0x8f5fa8, scale: 3.4, hpMul: 1.2, rewardMul: 1.3, dmgMul: 1.2, speedMul: 0.9 },
  tyrant:   { name: 'Тиран',           tint: 0x9c2b2b, scale: 3.5, hpMul: 1.4, rewardMul: 1.4, dmgMul: 1.3, speedMul: 0.95 },
  colossus: { name: 'Колосс',          tint: 0xa8c4d4, scale: 3.8, hpMul: 1.6, rewardMul: 1.5, dmgMul: 1.4, speedMul: 0.65 },
}

export const BOSS_IDS = Object.keys(BOSSES)

export function isBossId(id) { return Object.prototype.hasOwnProperty.call(BOSSES, id) }

// Определение по id — боссы и обычные враги живут в одном пространстве имён,
// поэтому бою достаточно одного лукапа вместо двух веток.
export function defOf(id) { return BOSSES[id] || ENEMIES[id] }

// Ключ спрайт-листа: боссы лежат в public/sprites/boss-*.png, враги — enemy-*.png.
export function sheetKey(id) { return isBossId(id) ? `boss-${id}` : `enemy-${id}` }
