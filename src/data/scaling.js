// Единая формула статов врага — используется и боем, и симуляцией баланса,
// чтобы они гарантированно не расходились.
// stage = сколько всего убито (totalKills): мягкая экспонента само-балансирует
// TTK. Поверх этого бой домножает на прогрессию (уровень/зона), волну и мету.

import { BAL } from './balance.js'

const MAX = Number.MAX_SAFE_INTEGER // жёсткий предел от Infinity/NaN на экстремальной глубине

// Глубинный рамп — множитель к HP, урону и скорости врага на больших локациях.
//
// Живёт ЗДЕСЬ, а не в GameState, потому что считать его должны трое: бой,
// balance-sim и depth-sim. Раньше формула была переписана в каждом из них
// вручную, и добавление второй ступени пришлось бы синхронизировать в трёх
// местах — именно так расходятся симуляторы с игрой.
//
// Ступеней две, и они перемножаются (см. BAL.deepZoneStart / abyssZoneStart).
// Каждая устроена одинаково: ступенька за КАЖДУЮ локацию глубже своего порога
// плюс ровный рост за каждые killStep убийств, сделанных уже на этой глубине.
// Убийства у ступеней СВОИ (deepKills / abyssKills): взять общий totalKills —
// значит получить на входе стену вместо рампа.
//
// zoneNumber — номер локации, а не индекс (первая = 1).
export function deepRampMul(zoneNumber, deepKills, abyssKills = 0) {
  const tier = (start, zoneRamp, killStep, killRamp, kills) =>
    Math.pow(zoneRamp, Math.max(0, zoneNumber - start))
      * Math.pow(killRamp, Math.floor(Math.max(0, kills) / killStep))
  return tier(BAL.deepZoneStart, BAL.deepZoneRamp, BAL.deepKillStep, BAL.deepKillRamp, deepKills)
    * tier(BAL.abyssZoneStart, BAL.abyssZoneRamp, BAL.abyssKillStep, BAL.abyssKillRamp, abyssKills)
}

// Тот же рамп для скорости, но с потолком: см. BAL.deepSpeedCap.
export function deepRampSpeedMul(zoneNumber, deepKills, abyssKills = 0) {
  return Math.min(BAL.deepSpeedCap, deepRampMul(zoneNumber, deepKills, abyssKills))
}

export function enemyStats(def, stage, isBoss) {
  // Сквозной рамп забега (A/B): за каждые killScaleStep убийств +killScaleRamp
  // к HP и +killScaleRampDmg к урону. Награду НЕ трогает — доход игрока
  // отстаёт, и бой тяжелеет быстрее, чем по одной экспоненте. stage =
  // totalKills, поэтому сбрасывается только перерождением (сквозь зоны и
  // смерти — работает).
  const rampSteps = Math.floor(stage / BAL.killScaleStep)
  const hpRamp = Math.pow(BAL.killScaleRamp, rampSteps)
  const dmgRamp = Math.pow(BAL.killScaleRampDmg, rampSteps)
  const hp = BAL.enemyBaseHp * Math.pow(BAL.hpGrowth, stage) * hpRamp * def.hpMul * (isBoss ? BAL.bossHpMul : 1)
  const reward = BAL.enemyBaseReward * Math.pow(BAL.rewardGrowth, stage) * def.rewardMul * (isBoss ? BAL.bossRewardMul : 1)
  const dmg = BAL.enemyBaseDamage * Math.pow(BAL.dmgGrowth, stage) * dmgRamp * def.dmgMul * (isBoss ? BAL.bossDamageMul : 1)
  return {
    hp: Math.min(MAX, Math.ceil(hp)),
    reward: Math.min(MAX, Math.ceil(reward)),
    dmg: Math.min(MAX, dmg),
  }
}
