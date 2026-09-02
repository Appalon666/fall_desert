// Тесты чистых данных: масштабирование, прогрессия, зоны/аффиксы, лут, апгрейды, формат.
import { describe, it, expect } from 'vitest'
import { BAL } from '../src/data/balance.js'
import { enemyStats } from '../src/data/scaling.js'
import { enemiesInWave, bossDue, zoneKillsFor, xpFromKill } from '../src/data/progression.js'
import { ZONES, getZone, AFFIXES, affixForLoop, isRelicZone } from '../src/data/zones.js'
import { ENEMIES, ENEMY_IDS } from '../src/data/enemies.js'
import { BOSSES, BOSS_IDS, defOf, sheetKey, isBossId } from '../src/data/bosses.js'
import { setLang, t, itemName } from '../src/i18n.js'
import { readFileSync } from 'node:fs'
import { RARITIES, rollItem, scrapValue, CRAFT_TIERS, RARITY_BY_ID, SLOT_BY_ID, ITEM_LEVEL_CAP } from '../src/data/loot.js'
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
    const norm = zoneKillsFor()
    expect(bossDue(norm - 1)).toBe(false)
    expect(bossDue(norm)).toBe(true)
    expect(bossDue(norm + 5)).toBe(true)
  })
  it('норма зоны одна на всех глубинах, а надбавка к волне ограничена', () => {
    expect(zoneKillsFor()).toBe(BAL.zoneKills)
    // раньше надбавка «+1 враг за 20 убийств» была без потолка и разгоняла темп
    expect(enemiesInWave(0, 100000)).toBe(BAL.waveCountBase + BAL.waveKillBonusMax)
  })
  it('опыт за килл растёт много медленнее награды', () => {
    expect(xpFromKill(0)).toBe(BAL.xpPerKill)
    const xpRatio = xpFromKill(2000) / xpFromKill(0)
    const rewardRatio = Math.pow(BAL.rewardGrowth, 2000)
    expect(xpRatio).toBeLessThan(rewardRatio)
    // экспонента не должна давать Infinity: addXp превратил бы опыт в NaN
    expect(Number.isFinite(xpFromKill(2e6))).toBe(true)
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

describe('зона реликвий', () => {
  it('это последняя локация и её повторы в endless', () => {
    expect(isRelicZone(ZONES.length - 1)).toBe(true)
    expect(isRelicZone(ZONES.length * 2 - 1)).toBe(true)
    expect(isRelicZone(ZONES.length * 3 - 1)).toBe(true)
    for (let z = 0; z < ZONES.length - 1; z++) expect(isRelicZone(z), `зона ${z}`).toBe(false)
  })
})

describe('враги и боссы', () => {
  const ALL = [...Object.entries(ENEMIES), ...Object.entries(BOSSES)]

  it('id врагов и боссов не пересекаются', () => {
    // ключ анимации ходьбы — `${id}-walk` на всех, совпадение id склеит анимации
    for (const id of BOSS_IDS) expect(ENEMY_IDS).not.toContain(id)
  })

  it('у каждого дефа есть все поля, которые читает бой', () => {
    for (const [id, d] of ALL) {
      expect(typeof d.name, id).toBe('string')
      for (const f of ['scale', 'hpMul', 'rewardMul', 'dmgMul', 'speedMul']) {
        expect(d[f], `${id}.${f}`).toBeGreaterThan(0)
      }
      expect(typeof d.tint, id).toBe('number')
    }
  })

  it('defOf/sheetKey разводят боссов и врагов', () => {
    for (const id of ENEMY_IDS) {
      expect(defOf(id)).toBe(ENEMIES[id])
      expect(isBossId(id)).toBe(false)
      expect(sheetKey(id)).toBe(`enemy-${id}`)
    }
    for (const id of BOSS_IDS) {
      expect(defOf(id)).toBe(BOSSES[id])
      expect(isBossId(id)).toBe(true)
      expect(sheetKey(id)).toBe(`boss-${id}`)
    }
    expect(defOf('нет-такого')).toBeUndefined()
  })

  it('все имена переведены на английский', () => {
    setLang('en')
    try {
      for (const [id, d] of ALL) expect(t(d.name), `${id}: ${d.name}`).not.toBe(d.name)
    } finally { setLang('ru') }
  })

  it('боссы не выше арены', () => {
    // высота на экране = 100 × scale (ENEMY_H_PER_SCALE), земля на y≈590
    for (const [id, d] of Object.entries(BOSSES)) expect(d.scale * 100, id).toBeLessThanOrEqual(420)
  })

  it('пулы всех зон (включая endless) состоят из существующих id', () => {
    for (let z = 0; z < ZONES.length + 6; z++) {
      const zone = getZone(z)
      expect(zone.enemies.length, `зона ${z}`).toBeGreaterThan(0)
      expect(zone.bosses.length, `зона ${z}`).toBeGreaterThan(0)
      for (const id of zone.enemies) expect(ENEMIES[id], `зона ${z}: ${id}`).toBeTruthy()
      for (const id of zone.bosses) expect(BOSSES[id], `зона ${z}: ${id}`).toBeTruthy()
    }
  })

  it('каждый враг и босс где-то встречается', () => {
    const used = new Set()
    for (let z = 0; z < ZONES.length + 5; z++) {
      const zone = getZone(z)
      zone.enemies.forEach(i => used.add(i))
      zone.bosses.forEach(i => used.add(i))
    }
    for (const id of [...ENEMY_IDS, ...BOSS_IDS]) expect(used.has(id), id).toBe(true)
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
  it('scrapValue упирается в тот же потолок уровня, что и сила предмета', () => {
    // Уровень предмета растёт линейно от убийств и не ограничен, а цены на
    // верстаке фиксированные: без потолка серый хлам с глубины давал сотни
    // металлолома, и «Мастерская ковка» становилась бесплатной.
    const atCap = scrapValue({ rarity: 'common', level: ITEM_LEVEL_CAP })
    for (const lv of [ITEM_LEVEL_CAP + 1, 500, 5000, 1e6]) {
      expect(scrapValue({ rarity: 'common', level: lv }), `уровень ${lv}`).toBe(atCap)
    }
    // самый дорогой тир крафта по-прежнему стоит десятков разобранных вещей
    const top = CRAFT_TIERS[CRAFT_TIERS.length - 1]
    expect(top.cost / atCap).toBeGreaterThan(50)
  })
  it('scrapValue не ломается на предмете без level', () => {
    expect(scrapValue({ rarity: 'common' })).toBeGreaterThan(0)
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

describe('локализация', () => {
  const CYR = /[а-яА-ЯёЁ]/

  it('в словаре нет дублей ключей (второй молча перетирает первый)', () => {
    const src = readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8')
    const en = src.slice(src.indexOf('const EN = {'), src.lastIndexOf('}'))
    const seen = new Set(), dupes = []
    for (const m of en.matchAll(/'((?:[^'\\]|\\.)*)'\s*:\s*(?:\n\s*)?'/g)) {
      if (seen.has(m[1])) dupes.push(m[1])
      seen.add(m[1])
    }
    expect(dupes).toEqual([])
  })

  it('сгенерированное имя предмета переводится целиком', () => {
    const rng = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(11)
    setLang('en')
    try {
      for (let i = 0; i < 300; i++) {
        const name = itemName(rollItem(rng, 1 + i, 0).name)
        expect(CYR.test(name), name).toBe(false)
      }
    } finally { setLang('ru') }
  })

  it('itemName не трогает имя, пока язык русский', () => {
    const name = rollItem(Math.random, 5, 0).name
    expect(itemName(name)).toBe(name)
  })

  it('единицы длительности переводятся (окно офлайн-дохода)', () => {
    setLang('en')
    try {
      for (const s of [45, 305, 8115]) expect(CYR.test(fmtDuration(s)), String(s)).toBe(false)
    } finally { setLang('ru') }
  })

  it('имя endless-зоны переводится вместе с аффиксом', () => {
    setLang('en')
    try {
      for (let z = ZONES.length; z < ZONES.length + AFFIXES.length; z++) {
        expect(CYR.test(getZone(z).name), `зона ${z}`).toBe(false)
      }
    } finally { setLang('ru') }
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
