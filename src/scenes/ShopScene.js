// Shop — апгрейды (слева) и союзники (справа). Клик по строке = покупка.
// Тумблер ×1 / ×10 / MAX задаёт, сколько уровней покупать за клик.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES } from '../config.js'
import { State } from '../state/GameState.js'
import { UPGRADES } from '../data/upgrades.js'
import { ALLIES } from '../data/allies.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, applyPostFX, resIcon } from '../ui/scenery.js'
import { t } from '../i18n.js'
import { fmt } from '../util/format.js'

const MODES = [{ id: 1, label: '×1' }, { id: 10, label: '×10' }, { id: 'max', label: 'MAX' }]

export default class ShopScene extends Phaser.Scene {
  constructor() { super(SCENES.SHOP) }

  create() {
    buildBackground(this, { sky: 0x241d15, ground: 0x322516, accent: 0x8a6a3a }, { groundY: GAME.HEIGHT * 0.88, dust: false })
    applyPostFX(this, true, 0.4)
    titleText(this, GAME.WIDTH / 2, 40, t('МАСТЕРСКАЯ'), { size: 34 })

    resIcon(this, 40, 40, 'caps', 36)
    this.capsText = this.add.text(62, 40, '', { fontFamily: 'Rubik, sans-serif', fontSize: '26px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)

    this.add.text(GAME.WIDTH * 0.27, 108, t('АПГРЕЙДЫ'), { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.toxic, fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(GAME.WIDTH * 0.73, 108, t('СОЮЗНИКИ (idle)'), { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.toxic, fontStyle: 'bold' }).setOrigin(0.5)

    createButton(this, GAME.WIDTH / 2, GAME.HEIGHT - 44, { label: t('⟵ В лагерь'), width: 300, height: 52, onClick: () => this.scene.start(SCENES.HUB) })

    this.buyMode = 1
    this.rowObjs = []
    this.render()
  }

  // Тумблер количества покупки за клик.
  renderModeToggle() {
    const cx = GAME.WIDTH / 2, y = 78
    this.add.text(cx - 138, y, t('Покупать:'), { fontFamily: 'Rubik, sans-serif', fontSize: '16px', color: CSS.paper }).setOrigin(1, 0.5)
    MODES.forEach((m, i) => {
      const active = this.buyMode === m.id
      const btn = createButton(this, cx - 60 + i * 66, y, {
        label: m.label, width: 60, height: 46, fontSize: 18,
        color: active ? COLORS.toxicDark : COLORS.steelDark, hover: COLORS.toxic,
        onClick: () => { this.buyMode = m.id; this.render() },
      })
      this.rowObjs.push(btn)
    })
  }

  render() {
    this.rowObjs.forEach(o => o.destroy())
    this.rowObjs = []
    this.capsText.setText(fmt(State.caps))
    this.renderModeToggle()

    const leftX = GAME.WIDTH * 0.27 - 260
    const rightX = GAME.WIDTH * 0.73 - 260
    const w = 520
    const y = 140

    UPGRADES.forEach((u, i) => {
      const level = State.upgLevel(u.id)
      const q = State.upgradeQuote(u.id, this.buyMode)
      this.makeRow(leftX, y + i * 88, w, {
        icon: u.icon, iconTex: `up-${u.id}`, title: `${t(u.name)}  (${t('ур.')} ${level})`, desc: t(u.desc),
        cost: q.cost, count: q.count,
        onBuy: () => { if (State.buyUpgradeMulti(u.id, this.buyMode)) this.render() },
      })
    })

    ALLIES.forEach((a, i) => {
      const owned = State.allies[a.id] || 0
      const q = State.allyQuote(a.id, this.buyMode)
      this.makeRow(rightX, y + i * 88, w, {
        icon: a.icon, iconTex: `ally-${a.id}`, title: `${t(a.name)}  ×${owned}`, desc: t('+{n} урона/сек', { n: fmt(a.dps) }),
        cost: q.cost, count: q.count,
        onBuy: () => { if (State.hireAllyMulti(a.id, this.buyMode)) this.render() },
      })
    })
  }

  makeRow(x, y, w, opts) {
    const h = 78
    // покупка возможна, если хватает крышек и есть что купить (count>0)
    const afford = opts.count > 0 && State.caps >= opts.cost
    const c = this.add.container(x, y)
    const bg = this.add.graphics()
    const paint = (hover) => {
      bg.clear()
      bg.fillStyle(hover && afford ? COLORS.rust : (afford ? COLORS.steelDark : 0x2a2a2e), 1)
      bg.fillRoundedRect(0, 0, w, h, 10)
      bg.lineStyle(2, afford ? (hover ? COLORS.toxic : COLORS.toxicDark) : COLORS.ink, hover ? 1 : 0.9)
      bg.strokeRoundedRect(0, 0, w, h, 10)
    }
    paint(false)

    let icon
    if (opts.iconTex && this.textures.exists(opts.iconTex)) {
      icon = this.add.image(38, h / 2, opts.iconTex).setOrigin(0.5)
      const src = this.textures.get(opts.iconTex).getSourceImage()
      icon.setScale(46 / Math.max(src.width, src.height))
    } else {
      icon = this.add.text(16, h / 2, opts.icon, { fontSize: '34px' }).setOrigin(0, 0.5)
    }
    const title = this.add.text(64, 18, opts.title, { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: CSS.paper, fontStyle: 'bold' }).setOrigin(0)
    const desc = this.add.text(64, 46, opts.desc, { fontFamily: 'Rubik, sans-serif', fontSize: '15px', color: '#ddd2b4' }).setOrigin(0)
    // бейдж «сколько купим» при режиме ≠ ×1
    const objs = [bg, icon, title, desc]
    if (this.buyMode !== 1) {
      const badge = this.add.text(w - 150, 16, `+${opts.count}`, { fontFamily: 'Rubik, sans-serif', fontSize: '15px', color: afford ? CSS.toxic : '#8a8a92', fontStyle: 'bold' }).setOrigin(1, 0)
      objs.push(badge)
    }
    const cap = resIcon(this, w - 118, h / 2, 'caps', 28)
    const cost = this.add.text(w - 100, h / 2, fmt(opts.cost), { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: afford ? CSS.cap : '#ab9e80', fontStyle: 'bold' }).setOrigin(0, 0.5)
    objs.push(cap, cost)
    c.add(objs)

    const zone = this.add.zone(0, 0, w, h).setOrigin(0)
    zone.setInteractive({ useHandCursor: afford })
    zone.on('pointerover', () => paint(true))
    zone.on('pointerout', () => paint(false))
    zone.on('pointerup', () => { if (afford) opts.onBuy(); else this.flash(cost) })
    c.add(zone)
    this.rowObjs.push(c)
  }

  flash(obj) {
    // Не запускаем новый твин, пока идёт старый: при спаме по недоступной
    // покупке масштаб цены накапливался и текст «застревал» раздутым.
    if (obj._flashing) return
    obj._flashing = true
    this.tweens.add({ targets: obj, scale: 1.3, duration: 90, yoyo: true, onComplete: () => { obj._flashing = false } })
  }
}
