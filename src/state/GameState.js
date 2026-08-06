// Центральное состояние игры + вычисление производных статов + сохранение.
// Единый источник правды для всех сцен. Наследует EventEmitter — сцены могут
// слушать изменения ('caps','stats','level',...), но чаще просто перечитывают.

import { Emitter } from '../util/emitter.js'
import { BAL } from '../data/balance.js'
import { UPGRADES, upgradeCost } from '../data/upgrades.js'
import { ALLIES, allyCost } from '../data/allies.js'
import { CLASS_BY_ID } from '../data/classes.js'
import { EQUIP_KEYS, SLOT_BY_ID, RARITY_BY_ID, rollItem, scrapValue, CRAFT_TIERS, weaponStyleFor, itemPower, ITEM_LEVEL_CAP } from '../data/loot.js'
import { RELIC_PART_IDS, RELIC_PART_BY_ID, RELIC_DUPE_SCRAP } from '../data/relics.js'
import { zoneHpMul } from '../data/zones.js'
import { zoneKillsFor } from '../data/progression.js'
import { Platform } from '../platform/yandex.js'

const SAVE_KEY = 'wasteland_save_v1'
// С какой пройденной зоны открывается перерождение (см. canPrestige/coresFromRun).
const PRESTIGE_GATE_ZONE = 4
const CAPS_PER_DPS = 0.12 // перевод idle-DPS в крышки/сек для офлайн-дохода

export class GameState extends Emitter {
  constructor() {
    super()
    this.bestScore = 0
    this.reset()
    this.load()
  }

  reset() {
    this.caps = 0
    this.heroClass = null // выбирается при первом входе
    this.hero = { level: 1, xp: 0, points: 0, str: 0, vit: 0, luck: 0 }
    this.upgrades = {}
    this.allies = {}
    this.equipment = { weapon: null, helmet: null, armor: null, boots: null, acc1: null, acc2: null }
    this.inventory = []
    this.scrap = 0 // металлолом (сохраняется между перерождениями)
    // Части реликвии: id собранных. Как и металлолом, переживают перерождение —
    // иначе набор из пяти частей не собрать в принципе.
    this.relicParts = []
    this.relicsCrafted = 0 // сколько реликвий уже сковано (от этого зависят дубли)
    // Герой пал, но игрок ещё не выбрал «возродиться за рекламу» или «смириться».
    // Флаг сохраняется: иначе перезагрузка страницы прямо на экране смерти
    // отменяла штраф целиком — бесплатный способ никогда не терять прогресс.
    this.pendingDeath = false
    this.zoneIndex = 0
    this.killsInZone = 0
    this.totalKills = 0
    this.waveCount = 0      // сколько волн выпущено за забег (+1% к врагам за волну)
    this.bossActive = false // идёт бой с боссом-воротами зоны
    // престиж (сохраняется между перерождениями)
    this.cores = 0
    this.prestige = { legacy: 0, stash: 0, vitality: 0, quickstart: 0 }
    this.prestigeCount = 0
    this.lastSeen = Date.now()
    // transient
    this.hp = this.heroMaxHp()
    this.combo = 0
    this.ult = 0
    this._lastLocalSave = 0 // троттлинг записи в localStorage
    this._started = false   // началась ли игровая сессия (защита от позднего облака)
  }

  // Сброс забега при перерождении: копит крышки/апгрейды/уровень/зоны,
  // но сохраняет ядра, престиж-бонусы, экипировку, рекорд и класс.
  resetRun() {
    const cls = this.classDef()
    this.caps = this.prestige.quickstart * 300
    this.hero = { level: 1, xp: 0, points: 0, str: 0, vit: 0, luck: 0 }
    // «Быстрый старт» даёт бесплатные уровни Калибра — мультипликативный разгон
    // следующего забега (компаунд меты, а не бесполезные стартовые крышки).
    this.upgrades = this.prestige.quickstart > 0 ? { damage: this.prestige.quickstart } : {}
    this.allies = {}
    if (cls) {
      this.hero.str += cls.startStats.str || 0
      this.hero.vit += cls.startStats.vit || 0
      this.hero.luck += cls.startStats.luck || 0
      for (const [aid, n] of Object.entries(cls.startAllies || {})) this.allies[aid] = (this.allies[aid] || 0) + n
    }
    this.zoneIndex = 0
    this.killsInZone = 0
    this.totalKills = 0
    this.waveCount = 0
    this.bossActive = false
    this.hp = this.heroMaxHp()
    this.combo = 0
    this.ult = 0
  }

