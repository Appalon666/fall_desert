// Тесты состояния игры: экономика, волны/зоны/босс, престиж, сейв/загрузка,
// классовые механики, офлайн-доход, инвентарь. GameState развязан от Phaser.
import { describe, it, expect, beforeEach } from 'vitest'
import { GameState } from '../src/state/GameState.js'
import { zoneKillsFor } from '../src/data/progression.js'
import { BAL } from '../src/data/balance.js'
import { rollItem } from '../src/data/loot.js'
import { RELIC_PART_IDS } from '../src/data/relics.js'

const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)(123)
const item = (over = {}) => ({ ...rollItem(rng, 5, 0), ...over })

let s
beforeEach(() => { localStorage.clear(); s = new GameState() })

describe('экономика: апгрейды и союзники', () => {
  it('покупка апгрейда списывает крышки и поднимает уровень', () => {
    s.addCaps(1000)
    const before = s.caps
    const ok = s.buyUpgrade('damage')
    expect(ok).toBe(true)
    expect(s.upgLevel('damage')).toBe(1)
    expect(s.caps).toBeLessThan(before)
  })
  it('не купить без крышек', () => {
    s.caps = 0
    expect(s.buyUpgrade('damage')).toBe(false)
    expect(s.upgLevel('damage')).toBe(0)
  })
  it('урон клика растёт от апгрейда Калибр', () => {
    const base = s.clickDamage(false)
    s.addCaps(1e9)
    for (let i = 0; i < 10; i++) s.buyUpgrade('damage')
    expect(s.clickDamage(false)).toBeGreaterThan(base * 3)
  })
  it('найм союзника дорожает и повышает DPS', () => {
    s.addCaps(1e9)
    expect(s.allyDps()).toBe(0)
    s.hireAlly('dog')
    const c1 = s.caps
    s.hireAlly('dog')
    expect(s.allyDps()).toBeGreaterThan(0)
    // второй пёс дороже первого (цена растёт)
    expect(c1 - s.caps).toBeGreaterThan(50)
  })
})

describe('глубинный рамп', () => {
  // Рамп считает СВОИ убийства, а не totalKills: иначе на входе в 30-ю локацию
  // накопленных за забег хватило бы сразу на ×19 — стена вместо рампа.
  it('до deepZoneStart не работает ни одна из двух составляющих', () => {
    const st = new GameState()
    st.zoneIndex = BAL.deepZoneStart - 2 // локация номер deepZoneStart-1
    for (let i = 0; i < 100; i++) st.registerKill()
    expect(st.deepKills).toBe(0)
    expect(st.deepZoneLevels()).toBe(0)
    expect(st.deepZoneMul()).toBe(1)
    expect(st.deepZoneSpeedMul()).toBe(1)
  })

  it('за каждую локацию глубже deepZoneStart — +deepZoneRamp', () => {
    const st = new GameState()
    st.zoneIndex = BAL.deepZoneStart + 9 // десять локаций сверх порога
    expect(st.deepZoneLevels()).toBe(10)
    expect(st.deepZoneMul()).toBeCloseTo(Math.pow(BAL.deepZoneRamp, 10), 10)
  })

  it('за каждые deepKillStep убийств на глубине — +deepKillRamp', () => {
    const st = new GameState()
    st.zoneIndex = BAL.deepZoneStart - 1 // это и есть локация номер deepZoneStart
    for (let i = 0; i < BAL.deepKillStep * 3; i++) st.registerKill()
    expect(st.deepKills).toBe(BAL.deepKillStep * 3)
    expect(st.deepZoneSteps()).toBe(3)
    expect(st.deepZoneMul()).toBeCloseTo(Math.pow(BAL.deepKillRamp, 3), 10)
    st.registerKill() // неполный шаг ступень не двигает
    expect(st.deepZoneSteps()).toBe(3)
  })

  // Главное: одно НЕ заменило другое — множители складываются в произведение.
  it('обе составляющие работают вместе', () => {
    const st = new GameState()
    st.zoneIndex = BAL.deepZoneStart + 4 // пять локаций сверх порога
    st.deepKills = BAL.deepKillStep * 7
    expect(st.deepZoneMul()).toBeCloseTo(
      Math.pow(BAL.deepZoneRamp, 5) * Math.pow(BAL.deepKillRamp, 7), 10)
    expect(st.deepZoneMul()).toBeGreaterThan(Math.pow(BAL.deepZoneRamp, 5))
    expect(st.deepZoneMul()).toBeGreaterThan(Math.pow(BAL.deepKillRamp, 7))
  })

  it('босс-ворота глубины тоже считаются', () => {
    const st = new GameState()
    st.zoneIndex = BAL.deepZoneStart - 1
    st.registerBossKill()
    expect(st.deepKills).toBe(1)
  })

  // Скорость — единственное, что нельзя отдавать экспоненте: иначе на глубине
  // враг пересекает арену быстрее, чем игрок успевает кликнуть.
  it('скорость упирается в потолок, HP и урон — нет', () => {
    const st = new GameState()
    st.zoneIndex = 500
    st.deepKills = 100000
    expect(st.deepZoneSpeedMul()).toBe(BAL.deepSpeedCap)
    expect(st.deepZoneMul()).toBeGreaterThan(BAL.deepSpeedCap)
  })

  it('счётчик глубины переживает сейв и обнуляется перерождением', () => {
    const st = new GameState()
    st.zoneIndex = BAL.deepZoneStart - 1
    for (let i = 0; i < 25; i++) st.registerKill()
    const clone = new GameState()
    clone._apply(JSON.parse(JSON.stringify(st.toJSON())))
    expect(clone.deepKills).toBe(25)
    st.resetRun()
    expect(st.deepKills).toBe(0)
  })
})

