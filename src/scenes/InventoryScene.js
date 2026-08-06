// Inventory — «кукла» персонажа как в шутерах: слоты вокруг героя
// (оружие, шлем, броня, обувь, 2 аксессуара) + список добычи справа.
// Клик по слоту — снять; клик по предмету — надеть; «продать» — за крышки.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX } from '../config.js'
import { State } from '../state/GameState.js'
import { RARITY_BY_ID, SLOT_BY_ID, STAT_LABEL, scrapValue, weaponTexKey } from '../data/loot.js'
import { RELIC_PARTS } from '../data/relics.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, applyPostFX, resIcon } from '../ui/scenery.js'
import { heroScaleFor } from '../assets.js'
import { Sfx } from '../audio/sfx.js'
import { t, itemName } from '../i18n.js'
import { fmt } from '../util/format.js'

// Метаданные гнёзд «куклы».
const SLOT_META = {
  weapon: { name: 'Оружие', icon: '🔫' },
  helmet: { name: 'Шлем', icon: '⛑️' },
  armor: { name: 'Броня', icon: '🦺' },
  boots: { name: 'Обувь', icon: '🥾' },
  acc1: { name: 'Аксессуар', icon: '📿' },
  acc2: { name: 'Аксессуар', icon: '📿' },
}

// Панель набора реликвии живёт под списком добычи; список ужат до 6 строк,
// чтобы они не наезжали друг на друга.
const RELIC_PANEL_Y = 528

function statText(it) {
  const v = it.value
  const label = t(STAT_LABEL[it.stat] || it.stat)
  if (it.stat === 'critChance') return `+${(v * 100).toFixed(1)}% ${label}`
  return `+${(v * 100).toFixed(0)}% ${label}`
}

export default class InventoryScene extends Phaser.Scene {
  constructor() { super(SCENES.INVENTORY) }