  // ---------- классы ----------
  classDef() { return this.heroClass ? CLASS_BY_ID[this.heroClass] : null }
  classBonus(stat) { const c = this.classDef(); return (c && c.bonus[stat]) || 0 }
  // Сигнатурные механики классов (с безопасными дефолтами).
  classPierce() { const c = this.classDef(); return (c && c.pierce) || 1 }
  classLifesteal() { const c = this.classDef(); return (c && c.lifesteal) || 0 }
  classOfflineBonus() { const c = this.classDef(); return (c && c.offlineBonus) || 0 }
  chooseClass(id) {
    const c = CLASS_BY_ID[id]
    if (!c) return false
    this.heroClass = id
    this.hero.str += c.startStats.str || 0
    this.hero.vit += c.startStats.vit || 0
    this.hero.luck += c.startStats.luck || 0
    for (const [aid, n] of Object.entries(c.startAllies || {})) this.allies[aid] = (this.allies[aid] || 0) + n
    this.hp = this.heroMaxHp()
    this.save()
    return true
  }

  // ---------- производные статы ----------
  upgLevel(id) { return this.upgrades[id] || 0 }
  upgAdd(stat) {
    let s = 0
    for (const u of UPGRADES) if (u.kind === 'add' && u.stat === stat) s += this.upgLevel(u.id) * u.perLevel
    return s
  }
  upgPow(stat) {
    let p = 1
    for (const u of UPGRADES) if (u.kind === 'pow' && u.stat === stat) p *= Math.pow(u.mul, this.upgLevel(u.id))
    return p
  }
  equipSum(stat) {
    let s = 0
    for (const key of EQUIP_KEYS) {
      const it = this.equipment[key]
      if (it && it.stat === stat) s += it.value
    }
    return s
  }
  // Бонус к получаемым крышкам (класс + обувь/аксессуары).
  capsBonus() { return this.equipSum('capsMul') + this.classBonus('capsMul') + this.prestigeCapsMul() }
  // Удача для дропа лута (характеристика + класс).
  lootLuck() { const c = this.classDef(); return this.hero.luck * 0.05 + (c ? c.lootLuck : 0) }
  // Визуал выстрела по надетому оружию (без оружия — пистоль по умолчанию).
  weaponStyle() { return weaponStyleFor(this.equipment.weapon) }

