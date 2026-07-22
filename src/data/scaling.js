// Единая формула статов врага — используется и боем, и симуляцией баланса,
// чтобы они гарантированно не расходились.
// stage = ТИР сложности (сквозной номер волны), см. progression.tierFor().

import { BAL } from './balance.js'

const MAX = Number.MAX_SAFE_INTEGER // жёсткий предел от Infinity/NaN на экстремальной глубине

export function enemyStats(def, stage, isBoss) {
  const hp = BAL.enemyBaseHp * Math.pow(BAL.hpGrowth, stage) * def.hpMul * (isBoss ? BAL.bossHpMul : 1)
  const reward = BAL.enemyBaseReward * Math.pow(BAL.rewardGrowth, stage) * def.rewardMul * (isBoss ? BAL.bossRewardMul : 1)
  const dmg = BAL.enemyBaseDamage * Math.pow(BAL.dmgGrowth, stage) * def.dmgMul * (isBoss ? BAL.bossDamageMul : 1)
  return {
    hp: Math.min(MAX, Math.ceil(hp)),
    reward: Math.min(MAX, Math.ceil(reward)),
    dmg: Math.min(MAX, dmg),
  }
}
