// Центральное состояние игры + вычисление производных статов + сохранение.
// Единый источник правды для всех сцен. Наследует EventEmitter — сцены могут
// слушать изменения ('caps','stats','level',...), но чаще просто перечитывают.

import Phaser from 'phaser'
import { BAL } from '../data/balance.js'
import { UPGRADES, upgradeCost } from '../data/upgrades.js'
import { ALLIES, allyCost } from '../data/allies.js'
import { CLASS_BY_ID } from '../data/classes.js'
import { EQUIP_KEYS, SLOT_BY_ID, RARITY_BY_ID } from '../data/loot.js'

const SAVE_KEY = 'wasteland_save_v1'
const CAPS_PER_DPS = 0.12 // перевод idle-DPS в крышки/сек для офлайн-дохода

class GameState extends Phaser.Events.EventEmitter {
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
    this.zoneIndex = 0
    this.killsInZone = 0
    this.totalKills = 0
    this.lastSeen = Date.now()
    // transient
    this.hp = this.heroMaxHp()
    this.combo = 0
    this.ult = 0
  }

  // ---------- классы ----------
  classDef() { return this.heroClass ? CLASS_BY_ID[this.heroClass] : null }
  classBonus(stat) { const c = this.classDef(); return (c && c.bonus[stat]) || 0 }
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
  capsBonus() { return this.equipSum('capsMul') + this.classBonus('capsMul') }
  // Удача для дропа лута (характеристика + класс).
  lootLuck() { const c = this.classDef(); return this.hero.luck * 0.05 + (c ? c.lootLuck : 0) }

  comboMult() {
    const steps = Math.floor(this.combo / BAL.comboHitsPerStep)
    return Math.min(BAL.comboMax, 1 + steps * BAL.comboStep)
  }
  clickDamage(withCombo = true) {
    const flat = BAL.baseClickDamage + this.hero.str * BAL.perStrength
    const mul = 1 + this.upgAdd('clickMul') + this.equipSum('clickMul') + this.classBonus('clickMul')
    let dmg = flat * mul * this.upgPow('clickPow')
    if (withCombo) dmg *= this.comboMult()
    return dmg
  }
  critChance() {
    return Math.min(0.9,
      BAL.baseCritChance + this.hero.luck * BAL.perLuckCrit
      + this.upgAdd('critChance') + this.equipSum('critChance') + this.classBonus('critChance'))
  }
  heroMaxHp() {
    const flat = BAL.baseHeroHp + this.hero.vit * BAL.perVitality
    const mul = 1 + this.equipSum('hpMul') + this.classBonus('hpMul')
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
    this.addCaps(10 + it.level * 3)
    this.emit('inventory'); this.save()
  }

  // ---------- зоны / убийства ----------
  enemyLevel() { return 1 + this.totalKills * 0.5 + this.zoneIndex * 8 }
  registerKill() {
    this.totalKills++
    this.killsInZone++
    let advanced = false
    if (this.killsInZone >= BAL.zoneKills) {
      this.zoneIndex++
      this.killsInZone = 0
      advanced = true
    }
    if (this.totalKills > this.bestScore) this.bestScore = this.totalKills
    this.save()
    if (advanced) this.emit('zone')
    return advanced
  }
  // Откат при смерти героя — теряем прогресс текущей зоны.
  onHeroDeath() {
    this.killsInZone = 0
    this.hp = this.heroMaxHp()
    this.combo = 0
    this.save()
  }

  // ---------- офлайн-доход ----------
  computeOffline() {
    const now = Date.now()
    const away = Math.max(0, (now - this.lastSeen) / 1000)
    const capped = Math.min(away, BAL.offlineCapSeconds)
    const caps = Math.floor(this.allyDps() * CAPS_PER_DPS * BAL.offlineFactor * capped)
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
      equipment: this.equipment, inventory: this.inventory,
      zoneIndex: this.zoneIndex, killsInZone: this.killsInZone, totalKills: this.totalKills,
      bestScore: this.bestScore, lastSeen: Date.now(),
    }
  }
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.toJSON())) } catch (e) { /* приватный режим */ }
  }
  load() {
    let raw
    try { raw = localStorage.getItem(SAVE_KEY) } catch (e) { return }
    if (!raw) return
    try {
      const d = JSON.parse(raw)
      Object.assign(this, {
        caps: d.caps ?? 0,
        heroClass: d.heroClass || null,
        hero: { level: 1, xp: 0, points: 0, str: 0, vit: 0, luck: 0, ...(d.hero || {}) },
        upgrades: d.upgrades || {},
        allies: d.allies || {},
        equipment: { weapon: null, helmet: null, armor: null, boots: null, acc1: null, acc2: null, ...(d.equipment || {}) },
        inventory: d.inventory || [],
        zoneIndex: d.zoneIndex || 0,
        killsInZone: d.killsInZone || 0,
        totalKills: d.totalKills || 0,
        bestScore: d.bestScore || 0,
        lastSeen: d.lastSeen || Date.now(),
      })
      this.sanitizeItems()
      this.hp = this.heroMaxHp()
    } catch (e) { /* битый сейв — игнор */ }
  }

  // Приводит инвентарь/экипировку к текущей схеме (миграция старых сейвов).
  // Без этого предметы старых версий (напр. slot 'trinket') роняют сцены.
  sanitizeItems() {
    const valid = (it) => it && it.uid && SLOT_BY_ID[it.slot] && RARITY_BY_ID[it.rarity]
      && it.stat && typeof it.value === 'number'
    const remap = (it) => { if (it && it.slot === 'trinket') it.slot = 'accessory'; return it }

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