describe('крышки за локацию и награда за ролик', () => {
  it('копятся только боевые крышки, продажа лута мимо копилки', () => {
    const st = new GameState()
    st.addBattleCaps(100)
    st.addCaps(500) // продажа/офлайн — не «добыто в локации»
    expect(st.capsInZone).toBe(100)
    expect(st.caps).toBe(600)
  })
  it('взятие локации закрывает копилку и открывает новую', () => {
    const st = new GameState()
    st.addBattleCaps(250)
    st.registerBossKill()
    expect(st.lastZoneCaps).toBe(250)
    expect(st.capsInZone).toBe(0)
    st.addBattleCaps(40)
    expect(st.capsInZone).toBe(40)
    expect(st.lastZoneCaps).toBe(250) // прошлая награда не переписана
  })
  it('копилка переживает перезагрузку сейва', () => {
    const st = new GameState()
    st.addBattleCaps(77)
    const clone = new GameState()
    clone._apply(JSON.parse(JSON.stringify(st.toJSON())))
    expect(clone.capsInZone).toBe(77)
  })
})

describe('массовый разбор и продажа рюкзака', () => {
  const fill = (st) => {
    for (let i = 0; i < 6; i++) st.addItem(rollItem(Math.random, 5 + i, 0))
  }

  it('«всё в лом» опустошает рюкзак и даёт обещанный металлолом', () => {
    const st = new GameState()
    fill(st)
    const { count, scrapGain } = st.bulkValue()
    const before = st.scrap
    const r = st.scrapAll()
    expect(r).toEqual({ count, gained: scrapGain })
    expect(st.inventory).toHaveLength(0)
    expect(st.scrap - before).toBe(scrapGain)
  })

  it('«продать всё» опустошает рюкзак и даёт обещанные крышки', () => {
    const st = new GameState()
    fill(st)
    const { count, capsGain } = st.bulkValue()
    const before = st.caps
    const r = st.sellAll()
    expect(r).toEqual({ count, gained: capsGain })
    expect(st.inventory).toHaveLength(0)
    expect(st.caps - before).toBe(capsGain)
  })

  // Главное обещание кнопок: надетое они не трогают.
  it('надетое не попадает ни в подсчёт, ни под нож', () => {
    const st = new GameState()
    fill(st)
    st.equip(st.inventory[0].uid)
    const worn = Object.values(st.equipment).filter(Boolean)
    expect(worn).toHaveLength(1)
    expect(st.bulkValue().count).toBe(st.inventory.length)
    st.scrapAll()
    expect(Object.values(st.equipment).filter(Boolean)).toEqual(worn)
    expect(st.heroMaxHp()).toBeGreaterThan(0)
  })

  it('на пустом рюкзаке ничего не начисляют', () => {
    const st = new GameState()
    const caps = st.caps, scrap = st.scrap
    expect(st.scrapAll()).toEqual({ count: 0, gained: 0 })
    expect(st.sellAll()).toEqual({ count: 0, gained: 0 })
    expect(st.caps).toBe(caps)
    expect(st.scrap).toBe(scrap)
  })
})

