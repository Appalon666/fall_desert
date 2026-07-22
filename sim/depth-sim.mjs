// Глубинная симуляция: 10 прогонов по 2 часа активной игры С УЧЁТОМ ПРЕСТИЖА.
// Цель — понять реальную длительность/глубину: сколько контента, когда потолок,
// работает ли мета-петля престижа, где наступает скука.
//
// Запуск: node sim/depth-sim.mjs

import { BAL } from '../src/data/balance.js'
import { ENEMIES } from '../src/data/enemies.js'
import { enemyStats } from '../src/data/scaling.js'
import { getZone } from '../src/data/zones.js'
import { ZONES } from '../src/data/zones.js'
import { UPGRADES, upgradeCost } from '../src/data/upgrades.js'
import { ALLIES, allyCost } from '../src/data/allies.js'
import { CLASSES, CLASS_BY_ID } from '../src/data/classes.js'

const SESSION = 7200 // 2 часа
const DT = 0.2
const RUNS = 10

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
  // мета (сохраняется между престижами)
  const meta = { cores: 0, prestige: { legacy: 0, stash: 0, vitality: 0, quickstart: 0 }, prestigeCount: 0 }

  const prestigeDmgMul = () => 1 + meta.prestige.legacy * 0.10
  const prestigeHpMul = () => meta.prestige.vitality * 0.08
  const prestigeCapsMul = () => meta.prestige.stash * 0.10
  const prestigeCost = (id) => { const b = { legacy: 2, stash: 2, vitality: 2, quickstart: 3 }; return Math.floor(b[id] * Math.pow(1.6, meta.prestige[id] || 0)) }

  let st
  function freshRun() {
    st = {
      caps: meta.prestige.quickstart * 500,
      hero: { level: 1, xp: 0, points: 0, str: cls.startStats.str, vit: cls.startStats.vit, luck: cls.startStats.luck },
      upgrades: {}, allies: { ...cls.startAllies },
      zoneIndex: 0, killsInZone: 0, totalKills: 0, combo: 0, hp: 0, deaths: 0,
    }
    st.hp = heroMaxHp()
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
  const clickHit = () => clickFlat() * clickMul() * upgPow('clickPow') * comboMult() * critEV() * prestigeDmgMul()
  const heroMaxHp = () => Math.floor((BAL.baseHeroHp + st.hero.vit * BAL.perVitality) * (1 + cb('hpMul') + prestigeHpMul()) * upgPow('hpPow'))
  const allyDps = () => { let b = 0; for (const a of ALLIES) b += (st.allies[a.id] || 0) * a.dps; return b * (1 + upgAdd('allyMul') + cb('allyMul')) * upgPow('allyPow') }
  const capsBonus = () => cb('capsMul') + prestigeCapsMul()
  const xpNeed = () => Math.floor(BAL.baseXpToLevel * Math.pow(BAL.xpGrowth, st.hero.level - 1))
  const coresFromRun = () => Math.floor(Math.pow(Math.max(0, st.totalKills) / 60, 0.8))

  function spend() {
    let bought = true
    while (bought) {
      bought = false
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
      if (pick) { st.caps -= pick.cost; if (pick.type === 'u') st.upgrades[pick.ref.id] = upgLevel(pick.ref.id) + 1; else st.allies[pick.ref.id] = (st.allies[pick.ref.id] || 0) + 1; bought = true }
    }
  }
  function allocate() { while (st.hero.points > 0) { const pick = st.hero.str <= st.hero.vit * 2 ? 'str' : 'vit'; st.hero[pick]++; st.hero.points-- } }
  // Разумный игрок: покупает престиж-бонусы на ядра сразу как хватает (жадно самый дешёвый).
  function buyPrestigeUpgrades() {
    let bought = true
    while (bought) {
      bought = false
      let best = null
      for (const id of ['legacy', 'stash', 'vitality', 'quickstart']) {
        const c = prestigeCost(id)
        if (c <= meta.cores && (!best || c < best.c)) best = { id, c }
      }
      if (best) { meta.cores -= best.c; meta.prestige[best.id]++; bought = true }
    }
  }

  let spawnCount = 0, enemy = null
  function spawn() {
    spawnCount++
    const isBoss = spawnCount % BAL.bossEvery === 0
    const pool = getZone(st.zoneIndex).enemies
    const def = ENEMIES[pool[Math.floor(rng() * pool.length)]]
    const { hp, reward, dmg } = enemyStats(def, st.totalKills, isBoss)
    const speed = BAL.enemySpeed * def.speedMul * (isBoss ? 0.7 : 1)
    const approachTime = isBoss ? 0.3 : Math.max(0, (710 - BAL.enemyAttackRange) / speed)
    enemy = { hp, maxHp: hp, reward, dmg, approachTime, attackAccum: 0, isBoss }
  }
  function kill() {
    st.caps += Math.ceil(enemy.reward * (1 + capsBonus()))
    st.hero.xp += Math.ceil(enemy.reward * 0.6)
    while (st.hero.xp >= xpNeed()) { st.hero.xp -= xpNeed(); st.hero.level++; st.hero.points += BAL.pointsPerLevel }
    st.totalKills++; st.killsInZone++
    if (st.killsInZone >= BAL.zoneKills) { st.zoneIndex++; st.killsInZone = 0 }
    enemy = null
  }
  function heroDie() { st.deaths++; st.killsInZone = 0; st.hp = heroMaxHp(); st.combo = 0; spawnCount = 0; enemy = null }

  meta.prestige.quickstart = 0
  freshRun()
  const cps = 4, acc = 0.9
  let clickAccum = 0, sinceSpend = 0
  spawn()

  // Метрики контента/времени
  const zoneFirstReach = {}      // zoneIndex -> t (первое достижение "настоящей" зоны)
  const prestigeTimes = []       // t каждого престижа
  let firstEndlessT = null       // когда впервые ушли в endless (zoneIndex >= ZONES.length)
  let maxZone = 0
  const capsSeries = []          // (t, caps) раз в 10 мин
  const killRate = {}            // 120s bucket -> kills

  for (let t = 0; t < SESSION; t += DT) {
    if (!enemy) spawn()
    clickAccum += cps * acc * DT
    while (clickAccum >= 1 && enemy) { clickAccum -= 1; st.combo++; enemy.hp -= clickHit(); if (enemy.hp <= 0) kill() }
    if (enemy) { enemy.hp -= allyDps() * DT; if (enemy.hp <= 0) kill() }
    if (enemy) {
      enemy.approachTime -= DT
      if (enemy.approachTime <= 0) {
        enemy.attackAccum += DT
        const rate = BAL.enemyAttackRate / 1000
        while (enemy.attackAccum >= rate) { enemy.attackAccum -= rate; st.hp -= enemy.dmg; if (st.hp <= 0) { heroDie(); break } }
      }
    }
    sinceSpend += DT
    if (sinceSpend >= 1) {
      sinceSpend = 0; allocate(); spend()
      // Престиж: разумный игрок перерождается, когда забег даёт заметный прирост ядер
      // (эвристика: когда прирост ядер >= 50% текущего запаса ИЛИ прошло много убийств)
      const gain = coresFromRun()
      const worth = gain >= 5 && (gain >= (meta.cores + 1) * 0.5)
      if (worth && st.totalKills > 300) {
        meta.cores += gain; meta.prestigeCount++
        prestigeTimes.push(t)
        buyPrestigeUpgrades()
        freshRun()
        spawnCount = 0; enemy = null
      }
    }
    if (st.zoneIndex > maxZone) maxZone = st.zoneIndex
    if (!(st.zoneIndex in zoneFirstReach)) zoneFirstReach[st.zoneIndex] = t
    if (firstEndlessT === null && st.zoneIndex >= ZONES.length) firstEndlessT = t
    const bucket = Math.floor(t / 120) * 120
    killRate[bucket] = (killRate[bucket] || 0)
  }

  return {
    classId, maxZone, prestigeCount: meta.prestigeCount, cores: meta.cores,
    prestige: meta.prestige, prestigeTimes, firstEndlessT,
    zonesContentClearedT: zoneFirstReach[ZONES.length] ?? null,
    level: st.hero.level, deaths: st.deaths,
  }
}

