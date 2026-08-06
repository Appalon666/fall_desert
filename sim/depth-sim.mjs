// Глубинная симуляция: прогоны по 2 часа активной игры С УЧЁТОМ ПРЕСТИЖА.
// Волновая модель + босс-ворота + килл-масштабирование (как в игре/balance-sim).
// Цель — понять реальную длительность/глубину: работает ли мета-петля престижа,
// растёт ли глубина от забега к забегу, когда наступает потолок.
//
// Запуск: node sim/depth-sim.mjs

import { BAL } from '../src/data/balance.js'
import { defOf } from '../src/data/bosses.js'
import { enemyStats } from '../src/data/scaling.js'
import { getZone, zoneHpMul } from '../src/data/zones.js'
import { UPGRADES, upgradeCost } from '../src/data/upgrades.js'
import { ALLIES, allyCost } from '../src/data/allies.js'
import { CLASSES, CLASS_BY_ID } from '../src/data/classes.js'
import { enemiesInWave, bossDue, xpFromKill } from '../src/data/progression.js'

const SESSION = process.env.SIM_SECONDS ? +process.env.SIM_SECONDS : 7200 // 2 часа (env: SIM_SECONDS)
const DT = 0.2

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
  const meta = { cores: 0, prestige: { legacy: 0, stash: 0, vitality: 0, quickstart: 0 }, prestigeCount: 0 }
  const pDmg = () => 1 + meta.prestige.legacy * 0.20
  const pHp = () => meta.prestige.vitality * 0.15
  const pCaps = () => meta.prestige.stash * 0.20
  const pCost = (id) => { const b = { legacy: 3, stash: 3, vitality: 3, quickstart: 5 }; return Math.floor(b[id] * Math.pow(BAL.prestigeCostGrowth, meta.prestige[id] || 0)) }

  let st
  function freshRun() {
    st = {
      caps: meta.prestige.quickstart * 300,
      hero: { level: 1, xp: 0, points: 0, str: cls.startStats.str, vit: cls.startStats.vit, luck: cls.startStats.luck },
      upgrades: meta.prestige.quickstart > 0 ? { damage: meta.prestige.quickstart } : {},
      allies: { ...cls.startAllies },
      zoneIndex: 0, killsInZone: 0, totalKills: 0, combo: 0, hp: 0, bossActive: false, waveCount: 0,
    }
    st.hp = heroMaxHp()
  }
  const uL = id => st.upgrades[id] || 0
  const uA = s => UPGRADES.reduce((a, u) => (u.kind === 'add' && u.stat === s) ? a + uL(u.id) * u.perLevel : a, 0)
  const uP = s => UPGRADES.reduce((p, u) => (u.kind === 'pow' && u.stat === s) ? p * Math.pow(u.mul, uL(u.id)) : p, 1)
  const cb = s => cls.bonus[s] || 0
  const comboMult = () => Math.min(BAL.comboMax, 1 + Math.floor(st.combo / BAL.comboHitsPerStep) * BAL.comboStep)
  const clickHit = () => (BAL.baseClickDamage + st.hero.str * BAL.perStrength) * (1 + uA('clickMul') + cb('clickMul')) * uP('clickPow') * comboMult() * (1 + Math.min(0.9, BAL.baseCritChance + st.hero.luck * BAL.perLuckCrit + uA('critChance') + cb('critChance')) * (BAL.critMultiplier - 1)) * pDmg()
  const heroMaxHp = () => Math.floor((BAL.baseHeroHp + st.hero.vit * BAL.perVitality) * (1 + cb('hpMul') + pHp()) * uP('hpPow'))
  const allyDps = () => { let b = 0; for (const a of ALLIES) b += (st.allies[a.id] || 0) * a.dps; return b * (1 + uA('allyMul') + cb('allyMul')) * uP('allyPow') }
  const capsBonus = () => cb('capsMul') + pCaps()
  const xpNeed = () => Math.floor(BAL.baseXpToLevel * Math.pow(BAL.xpGrowth, st.hero.level - 1))
  // как в GameState.coresFromRun: 4 ядра на гейте, дальше × coresDepthGrowth за зону
  const coresFromRun = () => (st.zoneIndex >= 4 ? Math.floor(4 * Math.pow(BAL.coresDepthGrowth, st.zoneIndex - 4)) : 0)

  function spend() {
    let bought = true
    while (bought) {
      bought = false
      const wantHp = uL('hp') < uL('damage') - 1
      let hpCand = null, cheapest = null
      for (const u of UPGRADES) {
        const c = upgradeCost(u, uL(u.id))
        if (c <= st.caps) { if (u.id === 'hp') hpCand = { u, c }; if (!cheapest || c < cheapest.c) cheapest = { u, c } }
      }
      for (const a of ALLIES) { const c = allyCost(a, st.allies[a.id] || 0); if (c <= st.caps && (!cheapest || c < cheapest.c)) cheapest = { a, c } }
      const pick = (wantHp && hpCand) ? hpCand : cheapest
      if (pick) { st.caps -= pick.c; if (pick.u) st.upgrades[pick.u.id] = uL(pick.u.id) + 1; else st.allies[pick.a.id] = (st.allies[pick.a.id] || 0) + 1; bought = true }
    }
  }
  function allocate() { while (st.hero.points > 0) { const p = st.hero.str <= st.hero.vit * 2 ? 'str' : 'vit'; st.hero[p]++; st.hero.points-- } }
  function buyPrestige() {
    let b = true
    while (b) { b = false; let best = null; for (const id of ['legacy', 'stash', 'vitality', 'quickstart']) { const c = pCost(id); if (c <= meta.cores && (!best || c < best.c)) best = { id, c } } if (best) { meta.cores -= best.c; meta.prestige[best.id]++; b = true } }
  }

  let wave = []
  function spawnWave() {
    st.waveCount++
    const boss = !st.bossActive && bossDue(st.killsInZone)
    if (boss) st.bossActive = true
    const count = boss ? 1 : enemiesInWave(st.zoneIndex, st.killsInZone)
    const z = getZone(st.zoneIndex); const pool = boss ? z.bosses : z.enemies; const af = z.affix || { hp: 1, dmg: 1, rew: 1, spd: 1 }
    wave = []
    for (let i = 0; i < count; i++) {
      const def = defOf(pool[Math.floor(rng() * pool.length)])
      const pEnemy = Math.pow(1.03, meta.prestigeCount) // +3% за каждое перерождение
      const mHp = Math.pow(pDmg() * Math.pow(1.15, meta.prestige.quickstart), 0.35) * pEnemy
      const mDmg = (1 + pHp() * 0.45) * pEnemy
      const lv = st.hero.level - 1
      const progFull = Math.pow(BAL.enemyLevelRamp, Math.min(lv, BAL.enemyLevelRampCap)) * Math.pow(BAL.enemyLevelTail, Math.max(0, lv - BAL.enemyLevelRampCap)) * zoneHpMul(st.zoneIndex)
      const prog = progFull // жирность босса задаёт только bossHpMul (как в игре)
      const wv = Math.pow(BAL.enemyWaveRamp, st.waveCount)
      const b = enemyStats(def, st.totalKills, boss)
      const hp = b.hp * af.hp * mHp * prog * wv, reward = b.reward * af.rew, dmg = b.dmg * af.dmg * mDmg * wv
      const speed = BAL.enemySpeed * def.speedMul * (boss ? 0.7 : 1) * af.spd
      const approach = boss ? 0.3 : Math.max(0, (710 - BAL.enemyAttackRange) / speed) + i * 0.6
      wave.push({ hp, reward, dmg, approach, attackAccum: 0, boss })
    }
  }
  function killFront(e) {
    st.caps += Math.ceil(e.reward * (1 + capsBonus()))
    st.hero.xp += xpFromKill(st.totalKills)
    while (st.hero.xp >= xpNeed()) { st.hero.xp -= xpNeed(); st.hero.level++; st.hero.points += BAL.pointsPerLevel }
    if (e.boss) { st.totalKills++; st.bossActive = false; st.zoneIndex++; st.killsInZone = 0; st.waveCount = 0 }
    else { st.totalKills++; st.killsInZone++ }
  }
  function heroDie() { st.killsInZone = Math.floor(st.killsInZone / 2); st.waveCount = 0; st.bossActive = false; st.hp = heroMaxHp(); st.combo = 0; wave = [] }

  freshRun()
  const cps = 4, acc = 0.9
  let clickAccum = 0, sinceSpend = 0
  const prestigeTimes = []; const prestigeZones = []; let maxZone = 0
  let lastZoneT = 0 // когда в последний раз взяли НОВУЮ зону
  let firstCoreT = null // когда впервые стал доступен престиж (coresFromRun>=1)
  spawnWave()

  for (let t = 0; t < SESSION; t += DT) {
    if (wave.length === 0) spawnWave()
    const zoneBefore = st.zoneIndex
    clickAccum += cps * acc * DT
    while (clickAccum >= 1 && wave.length) {
      clickAccum -= 1; st.combo++
      const hit = clickHit(); wave[0].hp -= hit
      const sp = uA('splash') // Картечь: разлёт по нескольким врагам сзади
      if (sp > 0) for (let k = 1; k < wave.length && k <= 3; k++) wave[k].hp -= hit * sp
      for (let k = wave.length - 1; k >= 0; k--) if (wave[k].hp <= 0) { killFront(wave[k]); wave.splice(k, 1) }
    }
    if (wave.length) { wave[0].hp -= allyDps() * DT; if (wave[0].hp <= 0) { killFront(wave[0]); wave.shift() } }
    if (st.zoneIndex > zoneBefore) lastZoneT = t
    if (wave.length) {
      for (const e of wave) {
        e.approach -= DT
        if (e.approach <= 0) { e.attackAccum += DT; const rate = BAL.enemyAttackRate / 1000; while (e.attackAccum >= rate) { e.attackAccum -= rate; st.hp -= e.dmg; if (st.hp <= 0) { heroDie(); break } } }
        if (st.hp <= 0) break
      }
    }
    sinceSpend += DT
    if (sinceSpend >= 1) {
      sinceSpend = 0; allocate(); spend()
      // Разумный игрок пушит до СТЕНЫ (не берёт новую зону ~2 мин = темп рухнул),
      // затем перерождается — так каждый следующий забег уходит глубже.
      // Порог «стены» — 15 минут без новой зоны. Раньше стояло 2 минуты, но
      // зоны теперь сами по себе идут по 5-8 минут (260+ убийств, растёт на 13%
      // за зону), и детектор срабатывал на здоровом прогрессе: игрок
      // «упирался» ровно на пятой зоне каждый забег независимо от меты.
      const walled = (t - lastZoneT) > 900 && st.zoneIndex >= 5 && coresFromRun() >= 1
      if (walled) {
        meta.cores += coresFromRun(); meta.prestigeCount++
        prestigeTimes.push(t); prestigeZones.push(st.zoneIndex)
        buyPrestige(); freshRun(); wave = []; lastZoneT = t
      }
    }
    if (st.zoneIndex > maxZone) maxZone = st.zoneIndex
    if (firstCoreT === null && coresFromRun() >= 1 && st.zoneIndex >= 4) firstCoreT = t
  }

  return { classId, maxZone, prestigeCount: meta.prestigeCount, cores: meta.cores, prestige: meta.prestige, prestigeTimes, prestigeZones, level: st.hero.level, legacy: meta.prestige.legacy, firstCoreT }
}

