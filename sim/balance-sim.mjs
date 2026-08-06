// Headless-симуляция баланса. Моделирует активную игру по тем же формулам,
// что и GameState (без Phaser), НО в волновой модели: волна из нескольких
// врагов, зона из wavesPerZone волн (последняя — боссовая).
// Гоняет прогоны по классам, собирает метрики темпа/выживания/экономики.
//
// Запуск: node sim/balance-sim.mjs

import { BAL } from '../src/data/balance.js'
import { defOf } from '../src/data/bosses.js'
import { enemyStats } from '../src/data/scaling.js'
import { getZone, zoneHpMul } from '../src/data/zones.js'
import { UPGRADES, upgradeCost } from '../src/data/upgrades.js'
import { ALLIES, allyCost } from '../src/data/allies.js'
import { CLASSES, CLASS_BY_ID } from '../src/data/classes.js'
import { enemiesInWave, bossDue, zoneKillsFor, xpFromKill } from '../src/data/progression.js'
import { pathToFileURL } from 'node:url'

const SESSION = process.env.SIM_SECONDS ? +process.env.SIM_SECONDS : 1200 // сек за прогон (env: SIM_SECONDS)
const DT = 0.1
const RUNS_PER_CLASS = 25

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function runOne(classId, rng) {
  const cls = CLASS_BY_ID[classId]
  const st = {
    caps: 0,
    hero: { level: 1, xp: 0, points: 0, str: cls.startStats.str, vit: cls.startStats.vit, luck: cls.startStats.luck },
    upgrades: {}, allies: { ...cls.startAllies },
    zoneIndex: 0, killsInZone: 0, totalKills: 0, combo: 0, hp: 0, deaths: 0, ult: 0, bossActive: false, waveCount: 0,
  }
  const upgLevel = id => st.upgrades[id] || 0
  const upgAdd = stat => UPGRADES.reduce((s, u) => (u.kind === 'add' && u.stat === stat) ? s + upgLevel(u.id) * u.perLevel : s, 0)
  const upgPow = stat => UPGRADES.reduce((p, u) => (u.kind === 'pow' && u.stat === stat) ? p * Math.pow(u.mul, upgLevel(u.id)) : p, 1)
  const cb = stat => cls.bonus[stat] || 0
  const comboMult = () => Math.min(BAL.comboMax, 1 + Math.floor(st.combo / BAL.comboHitsPerStep) * BAL.comboStep)
  const clickFlat = () => BAL.baseClickDamage + st.hero.str * BAL.perStrength
  const clickMul = () => 1 + upgAdd('clickMul') + cb('clickMul')
  const critChance = () => Math.min(0.9, BAL.baseCritChance + st.hero.luck * BAL.perLuckCrit + upgAdd('critChance') + cb('critChance'))
  const critEV = () => 1 + critChance() * (BAL.critMultiplier - 1)
  const clickHit = () => clickFlat() * clickMul() * upgPow('clickPow') * comboMult() * critEV()
  const heroMaxHp = () => Math.floor((BAL.baseHeroHp + st.hero.vit * BAL.perVitality) * (1 + cb('hpMul')) * upgPow('hpPow'))
  const allyDps = () => { let b = 0; for (const a of ALLIES) b += (st.allies[a.id] || 0) * a.dps; return b * (1 + upgAdd('allyMul') + cb('allyMul')) * upgPow('allyPow') }
  const capsBonus = () => cb('capsMul')
  const xpNeed = () => Math.floor(BAL.baseXpToLevel * Math.pow(BAL.xpGrowth, st.hero.level - 1))

  st.hp = heroMaxHp()

  // Модель трат. SIM_PLAYER=dps (по умолчанию) — урон в приоритете; =even —
  // «всё поровну»: очки веером по трём статам, крышки в самый отстающий
  // апгрейд. Вторая модель нужна, чтобы проверять крутилки, завязанные на
  // УРОВЕНЬ героя: при них осмысленный игрок может играть иначе, и вывод про
  // крутилку не должен зависеть от одной-единственной стратегии.
  function spendEven() {
    let bought = true
    while (bought) {
      bought = false
      // самый отстающий апгрейд (при равенстве — самый дешёвый)
      let pick = null
      for (const u of UPGRADES) {
        const c = upgradeCost(u, upgLevel(u.id))
        if (c > st.caps) continue
        if (!pick || upgLevel(u.id) < pick.lvl || (upgLevel(u.id) === pick.lvl && c < pick.cost)) {
          pick = { type: 'u', ref: u, cost: c, lvl: upgLevel(u.id) }
        }
      }
      // союзники тоже часть «всех статов»: берём, если отстают от апгрейдов
      const allyTotal = ALLIES.reduce((n, a) => n + (st.allies[a.id] || 0), 0)
      const upgTotal = UPGRADES.reduce((n, u) => n + upgLevel(u.id), 0)
      if (allyTotal * UPGRADES.length < upgTotal) {
        for (const a of ALLIES) {
          const c = allyCost(a, st.allies[a.id] || 0)
          if (c <= st.caps && (!pick || c < pick.cost)) pick = { type: 'a', ref: a, cost: c, lvl: 0 }
        }
      }
      if (pick) {
        st.caps -= pick.cost
        if (pick.type === 'u') st.upgrades[pick.ref.id] = upgLevel(pick.ref.id) + 1
        else st.allies[pick.ref.id] = (st.allies[pick.ref.id] || 0) + 1
        bought = true
      }
    }
  }
  // Очки веером: самый отстающий из трёх статов.
  function allocateEven() {
    while (st.hero.points > 0) {
      const h = st.hero
      const pick = h.str <= h.vit && h.str <= h.luck ? 'str' : (h.vit <= h.luck ? 'vit' : 'luck')
      h[pick]++
      h.points--
    }
  }

  // Агрессивный DPS-игрок: урон в приоритете, немного HP «на выживание».
  function spend() {
    let bought = true
    while (bought) {
      bought = false
      const dmgU = UPGRADES.find(u => u.id === 'damage')
      const dCost = upgradeCost(dmgU, upgLevel('damage'))
      // немного HP: держим брони ~треть от уровня урона
      const hpU = UPGRADES.find(u => u.id === 'hp')
      const hCost = upgradeCost(hpU, upgLevel('hp'))
      if (upgLevel('hp') < upgLevel('damage') * 0.35 && hCost <= st.caps) { st.caps -= hCost; st.upgrades.hp = upgLevel('hp') + 1; bought = true; continue }
      if (dCost <= st.caps) { st.caps -= dCost; st.upgrades.damage = upgLevel('damage') + 1; bought = true; continue }
      // остаток — в самое дешёвое (крит/картечь/союзники)
      let cheapest = null
      for (const u of UPGRADES) { const c = upgradeCost(u, upgLevel(u.id)); if (c <= st.caps && (!cheapest || c < cheapest.cost)) cheapest = { type: 'u', ref: u, cost: c } }
      for (const a of ALLIES) { const c = allyCost(a, st.allies[a.id] || 0); if (c <= st.caps && (!cheapest || c < cheapest.cost)) cheapest = { type: 'a', ref: a, cost: c } }
      if (cheapest) { st.caps -= cheapest.cost; if (cheapest.type === 'u') st.upgrades[cheapest.ref.id] = upgLevel(cheapest.ref.id) + 1; else st.allies[cheapest.ref.id] = (st.allies[cheapest.ref.id] || 0) + 1; bought = true }
    }
  }
  // Реальный игрок льёт очки в СИЛУ (немного в живучесть, чтобы не спираль).
  function allocate() { while (st.hero.points > 0) { const pick = st.hero.vit < st.hero.str * 0.2 ? 'vit' : 'str'; st.hero[pick]++; st.hero.points-- } }
  const EVEN = process.env.SIM_PLAYER === 'even'
  const doSpend = EVEN ? spendEven : spend
  const doAllocate = EVEN ? allocateEven : allocate
  // Прогрессия HP врагов по уровню/зоне (как в GameState.enemyProgMul).
  const progMul = () => {
    const lv = st.hero.level - 1
    return Math.pow(BAL.enemyLevelRamp, Math.min(lv, BAL.enemyLevelRampCap))
      * Math.pow(BAL.enemyLevelTail, Math.max(0, lv - BAL.enemyLevelRampCap))
      * zoneHpMul(st.zoneIndex)
  }

  // ---- волна из нескольких врагов / босс-ворота ----
  let wave = []          // живые враги текущей волны
  function spawnWave() {
    st.waveCount++ // +1% к врагам за волну
    const boss = !st.bossActive && bossDue(st.killsInZone)
    if (boss) st.bossActive = true
    const count = boss ? 1 : enemiesInWave(st.zoneIndex, st.killsInZone)
    const z = getZone(st.zoneIndex); const pool = boss ? z.bosses : z.enemies; const af = z.affix || { hp: 1, dmg: 1, rew: 1, spd: 1 }
    wave = []
    for (let i = 0; i < count; i++) {
      const def = defOf(pool[Math.floor(rng() * pool.length)])
      const b = enemyStats(def, st.totalKills, boss)
      const prog = progMul()   // у босса та же прогрессия, жирность — в bossHpMul
      const wv = Math.pow(BAL.enemyWaveRamp, st.waveCount)
      const hp = b.hp * af.hp * prog * wv, reward = b.reward * af.rew, dmg = b.dmg * af.dmg * wv
      const speed = BAL.enemySpeed * def.speedMul * (boss ? 0.7 : 1) * af.spd
      const approach = boss ? 0.3 : Math.max(0, (710 - BAL.enemyAttackRange) / speed) + i * 0.6
      wave.push({ hp, maxHp: hp, reward, dmg, approach, attackAccum: 0, boss })
    }
  }
  function killFront(front) {
    st.caps += Math.ceil(front.reward * (1 + capsBonus()))
    st.hero.xp += xpFromKill(st.totalKills)
    while (st.hero.xp >= xpNeed()) { st.hero.xp -= xpNeed(); st.hero.level++; st.hero.points += BAL.pointsPerLevel }
    st.ult = Math.min(BAL.ultMax, st.ult + BAL.ultChargePerKill)
    if (front.boss) { st.totalKills++; st.bossActive = false; st.zoneIndex++; st.killsInZone = 0; st.waveCount = 0 }
    else { st.totalKills++; st.killsInZone++ }
  }
  function heroDie() { st.deaths++; if (!st.bossActive) st.killsInZone = Math.max(0, st.killsInZone - Math.ceil(zoneKillsFor() * BAL.deathZoneLoss)); st.waveCount = 0; st.bossActive = false; st.hp = heroMaxHp(); st.combo = 0; wave = [] }

  const pierce = cls.pierce || 1
  const lifesteal = cls.lifesteal || 0
  const cps = 3 + rng() * 2, acc = 0.9
  let clickAccum = 0, sinceSpend = 0
  const durations = []; let curStart = 0
  const checkpoints = {}
  doAllocate(); doSpend()
  spawnWave(); curStart = 0

  for (let t = 0; t < SESSION; t += DT) {
    if (wave.length === 0) { spawnWave(); curStart = t }
    // фокус-огонь по переднему живому (wave[0] — он же цель пробития ниже)
    clickAccum += cps * acc * DT
    while (clickAccum >= 1 && wave.length) {
      clickAccum -= 1; st.combo++
      st.ult = Math.min(BAL.ultMax, st.ult + BAL.ultChargePerHit)
      const dmg = clickHit()
      if (lifesteal > 0 && st.hp < heroMaxHp()) st.hp = Math.min(heroMaxHp(), st.hp + dmg * lifesteal)
      // пробитие: урон по нескольким передним врагам
      for (let p = 0; p < pierce && p < wave.length; p++) wave[p].hp -= dmg
      // Картечь: разлёт части урона по врагам сзади
      const sp = upgAdd('splash')
      if (sp > 0) for (let k = pierce; k < wave.length && k < pierce + 3; k++) wave[k].hp -= dmg * sp
      for (let k = 0; k < wave.length;) { if (wave[k].hp <= 0) { killFront(wave[k]); wave.splice(k, 1) } else k++ }
    }
    // союзники — тоже по переднему
    if (wave.length) { wave[0].hp -= allyDps() * DT; if (wave[0].hp <= 0) { killFront(wave[0]); wave.shift() } }
    // ульта — AoE по всем, когда заряжена (разумный игрок жмёт сразу)
    if (st.ult >= BAL.ultMax && wave.length) {
      st.ult = 0
      const dmg = clickHit() / comboMult() * BAL.ultDamageMul
      for (const e of wave) e.hp -= dmg
      for (let i = wave.length - 1; i >= 0; i--) if (wave[i].hp <= 0) { killFront(wave[i]); wave.splice(i, 1) }
    }
    if (wave.length === 0) { durations.push(t - curStart); continue }
    // угроза: каждый подошедший враг бьёт
    for (const e of wave) {
      e.approach -= DT
      if (e.approach <= 0) {
        e.attackAccum += DT
        const rate = BAL.enemyAttackRate / 1000
        while (e.attackAccum >= rate) { e.attackAccum -= rate; st.hp -= e.dmg; if (st.hp <= 0) { heroDie(); break } }
      }
      if (st.hp <= 0) break
    }
    sinceSpend += DT
    if (sinceSpend >= 1) { sinceSpend = 0; doAllocate(); doSpend() }
    const tc = Math.round(t)
    if (tc % 120 === 0 && !(tc in checkpoints)) checkpoints[tc] = st.totalKills
  }

  const effDps = cps * acc * clickHit() + allyDps()
  const avgDef = { hpMul: 1, rewardMul: 1, dmgMul: 1, speedMul: 1 }
  const wvEnd = Math.pow(BAL.enemyWaveRamp, st.waveCount)
  const typicalHp = enemyStats(avgDef, st.totalKills, false).hp * progMul() * wvEnd
  const ttkEnd = typicalHp / effDps
  // Попаданий на врага ТОЛЬКО кликами (без союзников и ульты) — это и есть
  // ощущение «сильный герой, но не ваншотит всех подряд». Секунды сами по себе
  // врут: одно и то же время убийства при слабом клике и толпе союзников
  // ощущается как «я ничего не решаю».
  const hitsEnd = typicalHp / clickHit()
  const bossHitsEnd = enemyStats(avgDef, st.totalKills, true).hp * progMul() * wvEnd / clickHit()
  const bossTtkEnd = enemyStats(avgDef, st.totalKills, true).hp * progMul() * wvEnd / effDps
  const earlyRate = (checkpoints[120] || st.totalKills) / 120
  const lateRate = (st.totalKills - (checkpoints[1080] || st.totalKills)) / 120

  return {
    classId, kills: st.totalKills, zone: st.zoneIndex, deaths: st.deaths, level: st.hero.level,
    caps: st.caps, clickDmg: clickHit(), allyDps: allyDps(), effDps, ttkEnd, bossTtkEnd, hitsEnd, bossHitsEnd, earlyRate, lateRate,
  }
}