  create() {
    buildBackground(this, { sky: 0x1c1a20, ground: 0x2a2630, accent: 0x6b6b73 }, { groundY: GAME.HEIGHT * 0.88, dust: false })
    applyPostFX(this, true, 0.4)
    titleText(this, GAME.WIDTH / 2, 36, t('ИНВЕНТАРЬ'), { size: 32 })
    resIcon(this, 40, 36, 'caps', 36)
    this.capsText = this.add.text(62, 36, '', { fontFamily: 'Rubik, sans-serif', fontSize: '24px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    resIcon(this, 220, 36, 'scrap', 26)
    this.scrapText = this.add.text(242, 36, '', { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: '#d8d8e0', fontStyle: 'bold' }).setOrigin(0, 0.5)

    this.add.text(GAME.WIDTH * 0.72, 74, t('ДОБЫЧА'), { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.toxic, fontStyle: 'bold' }).setOrigin(0.5)
    // Массовый разбор хлама (серое+зелёное) в металлолом
    createButton(this, GAME.WIDTH * 0.72, GAME.HEIGHT - 40, {
      label: t('🔩 Разобрать хлам'), width: 260, height: 52, fontSize: 18, color: COLORS.steelDark, hover: COLORS.steel,
      onClick: () => { const r = State.scrapAllUpTo(1); if (r.count) Sfx.click(); this.safeRender() },
    })

    createButton(this, GAME.WIDTH * 0.28, GAME.HEIGHT - 40, { label: t('⟵ В лагерь'), width: 260, height: 50, onClick: () => this.scene.start(SCENES.HUB) })

    this.uiObjs = []
    this.safeRender()
  }

  // Отрисовка с защитой: любой сбой не «замораживает» игру — кнопка выхода жива.
  safeRender() {
    try { this.render() } catch (e) {
      console.error('[Инвентарь] ошибка отрисовки:', e)
      this.add.text(GAME.WIDTH / 2, GAME.HEIGHT / 2, t('Не удалось открыть инвентарь.\nВернись в лагерь.'), {
        fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: '#ff6a6a', align: 'center',
      }).setOrigin(0.5)
    }
  }

  render() {
    this.uiObjs.forEach(o => o.destroy())
    this.uiObjs = []
    this.capsText.setText(fmt(State.caps))
    this.scrapText.setText(fmt(State.scrap))

    // --- Кукла персонажа ---
    const hx = GAME.WIDTH * 0.26, hy = 330
    const cls = State.classDef()
    const heroTex = (cls && cls.tex) || TEX.HERO
    const footY = (cls && cls.footY) || 0.98 // ноги на одной линии для всех классов
    // Кукла чуть уже: карточки слотов подросли под крупный шрифт (п.1.8),
    // и герой не должен на них наезжать.
    const heroImg = this.add.image(hx, hy + 85, heroTex, 0).setOrigin(0.5, footY).setScale(heroScaleFor(this, heroTex, 130))
    const clsLabel = this.add.text(hx, hy + 148, cls ? t(cls.name) : '', { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0.5)
    this.uiObjs.push(heroImg, clsLabel)

    const slotPos = {
      helmet: [hx, hy - 180],
      weapon: [hx - 205, hy - 40],
      armor: [hx + 205, hy - 40],
      acc1: [hx - 205, hy + 80],
      acc2: [hx + 205, hy + 80],
      boots: [hx, hy + 210],
    }
    for (const key of Object.keys(SLOT_META)) {
      const [x, y] = slotPos[key]
      this.makeSlot(key, x, y)
    }

    // Сводка бонусов экипировки
    const sum = this.add.text(hx, hy + 272, this.equipSummary(), { fontFamily: 'monospace', fontSize: '16px', color: '#ddd2b4', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0)
    this.uiObjs.push(sum)

    // --- Список добычи ---
    this.renderLoot()
    // --- Набор реликвии ---
    this.renderRelicPanel()
  }

  // Панель набора: пять гнёзд под части + ковка, когда собраны все.
  // Части падают только с босса десятой локации (см. isRelicZone), поэтому до
  // первой части панель объясняет, куда идти, а не просто светит пустотой.
  renderRelicPanel() {
    const x = GAME.WIDTH * 0.72 - 260, y = RELIC_PANEL_Y, w = 520, h = 108
    const ready = State.canCraftRelic()
    const relic = RARITY_BY_ID.relic
    const c = this.add.container(x, y)
    const bg = this.add.graphics()
    bg.fillStyle(0x241a12, 0.92); bg.fillRoundedRect(0, 0, w, h, 10)
    bg.lineStyle(2, relic.color, ready ? 1 : 0.5); bg.strokeRoundedRect(0, 0, w, h, 10)
    const owned = State.relicPartsOwned().length
    const head = this.add.text(12, 10, t('НАБОР РЕЛИКВИИ  {a}/{b}', { a: owned, b: RELIC_PARTS.length }), {
      fontFamily: 'Rubik, sans-serif', fontSize: '17px', color: relic.css, fontStyle: 'bold',
    }).setOrigin(0)
    c.add([bg, head])

    // Гнёзда частей: собранная — своя иконка и оранжевая рамка, недостающая — тусклая.
    RELIC_PARTS.forEach((p, i) => {
      const px = 14 + i * 62, py = 42, s = 54
      const has = State.hasRelicPart(p.id)
      const box = this.add.graphics()
      box.fillStyle(has ? 0x3a2410 : COLORS.steelDark, 1); box.fillRoundedRect(px, py, s, s, 8)
      box.lineStyle(2, has ? relic.color : COLORS.ink, has ? 1 : 0.6); box.strokeRoundedRect(px, py, s, s, 8)
      const icon = this.add.text(px + s / 2, py + s / 2, has ? p.icon : '·', {
        fontSize: has ? '26px' : '22px', color: has ? '#ffd8a8' : '#6a6458',
      }).setOrigin(0.5)
      const nm = this.add.text(px + s / 2, py + s + 3, has ? t(p.name).split(' ')[0] : '—', {
        fontFamily: 'Rubik, sans-serif', fontSize: '11px', color: has ? '#ddd2b4' : '#7a7268',
      }).setOrigin(0.5, 0)
      c.add([box, icon, nm])
    })

    if (ready) {
      const btn = createButton(this, x + w - 130, y + h / 2, {
        label: t('🔥 Выковать'), width: 220, height: 56, fontSize: 19,
        color: 0x8a4b10, hover: 0xc06a18,
        onClick: () => {
          const item = State.craftRelic()
          if (!item) return
          Sfx.levelup()
          this.safeRender()
          this.flashRelic(itemName(item.name))
        },
      })
      this.uiObjs.push(btn)
    } else {
      const hint = owned === 0
        ? t('Части падают с босса 10-й локации')
        : t('Собери все части — выкуешь случайную реликвию')
      c.add(this.add.text(w - 14, 18, hint, {
        fontFamily: 'Rubik, sans-serif', fontSize: '13px', color: '#b8ad9a', align: 'right', wordWrap: { width: 210 },
      }).setOrigin(1, 0))
    }
    this.uiObjs.push(c)
  }

  // Всплывашка о выкованной реликвии — иначе предмет молча уезжает в список.
  flashRelic(name) {
    const txt = this.add.text(GAME.WIDTH / 2, GAME.HEIGHT / 2, t('⭐ {name}', { name }), {
      fontFamily: 'Rubik, sans-serif', fontSize: '34px', color: RARITY_BY_ID.relic.css, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100)
    this.tweens.add({ targets: txt, y: GAME.HEIGHT / 2 - 90, alpha: 0, duration: 1600, ease: 'Cubic.easeOut', onComplete: () => txt.destroy() })
  }

  equipSummary() {
    const parts = []
    for (const stat of ['clickMul', 'hpMul', 'critChance', 'allyMul', 'capsMul']) {
      const v = State.equipSum(stat)
      if (v > 0) {
        const label = t(STAT_LABEL[stat])
        parts.push(stat === 'critChance' ? `+${(v * 100).toFixed(1)}% ${label}` : `+${(v * 100).toFixed(0)}% ${label}`)
      }
    }
    return parts.length ? t('От экипировки:  {parts}', { parts: parts.join('   ') }) : t('Экипировка пуста')
  }

  // Иконка предмета: арт оружия (по wtype) → иконка слота → эмодзи-фолбэк.
  slotIcon(x, y, item, fallbackIcon, px, slotKey) {
    const base = (slotKey === 'acc1' || slotKey === 'acc2') ? 'accessory' : slotKey
    let key = weaponTexKey(item)
    if (!key && base && this.textures.exists(`slot-${base}`)) key = `slot-${base}`
    if (key && this.textures.exists(key)) {
      const img = this.add.image(x, y, key).setOrigin(0, 0.5)
      const src = this.textures.get(key).getSourceImage()
      img.setScale(px / Math.max(src.width, src.height))
      return img
    }
    return this.add.text(x, y, fallbackIcon, { fontSize: `${px}px` }).setOrigin(0, 0.5)
  }

  makeSlot(key, x, y) {
    const w = 210, h = 96
    const raw = State.equipment[key]
    const it = (raw && RARITY_BY_ID[raw.rarity] && SLOT_BY_ID[raw.slot]) ? raw : null
    const rar = it ? RARITY_BY_ID[it.rarity] : null
    const meta = SLOT_META[key]
    const c = this.add.container(x, y)
    const bg = this.add.graphics()
    bg.fillStyle(COLORS.steelDark, 1); bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8)
    bg.lineStyle(2, rar ? rar.color : COLORS.ink, 0.9); bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8)
    const icon = this.slotIcon(-w / 2 + 10, 0, it, meta.icon, 36, key)
    const head = this.add.text(-w / 2 + 52, -34, t(meta.name), { fontFamily: 'Rubik, sans-serif', fontSize: '16px', color: '#c4b998' }).setOrigin(0, 0.5)
    const body = this.add.text(-w / 2 + 52, -4, it ? itemName(it.name) : t('— пусто —'), {
      fontFamily: 'Rubik, sans-serif', fontSize: '16px',
      color: it ? rar.css : '#9a9078', fontStyle: 'bold', wordWrap: { width: w - 62 },
    }).setOrigin(0, 0.5)
    const st = this.add.text(-w / 2 + 52, 32, it ? statText(it) : '', { fontFamily: 'Rubik, sans-serif', fontSize: '16px', color: CSS.toxic }).setOrigin(0, 0.5)
    c.add([bg, icon, head, body, st])
    if (it) {
      const z = this.add.zone(-w / 2, -h / 2, w, h).setOrigin(0).setInteractive({ useHandCursor: true })
      z.on('pointerover', () => { bg.clear(); bg.fillStyle(COLORS.rust, 1); bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8); bg.lineStyle(2, rar.color, 1); bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8) })
      z.on('pointerout', () => { bg.clear(); bg.fillStyle(COLORS.steelDark, 1); bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8); bg.lineStyle(2, rar.color, 0.9); bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8) })
      z.on('pointerup', () => { State.unequip(key); this.safeRender() })
      c.add(z)
    }
    this.uiObjs.push(c)
  }

  renderLoot() {
    const items = [...State.inventory].sort((a, b) =>
      (RARITY_BY_ID[b.rarity].mul - RARITY_BY_ID[a.rarity].mul) || (b.value - a.value))
    const ix = GAME.WIDTH * 0.72 - 260
    let iy = 108
    const maxRows = 6

    if (items.length === 0) {
      this.uiObjs.push(this.add.text(GAME.WIDTH * 0.72, 200, t('Пусто. Иди в поход за лутом!'), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: '#b8ad9a' }).setOrigin(0.5))
      return
    }

    items.slice(0, maxRows).forEach(it => {
      const rar = RARITY_BY_ID[it.rarity]
      const slot = SLOT_BY_ID[it.slot]
      if (!rar || !slot) return // страховка от битых предметов
      const w = 520, h = 54
      const c = this.add.container(ix, iy)
      const bg = this.add.graphics()
      bg.fillStyle(COLORS.steelDark, 1); bg.fillRoundedRect(0, 0, w, h, 8)
      bg.lineStyle(2, rar.color, 1); bg.strokeRoundedRect(0, 0, w, h, 8)
      const icon = this.slotIcon(14, h / 2, it, slot.icon, 34, it.slot)
      const name = this.add.text(50, 12, itemName(it.name), { fontFamily: 'Rubik, sans-serif', fontSize: '17px', color: rar.css, fontStyle: 'bold' }).setOrigin(0)
      const st = this.add.text(50, 33, `${t(slot.name)} · ${t(rar.name)} · ${statText(it)}`, { fontFamily: 'Rubik, sans-serif', fontSize: '13px', color: '#ddd2b4' }).setOrigin(0)
      c.add([bg, icon, name, st])

      const equipZone = this.add.zone(0, 0, w - 150, h).setOrigin(0).setInteractive({ useHandCursor: true })
      equipZone.on('pointerup', () => { State.equip(it.uid); this.safeRender() })
      // разобрать на металлолом
      const scrapTxt = this.add.text(w - 142, h / 2, `🔩${scrapValue(it)}`, { fontFamily: 'Rubik, sans-serif', fontSize: '14px', color: '#c8c8d2', fontStyle: 'bold' }).setOrigin(0, 0.5)
      const scrapZone = this.add.zone(w - 150, 0, 80, h).setOrigin(0).setInteractive({ useHandCursor: true })
      scrapZone.on('pointerup', () => { State.scrapItem(it.uid); Sfx.click(); this.safeRender() })
      // продать за крышки
      const sell = this.add.text(w - 16, h / 2, '💰', { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: CSS.cap }).setOrigin(1, 0.5)
      const sellZone = this.add.zone(w - 66, 0, 66, h).setOrigin(0).setInteractive({ useHandCursor: true })
      sellZone.on('pointerup', () => { State.sellItem(it.uid); this.safeRender() })
      c.add([equipZone, scrapTxt, scrapZone, sell, sellZone])
      this.uiObjs.push(c)
      iy += h + 8
    })

    if (items.length > maxRows) {
      this.uiObjs.push(this.add.text(GAME.WIDTH * 0.72, iy + 6, t('…и ещё {n} предметов', { n: items.length - maxRows }), { fontFamily: 'monospace', fontSize: '14px', color: '#b8ad9a' }).setOrigin(0.5))
    }
  }
}
