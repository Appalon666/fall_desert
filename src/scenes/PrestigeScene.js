// Prestige — перерождение: сброс забега ради Ядер и вечных бонусов.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES } from '../config.js'
import { State } from '../state/GameState.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, applyPostFX, resIcon } from '../ui/scenery.js'
import { Sfx } from '../audio/sfx.js'
import { t } from '../i18n.js'
import { fmt } from '../util/format.js'

const PRESTIGE = [
  { id: 'legacy', name: 'Наследие бойца', icon: '⚔️', desc: '+10% урон клика за уровень' },
  { id: 'stash', name: 'Схрон', icon: '🎒', desc: '+10% крышек за уровень' },
  { id: 'vitality', name: 'Крепкий род', icon: '❤️', desc: '+8% макс. HP за уровень' },
  { id: 'quickstart', name: 'Быстрый старт', icon: '⚡', desc: '+300 крышек и +1 ур. «Калибра» на старте за уровень' },
]

export default class PrestigeScene extends Phaser.Scene {
  constructor() { super(SCENES.PRESTIGE) }

  create() {
    buildBackground(this, { sky: 0x16240f, ground: 0x22300f, accent: 0x8fbf3f }, { groundY: GAME.HEIGHT * 0.88, dust: false })
    applyPostFX(this, true, 0.5)
    titleText(this, GAME.WIDTH / 2, 44, t('ПЕРЕРОЖДЕНИЕ'), { size: 34, color: '#b6ff5a', glow: COLORS.toxic })

    resIcon(this, 40, 40, 'core', 32)
    this.coresText = this.add.text(62, 40, '', { fontFamily: 'Rubik, sans-serif', fontSize: '24px', color: '#b6ff5a', fontStyle: 'bold' }).setOrigin(0, 0.5)

    this.add.text(GAME.WIDTH / 2, 88,
      t('Потеряешь крышки, апгрейды, уровень и зоны — но Ядра и их бонусы останутся навсегда.\nЭкипировка и рекорд сохраняются.'),
      { fontFamily: 'Rubik, sans-serif', fontSize: '16px', color: CSS.paper, align: 'center', lineSpacing: 4 }).setOrigin(0.5)

    createButton(this, GAME.WIDTH / 2, GAME.HEIGHT - 42, { label: t('⟵ В лагерь'), width: 300, height: 50, onClick: () => this.scene.start(SCENES.HUB) })

    this.uiObjs = []
    this.render()
  }

  render() {
    this.uiObjs.forEach(o => o.destroy())
    this.uiObjs = []
    this.coresText.setText(t('{n} ядер', { n: fmt(State.cores) }))

    // Кнопка перерождения
    const gain = State.coresFromRun()
    const can = State.canPrestige()
    const info = this.add.text(GAME.WIDTH / 2, 148, can
      ? t('За этот забег получишь: +{g} ☢   (убито {k})', { g: gain, k: fmt(State.totalKills) })
      : t('Перерождение — после босса 4-й локации (ты в зоне {z}).', { z: State.zoneIndex + 1 }),
      { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: can ? '#b6ff5a' : '#b8ad9a', fontStyle: 'bold' }).setOrigin(0.5)
    const pb = createButton(this, GAME.WIDTH / 2, 196, {
      label: can ? t('☢ Переродиться (+{g})', { g: gain }) : t('☢ Пока рано'),
      width: 360, height: 54, fontSize: 22, enabled: can,
      color: COLORS.toxicDark, hover: COLORS.toxic,
      onClick: () => this.confirmPrestige(gain),
    })
    this.uiObjs.push(info, pb)

    // Престиж-апгрейды
    this.add.text(GAME.WIDTH / 2, 250, t('ВЕЧНЫЕ БОНУСЫ (за Ядра)'), { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: CSS.toxic, fontStyle: 'bold' }).setOrigin(0.5)
    PRESTIGE.forEach((p, i) => {
      const x = i % 2 === 0 ? GAME.WIDTH / 2 - 300 : GAME.WIDTH / 2 + 20
      const y = 290 + Math.floor(i / 2) * 96
      this.makeRow(x, y, 280, p)
    })
  }

  makeRow(x, y, w, p) {
    const h = 82
    const level = State.prestige[p.id] || 0
    const cost = State.prestigeCost(p.id)
    const afford = State.cores >= cost
    const c = this.add.container(x, y)
    const bg = this.add.graphics()
    const paint = (hover) => {
      bg.clear()
      bg.fillStyle(hover && afford ? 0x2c3a16 : COLORS.steelDark, 1); bg.fillRoundedRect(0, 0, w, h, 10)
      bg.lineStyle(2, afford ? COLORS.toxicDark : COLORS.ink, 0.9); bg.strokeRoundedRect(0, 0, w, h, 10)
    }
    paint(false)
    const icon = this.add.text(16, h / 2, p.icon, { fontSize: '30px' }).setOrigin(0, 0.5)
    const title = this.add.text(58, 16, `${t(p.name)}  ${t('ур.')}${level}`, { fontFamily: 'Rubik, sans-serif', fontSize: '17px', color: CSS.paper, fontStyle: 'bold' }).setOrigin(0)
    const desc = this.add.text(58, 40, t(p.desc), { fontFamily: 'Rubik, sans-serif', fontSize: '13px', color: '#ddd2b4', wordWrap: { width: w - 66 } }).setOrigin(0)
    const cost1 = this.add.text(w - 14, h / 2, `${fmt(cost)} ☢`, { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: afford ? '#b6ff5a' : '#ab9e80', fontStyle: 'bold' }).setOrigin(1, 0.5)
    c.add([bg, icon, title, desc, cost1])
    const z = this.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: afford })
    z.on('pointerover', () => paint(true))
    z.on('pointerout', () => paint(false))
    z.on('pointerup', () => { if (afford && State.buyPrestige(p.id)) this.render() })
    c.add(z)
    this.uiObjs.push(c)
  }

  confirmPrestige(gain) {
    const cx = GAME.WIDTH / 2, cy = GAME.HEIGHT / 2
    const ov = this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, COLORS.ink, 0.72).setOrigin(0).setInteractive().setDepth(80)
    const msg = this.add.text(cx, cy - 70, t('Переродиться за +{g} ☢ ?\nПрогресс забега сбросится.', { g: gain }), { fontFamily: 'Rubik, sans-serif', fontSize: '24px', color: '#fff', align: 'center' }).setOrigin(0.5).setDepth(81)
    const yes = createButton(this, cx - 110, cy + 20, {
      label: t('Переродиться'), width: 200, height: 54, color: COLORS.toxicDark, hover: COLORS.toxic,
      onClick: () => { Sfx.prestige(); State.doPrestige(); this.scene.start(SCENES.HUB) },
    })
    const no = createButton(this, cx + 110, cy + 20, { label: t('Отмена'), width: 200, height: 54, onClick: () => { ov.destroy(); msg.destroy(); yes.destroy(); no.destroy() } })
    yes.setDepth(81); no.setDepth(81)
  }
}
