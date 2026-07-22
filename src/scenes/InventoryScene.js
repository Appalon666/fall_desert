// Inventory — «кукла» персонажа как в шутерах: слоты вокруг героя
// (оружие, шлем, броня, обувь, 2 аксессуара) + список добычи справа.
// Клик по слоту — снять; клик по предмету — надеть; «продать» — за крышки.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX } from '../config.js'
import { State } from '../state/GameState.js'
import { RARITY_BY_ID, SLOT_BY_ID, STAT_LABEL, scrapValue } from '../data/loot.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, applyPostFX } from '../ui/scenery.js'
import { Sfx } from '../audio/sfx.js'
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

function statText(it) {
  const v = it.value
  const label = STAT_LABEL[it.stat] || it.stat
  if (it.stat === 'critChance') return `+${(v * 100).toFixed(1)}% ${label}`
  return `+${(v * 100).toFixed(0)}% ${label}`
}

export default class InventoryScene extends Phaser.Scene {
  constructor() { super(SCENES.INVENTORY) }

  create() {
    buildBackground(this, { sky: 0x1c1a20, ground: 0x2a2630, accent: 0x6b6b73 }, { groundY: GAME.HEIGHT * 0.88, dust: false })
    applyPostFX(this, true, 0.4)
    titleText(this, GAME.WIDTH / 2, 36, 'ИНВЕНТАРЬ', { size: 32 })
    this.add.image(40, 36, TEX.CAP).setScale(1.4)
    this.capsText = this.add.text(62, 36, '', { fontFamily: 'Rubik, sans-serif', fontSize: '24px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    this.add.text(220, 36, '🔩', { fontSize: '22px' }).setOrigin(0.5)
    this.scrapText = this.add.text(242, 36, '', { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: '#d8d8e0', fontStyle: 'bold' }).setOrigin(0, 0.5)

    this.add.text(GAME.WIDTH * 0.72, 74, 'ДОБЫЧА', { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.toxic, fontStyle: 'bold' }).setOrigin(0.5)
    // Массовый разбор хлама (серое+зелёное) в металлолом
    createButton(this, GAME.WIDTH * 0.72, GAME.HEIGHT - 40, {
      label: '🔩 Разобрать хлам', width: 260, height: 44, fontSize: 16, color: COLORS.steelDark, hover: COLORS.steel,
      onClick: () => { const r = State.scrapAllUpTo(1); if (r.count) Sfx.click(); this.safeRender() },
    })

    createButton(this, GAME.WIDTH * 0.28, GAME.HEIGHT - 40, { label: '⟵ В лагерь', width: 260, height: 50, onClick: () => this.scene.start(SCENES.HUB) })

    this.uiObjs = []
    this.safeRender()
  }

  // Отрисовка с защитой: любой сбой не «замораживает» игру — кнопка выхода жива.
  safeRender() {
    try { this.render() } catch (e) {
      console.error('[Инвентарь] ошибка отрисовки:', e)
      this.add.text(GAME.WIDTH / 2, GAME.HEIGHT / 2, 'Не удалось открыть инвентарь.\nВернись в лагерь.', {
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
    const heroTex = (State.classDef() && State.classDef().tex) || TEX.HERO
    const heroImg = this.add.image(hx, hy, heroTex).setScale(3)
    const cls = State.classDef()
    const clsLabel = this.add.text(hx, hy + 150, cls ? `${cls.icon} ${cls.name}` : '', { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0.5)
    this.uiObjs.push(heroImg, clsLabel)

    const slotPos = {
      helmet: [hx, hy - 175],
      weapon: [hx - 185, hy - 40],
      armor: [hx + 185, hy - 40],
      acc1: [hx - 185, hy + 80],
      acc2: [hx + 185, hy + 80],
      boots: [hx, hy + 205],
    }
    for (const key of Object.keys(SLOT_META)) {
      const [x, y] = slotPos[key]
      this.makeSlot(key, x, y)
    }

    // Сводка бонусов экипировки
    const sum = this.add.text(hx, hy + 240, this.equipSummary(), { fontFamily: 'monospace', fontSize: '14px', color: '#ddd2b4', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0)
    this.uiObjs.push(sum)

    // --- Список добычи ---
    this.renderLoot()
  }

  equipSummary() {
    const parts = []
    for (const stat of ['clickMul', 'hpMul', 'critChance', 'allyMul', 'capsMul']) {
      const v = State.equipSum(stat)
      if (v > 0) {
        const label = STAT_LABEL[stat]
        parts.push(stat === 'critChance' ? `+${(v * 100).toFixed(1)}% ${label}` : `+${(v * 100).toFixed(0)}% ${label}`)
      }
    }
    return parts.length ? `От экипировки:  ${parts.join('   ')}` : 'Экипировка пуста'
  }

  makeSlot(key, x, y) {
    const w = 176, h = 66
    const raw = State.equipment[key]
    const it = (raw && RARITY_BY_ID[raw.rarity] && SLOT_BY_ID[raw.slot]) ? raw : null
    const rar = it ? RARITY_BY_ID[it.rarity] : null
    const meta = SLOT_META[key]
    const c = this.add.container(x, y)
    const bg = this.add.graphics()
    bg.fillStyle(COLORS.steelDark, 1); bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8)
    bg.lineStyle(2, rar ? rar.color : COLORS.ink, 0.9); bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8)
    const icon = this.add.text(-w / 2 + 12, 0, meta.icon, { fontSize: '26px' }).setOrigin(0, 0.5)
    const head = this.add.text(-w / 2 + 46, -16, meta.name, { fontFamily: 'Rubik, sans-serif', fontSize: '13px', color: '#c4b998' }).setOrigin(0, 0.5)
    const body = this.add.text(-w / 2 + 46, 4, it ? it.name : '— пусто —', {
      fontFamily: 'Rubik, sans-serif', fontSize: it ? '13px' : '14px',
      color: it ? rar.css : '#9a9078', fontStyle: 'bold', wordWrap: { width: w - 52 },
    }).setOrigin(0, 0.5)
    const st = this.add.text(-w / 2 + 46, 20, it ? statText(it) : '', { fontFamily: 'Rubik, sans-serif', fontSize: '12px', color: CSS.toxic }).setOrigin(0, 0.5)
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
    const maxRows = 8

    if (items.length === 0) {
      this.uiObjs.push(this.add.text(GAME.WIDTH * 0.72, 200, 'Пусто. Иди в поход за лутом!', { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: '#b8ad9a' }).setOrigin(0.5))
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
      const icon = this.add.text(14, h / 2, slot.icon, { fontSize: '24px' }).setOrigin(0, 0.5)
      const name = this.add.text(50, 12, it.name, { fontFamily: 'Rubik, sans-serif', fontSize: '17px', color: rar.css, fontStyle: 'bold' }).setOrigin(0)
      const st = this.add.text(50, 33, `${slot.name} · ${rar.name} · ${statText(it)}`, { fontFamily: 'Rubik, sans-serif', fontSize: '13px', color: '#ddd2b4' }).setOrigin(0)
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
      this.uiObjs.push(this.add.text(GAME.WIDTH * 0.72, iy + 6, `…и ещё ${items.length - maxRows} предметов`, { fontFamily: 'monospace', fontSize: '14px', color: '#b8ad9a' }).setOrigin(0.5))
    }
  }
}
