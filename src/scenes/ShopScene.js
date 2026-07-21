// Shop — апгрейды (слева) и союзники (справа). Клик по строке = покупка.
// Строки перерисовываются после каждой покупки (цены/уровни/доступность).

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX } from '../config.js'
import { State } from '../state/GameState.js'
import { UPGRADES, upgradeCost } from '../data/upgrades.js'
import { ALLIES, allyCost } from '../data/allies.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, applyPostFX } from '../ui/scenery.js'
import { fmt } from '../util/format.js'

export default class ShopScene extends Phaser.Scene {
  constructor() { super(SCENES.SHOP) }

  create() {
    buildBackground(this, { sky: 0x241d15, ground: 0x322516, accent: 0x8a6a3a }, { groundY: GAME.HEIGHT * 0.88, dust: false })
    applyPostFX(this, true, 0.4)
    titleText(this, GAME.WIDTH / 2, 40, 'МАСТЕРСКАЯ', { size: 34 })

    this.add.image(40, 40, TEX.CAP).setScale(1.4)
    this.capsText = this.add.text(62, 40, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '26px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)

    this.add.text(GAME.WIDTH * 0.27, 90, 'АПГРЕЙДЫ', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', color: CSS.toxic, fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(GAME.WIDTH * 0.73, 90, 'СОЮЗНИКИ (idle)', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', color: CSS.toxic, fontStyle: 'bold' }).setOrigin(0.5)

    createButton(this, GAME.WIDTH / 2, GAME.HEIGHT - 44, { label: '⟵ В лагерь', width: 300, height: 52, onClick: () => this.scene.start(SCENES.HUB) })

    this.rowObjs = []
    this.render()
  }

  render() {
    this.rowObjs.forEach(o => o.destroy())
    this.rowObjs = []
    this.capsText.setText(fmt(State.caps))

    const leftX = GAME.WIDTH * 0.27 - 260
    const rightX = GAME.WIDTH * 0.73 - 260
    const w = 520
    let y = 130

    UPGRADES.forEach((u, i) => {
      const level = State.upgLevel(u.id)
      const cost = upgradeCost(u, level)
      this.makeRow(leftX, y + i * 88, w, {
        icon: u.icon, title: `${u.name}  (ур. ${level})`, desc: u.desc, cost,
        onBuy: () => { if (State.buyUpgrade(u.id)) this.render() },
      })
    })

    ALLIES.forEach((a, i) => {
      const owned = State.allies[a.id] || 0
      const cost = allyCost(a, owned)
      this.makeRow(rightX, y + i * 88, w, {
        icon: a.icon, title: `${a.name}  ×${owned}`, desc: `+${fmt(a.dps)} урона/сек`, cost,
        onBuy: () => { if (State.hireAlly(a.id)) this.render() },
      })
    })
  }

  makeRow(x, y, w, opts) {
    const h = 78
    const afford = State.caps >= opts.cost
    const c = this.add.container(x, y)
    const bg = this.add.graphics()
    bg.fillStyle(afford ? COLORS.steelDark : 0x2a2a2e, 1)
    bg.fillRoundedRect(0, 0, w, h, 10)
    bg.lineStyle(2, afford ? COLORS.toxicDark : COLORS.ink, 0.9)
    bg.strokeRoundedRect(0, 0, w, h, 10)

    const icon = this.add.text(16, h / 2, opts.icon, { fontSize: '34px' }).setOrigin(0, 0.5)
    const title = this.add.text(64, 18, opts.title, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '20px', color: CSS.paper, fontStyle: 'bold' }).setOrigin(0)
    const desc = this.add.text(64, 46, opts.desc, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: '#b7ad93' }).setOrigin(0)
    const cap = this.add.image(w - 118, h / 2, TEX.CAP).setScale(1.1)
    const cost = this.add.text(w - 100, h / 2, fmt(opts.cost), { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', color: afford ? CSS.cap : '#7a6f58', fontStyle: 'bold' }).setOrigin(0, 0.5)
    c.add([bg, icon, title, desc, cap, cost])

    const zone = this.add.zone(0, 0, w, h).setOrigin(0)
    zone.setInteractive({ useHandCursor: afford })
    zone.on('pointerover', () => { bg.clear(); bg.fillStyle(afford ? COLORS.rust : 0x33333a, 1); bg.fillRoundedRect(0, 0, w, h, 10); bg.lineStyle(2, afford ? COLORS.toxic : COLORS.ink, 1); bg.strokeRoundedRect(0, 0, w, h, 10) })
    zone.on('pointerout', () => { bg.clear(); bg.fillStyle(afford ? COLORS.steelDark : 0x2a2a2e, 1); bg.fillRoundedRect(0, 0, w, h, 10); bg.lineStyle(2, afford ? COLORS.toxicDark : COLORS.ink, 0.9); bg.strokeRoundedRect(0, 0, w, h, 10) })
    zone.on('pointerup', () => {
      if (afford) opts.onBuy()
      else this.flash(cost)
    })
    c.add(zone)
    this.rowObjs.push(c)
  }

  flash(obj) {
    this.tweens.add({ targets: obj, scale: 1.3, duration: 90, yoyo: true })
  }
}
