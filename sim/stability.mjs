// Устойчивость баланса: гоняет N независимых партий и ищет ПАТОЛОГИИ, а не
// «красивое среднее». Одна партия может случайно выглядеть хорошо; здесь видно
// разброс между партиями и худший случай по каждому классу.
//
// Ловит: смерть-спираль, застревание в зоне, падение темпа, «слабый герой»
// (слишком много кликов на врага), ваншот и разрыв между классами.
//
// Запуск: node sim/stability.mjs     (N=40 node sim/stability.mjs — точнее)

import { CLASSES } from '../src/data/classes.js'
import { batch } from './balance-sim.mjs'

const N = +(process.env.N || 20)
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const f = (x, d = 1) => Number(x).toFixed(d)

const batches = []
for (let b = 0; b < N; b++) batches.push(batch(4000 + b * 7919, 6))

console.log(`\n=== УСТОЙЧИВОСТЬ: ${N} партий по ${batches[0].length} прогонов ===\n`)
console.log('Класс      | зона (мин–макс) | попад. | босс | смертей (макс) | темп ранн→поздн')
console.log('-'.repeat(92))
const problems = []
for (const cls of CLASSES) {
  const per = batches.map(bt => bt.filter(r => r.classId === cls.id))
  const zones = per.map(rs => med(rs.map(r => r.zone)))
  const hits = per.map(rs => med(rs.map(r => r.hitsEnd)))
  const bh = per.map(rs => med(rs.map(r => r.bossHitsEnd)))
  const deaths = per.map(rs => med(rs.map(r => r.deaths)))
  const early = per.map(rs => med(rs.map(r => r.earlyRate)))
  const late = per.map(rs => med(rs.map(r => r.lateRate)))
  console.log(
    `${cls.name.padEnd(10)} | ${String(med(zones)).padStart(4)} (${Math.min(...zones)}–${Math.max(...zones)})`.padEnd(31) +
    ` | ${f(med(hits)).padStart(6)} | ${f(med(bh), 0).padStart(4)} | ${f(med(deaths), 1).padStart(6)} (${Math.max(...deaths)})`.padEnd(24) +
    ` | ${f(med(early), 2)} → ${f(med(late), 2)}`,
  )
  if (Math.max(...deaths) > 8) problems.push(`${cls.name}: до ${Math.max(...deaths)} смертей за 20 мин (смерть-спираль)`)
  if (med(zones) < 3) problems.push(`${cls.name}: медиана всего ${med(zones)} зон — застревает`)
  if (med(late) < med(early) * 0.7) problems.push(`${cls.name}: темп падает ${f(med(early), 2)} → ${f(med(late), 2)}`)
  if (med(hits) > 14) problems.push(`${cls.name}: ${f(med(hits))} попаданий на врага — герой ощущается слабым`)
  if (med(hits) < 3) problems.push(`${cls.name}: ${f(med(hits))} попаданий — почти ваншот`)
}

// Разрыв между классами — главный источник «одним классом играть нельзя».
const all = CLASSES.map(c => ({ c, kills: med(batches.flat().filter(r => r.classId === c.id).map(r => r.kills)) }))
const best = all.reduce((a, b) => a.kills > b.kills ? a : b)
const worst = all.reduce((a, b) => a.kills < b.kills ? a : b)
console.log(`\nРазрыв классов по убийствам: ${best.c.name} ${Math.round(best.kills)} против ${worst.c.name} ${Math.round(worst.kills)} = ×${f(best.kills / worst.kills, 2)}`)
if (best.kills / worst.kills > 1.6) problems.push(`разрыв классов ×${f(best.kills / worst.kills, 2)} — слабый класс отстаёт заметно`)

console.log(problems.length ? '\n⚠️ Слабые места:\n' + problems.map(p => '  - ' + p).join('\n') : '\n✅ Патологий не найдено')
