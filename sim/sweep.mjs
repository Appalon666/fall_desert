// Развёртка по одной крутилке баланса: гоняет balance-sim по списку значений,
// по нескольку независимых партий на значение (разные зёрна), и печатает
// сводку. Нужна, чтобы выбирать число не по одному прогону, а по устойчивой
// картине — разброс между партиями видно сразу.
//
// Запуск:
//   node sim/sweep.mjs enemyLevelTail 1.05 1.1 1.15 1.2
//   BATCHES=5 RUNS=6 node sim/sweep.mjs hpGrowth 1.003 1.0034 1.004
//
// Первый аргумент — имя поля в BAL, дальше значения. Поле восстанавливается
// после каждого значения, так что порядок аргументов ни на что не влияет.

import { BAL } from '../src/data/balance.js'
import { batch } from './balance-sim.mjs'

const BATCHES = process.env.BATCHES ? +process.env.BATCHES : 5
const RUNS = process.env.RUNS ? +process.env.RUNS : 6 // прогонов на класс в партии

// Фон развёртки: правки BAL, действующие для ВСЕХ значений (например, снять
// потолок рампа, чтобы развернуть множитель «на все уровни до конца»).
const OVR = JSON.parse(process.env.OVR || '{}')
Object.assign(BAL, OVR)

const [key, ...vals] = process.argv.slice(2)
if (!key || !vals.length) {
  console.error('Использование: node sim/sweep.mjs <крутилка> <значение> [значение...]')
  process.exit(1)
}
if (!(key in BAL)) {
  console.error(`В BAL нет поля «${key}»`)
  process.exit(1)
}

const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const original = BAL[key]

console.log(`\n=== Развёртка ${key}: ${BATCHES} партий × ${RUNS} прогонов на класс ===`)
console.log(`(исходное значение — ${original})\n`)
console.log('значение | зон/20мин | убийство | босс   | попад./враг | попад./босс | темп ранн→поздн | смертей')
console.log('-'.repeat(100))

const summary = []
for (const raw of vals) {
  const v = Number(raw)
  BAL[key] = v
  const perBatch = []
  for (let b = 0; b < BATCHES; b++) {
    const runs = batch(1000 + b * 9973, RUNS)
    perBatch.push({
      zone: median(runs.map(r => r.zone)),
      ttk: median(runs.map(r => r.ttkEnd)),
      boss: median(runs.map(r => r.bossTtkEnd)),
      hits: median(runs.map(r => r.hitsEnd)),
      bossHits: median(runs.map(r => r.bossHitsEnd)),
      early: median(runs.map(r => r.earlyRate)),
      late: median(runs.map(r => r.lateRate)),
      deaths: median(runs.map(r => r.deaths)),
    })
  }
  const g = k => median(perBatch.map(x => x[k]))
  const zones = perBatch.map(x => x.zone)
  const row = {
    v, zone: g('zone'), ttk: g('ttk'), boss: g('boss'), hits: g('hits'), bossHits: g('bossHits'),
    early: g('early'), late: g('late'), deaths: g('deaths'),
    spread: `${Math.min(...zones)}–${Math.max(...zones)}`,
  }
  summary.push(row)
  console.log(
    `${String(v).padEnd(8)} | ${String(row.zone).padStart(9)} | ${row.ttk.toFixed(1).padStart(7)}s | ${row.boss.toFixed(1).padStart(5)}s | ` +
    `${row.hits.toFixed(1).padStart(11)} | ${row.bossHits.toFixed(0).padStart(11)} | ` +
    `${row.early.toFixed(2)} → ${row.late.toFixed(2)}`.padStart(15) + ` | ${String(row.deaths).padStart(7)}`,
  )
}
BAL[key] = original

// Подсказка: какие значения попали в целевые коридоры симулятора.
console.log('\nВ целевых коридорах (убийство 0.6–6 с, босс 4–15 с, темп не падает):')
const ok = summary.filter(r => r.ttk >= 0.6 && r.ttk <= 6 && r.boss >= 4 && r.boss <= 15 && r.late >= r.early * 0.7)
console.log(ok.length ? ok.map(r => r.v).join(', ') : '— ни одно')