describe('характеристики и крит', () => {
  it('крит-шанс не превышает потолок', () => {
    s.hero.luck = 1000
    expect(s.critChance()).toBeLessThanOrEqual(BAL.critChanceCap)
  })
  // Иначе очки удачи после потолка молча пропадают — ровно тот баг, из-за
  // которого «Крит: 90%» не двигался, а игроку об этом никто не говорил.
  it('перелив крит-шанса сверх потолка уходит в крит-урон', () => {
    s.hero.luck = 0
    expect(s.critOverflow()).toBe(0)
    expect(s.critMultiplier()).toBeCloseTo(BAL.critMultiplier, 6)
    const before = s.critMultiplier()
    s.hero.luck = Math.ceil(BAL.critChanceCap / BAL.perLuckCrit) + 50
    expect(s.critChance()).toBe(BAL.critChanceCap)
    expect(s.critOverflow()).toBeGreaterThan(0)
    expect(s.critMultiplier()).toBeGreaterThan(before)
    expect(s.critMultiplier()).toBeCloseTo(BAL.critMultiplier + s.critOverflow() * BAL.critOverflowToMult, 6)
    // и каждое следующее очко удачи продолжает что-то давать
    const step = s.critMultiplier()
    s.hero.luck += 1
    expect(s.critMultiplier()).toBeGreaterThan(step)
  })
  it('комбо-множитель в пределах [1, comboMax]', () => {
    s.combo = 0; expect(s.comboMult()).toBe(1)
    s.combo = 100000; expect(s.comboMult()).toBeLessThanOrEqual(BAL.comboMax)
    expect(s.comboMult()).toBeGreaterThan(1)
  })
  it('HP растёт от живучести и брони', () => {
    const base = s.heroMaxHp()
    s.hero.vit += 10
    expect(s.heroMaxHp()).toBeGreaterThan(base)
  })
  it('распределение очка увеличивает характеристику', () => {
    s.hero.points = 1
    expect(s.spendPoint('str')).toBe(true)
    expect(s.hero.str).toBe(1)
    expect(s.spendPoint('str')).toBe(false) // очков больше нет
  })
})

describe('волны / зоны / босс-ворота', () => {
  it('registerKill копит убийства и рекорд', () => {
    s.registerKill(); s.registerKill()
    expect(s.totalKills).toBe(2)
    expect(s.killsInZone).toBe(2)
    expect(s.bestScore).toBe(2)
  })
  it('убийство босса продвигает зону и сбрасывает счётчик', () => {
    s.killsInZone = zoneKillsFor()
    s.bossActive = true
    const z = s.zoneIndex
    s.registerBossKill()
    expect(s.zoneIndex).toBe(z + 1)
    expect(s.killsInZone).toBe(0)
    expect(s.bossActive).toBe(false)
  })
  it('смерть от рядовых врагов отнимает часть зоны, но не зону', () => {
    const loss = Math.ceil(zoneKillsFor() * BAL.deathZoneLoss)
    s.zoneIndex = 3; s.killsInZone = 200; s.bossActive = false; s.hp = 1
    s.onHeroDeath()
    expect(s.zoneIndex).toBe(3)
    expect(s.killsInZone).toBe(200 - loss)
    expect(s.hp).toBe(s.heroMaxHp())
  })
  it('смерть в бою с воротами прогресс зоны не трогает — босса бьют заново', () => {
    s.zoneIndex = 3; s.killsInZone = zoneKillsFor(); s.bossActive = true; s.hp = 1
    s.onHeroDeath()
    expect(s.killsInZone).toBe(zoneKillsFor()) // босс придёт сразу, без перегринда
    expect(s.bossActive).toBe(false)
    expect(s.hp).toBe(s.heroMaxHp())
  })
  it('откат не уводит счётчик зоны в минус', () => {
    s.zoneIndex = 1; s.killsInZone = 3; s.bossActive = false
    s.onHeroDeath()
    expect(s.killsInZone).toBe(0)
  })
  it('scaleStage = totalKills (килл-модель)', () => {
    s.totalKills = 77
    expect(s.scaleStage()).toBe(77)
  })
})

