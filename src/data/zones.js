// Зоны (3-4) с разным визуалом и своим пулом врагов.
// После последней зоны включается бесконечный режим (endless) с ростом сложности.
//
// enemies — пул обычных врагов зоны, bosses — пул боссов-ворот (см. bosses.js):
// на ворота выпадает случайный из своего пула, чтобы повторный заход в зону
// (после смерти или в endless) не был копией предыдущего.

import { BOSS_IDS } from './bosses.js'
import { t } from '../i18n.js'

// Палитра каждой зоны подобрана под её картину: ground — цвет полосы земли,
// которая в бою закрывает низ фона, поэтому он взят прямо из картинки над
// линией горизонта, чтобы стык не читался.
export const ZONES = [
  {
    name: 'Ржавый Пустырь',
    sky: 0x2c2416, ground: 0x8a4b2a, accent: 0xc9a76a,
    enemies: ['radrat', 'crawler', 'wasp', 'tick', 'vulture'],
    bosses: ['ratking', 'worm'],
    bossTint: 0xb5652f, bg: 'bg-rust',
  },
  {
    name: 'Автосвалка',
    sky: 0xaea89f, ground: 0x8e765d, accent: 0xcdab86,
    enemies: ['dog', 'roller', 'radrat', 'raider', 'tick'],
    bosses: ['crane', 'sledge'],
    bossTint: 0xc98a4a, bg: 'bg-junkyard',
  },
  {
    name: 'Руины Города',
    sky: 0x23262b, ground: 0x3c3c42, accent: 0x6b6b73,
    enemies: ['ghoul', 'raider', 'dog', 'roller', 'drowned'],
    bosses: ['sledge', 'crane'],
    bossTint: 0x8a8a92, bg: 'bg-city',
  },
  {
    name: 'Мёртвая Топь',
    sky: 0x95876d, ground: 0x7e704b, accent: 0xb6a26c,
    enemies: ['leech', 'slug', 'drowned', 'spitter', 'bloat'],
    bosses: ['toad', 'worm'],
    bossTint: 0x9cae4a, bg: 'bg-swamp',
  },
  {
    name: 'Затопленное Метро',
    sky: 0x1a2626, ground: 0x0c2021, accent: 0x112e2f,
    enemies: ['drowned', 'lurker', 'ghoul', 'zombie', 'leech'],
    bosses: ['mother', 'toad'],
    bossTint: 0x4fb0c8, bg: 'bg-metro',
  },
  {
    name: 'Токсичный Бункер',
    sky: 0x16240f, ground: 0x2c3a12, accent: 0x8fbf3f,
    enemies: ['bloat', 'spitter', 'lurker', 'slug', 'zombie'],
    bosses: ['toad', 'furnace'],
    bossTint: 0x8fbf3f, bg: 'bg-bunker',
  },
  {
    name: 'Зелёный Кратер',
    sky: 0x1b2420, ground: 0x384c38, accent: 0x516e51,
    enemies: ['zombie', 'ghoul', 'bloat', 'spitter', 'wasp'],
    bosses: ['mother', 'tyrant'],
    bossTint: 0x7fe04a, bg: 'bg-crater',
  },
  {
    name: 'Литейный Цех',
    sky: 0x312b26, ground: 0x292521, accent: 0x3b352f,
    enemies: ['hellhound', 'brute', 'butcher', 'raider', 'shard'],
    bosses: ['furnace', 'colossus'],
    bossTint: 0xff7a2a, bg: 'bg-foundry',
  },
  {
    name: 'Стеклянная Пустошь',
    sky: 0x1f253f, ground: 0x313b4c, accent: 0x47556e,
    enemies: ['shard', 'hellhound', 'lurker', 'vulture', 'crawler'],
    bosses: ['colossus', 'tyrant'],
    bossTint: 0xa8c4d4, bg: 'bg-glass',
  },
  {
    name: 'Логово Босса',
    sky: 0x2a1010, ground: 0x3a1414, accent: 0x9c2b2b,
    enemies: ['brute', 'butcher', 'shard', 'hellhound', 'zombie'],
    bosses: ['mother', 'tyrant', 'colossus'],
    bossTint: 0xff5a3c, bg: 'bg-lair',
  },
]

