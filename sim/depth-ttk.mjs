// Насколько враг соотносится с игроком НА ГЛУБИНЕ.
//
// Зачем отдельно от balance-sim и depth-sim: те моделируют первые часы игры и
// дальше 19-й локации не заходят. А ломается всё гораздо глубже — там, где у
// игрока десятки тысяч убийств. Пройти это руками нельзя (сутки игры), поэтому
// считаем.
//
// ЧТО СЧИТАЕТСЯ НАДЁЖНО, А ЧТО НЕТ. Абсолютную силу игрока формулой не
// восстановить, и это не мелочь, а суть проблемы: сила растёт не от убийств, а
// от ВЛОЖЕНИЙ. «Калибр» даёт урон ∝ лом^0.733, «Броня» — HP ∝ лом^0.874, лом
// копится ещё и в офлайне, и с лута. У двух игроков с одинаковым счётчиком
// убийств сила отличается на порядки — именно поэтому кривая врага, привязанная
// к числу убийств, разошлась с игроком на 10^26 (замер, 129-я локация).
//
// Поэтому опорная точка здесь — ЗАМЕР ЖИВОЙ ИГРЫ, а не модель. И показывает
// файл нижнюю границу: «что было бы, если бы игрок перестал качаться прямо
// сейчас». В самой игре сила отстающая и растёт вместе с вложениями
// (GameState.powerRef), поэтому реальные числа мягче.
//
// Запуск: node sim/depth-ttk.mjs
import { BAL } from '../src/data/balance.js'
import { fmt } from '../src/util/format.js'
import { deepRampMul, applyDepthBand, DEPTH_FROM } from '../src/data/scaling.js'
import { defOf } from '../src/data/bosses.js'
import { getZone, zoneHpMul } from '../src/data/zones.js'

// Опорная точка — с экранов реального игрока (зона 129, «Стрелок», ур. 205).
// click — ожидаемый урон за клик с критом: 12.6aj × (1 + 0.90 × 11.66).
const REF = {
  zone: 129, kills: 37544,
  clickRaw: 12.6e42, crit: 0.90, critMul: 12.66,
  heroHp: 70.4e45,
}
REF.click = REF.clickRaw * (1 + REF.crit * (REF.critMul - 1))

// Убийств к этой локации.
const KILLS_PER_ZONE = REF.kills / REF.zone
const killsAt = (z) => Math.round(z * KILLS_PER_ZONE)

// HP рядового врага этой локации — по формулам самой игры, но БЕЗ полосы.
function enemyHp(z) {
  const kills = killsAt(z)
  const def = defOf(getZone(z - 1).enemies[0])
  const rampSteps = Math.floor(kills / BAL.killScaleStep)
  const base = BAL.enemyBaseHp * Math.pow(BAL.hpGrowth, kills)
    * Math.pow(BAL.killScaleRamp, rampSteps) * def.hpMul
  const deep = deepRampMul(z, Math.max(0, (z - BAL.deepZoneStart) * BAL.zoneKills),
    Math.max(0, (z - BAL.abyssZoneStart) * BAL.zoneKills))
  return base * zoneHpMul(z - 1) * deep
}

// Урон рядового врага — тоже по формулам игры и тоже без полосы.
function enemyDmg(z) {
  const kills = killsAt(z)
  const def = defOf(getZone(z - 1).enemies[0])
  const rampSteps = Math.floor(kills / BAL.killScaleStep)
  const base = BAL.enemyBaseDamage * Math.pow(BAL.dmgGrowth, kills)
    * Math.pow(BAL.killScaleRampDmg, rampSteps) * def.dmgMul
  const deep = deepRampMul(z, Math.max(0, (z - BAL.deepZoneStart) * BAL.zoneKills),
    Math.max(0, (z - BAL.abyssZoneStart) * BAL.zoneKills))
  return base * deep
}

// С полосой — ровно как считает бой (BattleScene.makeEnemy).
const PLAYER = { click: REF.click, maxHp: REF.heroHp }
function banded(z, isBoss = false) {
  const hp = enemyHp(z) * (isBoss ? BAL.bossHpMul : 1)
  const dmg = enemyDmg(z) * (isBoss ? BAL.bossDamageMul : 1)
  return applyDepthBand(killsAt(z), hp, dmg, isBoss, PLAYER)
}

console.log('\n=== ГЛУБИНА: враг против игрока ===\n')
console.log(`Опорная точка (замерено в игре): ${REF.zone}-я локация, ${REF.kills} убийств.`)
console.log(`Урон клика ${fmt(REF.clickRaw)}, крит ${REF.crit * 100}% ×${REF.critMul}`)
console.log(`  → ожидаемый урон за клик ${fmt(REF.click)}. HP героя ${fmt(REF.heroHp)}.`)
console.log(`\nБез полосы формулы дают на этой глубине: HP врага ${enemyHp(REF.zone).toExponential(1)},`)
console.log(`урон ${enemyDmg(REF.zone).toExponential(1)} — то есть ${(enemyHp(REF.zone) / REF.click).toExponential(1)} кликов`)
console.log(`на рядового и ${(enemyDmg(REF.zone) / REF.heroHp).toExponential(1)} смертей героя с одного удара.`)
console.log(`Полоса включается с ${DEPTH_FROM} убийств и приводит это к играбельному виду.\n`)

console.log('| Локация | Убийств | Кликов на рядового | Кликов на босса | Ударов держит герой |')
console.log('|---|---|---|---|---|')
for (const z of [30, 40, 60, 86, 100, 114, 129, 150, 200]) {
  const n = banded(z), b = banded(z, true)
  console.log(`| ${z} | ${fmt(killsAt(z))} | ${(n.hp / REF.click).toFixed(1)} `
    + `| ${(b.hp / REF.click).toFixed(1)} | ${(REF.heroHp / n.dmg).toFixed(1)} |`)
}

// Цель: не больше 5 кликов по рядовому и 10 по боссу, и герой не умирает с
// одного удара.
const n = banded(REF.zone), b = banded(REF.zone, true)
const clicks = n.hp / REF.click, bclicks = b.hp / REF.click, hits = REF.heroHp / n.dmg
console.log(`\nВ опорной точке: ${clicks.toFixed(1)} кликов по рядовому, ${bclicks.toFixed(1)} по боссу,`)
console.log(`герой держит ${hits.toFixed(1)} ударов рядового.`)
console.log(clicks <= BAL.depthClicksMax + 0.01 && clicks >= BAL.depthClicksMin - 0.01
  && bclicks <= (BAL.depthClicksMax * BAL.bossHpMul) + 0.01 && hits >= 4
  ? '  ✓ в целевом коридоре' : '  ✗ мимо коридора')
