// Насколько экипировка перебивает баланс. Считает, сколько попаданий нужно
// на рядового врага при полном комплекте разной редкости — без гира, синий
// (rare), фиолетовый (epic), оранжевый (relic).
//
// Зачем отдельный инструмент: balance-sim моделирует ГОЛОГО героя (лут в нём
// не надевается), поэтому все его выводы про «сильный герой / не ваншотит»
// верны только без экипировки. Здесь видно, что с ней происходит.
//
// Запуск: node sim/gear-sim.mjs

import { BAL } from '../src/data/balance.js'
import { RARITIES, itemPower, ITEM_LEVEL_CAP } from '../src/data/loot.js'
import { batch } from './balance-sim.mjs'

// Силу предмета берём из самой игры (itemPower), а не копией формулы — иначе
// инструмент врёт ровно в тот момент, когда формулу правят.
// Уровень предмета = enemyLevel() = 1 + всего убито×0.5 + зона×6.
const itemValue = (rarityMul, itemLevel) => itemPower(rarityMul, itemLevel)
const itemLevelAt = (totalKills, zoneIndex) => 1 + totalKills * 0.5 + zoneIndex * 6

// Слотов, способных нести clickMul: оружие (всегда) + два аксессуара (если
// выпал нужный стат). Считаем лучший случай — «полный инвентарь под урон».
const CLICK_SLOTS = 3

const runs = batch(12345, 8)
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }

// Берём медианное состояние из balance-sim: голый урон клика и HP врага,
// пересчитанные в попадания (это та же метрика, что печатает balance-sim).
const kills = median(runs.map(r => r.kills))
const zone = median(runs.map(r => r.zone))
const hitsBare = median(runs.map(r => r.hitsEnd))
const bossHitsBare = median(runs.map(r => r.bossHitsEnd))
const lvl = itemLevelAt(kills, zone)

console.log(`\n=== ВЛИЯНИЕ ЭКИПИРОВКИ (20 минут игры: ${kills} убийств, зона ${zone + 1}) ===\n`)
console.log(`Уровень выпадающего предмета на этой глубине: ${Math.round(lvl)}`)
console.log(`(формула enemyLevel: 1 + всего убито × 0.5 + зона × 6 — потолка нет)\n`)
console.log('комплект     | бонус слота | ×к урону клика | попаданий на врага | на босса')
console.log('-'.repeat(84))

const rows = [{ id: null, name: 'без экипировки', mul: 0 }, ...RARITIES.map(r => ({ id: r.id, name: r.name, mul: r.mul }))]
for (const r of rows) {
  const per = r.mul ? itemValue(r.mul, lvl) : 0
  const dmgMul = 1 + per * CLICK_SLOTS
  const hits = hitsBare / dmgMul
  const bossHits = bossHitsBare / dmgMul
  const mark = hits < 1 ? '  ← ВАНШОТ' : ''
  console.log(
    `${r.name.padEnd(12)} | ${(per ? '+' + (per * 100).toFixed(0) + '%' : '—').padStart(11)} | ` +
    `${('×' + dmgMul.toFixed(1)).padStart(14)} | ${hits.toFixed(2).padStart(18)} | ${bossHits.toFixed(1).padStart(8)}${mark}`,
  )
}

console.log('\n--- Когда гир перестаёт расти ---')
// Уровень предмета = enemyLevel() и растёт линейно от убийств, поэтому потолок
// берётся почти сразу — дальше множитель от экипировки постоянный. Это и есть
// цель: гир — разовый рывок фиксированного размера, а не бесконечная лестница,
// которая обгоняет или отстаёт от врагов.
for (const k of [50, 100, 200, 1000, 10000]) {
  const L = itemLevelAt(k, Math.floor(k / BAL.zoneKills))
  const mul = 1 + itemValue(3, L) * CLICK_SLOTS
  const capped = L >= ITEM_LEVEL_CAP
  console.log(`  ${String(k).padStart(6)} убийств → уровень предмета ${String(Math.round(L)).padStart(5)}  ` +
    `${capped ? 'потолок' : 'растёт '}  синий комплект ×${mul.toFixed(1)}`)
}
