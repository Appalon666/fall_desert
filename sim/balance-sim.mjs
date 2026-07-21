// Headless-симуляция баланса. Моделирует активную игру по тем же формулам,
// что и GameState (без Phaser). Гоняет 100 прогонов (по 25 на класс),
// собирает метрики темпа/выживания/экономики и печатает анализ.
//
// Запуск: node sim/balance-sim.mjs

import { BAL } from '../src/data/balance.js'
import { ENEMIES } from '../src/data/enemies.js'
import { enemyStats } from '../src/data/scaling.js'
import { getZone } from '../src/data/zones.js'
import { UPGRADES, upgradeCost } from '../src/data/upgrades.js'
import { ALLIES, allyCost } from '../src/data/allies.js'
import { CLASSES, CLASS_BY_ID } from '../src/data/classes.js'

const SESSION = 1200 // секунд активной игры за прогон (20 мин)
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
    zoneIndex: 0, killsInZone: 0, totalKills: 0, combo: 0, hp: 0, deaths: 0,
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

  function spend() {
    let bought = true
    while (bought) {
      bought = false
      // Разумный игрок: держит броню (hp) вблизи уровня урона, чтобы не спиралить в смерти.
      const wantHp = upgLevel('hp') < upgLevel('damage') - 1
      let hpCand = null, cheapest = null
      for (const u of UPGRADES) {
        const c = upgradeCost(u, upgLevel(u.id))
        if (c <= st.caps) {
          if (u.id === 'hp') hpCand = { type: 'u', ref: u, cost: c }
          if (!cheapest || c < cheapest.cost) cheapest = { type: 'u', ref: u, cost: c }
        }
      }
      for (const a of ALLIES) { const c = allyCost(a, st.allies[a.id] || 0); if (c <= st.caps && (!cheapest || c < cheapest.cost)) cheapest = { type: 'a', ref: a, cost: c } }
      const pick = (wantHp && hpCand) ? hpCand : cheapest
      if (pick) {
        st.caps -= pick.cost
        if (pick.type === 'u') st.upgrades[pick.ref.id] = upgLevel(pick.ref.id) + 1
        else st.allies[pick.ref.id] = (st.allies[pick.ref.id] || 0) + 1
        bought = true
      }
    }
  }
  function allocate() { while (st.hero.points > 0) { const pick = st.hero.str <= st.hero.vit * 2 ? 'str' : 'vit'; st.hero[pick]++; st.hero.points-- } }

  let spawnCount = 0, enemy = null
  const durations = []
  let curStart = 0
  function spawn(t) {
    spawnCount++
    const isBoss = spawnCount % BAL.bossEvery === 0
    const pool = getZone(st.zoneIndex).enemies
    const def = ENEMIES[pool[Math.floor(rng() * pool.length)]]
    const { hp, reward, dmg } = enemyStats(def, st.totalKills, isBoss)
    const speed = BAL.enemySpeed * def.speedMul * (isBoss ? 0.7 : 1)
    const approachTime = Math.max(0, (710 - BAL.enemyAttackRange) / speed)
    enemy = { hp, maxHp: hp, reward, dmg, approachTime, attackAccum: 0, isBoss }
    curStart = t
  }
  function kill(t) {
    st.caps += Math.ceil(enemy.reward * (1 + capsBonus()))
    st.hero.xp += Math.ceil(enemy.reward * 0.6)
    while (st.hero.xp >= xpNeed()) { st.hero.xp -= xpNeed(); st.hero.level++; st.hero.points += BAL.pointsPerLevel }
    st.totalKills++; st.killsInZone++
    if (st.killsInZone >= BAL.zoneKills) { st.zoneIndex++; st.killsInZone = 0 }
    durations.push(t - curStart)
    enemy = null
  }
  function heroDie() { st.deaths++; st.killsInZone = 0; st.hp = heroMaxHp(); st.combo = 0; spawnCount = 0; enemy = null }

  const cps = 3 + rng() * 2, acc = 0.9
  let clickAccum = 0, sinceSpend = 0
  const checkpoints = {} // t -> totalKills
  spawn(0)

  for (let t = 0; t < SESSION; t += DT) {
    if (!enemy) spawn(t)
    clickAccum += cps * acc * DT
    while (clickAccum >= 1 && enemy) {
      clickAccum -= 1; st.combo++
      enemy.hp -= clickHit()
      if (enemy.hp <= 0) kill(t)
    }
    if (enemy) { enemy.hp -= allyDps() * DT; if (enemy.hp <= 0) kill(t) }
    if (enemy) {
      enemy.approachTime -= DT
      if (enemy.approachTime <= 0) {
        enemy.attackAccum += DT
        const rate = BAL.enemyAttackRate / 1000
        while (enemy.attackAccum >= rate) { enemy.attackAccum -= rate; st.hp -= enemy.dmg; if (st.hp <= 0) { heroDie(); break } }
      }
    }
    sinceSpend += DT
    if (sinceSpend >= 1) { sinceSpend = 0; allocate(); spend() }
    const tc = Math.round(t)
    if (tc % 120 === 0 && !(tc in checkpoints)) checkpoints[tc] = st.totalKills
  }

  const effDps = cps * acc * clickHit() + allyDps()
  const avgDef = { hpMul: 1, rewardMul: 1, dmgMul: 1, speedMul: 1 }
  const typicalHp = enemyStats(avgDef, st.totalKills, false).hp
  const ttkEnd = typicalHp / effDps
  const bossTtkEnd = enemyStats(avgDef, st.totalKills, true).hp / effDps
  const earlyRate = (checkpoints[120] || st.totalKills) / 120
  const lateRate = (st.totalKills - (checkpoints[1080] || st.totalKills)) / 120
  const lateDur = durations.slice(-30)
  const avgLateDur = lateDur.reduce((s, d) => s + d, 0) / (lateDur.length || 1)

  return {
    classId, kills: st.totalKills, zone: st.zoneIndex, deaths: st.deaths, level: st.hero.level,
    caps: st.caps, clickDmg: clickHit(), allyDps: allyDps(),
    effDps, ttkEnd, bossTtkEnd, earlyRate, lateRate, avgLateDur,
  }
}