function fmtT(s) { if (s === null || s === undefined) return '—'; const m = Math.floor(s / 60), sec = Math.round(s % 60); return `${m}м${String(sec).padStart(2, '0')}` }

console.log(`\n=== ГЛУБИНА: ${RUNS} прогонов по ${SESSION / 60} мин с престижем ===\n`)
console.log('Класс     | maxЗона | Престижей | Ядра | 1й endless | весь контент за | Ур.')
console.log('-'.repeat(80))
let seed = 777
const rows = []
for (let i = 0; i < RUNS; i++) {
  const cls = CLASSES[i % CLASSES.length]
  const r = runOne(cls.id, mulberry32(seed++))
  rows.push(r)
  console.log(
    `${cls.name.padEnd(9)} | ${String(r.maxZone).padStart(7)} | ${String(r.prestigeCount).padStart(9)} | ${String(r.cores).padStart(4)} | ${fmtT(r.firstEndlessT).padStart(10)} | ${fmtT(r.zonesContentClearedT).padStart(15)} | ${r.level}`)
}

console.log('\n--- Вывод по долговременности ---')
const med = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
console.log(`Весь заготовленный контент (${ZONES.length} зоны) исчерпан в среднем за: ${fmtT(med(rows.map(r => r.zonesContentClearedT).filter(x => x != null)))}`)
console.log(`Первый уход в бесконечный режим: ${fmtT(med(rows.map(r => r.firstEndlessT).filter(x => x != null)))}`)
console.log(`Престижей за 2 часа: ${med(rows.map(r => r.prestigeCount))} (медиана)`)
console.log(`Макс. зона за 2 часа: ${med(rows.map(r => r.maxZone))} (медиана)`)