  // ---------- престиж ----------
  // Бонусы подняты (было 0.12/0.10/0.12): при мягком множителе врагов от меты
  // (enemyMetaHpMul, показатель 0.35) чистый прирост с уровня «Наследия» —
  // 1.2^0.65 ≈ +12%, то есть прежние +12% почти целиком съедались.
  prestigeDamageMul() { return 1 + this.prestige.legacy * 0.20 }
  prestigeHpMul() { return this.prestige.vitality * 0.15 }
  prestigeCapsMul() { return this.prestige.stash * 0.20 }
  // Награда за перерождение растёт ЭКСПОНЕНЦИАЛЬНО по глубине, потому что цена
  // вечных бонусов тоже экспоненциальна (3 × 1.5^уровень). При линейной награде
  // (4 + зона) глубокий забег давал 5-6 ядер — ровно один уровень бонуса, и
  // метапетля не работала: в симуляции забег за забегом упирался в 5-ю зону.
  // Показатель — BAL.coresDepthGrowth: идти вглубь выгоднее, чем перерождаться
  // на гейте, но награда не улетает в тысячи ядер на глубоких зонах.
  coresFromRun() {
    if (this.zoneIndex < PRESTIGE_GATE_ZONE) return 0
    return Math.floor(4 * Math.pow(BAL.coresDepthGrowth, this.zoneIndex - PRESTIGE_GATE_ZONE))
  }
  // Масштаб врагов под ПЕРМАНЕНТНУЮ силу героя (мета). Иначе после престижа
  // враги картонные (их HP считается от totalKills, что сброшено, а бонусы меты —
  // нет). Берём ~70% прироста: накал сохраняется, но герой всё равно чуть сильнее
  // → глубина от забега к забегу растёт (компаунд), а не обнуляется.
  // Перманентное усиление врагов за каждое перерождение: +3% (компаундится).
  // Было +5%, и вместе с postPrestigeLevelMul (см. ниже) мета уходила в минус:
  // после престижа забег упирался в ту же зону, что и до него.
  prestigeEnemyMul() { return Math.pow(1.03, this.prestigeCount) }
  enemyMetaHpMul() {
    // Мягко: основную «не-картонность» после престижа даёт enemyProgMul (уровень),
    // здесь лишь небольшая добавка, чтобы глубина от престижа всё же росла.
    // Показатель 0.45 → 0.35: престиж должен ОКУПАТЬСЯ глубиной, иначе метапетля
    // бессмысленна (в симуляции стена стояла на 5-й зоне забег за забегом).
    //
    // Убран множитель за уровень героя (1.025^(level-10) после 1-го престижа):
    // он наказывал за прокачку — при 118 уровнях враги толстели в 14 раз, и
    // вся выгода перерождения съедалась. Уровень теперь и так редкий
    // (см. xpFromKill), а сдерживание уровня делает enemyProgMul.
    const power = this.prestigeDamageMul() * Math.pow(1.15, this.prestige.quickstart)
    return Math.pow(power, 0.35) * this.prestigeEnemyMul()
  }
  enemyMetaDmgMul() { return (1 + this.prestigeHpMul() * 0.45) * this.prestigeEnemyMul() }
  // Прогрессия HP врагов по уровню героя и зоне — чтобы очки силы от левелапов
  // не превращали мобов в картон. Ранний разгон до cap, затем мягкий хвост.
  enemyProgMul() {
    const lv = this.hero.level - 1
    const ramp = Math.pow(BAL.enemyLevelRamp, Math.min(lv, BAL.enemyLevelRampCap))
    const tail = Math.pow(BAL.enemyLevelTail, Math.max(0, lv - BAL.enemyLevelRampCap))
    return ramp * tail * zoneHpMul(this.zoneIndex)
  }
  // Нарастание за волну ВНУТРИ зоны: каждая волна +1% (к боссу ~+35%),
  // новая зона обнуляет счётчик (но базовая сложность зоны выше). Так «каждая
  // волна сильнее» ощущается, но не компаундится в абсурд за сотни волн.
  waveScaleMul() { return Math.pow(BAL.enemyWaveRamp, this.waveCount) }
  bumpWave() { this.waveCount++ }
  // Перерождение открывается после босса 4-й локации: zoneIndex доходит до 4,
  // то есть четыре зоны пройдены. Локаций теперь десять, но гейт оставлен
  // ранним намеренно — мета-петля не должна ждать полного прохождения; за
  // остальные шесть локаций игрок получает ядра сверх базовых (coresFromRun).
  canPrestige() { return this.zoneIndex >= PRESTIGE_GATE_ZONE }
  doPrestige() {
    if (!this.canPrestige()) return 0
    const gain = this.coresFromRun()
    if (gain < 1) return 0
    this.cores += gain
    this.prestigeCount++
    this.resetRun()
    this.save()
    return gain
  }
  prestigeCost(id) {
    const bases = { legacy: 3, stash: 3, vitality: 3, quickstart: 5 }
    return Math.floor(bases[id] * Math.pow(BAL.prestigeCostGrowth, this.prestige[id] || 0))
  }
  buyPrestige(id) {
    if (!(id in this.prestige)) return false
    const cost = this.prestigeCost(id)
    if (this.cores < cost) return false
    this.cores -= cost
    this.prestige[id]++
    this.emit('prestige'); this.save()
    return true
  }

