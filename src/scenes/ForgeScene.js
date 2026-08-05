// Forge — верстак: плавка хлама даёт металлолом (в инвентаре), здесь его тратят
// на крафт случайного снаряжения. Дороже сборка → выше шанс редкого предмета.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES } from '../config.js'
import { State } from '../state/GameState.js'
import { CRAFT_TIERS, RARITIES, RARITY_BY_ID, SLOT_BY_ID, STAT_LABEL } from '../data/loot.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, applyPostFX, panel, resIcon } from '../ui/scenery.js'
import { Sfx } from '../audio/sfx.js'
import { t } from '../i18n.js'
import { fmt } from '../util/format.js'

function statText(it) {
  const v = it.value
  const label = t(STAT_LABEL[it.stat] || it.stat)
  return `${it.stat === 'critChance' ? '+' + (v * 100).toFixed(1) : '+' + (v * 100).toFixed(0)}% ${label}`
}
function topPct(luck) {
  const top = RARITIES.filter((r, i) => i >= 2).reduce((s, r) => s + r.weight, 0)
  const base = RARITIES.filter((r, i) => i < 2).reduce((s, r) => s + r.weight, 0)
  return Math.round(top * (1 + luck) / (base + top * (1 + luck)) * 100)
}

export default class ForgeScene extends Phaser.Scene {
  constructor() { super(SCENES.FORGE) }

  create() {
    buildBackground(this, { sky: 0x241a12, ground: 0x3a2410, accent: 0xff8a2a }, { groundY: GAME.HEIGHT * 0.88, dust: false })
    applyPostFX(this, true, 0.5)
    titleText(this, GAME.WIDTH / 2, 46, t('🔨 ВЕРСТАК'), { size: 34, color: '#ffb46a', glow: 0xff8a2a })

    this.add.text(GAME.WIDTH / 2, 92, t('Разбирай лишнее в инвентаре → металлолом. Здесь куй снаряжение.\nДороже сборка — выше шанс редкого.'), {
      fontFamily: 'Rubik, sans-serif', fontSize: '16px', color: CSS.paper, align: 'center', lineSpacing: 4,
    }).setOrigin(0.5)

    resIcon(this, 40, 40, 'scrap', 30)
    this.scrapText = this.add.text(64, 40, '', { fontFamily: 'Rubik, sans-serif', fontSize: '24px', color: '#d8d8e0', fontStyle: 'bold' }).setOrigin(0, 0.5)

    createButton(this, GAME.WIDTH / 2, GAME.HEIGHT - 42, { label: t('⟵ В лагерь'), width: 300, height: 50, onClick: () => this.scene.start(SCENES.HUB) })

    // Область результата
    this.resultBox = this.add.container(GAME.WIDTH / 2, 470)
    this.uiObjs = []
    this.render()
  }

  render() {
    this.uiObjs.forEach(o => o.destroy())
    this.uiObjs = []
    this.scrapText.setText(t('{n} металлолома', { n: fmt(State.scrap) }))

    // Тиры крафта
    const n = CRAFT_TIERS.length
    const cardW = 260, gap = 20
    const totalW = n * cardW + (n - 1) * gap
    const startX = (GAME.WIDTH - totalW) / 2 + cardW / 2
    CRAFT_TIERS.forEach((tier, i) => this.makeTier(startX + i * (cardW + gap), 210, cardW, tier))
  }

  makeTier(cx, cy, w, tier) {
    const h = 150
    const afford = State.scrap >= tier.cost
    const c = this.add.container(cx, cy)
    const bg = this.add.graphics()
    const border = parseInt(tier.css.slice(1), 16) // цвет рамки из tier.css
    const paint2 = (hover) => {
      bg.clear()
      bg.fillStyle(hover && afford ? 0x3a2c18 : 0x241d15, 1); bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12)
      bg.lineStyle(3, afford ? border : COLORS.ink, 0.9); bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12)
    }
    paint2(false)
    const name = this.add.text(0, -h / 2 + 24, t(tier.name), { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: tier.css, fontStyle: 'bold' }).setOrigin(0.5)
    const cost = this.add.text(0, -h / 2 + 58, `🔩 ${fmt(tier.cost)}`, { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: afford ? '#e8e8f0' : '#7a7a82', fontStyle: 'bold' }).setOrigin(0.5)
    const odds = this.add.text(0, -h / 2 + 88, t('редкое+: ~{n}%', { n: topPct(tier.luck) }), { fontFamily: 'Rubik, sans-serif', fontSize: '15px', color: CSS.toxic }).setOrigin(0.5)
    c.add([bg, name, cost, odds])

    const btn = createButton(this, 0, h / 2 - 26, {
      label: afford ? t('Ковать') : t('Мало 🔩'), width: w - 50, height: 52, fontSize: 19,
      color: afford ? COLORS.rust : COLORS.steelDark, hover: COLORS.rustLight, enabled: afford,
      onClick: () => this.doCraft(tier.id),
    })
    c.add(btn)
    const z = this.add.zone(-w / 2, -h / 2, w, h - 46).setOrigin(0).setInteractive({ useHandCursor: afford })
    z.on('pointerover', () => paint2(true))
    z.on('pointerout', () => paint2(false))
    z.on('pointerup', () => { if (afford) this.doCraft(tier.id) })
    c.add(z)
    this.uiObjs.push(c)
  }

  doCraft(tierId) {
    const item = State.craft(tierId)
    if (!item) return
    Sfx.levelup()
    this.showResult(item)
    this.render()
  }

  showResult(item) {
    this.resultBox.removeAll(true)
    const rar = RARITY_BY_ID[item.rarity]
    const slot = SLOT_BY_ID[item.slot]
    const w = 520, h = 84
    // Плашку кладём В контейнер (panel рисует в координатах, но не добавляет сам),
    // иначе фон результата улетает в левый верхний угол сцены.
    const bg = panel(this, -w / 2, -h / 2, w, h, { radius: 10, fill: 0x241d15, border: rar.color, borderW: 3 })
    const glow = this.add.image(0, 0, 'tex-glow').setTint(rar.color).setAlpha(0.35).setScale(4, 2).setBlendMode('ADD')
    const icon = this.add.text(-w / 2 + 30, 0, slot.icon, { fontSize: '38px' }).setOrigin(0.5)
    const name = this.add.text(-w / 2 + 62, -16, item.name, { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: rar.css, fontStyle: 'bold' }).setOrigin(0, 0.5)
    const sub = this.add.text(-w / 2 + 62, 12, `${t(slot.name)} · ${t(rar.name)} · ${statText(item)}`, { fontFamily: 'Rubik, sans-serif', fontSize: '14px', color: '#ddd2b4' }).setOrigin(0, 0.5)
    const tag = this.add.text(w / 2 - 20, 0, t('скован!'), { fontFamily: 'Rubik, sans-serif', fontSize: '15px', color: CSS.toxic }).setOrigin(1, 0.5)
    this.resultBox.add([bg, glow, icon, name, sub, tag])
    this.resultBox.setScale(0.8).setAlpha(0)
    this.tweens.add({ targets: this.resultBox, scale: 1, alpha: 1, duration: 220, ease: 'Back.out' })
  }
}
