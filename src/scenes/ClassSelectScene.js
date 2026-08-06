// ClassSelect — первый экран новой игры. Просторные карточки классов с ховером.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX } from '../config.js'
import { State } from '../state/GameState.js'
import { CLASSES } from '../data/classes.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, panel, applyPostFX } from '../ui/scenery.js'
import { heroScaleFor } from '../assets.js'
import { t } from '../i18n.js'

export default class ClassSelectScene extends Phaser.Scene {
  constructor() { super(SCENES.CLASS_SELECT) }

  create() {
    buildBackground(this, { sky: 0x2c2416, ground: 0x3a2a18, accent: 0xc9a76a }, { groundY: GAME.HEIGHT * 0.86 })
    applyPostFX(this, true, 0.45)

    titleText(this, GAME.WIDTH / 2, 58, t('КТО ТЫ НА ПУСТОШИ?'), { size: 46 })
    this.add.text(GAME.WIDTH / 2, 104, t('Класс определяет твой стиль. Выбор — навсегда.'), {
      fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.sand, fontStyle: 'italic',
    }).setOrigin(0.5)

    const n = CLASSES.length
    const cardW = 278, gap = 22
    const totalW = n * cardW + (n - 1) * gap
    const startX = (GAME.WIDTH - totalW) / 2 + cardW / 2
    CLASSES.forEach((cls, i) => this.makeCard(startX + i * (cardW + gap), 430, cardW, cls))
  }

  makeCard(cx, cy, w, cls) {
    // Карточка подросла: шрифты описания и перков крупнее (Яндекс 1.8).
    const h = 500
    const top = -h / 2
    const tint = cls.color || 0xffffff
    const c = this.add.container(cx, cy)

    const bg = panel(this, -w / 2, top, w, h, { radius: 16, fill: 0x241d15, border: COLORS.ink })
    // цветная шапка класса
    const bar = this.add.graphics()
    bar.fillStyle(tint, 1); bar.fillRoundedRect(-w / 2, top, w, 10, { tl: 16, tr: 16, bl: 0, br: 0 })
    const glow = this.add.image(0, top + 96, TEX.GLOW).setTint(tint).setAlpha(0.22).setScale(3.4, 3)

    // Крупный арт героя вместо эмодзи-иконки — он и есть «иконка» класса.
    // Якорь по ногам (footY) — чтобы все классы стояли на одной линии в карточке.
    const footY = cls.footY || 0.98
    const hero = this.add.image(0, top + 203, cls.tex, 0).setOrigin(0.5, footY).setScale(heroScaleFor(this, cls.tex, 147))
    const name = this.add.text(0, top + 208, t(cls.name), {
      fontFamily: 'Rubik, sans-serif', fontSize: '30px', color: CSS.cap, fontStyle: 'bold',
      stroke: '#120d09', strokeThickness: 4,
    }).setOrigin(0.5)
    const line = this.add.rectangle(0, top + 238, w - 60, 2, tint, 0.6).setOrigin(0.5)
    const desc = this.add.text(0, top + 252, t(cls.desc), {
      fontFamily: 'Rubik, sans-serif', fontSize: '16px', color: CSS.paper,
      align: 'center', wordWrap: { width: w - 44 }, lineSpacing: 3,
    }).setOrigin(0.5, 0)
    const perks = this.add.text(0, top + 340, cls.perks.map(p => `✦ ${t(p)}`).join('\n'), {
      fontFamily: 'Rubik, sans-serif', fontSize: '16px', color: CSS.toxic,
      align: 'center', lineSpacing: 4, fontStyle: 'bold', wordWrap: { width: w - 22 },
    }).setOrigin(0.5, 0)

    c.add([bg, bar, glow, hero, name, line, desc, perks])

    const btn = createButton(this, 0, h / 2 - 36, {
      label: t('Выбрать'), width: w - 56, height: 56, fontSize: 22,
      color: COLORS.toxicDark, hover: COLORS.toxic, onClick: () => this.pick(cls),
    })
    c.add(btn)

    // ховер всей карточки
    const zone = this.add.zone(-w / 2, top, w, h - 80).setOrigin(0).setInteractive({ useHandCursor: true })
    zone.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.035, duration: 120 }))
    zone.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 120 }))
    zone.on('pointerup', () => this.pick(cls))
    c.add(zone)

    // лёгкое «дыхание» героя
    this.tweens.add({ targets: hero, y: hero.y - 6, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
  }

  pick(cls) {
    State.chooseClass(cls.id)
    this.cameras.main.flash(250, 20, 30, 10)
    this.time.delayedCall(180, () => this.scene.start(SCENES.HUB))
  }
}
