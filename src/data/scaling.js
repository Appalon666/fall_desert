// Единая формула статов врага — используется и боем, и симуляцией баланса,
// чтобы они гарантированно не расходились.
// stage = сколько всего убито (totalKills): мягкая экспонента само-балансирует
// TTK. Поверх этого бой домножает на прогрессию (уровень/зона), волну и мету.

import { BAL } from './balance.js'

// ПОТОЛОК ЧИСЕЛ — защита от Infinity/NaN, и только от них.
//
// Раньше здесь стоял Number.MAX_SAFE_INTEGER (9.0e15), и это ломало всю глубину:
// HP врага упиралось в него примерно к 80-й локации и дальше НЕ РОСЛО ВООБЩЕ,
// сколько бы рампов сверху ни навесили. Урон клика героя потолка не имел и
// продолжал расти — к 100-й локации разрыв доходил до двадцати с лишним
// порядков, и любой враг умирал с одного клика. Замер в игре: на 86-й, 100-й и
// 110-й локации HP рядового врага было одинаковым — ровно 9.0aa.
//
// MAX_SAFE_INTEGER — это граница ТОЧНОГО счёта целых, а не предел числа. HP
// врага и урон точность до единицы не волнует: разница между 1e40 и 1e40+1
// невидима. Берём предел на десять порядков ниже Infinity — от переполнения
// защищает так же, а расти больше не мешает.
// 1e307 — практически потолок самого JavaScript: числа с плавающей точкой
// заканчиваются на 1.8e308, дальше только Infinity. Выше поднять нельзя не по
// решению, а по устройству языка: чтобы числа росли за этот предел, игра должна
// перестать хранить их обычными числами (мантисса + порядок отдельно), а это
// переделка всех статов, сравнений и формата сейва.
export const STAT_CAP = 1e307
const MAX = STAT_CAP

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

// ПОЛОСА ГЛУБИНЫ — кривая сложности после ~20-й локации.
//
// Зачем она нужна. HP врага растёт как hpGrowth^убийства и вдобавок получает
// рампы за забег и за глубину; урон врага — как dmgGrowth^убийства. Сила героя
// не растёт от убийств вовсе: она растёт от ВЛОЖЕНИЙ. «Калибр» даёт урон
// ∝ лом^0.733, «Броня» — HP ∝ лом^0.874, а лом копится ещё и в офлайне, и с
// лута. Две величины считаются от разных вещей, поэтому расходятся — и не
// понемногу, а на десятки порядков.
//
// Что пробовали и почему это не работало:
//   1) Number.MAX_SAFE_INTEGER как потолок. HP упиралось в 9.0e15 примерно к
//      56-й локации и дальше не росло ВООБЩЕ, пока герой рос без предела.
//      Замер: 0.17 клика на рядового.
//   2) Растущий предел, привязанный к числу убийств. Держался ровно до тех пор,
//      пока игрок шёл «по расписанию». Замер на 129-й локации: 37 544
//      убийства, урон клика 1.26e43, HP героя 7.0e46 — а предел давал врагу
//      3.1e18. Разрыв в 10^26 набежал за пятнадцать локаций.
//   3) Резать урон в той же доле, что и HP. Давало перевёрнутую кривую: 8.4B
//      урона на 20-й локации, 99 на 86-й и РОВНО НОЛЬ на 114-й.
//
// Вывод из всех трёх: по числу убийств силу героя не предсказать. У двух игроков
// с одинаковым счётчиком она отличается на порядки — один вкладывался, другой
// копил. Поэтому на глубине враг соотносится с РЕАЛЬНОЙ силой героя.
//
// Полоса, а не жёсткое равенство: внутри границ работает обычная формула, и
// вложения там видны как есть. Границы задаёт BAL (depthClicksMin/Max для HP,
// min/maxHitShare для урона), а сила героя приходит не текущая, а отстающая —
// см. GameState.powerRef: вложился в урон — локацию рубишь заметно легче, и
// только потом враг подтягивается.
export const DEPTH_FROM = 8000          // с какого числа убийств полоса включается

// Накладывает полосу на ИТОГОВЫЕ числа врага — после прогрессии, волны и
// глубинных рампов. Множители босса (bossHpMul, bossDamageMul) учтены в
// границах, поэтому босс остаётся во столько же раз жирнее и злее рядового,
// сколько задумано.
//
// player = { click, maxHp } — отстающая сила героя и его максимальное HP. Без
// него (симуляции, тесты чистых формул) полоса не применяется вовсе.
export function applyDepthBand(stage, hp, dmg, isBoss, player) {
  if (!(stage > DEPTH_FROM) || !player) return { hp, dmg }
  let outHp = hp, outDmg = dmg
  const click = player.click
  if (Number.isFinite(click) && click > 0) {
    const bossMul = isBoss ? BAL.bossHpMul : 1
    outHp = clamp(hp, click * BAL.depthClicksMin * bossMul, click * BAL.depthClicksMax * bossMul)
  }
  const heroHp = player.maxHp
  if (Number.isFinite(heroHp) && heroHp > 0) {
    outDmg = clamp(dmg,
      heroHp * (isBoss ? BAL.minHitShareBoss : BAL.minHitShare),
      heroHp * (isBoss ? BAL.maxHitShareBoss : BAL.maxHitShare))
  }
  return { hp: outHp, dmg: outDmg }
}

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi) }

export function enemyStats(def, stage, isBoss) {
  // Сквозной рамп забега (A/B): за каждые killScaleStep убийств +killScaleRamp
  // к HP и +killScaleRampDmg к урону. Награду НЕ трогает — доход игрока
  // отстаёт, и бой тяжелеет быстрее, чем по одной экспоненте. stage =
  // totalKills, поэтому сбрасывается только перерождением (сквозь зоны и
  // смерти — работает).
  const rampSteps = Math.floor(stage / BAL.killScaleStep)
  const hpRamp = Math.pow(BAL.killScaleRamp, rampSteps)
  const dmgRamp = Math.pow(BAL.killScaleRampDmg, rampSteps)
  const hpRaw = BAL.enemyBaseHp * Math.pow(BAL.hpGrowth, stage) * hpRamp * def.hpMul * (isBoss ? BAL.bossHpMul : 1)
  const reward = BAL.enemyBaseReward * Math.pow(BAL.rewardGrowth, stage) * def.rewardMul * (isBoss ? BAL.bossRewardMul : 1)
  const dmgRaw = BAL.enemyBaseDamage * Math.pow(BAL.dmgGrowth, stage) * dmgRamp * def.dmgMul * (isBoss ? BAL.bossDamageMul : 1)
  // Полосу глубины здесь НЕ применяем: это только база, а бой домножает её на
  // прогрессию, волну и глубинные рампы — срезанное тут же вернулось бы обратно
  // (проверено замером: HP оставалось астрономическим). Полосу накладывает
  // BattleScene.makeEnemy последним действием — см. applyDepthBand выше.
  return {
    hp: Math.min(MAX, Math.ceil(hpRaw)),
    reward: Math.min(MAX, Math.ceil(reward)),
    dmg: Math.min(MAX, dmgRaw),
  }
}
