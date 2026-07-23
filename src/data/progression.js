// Единый источник правды по подаче боя: размер волны и триггер босса-ворот.
// Импортируется боем и симуляторами, чтобы формулы не расходились.
//
// Масштабирование врагов идёт по КИЛЛАМ (stage = totalKills, см. scaling.js) —
// это само-балансирует TTK. Здесь только СТРУКТУРА подачи: волны как батчи и
// зоны как вехи, гейтящиеся числом убийств + боссом-воротами в конце зоны.

import { BAL } from './balance.js'

// Сколько врагов в очередной волне (батч на экране). Медленно растёт по зонам,
// плюс +1 враг за каждые 20 убийств в зоне (напряг нарастает; killsInZone
// сбрасывается в новой зоне и делится пополам при смерти — прибавка ограничена).
export function enemiesInWave(zoneIndex, killsInZone = 0) {
  const byZone = Math.min(BAL.waveCountMax, BAL.waveCountBase + Math.floor(zoneIndex / 3))
  return byZone + Math.floor(killsInZone / 20)
}

// Пора ли выпускать босса-ворот (набрали норму убийств в зоне).
export function bossDue(killsInZone) {
  return killsInZone >= BAL.zoneKills
}