  comboMult() {
    const steps = Math.floor(this.combo / BAL.comboHitsPerStep)
    return Math.min(BAL.comboMax, 1 + steps * BAL.comboStep)
  }
  clickDamage(withCombo = true) {
    const flat = BAL.baseClickDamage + this.hero.str * BAL.perStrength
    const mul = 1 + this.upgAdd('clickMul') + this.equipSum('clickMul') + this.classBonus('clickMul')
    let dmg = flat * mul * this.upgPow('clickPow') * this.prestigeDamageMul()
    if (withCombo) dmg *= this.comboMult()
    return dmg
  }
  // Картечь: доля урона, которую попадание переносит на соседних врагов.
  splashFrac() { return this.upgAdd('splash') }
  critChance() {
    return Math.min(0.9,
      BAL.baseCritChance + this.hero.luck * BAL.perLuckCrit
      + this.upgAdd('critChance') + this.equipSum('critChance') + this.classBonus('critChance'))
  }
  heroMaxHp() {
    const flat = BAL.baseHeroHp + this.hero.vit * BAL.perVitality
    const mul = 1 + this.equipSum('hpMul') + this.classBonus('hpMul') + this.prestigeHpMul()
    return Math.floor(flat * mul * this.upgPow('hpPow'))
  }
  allyDps() {
    let base = 0
    for (const a of ALLIES) base += (this.allies[a.id] || 0) * a.dps
    return base * (1 + this.upgAdd('allyMul') + this.equipSum('allyMul') + this.classBonus('allyMul')) * this.upgPow('allyPow')
  }

  // ---------- опыт / уровни ----------
  xpToNext() { return Math.floor(BAL.baseXpToLevel * Math.pow(BAL.xpGrowth, this.hero.level - 1)) }
  addXp(n) {
    this.hero.xp += n
    let leveled = false
    while (this.hero.xp >= this.xpToNext()) {
      this.hero.xp -= this.xpToNext()
      this.hero.level++
      this.hero.points += BAL.pointsPerLevel
      leveled = true
    }
    if (leveled) this.emit('level')
    return leveled
  }
  spendPoint(stat) {
    if (this.hero.points <= 0 || !['str', 'vit', 'luck'].includes(stat)) return false
    this.hero.points--
    this.hero[stat]++
    if (stat === 'vit') this.hp = Math.min(this.heroMaxHp(), this.hp + BAL.perVitality)
    this.emit('stats')
    this.save()
    return true
  }

  // ---------- экономика ----------
  addCaps(n) { this.caps += n; this.emit('caps') }
  spend(n) { if (this.caps < n) return false; this.caps -= n; this.emit('caps'); return true }
  buyUpgrade(id) {
    const def = UPGRADES.find(u => u.id === id)
    const cost = upgradeCost(def, this.upgLevel(id))
    if (!this.spend(cost)) return false
    this.upgrades[id] = this.upgLevel(id) + 1
    this.emit('upgrade'); this.save()
    return true
  }
  hireAlly(id) {
    const def = ALLIES.find(a => a.id === id)
    const owned = this.allies[id] || 0
    const cost = allyCost(def, owned)
    if (!this.spend(cost)) return false
    this.allies[id] = owned + 1
    this.emit('ally'); this.save()
    return true
  }