function median(arr) { const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const SUF = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag']
function fmt(n) {
  if (!Number.isFinite(n)) return '∞'
  if (n < 1000) return n.toFixed(n < 10 ? 1 : 0)
  let t = 0; let v = n
  while (v >= 1000 && t < SUF.length - 1) { v /= 1000; t++ }
  return `${v.toFixed(1)}${SUF[t]}`
}

// runOne/mulberry32 экспортируем, чтобы развёртки по параметрам (sweep) гоняли
// ту же самую модель, а не свою копию. Печать таблицы — только при прямом
// запуске `node sim/balance-sim.mjs`, иначе импорт засорял бы вывод.
export { runOne, mulberry32 }

export function batch(seedBase = 12345, runsPerClass = RUNS_PER_CLASS) {
  const out = []
  let seed = seedBase
  for (const cls of CLASSES) {
    for (let i = 0; i < runsPerClass; i++) out.push(runOne(cls.id, mulberry32(seed++)))
  }
  return out
}

const DIRECT = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (!DIRECT) { /* импортировали ради runOne/batch — таблицу не печатаем */ } else {

const all = batch()

console.log(`\n=== БАЛАНС: ${all.length} прогонов по ${SESSION / 60} мин активной игры (волновая модель) ===\n`)
console.log('Класс      | Убийства | Зона | Смертей | Ур. | Крышки | ЛКМ-урон | Idle/с | TTK  | TTKбосс | ранн/поздн kps')
console.log('-'.repeat(108))
for (const cls of CLASSES) {
  const runs = all.filter(r => r.classId === cls.id)
  const g = k => median(runs.map(r => r[k]))
  console.log(
    `${cls.name.padEnd(10)} | ${String(Math.round(g('kills'))).padStart(8)} | ${String(g('zone')).padStart(4)} | ${String(g('deaths')).padStart(7)} | ${String(g('level')).padStart(3)} | ${fmt(g('caps')).padStart(6)} | ${fmt(g('clickDmg')).padStart(8)} | ${fmt(g('allyDps')).padStart(6)} | ${g('ttkEnd').toFixed(1).padStart(4)}s | ${g('bossTtkEnd').toFixed(1).padStart(6)}s | ${g('earlyRate').toFixed(2)}/${g('lateRate').toFixed(2)}`,
  )
}

const gz = median(all.map(r => r.zone))
const gd = median(all.map(r => r.deaths))
const gttk = median(all.map(r => r.ttkEnd))
const gbttk = median(all.map(r => r.bossTtkEnd))
const early = median(all.map(r => r.earlyRate))
const late = median(all.map(r => r.lateRate))
console.log('\n--- Диагностика ---')
console.log(`Медиана зон достигнуто за 20 мин: ${gz}   (цель: 4-6 — десять локаций примерно за 40 минут, дальше мета-петля)`)
console.log(`Медиана смертей: ${gd}   (цель: 1-5, риск есть, но не спираль)`)
console.log(`TTK обычного врага в конце: ${gttk.toFixed(1)}s   (цель: 0.6-3s)`)
console.log(`TTK босса зоны в конце: ${gbttk.toFixed(1)}s   (цель: 4-15s)`)
console.log(`Попаданий кликом на рядового врага: ${median(all.map(r => r.hitsEnd)).toFixed(1)}   (цель: 3-8 — сильный герой, но не ваншот)`)
console.log(`Попаданий кликом на босса: ${median(all.map(r => r.bossHitsEnd)).toFixed(0)}   (цель: 15-45)`)
console.log(`Темп ранний/поздний (kills/сек): ${early.toFixed(2)} / ${late.toFixed(2)}`)
console.log(`Стагнация: ${late < early * 0.4 ? '⚠️ ДА' : 'нет'}`)
console.log(`Макс. крышки (читаемость чисел): ${fmt(Math.max(...all.map(r => r.caps)))}   (не должно быть ∞/e+30)`)

}
