// Единая формула статов врага — используется и боем, и симуляцией баланса,
// чтобы они гарантированно не расходились.
// stage = сколько всего убито (totalKills): мягкая экспонента само-балансирует
// TTK. Поверх этого бой домножает на прогрессию (уровень/зона), волну и мету.

import { BAL } from './balance.js'

const MAX = Number.MAX_SAFE_INTEGER // жёсткий предел от Infinity/NaN на экстремальной глубине

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