  // ---------- мультипокупка (x1 / x10 / max) ----------
  // Возвращает {count, cost}: для числового mode — ровно mode уровней; для 'max'
  // — сколько влезает в текущие крышки.
  upgradeQuote(id, mode) {
    const def = UPGRADES.find(u => u.id === id)
    const lvl = this.upgLevel(id)
    if (mode === 'max') {
      const budget = Number.isFinite(this.caps) ? this.caps : 0
      let n = 0, cost = 0
      for (; n < 100000;) { const c = upgradeCost(def, lvl + n); if (cost + c > budget) break; cost += c; n++ }
      return { count: n, cost }
    }
    let cost = 0
    for (let i = 0; i < mode; i++) cost += upgradeCost(def, lvl + i)
    return { count: mode, cost }
  }
  buyUpgradeMulti(id, mode) {
    const q = this.upgradeQuote(id, mode)
    if (q.count <= 0 || this.caps < q.cost) return 0
    this.caps -= q.cost
    this.upgrades[id] = this.upgLevel(id) + q.count
    this.emit('caps'); this.emit('upgrade'); this.save()
    return q.count
  }
  allyQuote(id, mode) {
    const def = ALLIES.find(a => a.id === id)
    const owned = this.allies[id] || 0
    if (mode === 'max') {
      const budget = Number.isFinite(this.caps) ? this.caps : 0
      let n = 0, cost = 0
      for (; n < 100000;) { const c = allyCost(def, owned + n); if (cost + c > budget) break; cost += c; n++ }
      return { count: n, cost }
    }
    let cost = 0
    for (let i = 0; i < mode; i++) cost += allyCost(def, owned + i)
    return { count: mode, cost }
  }
  hireAllyMulti(id, mode) {
    const q = this.allyQuote(id, mode)
    if (q.count <= 0 || this.caps < q.cost) return 0
    this.caps -= q.cost
    this.allies[id] = (this.allies[id] || 0) + q.count
    this.emit('caps'); this.emit('ally'); this.save()
    return q.count
  }

  // ---------- лут ----------
  addItem(it) { this.inventory.push(it); this.emit('inventory') }
  // В какое гнездо пойдёт предмет данного слота.
  targetKey(slot) {
    if (slot === 'accessory') {
      if (!this.equipment.acc1) return 'acc1'
      if (!this.equipment.acc2) return 'acc2'
      return 'acc1' // оба заняты — заменяем первое
    }
    return slot
  }
  equip(uid) {
    const idx = this.inventory.findIndex(i => i.uid === uid)
    if (idx < 0) return
    const it = this.inventory[idx]
    const key = this.targetKey(it.slot)
    const prev = this.equipment[key]
    this.equipment[key] = it
    this.inventory.splice(idx, 1)
    if (prev) this.inventory.push(prev)
    this.emit('inventory'); this.emit('stats'); this.save()
  }
  unequip(key) {
    const it = this.equipment[key]
    if (!it) return
    this.inventory.push(it)
    this.equipment[key] = null
    this.emit('inventory'); this.emit('stats'); this.save()
  }
  sellItem(uid) {
    const idx = this.inventory.findIndex(i => i.uid === uid)
    if (idx < 0) return
    const it = this.inventory[idx]
    this.inventory.splice(idx, 1)
    this.addCaps(10 + (it.level || 1) * 3)
    this.emit('inventory'); this.save()
  }
  // Разобрать предмет на металлолом.
  scrapItem(uid) {
    const idx = this.inventory.findIndex(i => i.uid === uid)
    if (idx < 0) return 0
    const it = this.inventory[idx]
    const gain = scrapValue(it)
    this.inventory.splice(idx, 1)
    this.scrap += gain
    this.emit('inventory'); this.emit('scrap'); this.save()
    return gain
  }
  // Разобрать весь хлам до заданной редкости включительно (по индексу RARITIES).
  scrapAllUpTo(maxIdx) {
    const order = ['common', 'uncommon', 'rare', 'epic', 'relic']
    let gained = 0, count = 0
    this.inventory = this.inventory.filter((it) => {
      const rIdx = order.indexOf(it.rarity)
      if (rIdx >= 0 && rIdx <= maxIdx) { gained += scrapValue(it); count++; return false }
      return true
    })
    if (count) { this.scrap += gained; this.emit('inventory'); this.emit('scrap'); this.save() }
    return { count, gained }
  }
  // Крафт случайного предмета за металлолом; тир задаёт шанс качества (luck).
  craft(tierId) {
    const t = CRAFT_TIERS.find(c => c.id === tierId)
    if (!t || this.scrap < t.cost) return null
    this.scrap -= t.cost
    const item = rollItem(Math.random, Math.floor(this.enemyLevel()), t.luck + this.lootLuck())
    this.addItem(item)
    this.emit('scrap'); this.save()
    return item
  }

