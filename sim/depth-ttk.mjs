// Насколько враг обгоняет игрока НА ГЛУБИНЕ.
//
// Зачем отдельно от balance-sim и depth-sim: те моделируют первые часы игры и
// дальше 19-й локации не заходят. А ломается всё гораздо глубже — там, где у
// игрока десятки тысяч убийств. Пройти это руками нельзя (сутки игры), поэтому
// считаем.
//
// ЧТО СЧИТАЕТСЯ НАДЁЖНО, А ЧТО НЕТ. Абсолютный урон игрока формулой не
// восстановить: он складывается из базы, уровней, апгрейдов, снаряжения и
// престижа, и попытка описать его одной экспонентой даёт чушь (в первой версии
// этого файла выходило 6.7e22 кликов на врага на 10-й локации — там, где игра
// заведомо сбалансирована). Абсолютных чисел про игрока здесь поэтому НЕТ.
//
// Зато надёжно считается ОТНОШЕНИЕ. В опорной точке оно замерено в живой игре,
// а как оно меняется с глубиной — известно из формул: HP врага растёт как
// hpGrowth^киллы × ступени локаций × глубинные рампы, урон игрока — как
// rewardGrowth^(α·киллы), где α = ln(1.15)/ln(1.21) ≈ 0.73 (цена и отдача
// «Калибра», см. balance.js). Отсюда и кривая.
//
// Запуск: node sim/depth-ttk.mjs
import { BAL } from '../src/data/balance.js'
import { fmt } from '../src/util/format.js'
import { deepRampMul, applyDepthCap, STAT_CAP } from '../src/data/scaling.js'
import { defOf } from '../src/data/bosses.js'
import { getZone, zoneHpMul } from '../src/data/zones.js'

// Опорная точка — с экрана реального игрока.
const REF = { zone: 86, kills: 33029, click: 51.9e15 }


// Убийств к этой локации. У опорного игрока 33 029 на 86-ю — это 384 килла на
// локацию: норма зачистки 100 плюс смерти и повторные заходы.
const KILLS_PER_ZONE = REF.kills / REF.zone
const killsAt = (z) => Math.round(z * KILLS_PER_ZONE)


// HP рядового врага этой локации — по формулам самой игры, но БЕЗ потолка:
// enemyStats его уже применил, поэтому пересобираем HP из тех же множителей.
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

// То же, но с ГЛУБИННЫМ ПРЕДЕЛОМ — ровно как считает бой (BattleScene.makeEnemy).
function enemyHpCapped(z, isBoss = false) {
  const raw = enemyHp(z) * (isBoss ? BAL.bossHpMul : 1)
  return applyDepthCap(killsAt(z), raw, 0, isBoss).hp
}

// Предел берём ИЗ ИГРЫ, а не своим числом: инструмент должен показывать то,
// что происходит на самом деле, а не то, что было при его написании.
const CAP = STAT_CAP
const refHits = enemyHp(REF.zone) / REF.click

console.log('\n=== ГЛУБИНА: враг против игрока ===\n')
console.log(`Опорная точка (замерено в игре): ${REF.zone}-я локация, ${REF.kills} убийств,`)
console.log(`урон клика ${fmt(REF.click)}.`)
console.log(`HP врага БЕЗ потолка: ${fmt(enemyHp(REF.zone))} → ${refHits.toExponential(1)} кликов.`)
const clipped = enemyHp(REF.zone) > CAP
console.log(clipped
  ? `Предел ${CAP.toExponential(0)} режет это до ${(CAP / REF.click).toFixed(2)} клика.`
  : `Предел ${CAP.toExponential(0)} (только от Infinity) здесь НЕ срабатывает — растёт как есть.`)

// По локациям показываем ТОЛЬКО HP — это точные числа из формул игры.
// Колонки «сколько кликов» здесь нет намеренно: она требует знать урон игрока
// на каждой глубине, а его по одной опорной точке не восстановить (первые
// версии этого файла выдавали 3.8e21 кликов на 30-й локации — чистый мусор).
// Клики считаем только в опорной точке, где урон замерен в живой игре.
console.log('| Локация | Убийств | HP рядового | HP босса |')
console.log('|---|---|---|---|')
for (const z of [30, 40, 50, 56, 60, 70, 80, 86, 100, 120]) {
  console.log(`| ${z} | ${fmt(killsAt(z))} | ${fmt(enemyHpCapped(z))} | ${fmt(enemyHpCapped(z, true))} |`)
}

// Опорная точка: цель — 5 кликов по рядовому и 10 по боссу.
const perClick = REF.click * (1 + 0.90 * (5.80 - 1))   // с критом, как у опорного игрока
const n = enemyHpCapped(REF.zone) / perClick
const b = enemyHpCapped(REF.zone, true) / perClick
console.log(`
В опорной точке: ${n.toFixed(1)} кликов по рядовому, ${b.toFixed(1)} по боссу (цель 5 и 10).`)
console.log(Math.abs(n - 5) < 0.6 && Math.abs(b - 10) < 1.2 ? '  ✓ попадание в цель' : '  ✗ мимо цели')