// Аффиксы бесконечного режима — модификаторы зоны, циклятся по петлям,
// чтобы endless-повторы ощущались по-разному (риск/награда варьируются).
// Множители накладываются поверх статов врага (hp/dmg/reward) и скорости.
export const AFFIXES = [
  { id: 'calm', name: '', tag: '', hp: 1, dmg: 1, rew: 1, spd: 1 },
  { id: 'rich', name: 'Богатая', tag: '🍾×2', hp: 1, dmg: 1, rew: 2.2, spd: 1 },
  { id: 'armored', name: 'Бронированная', tag: '🛡', hp: 1.5, dmg: 1, rew: 1.5, spd: 0.9 },
  { id: 'swift', name: 'Шустрая', tag: '💨', hp: 0.9, dmg: 1.2, rew: 1.2, spd: 1.5 },
  { id: 'toxic', name: 'Ядрёная', tag: '☢', hp: 1.1, dmg: 1.4, rew: 1.3, spd: 1 },
]

// ШАГ СЛОЖНОСТИ ЛОКАЦИИ: во сколько раз враги этой локации крепче врагов
// предыдущей. У каждой свой — от ×1.10 до ×1.30 с шагом 0.05, чтобы переходы
// не были одинаковыми: после лёгкой топи «литейка ×1.30» читается как событие.
//
// Раньше здесь был один плоский множитель на все зоны (enemyZoneRamp 1.06), а
// весь накал сложности сидел в росте HP за каждое убийство — то есть был
// незаметным: враг крепчал на 0.29% за моба, игрок этого не видел, просто в
// какой-то момент переставал справляться. Теперь внутри локации сложность
// ровная, а на входе в новую — честная ступенька.
//
// В endless список циклится: локации идут по кругу вместе с их картинками.
const ZONE_STEPS = [1.10, 1.20, 1.15, 1.30, 1.25, 1.10, 1.30, 1.15, 1.25, 1.20]

export function zoneStep(zoneIndex) {
  const n = ZONE_STEPS.length
  return ZONE_STEPS[(((zoneIndex % n) + n) % n)]
}

// Накопленный множитель HP к началу зоны: произведение шагов всех предыдущих.
// Считаем через полные циклы, а не циклом по всем зонам, — в endless индекс
// зоны неограничен, и наивный цикл рос бы вместе с ним.
const CYCLE_PRODUCT = ZONE_STEPS.reduce((p, v) => p * v, 1)
export function zoneHpMul(zoneIndex) {
  const z = Math.max(0, Math.floor(zoneIndex) || 0)
  const n = ZONE_STEPS.length
  let m = Math.pow(CYCLE_PRODUCT, Math.floor(z / n))
  for (let i = 0; i < z % n; i++) m *= ZONE_STEPS[i]
  return m
}

// Десятая локация — та, с чьего босса падают части реликвии. В endless картинки
// локаций идут по кругу (см. getZone: bg берётся по index % ZONES.length),
// поэтому «десятая» повторяется каждые ZONES.length зон: 9, 19, 29…
export function isRelicZone(zoneIndex) {
  return zoneIndex >= 0 && (zoneIndex % ZONES.length) === ZONES.length - 1
}

// Аффикс для номера петли (1..) endless-режима.
export function affixForLoop(loop) {
  return AFFIXES[(loop - 1) % AFFIXES.length]
}

// Зона по индексу; за пределами списка — бесконечный режим с аффиксами.
export function getZone(index) {
  if (index < ZONES.length) return { ...ZONES[index], endless: false, loop: 0, affix: AFFIXES[0] }
  const loop = index - ZONES.length + 1
  const base = ZONES[ZONES.length - 1]
  const affix = affixForLoop(loop)
  // Имя endless-зоны склеивается здесь, поэтому и переводим здесь: собранную
  // строку «Логово Босса +4 · Шустрая» в словаре уже не найти.
  const suffix = affix.name ? ` +${loop} · ${t(affix.name)}` : ` +${loop}`
  // В endless фон циклится по всем 4 зонам (визуальное разнообразие), а пул
  // врагов остаётся от последней зоны: он самый жирный и самый щедрый, и на нём
  // посчитана экономика позднего этапа (см. sim/balance-sim.mjs). Боссы-ворота
  // в endless — любой из девяти, чтобы петли не были копией друг друга.
  const bg = ZONES[index % ZONES.length].bg
  return { ...base, bg, bosses: BOSS_IDS, name: `${t(base.name)}${suffix}`, endless: true, loop, affix }
}