  // ---------- реликвии ----------
  hasRelicPart(id) { return this.relicParts.includes(id) }
  relicPartsOwned() { return RELIC_PART_IDS.filter(id => this.hasRelicPart(id)) }
  canCraftRelic() { return this.relicPartsOwned().length >= RELIC_PART_IDS.length }
  // Бросок части с босса десятой локации. Возвращает описание результата, чтобы
  // бой мог показать всплывашку: { part, dupe, scrap }.
  //
  // Пока ни одной реликвии не сковано, дубли исключены полностью — падает
  // случайная из НЕДОСТАЮЩИХ. Это делает путь к первой реликвии предсказуемым:
  // ровно пять успешных бросков. После первой ковки 20% бросков дают повтор,
  // который идёт в металлолом, — гринд следующих реликвий длиннее.
  rollRelicPart(rng = Math.random) {
    const missing = RELIC_PART_IDS.filter(id => !this.hasRelicPart(id))
    const owned = this.relicPartsOwned()
    const dupeAllowed = this.relicsCrafted > 0 && owned.length > 0
    const dupe = missing.length === 0 || (dupeAllowed && rng() < BAL.relicDupeChance)
    if (dupe) {
      // Набор уже полон или выпал повтор — металлолом вместо части.
      const id = owned[Math.floor(rng() * owned.length)]
      this.scrap += RELIC_DUPE_SCRAP
      this.emit('scrap'); this.save()
      return { part: RELIC_PART_BY_ID[id], dupe: true, scrap: RELIC_DUPE_SCRAP }
    }
    const id = missing[Math.floor(rng() * missing.length)]
    this.relicParts.push(id)
    this.emit('relic'); this.save()
    return { part: RELIC_PART_BY_ID[id], dupe: false, scrap: 0 }
  }
  // Ковка: тратит все пять частей, даёт случайную реликвию (оранжевый тир).
  craftRelic() {
    if (!this.canCraftRelic()) return null
    this.relicParts = this.relicParts.filter(id => !RELIC_PART_IDS.includes(id))
    this.relicsCrafted++
    const item = rollItem(Math.random, Math.floor(this.enemyLevel()), this.lootLuck(), 'relic')
    this.addItem(item)
    this.emit('relic'); this.save()
    return item
  }

  // ---------- зоны / убийства ----------
  // Стадия масштабирования = всего убито (само-балансирует TTK). Для лута — та же.
  scaleStage() { return this.totalKills }
  enemyLevel() { return 1 + this.totalKills * 0.5 + this.zoneIndex * 6 }
  // Регистрация убийства обычного врага: счётчики/рекорд. Босс-ворота не считаются
  // сюда (у него отдельный registerBossKill → продвижение зоны).
  registerKill() {
    this.totalKills++
    this.killsInZone++
    if (this.totalKills > this.bestScore) this.bestScore = this.totalKills
    this.save()
  }
  // Убит босс-ворота → зона пройдена.
  registerBossKill() {
    this.totalKills++
    this.bossActive = false
    this.zoneIndex++
    this.killsInZone = 0
    this.waveCount = 0 // новая зона — ваве-рамп с нуля
    if (this.totalKills > this.bestScore) this.bestScore = this.totalKills
    this.save()
    this.emit('zone')
    return true
  }
  // Смерть героя: откатываем ЧАСТЬ прогресса зоны (не в ноль — иначе при
  // частых смертях игрок вечно перегринживает и не лезет выше; но и не
  // бесплатно — иначе бесконечно долбится в непробиваемую стену). Теряем
  // комбо/волну/ваве-рамп; HP восстанавливается. Рекламу показывает сцена.
  //
  // Смерть В БОЮ С ВОРОТАМИ прогресс зоны не трогает вовсе: игрок просто бьёт
  // босса заново, с полным HP и сброшенным ваве-рампом. Раньше здесь резалось
  // пополам, и провал на боссе отбрасывал к середине зоны — двести убийств,
  // чтобы вернуться к тому же бою.
  // Герой упал: фиксируем «смерть в процессе» ДО показа окна выбора и сразу
  // сохраняемся. Если игрок закроет вкладку или перезагрузит страницу, штраф
  // всё равно применится на загрузке (см. resolvePendingDeath).
  beginDeath() { this.pendingDeath = true; this.save(true) }
  // Возрождение за рекламу: смерть отменяется целиком, прогресс зоны цел.
  cancelDeath() {
    this.pendingDeath = false
    this.bossActive = false
    this.hp = this.heroMaxHp()
    this.combo = 0
    this.save()
  }
  // Незакрытая смерть из прошлой сессии — доводим до конца.
  resolvePendingDeath() {
    if (!this.pendingDeath) return false
    this.onHeroDeath()
    return true
  }
  onHeroDeath() {
    this.pendingDeath = false
    if (!this.bossActive) {
      const loss = Math.ceil(zoneKillsFor() * BAL.deathZoneLoss)
      this.killsInZone = Math.max(0, this.killsInZone - loss)
    }
    this.waveCount = 0
    this.bossActive = false
    this.hp = this.heroMaxHp()
    this.combo = 0
    this.save()
  }