describe('престиж (мета)', () => {
  it('ядра растут от глубины забега', () => {
    s.zoneIndex = 2; s.killsInZone = 0
    const a = s.coresFromRun()
    s.zoneIndex = 10
    expect(s.coresFromRun()).toBeGreaterThan(a)
  })
  it('перерождение начисляет ядра и сбрасывает забег', () => {
    s.zoneIndex = 5; s.killsInZone = 40; s.addCaps(9999)
    s.buyUpgrade('damage')
    expect(s.canPrestige()).toBe(true)
    const gain = s.coresFromRun()
    const got = s.doPrestige()
    expect(got).toBe(gain)
    expect(s.cores).toBe(gain)
    expect(s.zoneIndex).toBe(0)
    expect(s.upgLevel('damage')).toBe(0)
    expect(s.prestigeCount).toBe(1)
  })
  it('покупка вечного бонуса списывает ядра и усиливает урон', () => {
    s.cores = 999
    const dmgBefore = s.prestigeDamageMul()
    const cost = s.prestigeCost('legacy')
    expect(s.buyPrestige('legacy')).toBe(true)
    expect(s.prestige.legacy).toBe(1)
    expect(s.cores).toBe(999 - cost)
    expect(s.prestigeDamageMul()).toBeGreaterThan(dmgBefore)
  })
  it('нельзя купить бонус без ядер', () => {
    s.cores = 0
    expect(s.buyPrestige('legacy')).toBe(false)
  })
  it('«Быстрый старт» даёт бесплатные уровни Калибра и стартовые крышки', () => {
    s.prestige.quickstart = 3
    s.resetRun()
    expect(s.upgLevel('damage')).toBe(3)
    expect(s.caps).toBe(3 * 300)
  })
})

describe('классовые механики', () => {
  it('дефолты без класса', () => {
    expect(s.classPierce()).toBe(1)
    expect(s.classLifesteal()).toBe(0)
    expect(s.classOfflineBonus()).toBe(0)
  })
  it('Стрелок — пробитие, Бугай — вампиризм, Механик — офлайн', () => {
    const g = new GameState(); g.chooseClass('gunner'); expect(g.classPierce()).toBe(2)
    const b = new GameState(); b.chooseClass('brute'); expect(b.classLifesteal()).toBeGreaterThan(0)
    const m = new GameState(); m.chooseClass('mechanic'); expect(m.classOfflineBonus()).toBeGreaterThan(0)
  })
  it('класс применяет стартовые характеристики', () => {
    s.chooseClass('brute')
    expect(s.hero.vit).toBeGreaterThan(0)
  })
})

describe('офлайн-доход', () => {
  it('копится от союзников и ограничен потолком', () => {
    s.addCaps(1e9); s.hireAlly('turret'); s.hireAlly('turret')
    s.lastSeen = Date.now() - 3600 * 1000 // час назад
    const res = s.computeOffline()
    expect(res.caps).toBeGreaterThan(0)
    // за бесконечное отсутствие доход не превышает потолок времени
    s.lastSeen = Date.now() - 999 * 3600 * 1000
    const capped = s.computeOffline()
    const maxByCap = s.allyDps() * 0.12 * BAL.offlineFactor * BAL.offlineCapSeconds * 2
    expect(capped.caps).toBeLessThan(maxByCap)
  })
  it('Механик получает больше офлайна, чем безклассовый', () => {
    const mk = (cls) => { localStorage.clear(); const g = new GameState(); if (cls) g.chooseClass(cls); g.allies = { turret: 5 }; g.lastSeen = Date.now() - 3600 * 1000; return g.computeOffline().caps }
    expect(mk('mechanic')).toBeGreaterThan(mk(null))
  })
})

