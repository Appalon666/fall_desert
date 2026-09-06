// Тесты чистых данных: масштабирование, прогрессия, зоны/аффиксы, лут, апгрейды, формат.
import { describe, it, expect } from 'vitest'
import { BAL } from '../src/data/balance.js'
import { enemyStats, applyDepthBand, DEPTH_FROM, STAT_CAP } from '../src/data/scaling.js'
import { enemiesInWave, bossDue, zoneKillsFor, xpFromKill } from '../src/data/progression.js'
import { ZONES, getZone, AFFIXES, affixForLoop, isRelicZone } from '../src/data/zones.js'
import { ENEMIES, ENEMY_IDS } from '../src/data/enemies.js'
import { BOSSES, BOSS_IDS, defOf, sheetKey, isBossId } from '../src/data/bosses.js'
import { setLang, t, itemName } from '../src/i18n.js'
import { GameState } from '../src/state/GameState.js'
import { RELIC_PART_IDS } from '../src/data/relics.js'
import { readFileSync } from 'node:fs'
import { RARITIES, rollItem, scrapValue, CRAFT_TIERS, RARITY_BY_ID, SLOT_BY_ID, ITEM_LEVEL_CAP, itemPower, itemQuality, itemRank, SLOTS, STAT_SHARES, STATS_PER_ITEM, STAT_SHORT } from '../src/data/loot.js'
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
      // Сверяемся с ПРЕДЕЛОМ ИЗ ИГРЫ, а не с MAX_SAFE_INTEGER. Раньше здесь
      // стояло его число, и тест защищал не от Infinity, а от роста как
      // такового: HP врага упиралось в 9.0e15 примерно к 56-й локации и дальше
      // не росло вообще, пока урон героя рос без предела. Смысл проверки —
      // «числа остаются конечными», он и остался.
      expect(s.hp).toBeLessThanOrEqual(STAT_CAP)
    }
  })
  it('учитывает множители типа врага', () => {
    const weak = enemyStats({ ...DEF, hpMul: 0.5 }, 30, false)
    const tough = enemyStats({ ...DEF, hpMul: 2 }, 30, false)
    expect(tough.hp).toBeGreaterThan(weak.hp * 3)
  })
})

