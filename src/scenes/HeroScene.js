// Hero — характеристики и распределение очков за уровни (Сила / Живучесть / Удача).

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX } from '../config.js'
import { State } from '../state/GameState.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, applyPostFX } from '../ui/scenery.js'
import { heroScaleFor } from '../assets.js'
import { t } from '../i18n.js'
import { fmt } from '../util/format.js'

// Числа в desc обязаны совпадать с BAL.perStrength / perVitality / perLuckCrit —
// их сверяет тест «описания характеристик совпадают с балансом». «+25 к макс. HP»
// здесь пережило подъём perVitality до 30.
const STATS = [
  { id: 'str',  name: 'Сила',      icon: '💪', desc: '+2 к урону клика' },
  { id: 'vit',  name: 'Живучесть', icon: '❤️', desc: '+30 к макс. HP' },
  { id: 'luck', name: 'Удача',     icon: '🍀', desc: '+1% крит (сверх потолка — крит-урон) и лучше лут' },
]

export default class HeroScene extends Phaser.Scene {
  constructor() { super(SCENES.HERO) }

  create() {
    buildBackground(this, { sky: 0x241d15, ground: 0x322516, accent: 0x8a6a3a }, { groundY: GAME.HEIGHT * 0.88, dust: false })
    applyPostFX(this, true, 0.4)
    titleText(this, GAME.WIDTH / 2, 44, t('ГЕРОЙ'), { size: 36 })
    const cls = State.classDef()
    const heroTex = (cls && cls.tex) || TEX.HERO
    const footY = (cls && cls.footY) || 0.98 // ноги на одной линии для всех классов
    this.add.image(GAME.WIDTH / 2 - 360, GAME.HEIGHT / 2 + 126, heroTex, 0).setOrigin(0.5, footY).setScale(heroScaleFor(this, heroTex, 218))
    if (cls) this.add.text(GAME.WIDTH / 2 - 360, GAME.HEIGHT / 2 + 172, t(cls.name), { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0.5)

    createButton(this, GAME.WIDTH / 2, GAME.HEIGHT - 44, { label: t('⟵ В лагерь'), width: 300, height: 52, onClick: () => this.scene.start(SCENES.HUB) })

    // Сброс прогресса (для тестов и смены класса).
    createButton(this, GAME.WIDTH - 130, GAME.HEIGHT - 40, {
      label: t('⟲ Сброс'), width: 180, height: 52, fontSize: 18,
      color: COLORS.blood, hover: 0xc23b3b,
      onClick: () => this.confirmWipe(),
    })

    this.uiObjs = []
    this.render()
  }

  render() {
    this.uiObjs.forEach(o => o.destroy())
    this.uiObjs = []

    const cx = GAME.WIDTH / 2 + 80
    const info = this.add.text(cx, 110, t('Уровень {l}    Опыт {a}/{b}', { l: State.hero.level, a: fmt(State.hero.xp), b: fmt(State.xpToNext()) }), { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: CSS.paper }).setOrigin(0.5)
    const pts = this.add.text(cx, 144, State.hero.points > 0 ? t('Свободных очков: {n}', { n: State.hero.points }) : t('Нет свободных очков'), { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: State.hero.points > 0 ? CSS.cap : '#b8ad9a', fontStyle: 'bold' }).setOrigin(0.5)
    this.uiObjs.push(info, pts)

    let y = 210
    STATS.forEach(s => {
      const row = this.add.container(cx - 300, y)
      const icon = this.add.text(0, 0, s.icon, { fontSize: '32px' }).setOrigin(0, 0.5)
      const label = this.add.text(50, -12, `${t(s.name)}: ${State.hero[s.id]}`, { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.paper, fontStyle: 'bold' }).setOrigin(0, 0.5)
      const desc = this.add.text(50, 14, t(s.desc), { fontFamily: 'Rubik, sans-serif', fontSize: '15px', color: '#ddd2b4' }).setOrigin(0, 0.5)
      row.add([icon, label, desc])
      this.uiObjs.push(row)

      const canAdd = State.hero.points > 0
      const btn = createButton(this, cx + 250, y, {
        label: '＋', width: 60, height: 52, fontSize: 30,
        color: canAdd ? COLORS.toxicDark : COLORS.steelDark, hover: COLORS.toxic, enabled: canAdd,
        onClick: () => { if (State.spendPoint(s.id)) this.render() },
      })
      this.uiObjs.push(btn)
      y += 90
    })

    // Сводка боевых статов
    this.renderSummaryStub(cx, y)
  }

  confirmWipe() {
    const cx = GAME.WIDTH / 2, cy = GAME.HEIGHT / 2
    // Слои обязательны: без них окно живёт на нулевом слое вместе с обычным
    // содержимым сцены, и любой элемент поверх перехватит клики по кнопкам.
    const ov = this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, COLORS.ink, 0.7).setOrigin(0).setDepth(90).setInteractive()
    const msg = this.add.text(cx, cy - 70, t('Стереть весь прогресс?\nЭто нельзя отменить.'), { fontFamily: 'Rubik, sans-serif', fontSize: '24px', color: '#fff', align: 'center' }).setOrigin(0.5).setDepth(91)
    const yes = createButton(this, cx - 110, cy + 20, { label: t('Стереть'), width: 190, height: 54, color: COLORS.blood, hover: 0xc23b3b, onClick: () => { State.wipe(); this.scene.start(SCENES.CLASS_SELECT) } }).setDepth(92)
    const no = createButton(this, cx + 110, cy + 20, { label: t('Отмена'), width: 190, height: 54, onClick: () => { ov.destroy(); msg.destroy(); yes.destroy(); no.destroy() } }).setDepth(92)
  }

  renderSummaryStub(cx, y) {
    const summary = this.add.text(cx, y + 20, [
      t('Урон клика: {n}', { n: fmt(State.clickDamage(false)) }),
      t('Макс. HP: {n}', { n: fmt(State.heroMaxHp()) }),
      t('Крит: {n}% ×{m}', { n: (State.critChance() * 100).toFixed(0), m: State.critMultiplier().toFixed(2) }),
      t('Урон союзников: {n}/сек', { n: fmt(State.allyDps()) }),
    ].join('     '), { fontFamily: 'monospace', fontSize: '16px', color: '#e8ddc0' }).setOrigin(0.5)
    this.uiObjs.push(summary)
  }
}
