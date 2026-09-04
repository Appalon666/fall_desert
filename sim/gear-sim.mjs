// Насколько экипировка перебивает баланс. Считает, сколько попаданий нужно
// на рядового врага при полном комплекте разной редкости — без гира, синий
// (rare), фиолетовый (epic), красный (relic).
//
// Комплект СОБИРАЕТСЯ настоящим rollItem, а не считается формулой: у предмета
// теперь несколько статов со случайными добавками (см. STAT_SHARES), и «урон
// клика» набегает не только с оружия. Прикидка «оружие + два аксессуара по
// полному значению» после смешанных статов врала бы в полтора раза.
//
// Зачем отдельный инструмент: balance-sim моделирует ГОЛОГО героя (лут в нём
// не надевается), поэтому все его выводы про «сильный герой / не ваншотит»
// верны только без экипировки. Здесь видно, что с ней происходит.
//
// Запуск: node sim/gear-sim.mjs

import { BAL } from '../src/data/balance.js'
import { RARITIES, itemPower, ITEM_LEVEL_CAP, rollItem, itemStats, EQUIP_KEYS } from '../src/data/loot.js'
import { batch } from './balance-sim.mjs'

// Силу предмета берём из самой игры (itemPower), а не копией формулы — иначе
// инструмент врёт ровно в тот момент, когда формулу правят.
// Уровень предмета = enemyLevel() = 1 + всего убито×0.5 + зона×6.
const itemValue = (rarityMul, itemLevel) => itemPower(rarityMul, itemLevel)
const itemLevelAt = (totalKills, zoneIndex) => 1 + totalKills * 0.5 + zoneIndex * 6

// Полный комплект: по предмету в каждое гнездо. Возвращает сумму бонусов по
// каждому стату — ровно то, что делает GameState.equipSum.
const SLOT_OF = { weapon: 'weapon', helmet: 'helmet', armor: 'armor', boots: 'boots', acc1: 'accessory', acc2: 'accessory' }
function setBonus(rng, rarityId, level) {
  const sum = { clickMul: 0, hpMul: 0, critChance: 0, allyMul: 0, capsMul: 0 }
  for (const key of EQUIP_KEYS) {
    const it = rollItem(rng, level, 0, rarityId, SLOT_OF[key])
    for (const st of itemStats(it)) sum[st.stat] += st.value
  }
  return sum
}
// Усредняем по многим комплектам: вторые статы случайны, один бросок ничего не
// говорит. RNG детерминированный — числа воспроизводимы между запусками.
const SETS = 4000
function avgSet(rarityId, level) {
  const rng = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(20260904)
  const acc = { clickMul: 0, hpMul: 0, critChance: 0, allyMul: 0, capsMul: 0 }
  for (let i = 0; i < SETS; i++) {
    const one = setBonus(rng, rarityId, level)
    for (const k in acc) acc[k] += one[k]
  }
  for (const k in acc) acc[k] /= SETS
  return acc
}

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
console.log('комплект     | главный стат | урон клика | HP  | крит  | союзн | крышки | попаданий | босс')
console.log('-'.repeat(100))

const rows = [{ id: null, name: 'без экипировки', mul: 0 }, ...RARITIES.map(r => ({ id: r.id, name: r.name, mul: r.mul }))]
for (const r of rows) {
  const per = r.mul ? itemValue(r.mul, lvl) : 0
  const s = r.id ? avgSet(r.id, lvl) : { clickMul: 0, hpMul: 0, critChance: 0, allyMul: 0, capsMul: 0 }
  const dmgMul = 1 + s.clickMul
  const hits = hitsBare / dmgMul
  const bossHits = bossHitsBare / dmgMul
  const mark = hits < 1 ? '  ← ВАНШОТ' : ''
  const pct = (v) => (v ? '+' + (v * 100).toFixed(0) + '%' : '—')
  console.log(
    `${r.name.padEnd(12)} | ${(per ? '+' + (per * 100).toFixed(0) + '%' : '—').padStart(12)} | ` +
    `${('×' + dmgMul.toFixed(2)).padStart(10)} | ${pct(s.hpMul).padStart(5)} | ` +
    `${(s.critChance ? '+' + (s.critChance * 100).toFixed(1) + '%' : '—').padStart(6)} | ` +
    `${pct(s.allyMul).padStart(5)} | ${pct(s.capsMul).padStart(6)} | ` +
    `${hits.toFixed(2).padStart(9)} | ${bossHits.toFixed(1).padStart(5)}${mark}`,
  )
}
console.log('\n«главный стат» — сколько даёт ПЕРВЫЙ стат одного предмета этого тира;')
console.log('остальные колонки — сумма по всему комплекту из шести предметов.')

console.log('\n--- Когда гир перестаёт расти ---')
// Уровень предмета = enemyLevel() и растёт линейно от убийств, поэтому потолок
// берётся почти сразу — дальше множитель от экипировки постоянный. Это и есть
// цель: гир — разовый рывок фиксированного размера, а не бесконечная лестница,
// которая обгоняет или отстаёт от врагов.
for (const k of [50, 100, 200, 1000, 10000]) {
  const L = itemLevelAt(k, Math.floor(k / BAL.zoneKills))
  const mul = 1 + avgSet('rare', L).clickMul
  const capped = L >= ITEM_LEVEL_CAP
  console.log(`  ${String(k).padStart(6)} убийств → уровень предмета ${String(Math.round(L)).padStart(5)}  ` +
    `${capped ? 'потолок' : 'растёт '}  синий комплект ×${mul.toFixed(1)}`)
}