  // ---------- офлайн-доход ----------
  computeOffline() {
    const now = Date.now()
    const away = Math.max(0, (now - this.lastSeen) / 1000)
    const capped = Math.min(away, BAL.offlineCapSeconds)
    const factor = BAL.offlineFactor * (1 + this.classOfflineBonus())
    const caps = Math.floor(this.allyDps() * CAPS_PER_DPS * factor * capped)
    return { seconds: away, caps }
  }
  claimOffline() {
    const res = this.computeOffline()
    if (res.caps > 0) this.addCaps(res.caps)
    this.lastSeen = Date.now()
    this.save()
    return res
  }

  // ---------- сохранение ----------
  toJSON() {
    return {
      caps: this.caps, heroClass: this.heroClass, hero: this.hero,
      upgrades: this.upgrades, allies: this.allies,
      equipment: this.equipment, inventory: this.inventory, scrap: this.scrap,
      relicParts: this.relicParts, relicsCrafted: this.relicsCrafted, pendingDeath: this.pendingDeath,
      zoneIndex: this.zoneIndex, killsInZone: this.killsInZone, totalKills: this.totalKills, waveCount: this.waveCount,
      cores: this.cores, prestige: this.prestige, prestigeCount: this.prestigeCount,
      bestScore: this.bestScore, lastSeen: Date.now(),
    }
  }
  save(flushCloud = false) {
    const data = this.toJSON()
    const now = Date.now()
    // Локальную запись троттлим (registerKill зовёт save каждый килл) — кроме форса.
    if (flushCloud || now - this._lastLocalSave > 3000) {
      this._lastLocalSave = now
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)) } catch (e) { /* приватный режим */ }
    }
    try { Platform.saveCloud(data, flushCloud) } catch (e) { /* нет SDK */ }
  }
  // Свежесть прогресса для разрешения конфликта локальный↔облачный сейв.
  // Лексикографически: престижи → рекорд → всего убито → крышки.
  _progress(s) { return [s.prestigeCount || 0, s.bestScore || 0, s.totalKills || 0, s.caps || 0] }
  // Применить облачные данные только если облако прогрессивнее локального и
  // игровая сессия ещё не началась (иначе позднее облако затрёт активную игру).
  applyCloud(d) {
    if (!d || typeof d !== 'object' || !Object.keys(d).length || this._started) return
    try {
      const a = this._progress(d), b = this._progress(this)
      for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) { if (a[i] > b[i]) this._apply(d); return } }
    } catch (e) { /* битые облачные данные */ }
  }
  load() {
    let raw
    try { raw = localStorage.getItem(SAVE_KEY) } catch (e) { return }
    if (!raw) return
    try { this._apply(JSON.parse(raw)) } catch (e) { /* битый сейв — игнор */ }
  }
  _apply(d) {
    // Гвардия от не-конечных чисел (Infinity/NaN из старых переполненных сейвов):
    // без неё «битое» число протекло бы обратно в игру.
    const fin = (n, def = 0) => (Number.isFinite(n) ? n : def)
    // Санитайз словаря числовых значений (уровни апгрейдов/союзников/престижа).
    const finMap = (o, def = 0) => { const r = {}; for (const k in (o || {})) r[k] = fin(o[k], def); return r }
    const h = { level: 1, xp: 0, points: 0, str: 0, vit: 0, luck: 0, ...(d.hero || {}) }
    for (const k in h) h[k] = fin(h[k], k === 'level' ? 1 : 0)
    Object.assign(this, {
      caps: fin(d.caps),
      heroClass: d.heroClass || null,
      hero: h,
      upgrades: finMap(d.upgrades),
      allies: finMap(d.allies),
      equipment: { weapon: null, helmet: null, armor: null, boots: null, acc1: null, acc2: null, ...(d.equipment || {}) },
      inventory: d.inventory || [],
      scrap: fin(d.scrap),
      // Части реликвии фильтруем по текущему списку: сейв старой версии или
      // переименованная часть иначе навсегда заняли бы гнездо в наборе.
      relicParts: Array.isArray(d.relicParts) ? d.relicParts.filter(id => RELIC_PART_IDS.includes(id)) : [],
      relicsCrafted: fin(d.relicsCrafted),
      pendingDeath: !!d.pendingDeath,
      zoneIndex: fin(d.zoneIndex),
      killsInZone: fin(d.killsInZone),
      totalKills: fin(d.totalKills),
      waveCount: fin(d.waveCount),
      cores: fin(d.cores),
      prestige: { legacy: 0, stash: 0, vitality: 0, quickstart: 0, ...finMap(d.prestige) },
      prestigeCount: fin(d.prestigeCount),
      bestScore: fin(d.bestScore),
      lastSeen: d.lastSeen || Date.now(),
    })
    this.sanitizeItems()
    this.hp = this.heroMaxHp()
  }

  // Приводит инвентарь/экипировку к текущей схеме (миграция старых сейвов).
  // Без этого предметы старых версий (напр. slot 'trinket') роняют сцены.
  sanitizeItems() {
    const valid = (it) => it && it.uid && SLOT_BY_ID[it.slot] && RARITY_BY_ID[it.rarity]
      && it.stat && typeof it.value === 'number'
    const remap = (it) => {
      if (it && it.slot === 'trinket') it.slot = 'accessory'
      // Нормализуем level: без него sellItem/scrapValue дают NaN-крышки.
      if (it && !Number.isFinite(it.level)) it.level = 1
      // Срезаем силу предметов из сейвов, сделанных до потолка ITEM_LEVEL_CAP.
      // Там уровень предмета доходил до тысяч, и один надетый ствол давал
      // +800% к урону — с такой вещью в инвентаре никакой баланс не читается.
      const rar = it && RARITY_BY_ID[it.rarity]
      if (rar && Number.isFinite(it.value)) {
        const max = itemPower(rar.mul, ITEM_LEVEL_CAP, it.stat === 'critChance')
        if (it.value > max) it.value = max
      }
      return it
    }

    this.inventory = (Array.isArray(this.inventory) ? this.inventory : []).map(remap).filter(valid)

    const eq = { weapon: null, helmet: null, armor: null, boots: null, acc1: null, acc2: null }
    const src = this.equipment || {}
    for (const key of EQUIP_KEYS) {
      const it = remap(src[key])
      if (valid(it)) eq[key] = it
    }
    // Старый предмет из удалённого слота (например trinket) — вернём в инвентарь.
    for (const k of Object.keys(src)) {
      if (!EQUIP_KEYS.includes(k)) { const it = remap(src[k]); if (valid(it)) this.inventory.push(it) }
    }
    this.equipment = eq
  }
  wipe() {
    try { localStorage.removeItem(SAVE_KEY) } catch (e) { /* */ }
    this.bestScore = 0
    this.reset()
  }
}

export const State = new GameState()