describe('сейв / загрузка / облако', () => {
  it('roundtrip сохраняет ключевые поля', () => {
    s.chooseClass('scavenger')
    s.addCaps(4242); s.zoneIndex = 7; s.totalKills = 500; s.cores = 12; s.prestige.legacy = 4
    s.save(true)
    const s2 = new GameState()
    expect(s2.caps).toBe(4242)
    expect(s2.zoneIndex).toBe(7)
    expect(s2.totalKills).toBe(500)
    expect(s2.cores).toBe(12)
    expect(s2.prestige.legacy).toBe(4)
    expect(s2.heroClass).toBe('scavenger')
  })
  it('_apply отсекает не-конечные числа (защита от старого переполнения)', () => {
    s._apply({ caps: Infinity, scrap: NaN, totalKills: Infinity })
    expect(s.caps).toBe(0)
    expect(s.scrap).toBe(0)
    expect(s.totalKills).toBe(0)
  })
  it('облако применяется только если прогрессивнее и сессия не начата', () => {
    s._started = false
    s.prestigeCount = 1; s.bestScore = 100
    // менее прогрессивное облако игнорируется
    s.applyCloud({ prestigeCount: 0, bestScore: 50, caps: 9 })
    expect(s.caps).not.toBe(9)
    // более прогрессивное применяется
    s.applyCloud({ prestigeCount: 5, bestScore: 999, caps: 777 })
    expect(s.caps).toBe(777)
  })
  it('после старта сессии облако не затирает игру', () => {
    s._started = true
    s.caps = 100
    s.applyCloud({ prestigeCount: 99, bestScore: 99999, caps: 5 })
    expect(s.caps).toBe(100)
  })
})

describe('инвентарь и экипировка', () => {
  it('экипировка предмета переносит его в слот и влияет на статы', () => {
    const w = item({ slot: 'weapon', stat: 'clickMul', value: 0.5, rarity: 'rare' })
    s.addItem(w)
    const dmgBefore = s.clickDamage(false)
    s.equip(w.uid)
    expect(s.equipment.weapon).toBeTruthy()
    expect(s.clickDamage(false)).toBeGreaterThan(dmgBefore)
    s.unequip('weapon')
    expect(s.equipment.weapon).toBe(null)
  })
  it('продажа даёт крышки, разбор — металлолом', () => {
    const a = item({ rarity: 'rare', level: 5 })
    s.addItem(a)
    const caps0 = s.caps
    s.sellItem(a.uid)
    expect(s.caps).toBeGreaterThan(caps0)

    const b = item({ rarity: 'epic', level: 5 })
    s.addItem(b)
    const scrap0 = s.scrap
    s.scrapItem(b.uid)
    expect(s.scrap).toBeGreaterThan(scrap0)
  })
  it('sanitizeItems мигрирует старый слот trinket → accessory', () => {
    s.inventory = [{ uid: 'x1', slot: 'trinket', rarity: 'common', stat: 'clickMul', value: 0.1, level: 1 }]
    s.sanitizeItems()
    expect(s.inventory[0].slot).toBe('accessory')
  })
  it('продажа предмета без level не ломает крышки (не NaN)', () => {
    // Старый/битый предмет без поля level раньше давал caps = NaN навсегда.
    s.inventory = [{ uid: 'noLvl', slot: 'weapon', rarity: 'common', stat: 'clickMul', value: 0.1 }]
    s.sanitizeItems()
    expect(s.inventory[0].level).toBe(1)
    const caps0 = s.caps
    s.sellItem('noLvl')
    expect(Number.isFinite(s.caps)).toBe(true)
    expect(s.caps).toBeGreaterThan(caps0)
  })
})

describe('мультипокупка союзников', () => {
  it('hireAllyMulti списывает крышки, растит счётчик и эмитит caps', () => {
    s.addCaps(1e9)
    let capsEvents = 0
    s.on('caps', () => { capsEvents++ })
    const caps0 = s.caps
    const n = s.hireAllyMulti('dog', 10)
    expect(n).toBe(10)
    expect(s.allies.dog).toBe(10)
    expect(s.caps).toBeLessThan(caps0)
    expect(capsEvents).toBeGreaterThan(0)
  })
})