function median(arr) { const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const SUF = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag']
function fmt(n) {
  if (n < 1000) return n.toFixed(n < 10 ? 1 : 0)
  let t = 0; let v = n
  while (v >= 1000 && t < SUF.length - 1) { v /= 1000; t++ }
  return `${v.toFixed(1)}${SUF[t]}`
}

const all = []
let seed = 12345
for (const cls of CLASSES) {
  for (let i = 0; i < RUNS_PER_CLASS; i++) all.push(runOne(cls.id, mulberry32(seed++)))
}

console.log(`\n=== БАЛАНС: ${all.length} прогонов по ${SESSION / 60} мин активной игры ===\n`)
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
console.log(`Медиана зон достигнуто: ${gz}   (цель: 3-6)`)
console.log(`Медиана смертей: ${gd}   (цель: 1-4, риск есть, но не спираль)`)
console.log(`TTK обычного врага в конце: ${gttk.toFixed(1)}s   (цель: 0.5-3s)`)
console.log(`TTK босса в конце: ${gbttk.toFixed(1)}s   (цель: 3-12s)`)
console.log(`Темп ранний/поздний (kills/сек): ${early.toFixed(2)} / ${late.toFixed(2)}   (поздний не должен рушиться)`)
const stall = late < early * 0.4
console.log(`Стагнация прогресса: ${stall ? '⚠️  ДА (поздний темп < 40% раннего)' : 'нет'}`)
console.log(`Разброс классов по убийствам: ${fmt(Math.min(...CLASSES.map(c => median(all.filter(r => r.classId === c.id).map(r => r.kills)))))} … ${fmt(Math.max(...CLASSES.map(c => median(all.filter(r => r.classId === c.id).map(r => r.kills)))))}`)
