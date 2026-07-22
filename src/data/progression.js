// Единый источник правды по подаче боя: размер волны и триггер босса-ворот.
// Импортируется боем и симуляторами, чтобы формулы не расходились.
//
// Масштабирование врагов идёт по КИЛЛАМ (stage = totalKills, см. scaling.js) —
// это само-балансирует TTK. Здесь только СТРУКТУРА подачи: волны как батчи и
// зоны как вехи, гейтящиеся числом убийств + боссом-воротами в конце зоны.

import { BAL } from './balance.js'

// Сколько врагов в очередной волне (батч на экране). Медленно растёт по зонам.
export function enemiesInWave(zoneIndex) {
  return Math.min(BAL.waveCountMax, BAL.waveCountBase + Math.floor(zoneIndex / 3))
}

// Пора ли выпускать босса-ворот (набрали норму убийств в зоне).
export function bossDue(killsInZone) {
  return killsInZone >= BAL.zoneKills
}