describe('реликвии: части, дубли, ковка', () => {
  it('до первой ковки дубли не падают — набор собирается ровно за 5 бросков', () => {
    for (let i = 0; i < RELIC_PART_IDS.length; i++) {
      const res = s.rollRelicPart(rng)
      expect(res.dupe).toBe(false)
      expect(s.relicPartsOwned().length).toBe(i + 1)
    }
    expect(s.canCraftRelic()).toBe(true)
  })
  it('ковка тратит все части, даёт оранжевый предмет и считается', () => {
    RELIC_PART_IDS.forEach(() => s.rollRelicPart(rng))
    const before = s.inventory.length
    const item = s.craftRelic()
    expect(item).toBeTruthy()
    expect(item.rarity).toBe('relic')
    expect(s.inventory.length).toBe(before + 1)
    expect(s.relicPartsOwned().length).toBe(0)
    expect(s.relicsCrafted).toBe(1)
    expect(s.canCraftRelic()).toBe(false)
  })
  it('без полного набора ковка не проходит', () => {
    s.rollRelicPart(rng)
    expect(s.craftRelic()).toBe(null)
    expect(s.relicPartsOwned().length).toBe(1)
  })
  it('после первой ковки появляются дубли — примерно с заданным шансом', () => {
    RELIC_PART_IDS.forEach(() => s.rollRelicPart(rng))
    s.craftRelic()
    // набор пуст, реликвия сделана: гоняем броски и считаем повторы
    let dupes = 0, rolls = 0
    for (let i = 0; i < 4000; i++) {
      if (s.canCraftRelic()) { s.craftRelic(); continue }
      const res = s.rollRelicPart(rng)
      rolls++
      if (res.dupe) dupes++
    }
    const rate = dupes / rolls
    expect(rate).toBeGreaterThan(BAL.relicDupeChance * 0.6)
    expect(rate).toBeLessThan(BAL.relicDupeChance * 1.6)
  })
  it('дубль идёт в металлолом, а не пропадает', () => {
    RELIC_PART_IDS.forEach(() => s.rollRelicPart(rng))
    s.craftRelic()
    s.rollRelicPart(rng) // одна часть в наборе — есть из чего делать дубль
    const scrap0 = s.scrap
    let got = null
    for (let i = 0; i < 500 && !got; i++) { const r = s.rollRelicPart(rng); if (r.dupe) got = r }
    if (got) {
      expect(got.scrap).toBeGreaterThan(0)
      expect(s.scrap).toBeGreaterThan(scrap0)
    }
  })
  it('части и счётчик реликвий переживают перерождение и сейв', () => {
    s.rollRelicPart(rng); s.rollRelicPart(rng)
    s.zoneIndex = 9
    s.doPrestige()
    expect(s.relicPartsOwned().length).toBe(2)
    const raw = JSON.parse(JSON.stringify(s.toJSON()))
    const s2 = new GameState()
    s2._apply(raw)
    expect(s2.relicPartsOwned().length).toBe(2)
  })
  it('битые части из старого сейва отбрасываются', () => {
    const s2 = new GameState()
    s2._apply({ relicParts: ['gear', 'ерунда', 'gear2'], relicsCrafted: 2 })
    expect(s2.relicParts).toEqual(['gear'])
    expect(s2.relicsCrafted).toBe(2)
  })
})

describe('смерть: штраф нельзя обойти перезагрузкой', () => {
  it('незакрытая смерть доигрывается на загрузке', () => {
    s.zoneIndex = 2; s.killsInZone = 150; s.bossActive = false
    s.beginDeath()
    expect(s.pendingDeath).toBe(true)
    // игрок перезагрузил страницу — состояние поднимается из сейва
    const raw = JSON.parse(JSON.stringify(s.toJSON()))
    const s2 = new GameState()
    s2._apply(raw)
    expect(s2.pendingDeath).toBe(true)
    expect(s2.resolvePendingDeath()).toBe(true)
    expect(s2.killsInZone).toBe(150 - Math.ceil(zoneKillsFor() * BAL.deathZoneLoss))
    expect(s2.pendingDeath).toBe(false)
    expect(s2.resolvePendingDeath()).toBe(false) // второй раз штраф не берётся
  })
  it('возрождение за рекламу отменяет штраф целиком', () => {
    s.zoneIndex = 2; s.killsInZone = 150; s.bossActive = true
    s.beginDeath()
    s.cancelDeath()
    expect(s.pendingDeath).toBe(false)
    expect(s.killsInZone).toBe(150)
    expect(s.bossActive).toBe(false)
    expect(s.hp).toBe(s.heroMaxHp())
  })
})