describe('полоса глубины: враг против реальной силы героя', () => {
  // Замер живой игры, 129-я локация: урон клика 12.6aj (с критом 145aj),
  // HP героя 70.4ak. Формулы врага на этой глубине дают 6.2e72 HP и 1.6e52
  // урона — 4.3e28 кликов на рядового и мгновенная смерть от касания.
  const PLAYER = { click: 1.45e44, maxHp: 7.04e46 }
  const DEEP = 37544
  const RAW = { hp: 6.2e72, dmg: 1.6e52 }
  const band = (isBoss = false, raw = RAW, stage = DEEP, player = PLAYER) =>
    applyDepthBand(stage, raw.hp, raw.dmg, isBoss, player)

  it('рядовой живёт не больше пяти кликов, босс — десяти', () => {
    expect(band().hp / PLAYER.click).toBeCloseTo(BAL.depthClicksMax, 6)
    expect(band(true).hp / PLAYER.click).toBeCloseTo(BAL.depthClicksMax * BAL.bossHpMul, 6)
  })

  it('враг не становится мишенью в один клик', () => {
    // Обратная сторона: без нижней границы прокачанный игрок сносил бы всё с
    // первого касания — замер давал 0.17 клика на рядового.
    const weak = { hp: 1, dmg: 1 }
    expect(band(false, weak).hp / PLAYER.click).toBeCloseTo(BAL.depthClicksMin, 6)
  })

  it('один удар не убивает героя с полного HP', () => {
    const hits = PLAYER.maxHp / band().dmg
    expect(hits).toBeGreaterThanOrEqual(4)
    expect(band().dmg).toBeCloseTo(PLAYER.maxHp * BAL.maxHitShare, 6)
    expect(band(true).dmg).toBeCloseTo(PLAYER.maxHp * BAL.maxHitShareBoss, 6)
  })

  it('и не перестаёт наносить урон вовсе', () => {
    // Прямая регрессия на живой баг: HP героя растёт как лом^0.874, урон врага
    // — как dmgGrowth^убийства, поэтому герой обгоняет урон всегда. Замер:
    // 8.4B урона на 20-й локации, 99 на 86-й и РОВНО НОЛЬ на 114-й.
    const weak = { hp: 1, dmg: 1 }
    expect(band(false, weak).dmg).toBeCloseTo(PLAYER.maxHp * BAL.minHitShare, 6)
    expect(band(true, weak).dmg).toBeCloseTo(PLAYER.maxHp * BAL.minHitShareBoss, 6)
  })

  it('до DEPTH_FROM не трогает ничего', () => {
    expect(band(false, RAW, DEPTH_FROM - 1)).toEqual(RAW)
    expect(band(false, RAW, 100)).toEqual(RAW)
  })

  it('без силы героя (симуляции) полоса не применяется', () => {
    expect(applyDepthBand(DEEP, RAW.hp, RAW.dmg, false, null)).toEqual(RAW)
    expect(band(false, RAW, DEEP, { click: 0, maxHp: 0 })).toEqual(RAW)
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
    // Номер петли в ИМЕНИ не печатаем: на экране рядом всегда стоит номер
    // локации («ЗОНА 46 · ЛОГОВО БОССА»), и «+36» рядом с ним читалось как
    // второе, противоречащее число. Само поле loop при этом живо — по нему
    // считается аффикс.
    expect(zE.name).not.toMatch(/\+\d/)
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

const ANY_STAT_IDS = Object.keys(STAT_SHORT)

describe('loot', () => {
  const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)(42)
  it('rollItem всегда возвращает валидный предмет', () => {
    for (let i = 0; i < 500; i++) {
      const it = rollItem(rng, 1 + i, 0)
      expect(SLOT_BY_ID[it.slot]).toBeTruthy()
      expect(RARITY_BY_ID[it.rarity]).toBeTruthy()
      expect(it.uid).toBeTruthy()
      expect(it.stats).toHaveLength(STATS_PER_ITEM)
      for (const st of it.stats) {
        expect(ANY_STAT_IDS, st.stat).toContain(st.stat)
        expect(typeof st.value).toBe('number')
        expect(st.value).toBeGreaterThan(0)
      }
    }
  })

  // Смешанные статы: слот больше не диктует единственную характеристику.
  it('первый стат — родной для слота, остальные не повторяются', () => {
    const seen = {}
    for (let i = 0; i < 800; i++) {
      const it = rollItem(rng, 20, 0)
      const ids = it.stats.map(s => s.stat)
      expect(new Set(ids).size, ids.join(',')).toBe(ids.length) // без дублей
      const native = SLOT_BY_ID[it.slot].stat
      if (native !== 'any') expect(ids[0], it.slot).toBe(native)
      ;(seen[it.slot] ||= new Set()).add(ids.slice(1).sort().join('+'))
    }
    // У каждого слота набор вторых статов не один и тот же — иначе предметы
    // одного вида снова стали бы одинаковыми.
    for (const slot of Object.keys(seen)) expect(seen[slot].size, slot).toBeGreaterThan(1)
  })

  it('сила статов убывает по долям STAT_SHARES', () => {
    for (let i = 0; i < 200; i++) {
      const it = rollItem(rng, 30, 0)
      const rar = RARITY_BY_ID[it.rarity]
      it.stats.forEach((st, k) => {
        const max = itemPower(rar.mul, it.level, st.stat === 'critChance')
        expect(st.value / max, `${it.rarity}/${st.stat}`).toBeCloseTo(STAT_SHARES[k], 2)
      })
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

// itemQuality — общая мера силы предмета, по которой инвентарь сортирует список.
//
// Зачем она понадобилась: у шанса крита коэффициент в формуле впятеро меньше,
// чем у остальных статов, поэтому ПРЕДЕЛЬНАЯ реликвия-шлем (value 0.2)
// сортировалась НИЖЕ рядовых эпических сапог (0.75). В списке на шесть строк из
// сотен предметов свежевыкованная реликвия просто не показывалась — снаружи это
// выглядело как «крафт реликвии выдал шмотку тиром ниже».
describe('качество предмета (сортировка инвентаря)', () => {
  const item = (rarity, stat, level = ITEM_LEVEL_CAP) => ({
    uid: 'u', slot: stat === 'critChance' ? 'helmet' : 'boots', rarity, stat, level,
    value: itemPower(RARITY_BY_ID[rarity].mul, level, stat === 'critChance'),
  })

  it('предельный предмет любого тира и стата — это 1', () => {
    for (const r of RARITIES) {
      expect(itemQuality(item(r.id, 'capsMul')), r.id).toBeCloseTo(1, 6)
      expect(itemQuality(item(r.id, 'critChance')), r.id + '/crit').toBeCloseTo(1, 6)
    }
  })

  // Ровно та пара, на которой ломалась сортировка: внутри одного тира крит-вещь
  // с меньшим value обязана стоять ВЫШЕ слабой вещи с большим value.
  // (Разные тиры сортировка разводит раньше — по редкости.)
  it('крит-вещь не проваливается вниз только из-за меньшего value', () => {
    const helm = item('relic', 'critChance')      // предельный шлем: value 0.2
    const boots = item('relic', 'capsMul', 10)    // слабые сапоги: value 0.56
    expect(helm.value).toBeLessThan(boots.value)  // сырое value обманывает…
    expect(itemQuality(helm)).toBeGreaterThan(itemQuality(boots)) // …а качество — нет
  })

  it('предмет низкого уровня хуже предельного того же тира', () => {
    expect(itemQuality(item('relic', 'capsMul', 1))).toBeLessThan(itemQuality(item('relic', 'capsMul')))
  })

  it('битый предмет не ломает сортировку, а получает ноль', () => {
    expect(itemQuality(null)).toBe(0)
    expect(itemQuality({ rarity: 'нет-такого', stat: 'capsMul', value: 1 })).toBe(0)
    expect(itemQuality({ rarity: 'relic', stat: 'capsMul', value: NaN })).toBe(0)
  })
})

// Требование простое и его легко потерять при следующей правке коэффициентов:
// РЕЛИКВИЯ СИЛЬНЕЕ ЛЕГЕНДЫ. Всегда, в каждом слоте.
//
// Путаница тут родилась из-за формулы: у шанса крита коэффициент 0.01, у всех
// прочих статов 0.05, поэтому предельный шлем-реликвия показывает «+20.0%», а
// рядовые легендарные сапоги — «+75%», и снаружи это читается как понижение.
// Ковка ЧАСТИ реликвии за металлолом. Тир намеренно даёт не саму реликвию:
// покупать её готовой значило бы обесценить и выбивание частей с босса 10-й
// локации, и прохождение локаций. Часть — это ускорение уже начатого пути.
describe('ковка части реликвии за металлолом', () => {
  const TIER = CRAFT_TIERS.find(t => t.id === 'relicPart')
  // relicParts чистим руками: GameState в конструкторе читает сейв, а мок
  // localStorage в тестах общий — туда пишут соседние проверки.
  const fresh = () => { const s = new GameState(); s.relicParts = []; s.relicsCrafted = 0; return s }
  const rich = () => { const s = fresh(); s.scrap = TIER.cost * 10; return s }

  it('тир заведён: 10000 лома, помечен как часть', () => {
    expect(TIER).toBeTruthy()
    expect(TIER.cost).toBe(10000)
    expect(TIER.relicPart).toBe(true)
  })

  it('это самый дорогой тир', () => {
    for (const t of CRAFT_TIERS) if (t !== TIER) expect(TIER.cost).toBeGreaterThan(t.cost)
  })

  it('даёт часть и списывает лом', () => {
    const s = rich()
    const before = s.scrap
    const part = s.buyRelicPart(TIER.cost)
    expect(part).toBeTruthy()
    expect(s.scrap).toBe(before - TIER.cost)
    expect(s.relicPartsOwned()).toHaveLength(1)
  })

  // Главное: за такую цену дубликат был бы издевательством.
  it('всегда даёт НЕДОСТАЮЩУЮ часть, без дублей', () => {
    const s = rich()
    for (let i = 0; i < RELIC_PART_IDS.length; i++) s.buyRelicPart(TIER.cost)
    expect(s.relicParts).toHaveLength(RELIC_PART_IDS.length)
    expect(new Set(s.relicParts).size).toBe(RELIC_PART_IDS.length)
  })

  it('когда набор собран — не куёт и лом не тратит', () => {
    const s = rich()
    for (let i = 0; i < RELIC_PART_IDS.length; i++) s.buyRelicPart(TIER.cost)
    const left = s.scrap
    expect(s.buyRelicPart(TIER.cost)).toBe(null)
    expect(s.scrap).toBe(left)
  })

  it('без лома не куёт и лом не списывает', () => {
    const s = fresh()
    s.scrap = TIER.cost - 1
    expect(s.buyRelicPart(TIER.cost)).toBe(null)
    expect(s.scrap).toBe(TIER.cost - 1)
    expect(s.relicPartsOwned()).toHaveLength(0)
  })

  // Счётчик гейтит выпадение ДУБЛЕЙ частей с босса: покупка за лом не должна
  // портить дроп.
  it('не трогает счётчик выкованных реликвий', () => {
    const s = rich()
    s.buyRelicPart(TIER.cost)
    expect(s.relicsCrafted).toBe(0)
  })

  it('собранный покупкой набор кузнеца устраивает', () => {
    const s = rich()
    for (let i = 0; i < RELIC_PART_IDS.length; i++) s.buyRelicPart(TIER.cost)
    expect(s.canCraftRelic()).toBe(true)
    expect(s.craftRelic().rarity).toBe('relic')
  })
})

describe('реликвия не выпадает из добычи', () => {
  // Единственный путь к реликвии — пять частей и ковка. Регрессия на живой баг:
  // вес 0.6 плюс множитель от удачи давали красный предмет каждым сорок восьмым
  // броском, и смысл выбивать части пропадал.
  const rolls = (n, luck) => {
    const out = []
    for (let i = 0; i < n; i++) out.push(rollItem(Math.random, 40, luck))
    return out
  }

  it('ни одного красного за 20 000 бросков без удачи', () => {
    expect(rolls(20000, 0).some(it => it.rarity === 'relic')).toBe(false)
  })

  it('и с запредельной удачей тоже', () => {
    // 121 очко удачи у игрока = lootLuck 6.05; берём с большим запасом.
    expect(rolls(20000, 50).some(it => it.rarity === 'relic')).toBe(false)
  })

  it('потолок добычи — оранжевое легендарное, и оно выпадает', () => {
    const got = new Set(rolls(20000, 6).map(it => it.rarity))
    expect(got.has('legendary')).toBe(true)
    expect(got.has('relic')).toBe(false)
  })

  it('верстак тоже не выдаёт реликвию ни на одном тире', () => {
    for (const tier of CRAFT_TIERS.filter(c => !c.relicPart)) {
      const s = new GameState()
      s.heroClass = 'gunner'
      s.hero.luck = 500
      for (let i = 0; i < 400; i++) {
        s.scrap = tier.cost
        const item = s.craft(tier.id)
        expect(item && item.rarity).not.toBe('relic')
      }
    }
  })

  it('а ковка из частей — выдаёт', () => {
    const s = new GameState()
    s.heroClass = 'gunner'
    s.relicParts = [...RELIC_PART_IDS]
    const item = s.craftRelic()
    expect(item).toBeTruthy()
    expect(item.rarity).toBe('relic')
  })
})

describe('лестница редкостей: шесть тиров', () => {
  // Порядок с экрана игрока: серый → зелёный → синий → фиолетовый →
  // оранжевый легендарный → красная реликвия.
  const LADDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'relic']

  it('ровно шесть тиров в заданном порядке', () => {
    expect(RARITIES.map(r => r.id)).toEqual(LADDER)
  })

  it('каждый следующий сильнее предыдущего', () => {
    for (let i = 1; i < RARITIES.length; i++) {
      expect(RARITIES[i].mul, RARITIES[i].name).toBeGreaterThan(RARITIES[i - 1].mul)
    }
  })

  it('каждый следующий реже предыдущего, реликвия не выпадает вовсе', () => {
    for (let i = 1; i < RARITIES.length - 1; i++) {
      expect(RARITIES[i].weight, RARITIES[i].name).toBeLessThan(RARITIES[i - 1].weight)
    }
    expect(RARITY_BY_ID.relic.weight).toBe(0)
  })

  it('у каждого тира свой цвет', () => {
    expect(new Set(RARITIES.map(r => r.css)).size).toBe(RARITIES.length)
  })

  it('дороже в разбор с каждым тиром', () => {
    const val = (rarity) => scrapValue({ rarity, level: 50 })
    for (let i = 1; i < RARITIES.length; i++) {
      expect(val(RARITIES[i].id), RARITIES[i].name).toBeGreaterThan(val(RARITIES[i - 1].id))
    }
  })
})

describe('реликвия ровно вдвое сильнее легендарного', () => {
  const best = (rarityId, crit) => itemPower(RARITY_BY_ID[rarityId].mul, ITEM_LEVEL_CAP, crit)

  it('в каждом слоте предельная реликвия сильнее предельного легендарного', () => {
    for (const s of SLOTS) {
      const crit = s.stat === 'critChance'
      expect(best('relic', crit), s.name).toBeGreaterThan(best('legendary', crit))
    }
  })

  it('разрыв ровно вдвое и одинаковый во всех слотах', () => {
    expect(RARITY_BY_ID.relic.mul / RARITY_BY_ID.legendary.mul).toBeCloseTo(2, 6)
    for (const s of SLOTS) {
      const crit = s.stat === 'critChance'
      expect(best('relic', crit) / best('legendary', crit), s.name).toBeCloseTo(2, 6)
    }
  })

  // itemRank — то, чем инвентарь сравнивает вещи с РАЗНЫМИ статами и печатает
  // «лучше/хуже надетого». Без него список сравнивал несравнимые проценты.
  it('ранг ставит реликвию выше легендарного даже при разных статах', () => {
    const item = (rarity, stat) => ({
      uid: 'u', slot: stat === 'critChance' ? 'helmet' : 'boots', rarity, stat, level: ITEM_LEVEL_CAP,
      value: itemPower(RARITY_BY_ID[rarity].mul, ITEM_LEVEL_CAP, stat === 'critChance'),
    })
    const relicHelm = item('relic', 'critChance')       // «+32% шанс крита»
    const legendBoots = item('legendary', 'capsMul')   // «+120% крышек»
    expect(relicHelm.value).toBeLessThan(legendBoots.value)      // проценты обманывают…
    expect(itemRank(relicHelm)).toBeGreaterThan(itemRank(legendBoots)) // …ранг — нет
  })

  it('у предельного предмета ранг равен множителю его тира', () => {
    for (const r of RARITIES) {
      const it = { uid: 'u', slot: 'boots', rarity: r.id, stat: 'capsMul', level: ITEM_LEVEL_CAP,
        value: itemPower(r.mul, ITEM_LEVEL_CAP, false) }
      expect(itemRank(it), r.id).toBeCloseTo(r.mul, 6)
    }
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
  it('округление не выдаёт четырёхзначную мантиссу', () => {
    // 999 999 -> v = 999.999 -> toFixed(0) = «1000»: на экране был «1000K».
    expect(fmt(999_999)).toBe('1.0M')
    expect(fmt(999_999_999)).toBe('1.0B')
    // Обратная сторона порога: 99 999 не должно печататься как «100.0K».
    expect(fmt(99_999)).toBe('100K')
  })
  it('fmt держит числа за пределом 10^24 (глубина)', () => {
    // Список суффиксов кончался на «ad», и цены в мастерской уезжали за край
    // карточки как «3.1034826186448245e+34ad».
    expect(fmt(3.10348261864448245e34)).toBe('31.0ag')
    expect(fmt(1e300)).not.toMatch(/e\+/)
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
