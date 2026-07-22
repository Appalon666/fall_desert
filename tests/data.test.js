// Тесты чистых данных: масштабирование, прогрессия, зоны/аффиксы, лут, апгрейды, формат.
import { describe, it, expect } from 'vitest'
import { BAL } from '../src/data/balance.js'
import { enemyStats } from '../src/data/scaling.js'
import { enemiesInWave, bossDue } from '../src/data/progression.js'
import { ZONES, getZone, AFFIXES, affixForLoop } from '../src/data/zones.js'
import { RARITIES, SLOTS, rollItem, scrapValue, CRAFT_TIERS, RARITY_BY_ID, SLOT_BY_ID } from '../src/data/loot.js'
import { UPGRADES, upgradeCost } from '../src/data/upgrades.js'
import { fmt, fmtDuration } from '../src/util/format.js'

const DEF = { hpMul: 1, rewardMul: 1, dmgMul: 1, speedMul: 1 }

describe('scaling / enemyStats', () => {
  it('монотонно растёт по стадии', () => {
    const a = enemyStats(DEF, 0, false)
    const b = enemyStats(DEF, 100, false)
    expect(b.hp).toBeGreaterThan(a.hp)
    expect(b.reward).toBeGreaterThan(a.reward)
  })
  it('босс жирнее и щедрее обычного', () => {
    const n = enemyStats(DEF, 50, false)
    const boss = enemyStats(DEF, 50, true)
    expect(boss.hp).toBeGreaterThan(n.hp * (BAL.bossHpMul - 1)) // с запасом на ceil
    expect(boss.reward).toBeGreaterThan(n.reward)
  })
  it('никогда не улетает в Infinity/NaN даже на экстремальной глубине', () => {
    for (const stage of [1000, 5000, 20000, 100000]) {
      const s = enemyStats(DEF, stage, true)
      expect(Number.isFinite(s.hp)).toBe(true)
      expect(Number.isFinite(s.reward)).toBe(true)
      expect(Number.isFinite(s.dmg)).toBe(true)
      expect(s.hp).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER)
    }
  })
  it('учитывает множители типа врага', () => {
    const weak = enemyStats({ ...DEF, hpMul: 0.5 }, 30, false)
    const tough = enemyStats({ ...DEF, hpMul: 2 }, 30, false)
    expect(tough.hp).toBeGreaterThan(weak.hp * 3)
  })
})

describe('progression', () => {
  it('enemiesInWave растёт по зонам, но не выше потолка', () => {
    expect(enemiesInWave(0)).toBe(BAL.waveCountBase)
    expect(enemiesInWave(999)).toBe(BAL.waveCountMax)
    for (let z = 0; z < 100; z++) {
      const n = enemiesInWave(z)
      expect(n).toBeGreaterThanOrEqual(BAL.waveCountBase)
      expect(n).toBeLessThanOrEqual(BAL.waveCountMax)
    }
  })
  it('bossDue срабатывает на норме убийств зоны', () => {
    expect(bossDue(BAL.zoneKills - 1)).toBe(false)
    expect(bossDue(BAL.zoneKills)).toBe(true)
    expect(bossDue(BAL.zoneKills + 5)).toBe(true)
  })
})

describe('zones / affixes', () => {
  it('первые зоны — не endless, дальше — endless с аффиксом', () => {
    const z0 = getZone(0)
    expect(z0.endless).toBe(false)
    expect(z0.affix).toBe(AFFIXES[0])
    const zE = getZone(ZONES.length)
    expect(zE.endless).toBe(true)
    expect(zE.loop).toBe(1)
    expect(zE.name).toContain('+1')
  })
  it('аффиксы циклятся по петлям', () => {
    for (let loop = 1; loop <= AFFIXES.length * 2; loop++) {
      expect(affixForLoop(loop)).toBe(AFFIXES[(loop - 1) % AFFIXES.length])
    }
  })
  it('имя endless-зоны содержит имя аффикса (когда он есть)', () => {
    // найдём петлю с непустым аффиксом
    const loopWithName = AFFIXES.findIndex(a => a.name) // индекс в цикле
    const zone = getZone(ZONES.length + loopWithName) // loop = loopWithName+1
    expect(zone.name).toContain(AFFIXES[loopWithName].name)
  })
})

describe('loot', () => {
  const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)(42)
  it('rollItem всегда возвращает валидный предмет', () => {
    for (let i = 0; i < 500; i++) {
      const it = rollItem(rng, 1 + i, 0)
      expect(SLOT_BY_ID[it.slot]).toBeTruthy()
      expect(RARITY_BY_ID[it.rarity]).toBeTruthy()
      expect(typeof it.value).toBe('number')
      expect(it.value).toBeGreaterThan(0)
      expect(it.uid).toBeTruthy()
    }
  })
  it('удача повышает шанс редких предметов', () => {
    const rare = (luck) => {
      const r = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(7)
      let count = 0
      for (let i = 0; i < 4000; i++) {
        const it = rollItem(r, 1, luck)
        const idx = RARITIES.findIndex(x => x.id === it.rarity)
        if (idx >= 2) count++ // rare и выше
      }
      return count
    }
    expect(rare(5)).toBeGreaterThan(rare(0))
  })
  it('scrapValue положителен и растёт с редкостью', () => {
    const common = scrapValue({ rarity: 'common', level: 10 })
    const relic = scrapValue({ rarity: 'relic', level: 10 })
    expect(common).toBeGreaterThan(0)
    expect(relic).toBeGreaterThan(common)
  })
  it('тиры крафта отсортированы по цене', () => {
    for (let i = 1; i < CRAFT_TIERS.length; i++) {
      expect(CRAFT_TIERS[i].cost).toBeGreaterThan(CRAFT_TIERS[i - 1].cost)
    }
  })
  it('веса редкостей убывают (обычное чаще реликвии)', () => {
    expect(RARITIES[0].weight).toBeGreaterThan(RARITIES[RARITIES.length - 1].weight)
  })
})

describe('upgrades', () => {
  it('цена = base на 0 уровне и растёт экспоненциально', () => {
    for (const u of UPGRADES) {
      expect(upgradeCost(u, 0)).toBe(u.baseCost)
      expect(upgradeCost(u, 5)).toBeGreaterThan(upgradeCost(u, 4))
    }
  })
})

describe('format', () => {
  it('fmt сокращает большие числа', () => {
    expect(fmt(999)).toBe('999')
    expect(fmt(1500)).toBe('1.5K')
    expect(fmt(2_500_000)).toBe('2.5M')
  })
  it('fmt не-конечных чисел = ∞ (защита от переполнения)', () => {
    expect(fmt(Infinity)).toBe('∞')
    expect(fmt(NaN)).toBe('∞')
  })
  it('fmtDuration человекочитаем', () => {
    expect(fmtDuration(45)).toContain('сек')
    expect(fmtDuration(3720)).toContain('ч')
  })
})