function fmtT(s) { if (s == null) return '—'; const m = Math.floor(s / 60), sec = Math.round(s % 60); return `${m}м${String(sec).padStart(2, '0')}` }
const med = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

const PER_CLASS = 8
console.log(`\n=== ГЛУБИНА ПО КЛАССАМ: ${PER_CLASS} прогонов/класс по ${SESSION / 60} мин с престижем ===\n`)
console.log('Класс     | 1е Ядро | 1й престиж | Престижей | Ядра всего | Legacy | maxЗона')
console.log('-'.repeat(80))
let seed = 777
const byClass = {}
for (const cls of CLASSES) {
  const runs = []
  for (let i = 0; i < PER_CLASS; i++) runs.push(runOne(cls.id, mulberry32(seed++)))
  byClass[cls.id] = runs
  const g = k => med(runs.map(r => r[k]))
  const firstCore = med(runs.map(r => r.firstCoreT).filter(x => x != null))
  const firstPr = med(runs.map(r => r.prestigeTimes[0]).filter(x => x != null))
  console.log(`${cls.name.padEnd(9)} | ${fmtT(firstCore).padStart(7)} | ${fmtT(firstPr).padStart(10)} | ${String(g('prestigeCount')).padStart(9)} | ${String(g('cores')).padStart(10)} | ${String(g('legacy')).padStart(6)} | ${g('maxZone')}`)
}

const all = Object.values(byClass).flat()
console.log('\n--- Реально ли дойти до Ядра? ---')
const reachedCore = all.filter(r => r.firstCoreT != null).length
const didPrestige = all.filter(r => r.prestigeCount > 0).length
console.log(`Дошли до первого Ядра (престиж доступен): ${reachedCore}/${all.length} прогонов`)
console.log(`Реально переродились хотя бы раз: ${didPrestige}/${all.length} прогонов`)
console.log(`Медиана времени до первого Ядра: ${fmtT(med(all.map(r => r.firstCoreT).filter(x => x != null)))}`)
console.log(`Медиана времени до 1-го престижа: ${fmtT(med(all.map(r => r.prestigeTimes[0]).filter(x => x != null)))}`)
console.log(`Глубина стены по забегам (пример): ${(byClass.gunner[0].prestigeZones).join(' → ') || '—'}`)
