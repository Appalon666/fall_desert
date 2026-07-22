// Hub — стартовый лагерь: навигация, крышки, уровень героя, офлайн-доход.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX, TEX_SS } from '../config.js'
import { State } from '../state/GameState.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, panel, applyPostFX } from '../ui/scenery.js'
import { Platform } from '../platform/yandex.js'
import { Sfx } from '../audio/sfx.js'
import { Music } from '../audio/music.js'
import { fmt, fmtDuration } from '../util/format.js'

export default class HubScene extends Phaser.Scene {
  constructor() { super(SCENES.HUB) }

  create() {
    const cx = GAME.WIDTH / 2

    // Атмосферный фон
    buildBackground(this, { sky: 0x2c2416, ground: 0x3a2a18, accent: 0xc9a76a }, { groundY: GAME.HEIGHT * 0.82 })
    applyPostFX(this, true, 0.45)
    Music.play(this, 'bgm_menu')

    // Заголовок
    titleText(this, cx, 76, 'ЯДРЁН-ПУСТОШЬ', { size: 54 })
    this.add.text(cx, 124, 'Крышки, пули и абсурд', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '24px', color: CSS.rust, fontStyle: 'bold' }).setOrigin(0.5)

    // Крышки (крупно, слева сверху)
    this.add.image(60, 44, TEX.CAP).setScale(1.6)
    this.add.text(86, 44, fmt(State.caps), { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '30px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    if (State.cores > 0) {
      this.add.text(60, 82, `☢ ${fmt(State.cores)} ядер`, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', color: '#b6ff5a', fontStyle: 'bold' }).setOrigin(0, 0.5)
    }

    // Рекорд
    this.add.text(GAME.WIDTH - 20, 30, `Рекорд: ${fmt(State.bestScore)} убийств`, { fontFamily: 'monospace', fontSize: '16px', color: CSS.sand }).setOrigin(1, 0.5)
    this.add.text(GAME.WIDTH - 20, 54, `Зона ${State.zoneIndex + 1} · ур. ${State.hero.level}`, { fontFamily: 'monospace', fontSize: '16px', color: '#cbb98e' }).setOrigin(1, 0.5)
    createButton(this, GAME.WIDTH - 100, 92, { label: '🏆 Рекорды', width: 170, height: 38, fontSize: 15, onClick: () => this.scene.start(SCENES.LEADERBOARD) })
    createButton(this, GAME.WIDTH - 100, 160, { label: '❔ Как играть', width: 170, height: 38, fontSize: 15, color: COLORS.rust, hover: COLORS.rustLight, onClick: () => this.showHowTo() })
    // Переключатель звука
    const muteTxt = this.add.text(GAME.WIDTH - 20, 128, Sfx.muted ? '🔇 Звук выкл' : '🔊 Звук вкл', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: CSS.sand }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true })
    muteTxt.on('pointerup', () => { const m = Sfx.toggleMute(); Music.setMuted(m); muteTxt.setText(m ? '🔇 Звук выкл' : '🔊 Звук вкл') })

    // Герой + полоска опыта
    const heroTex = (State.classDef() && State.classDef().tex) || TEX.HERO
    const hero = this.add.image(cx - 360, 456, heroTex).setScale(2.3 / TEX_SS)
    this.tweens.add({ targets: hero, y: hero.y - 6, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    const xpW = 300, xpX = cx - 510, xpY = 610
    this.add.text(xpX, xpY - 24, `Уровень ${State.hero.level}`, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', color: CSS.paper }).setOrigin(0)
    this.add.rectangle(xpX, xpY, xpW, 18, COLORS.ink).setOrigin(0)
    this.add.rectangle(xpX + 2, xpY + 2, (xpW - 4) * Phaser.Math.Clamp(State.hero.xp / State.xpToNext(), 0, 1), 14, COLORS.toxic).setOrigin(0)
    if (State.hero.points > 0) {
      this.add.text(xpX + xpW + 14, xpY + 8, `+${State.hero.points} очков!`, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    }

    // Кнопки навигации
    const bx = cx + 130
    let by = 250
    const gap = 74
    createButton(this, bx, by, { label: '⚔  ПОХОД', width: 340, height: 66, fontSize: 30, color: COLORS.toxicDark, hover: COLORS.toxic, onClick: () => this.scene.start(SCENES.BATTLE) })
    by += gap + 6
    createButton(this, bx, by, { label: '🔧  Апгрейды и союзники', width: 340, height: 58, onClick: () => this.scene.start(SCENES.SHOP) })
    by += gap
    createButton(this, bx, by, { label: '🎒  Инвентарь', width: 340, height: 58, onClick: () => this.scene.start(SCENES.INVENTORY) })
    by += gap
    createButton(this, bx, by, { label: '🔨  Верстак (крафт)', width: 340, height: 58, color: COLORS.rust, hover: COLORS.rustLight, onClick: () => this.scene.start(SCENES.FORGE) })
    by += gap
    createButton(this, bx, by, {
      label: State.hero.points > 0 ? `🦸  Герой (+${State.hero.points})` : '🦸  Герой',
      width: 340, height: 58, color: State.hero.points > 0 ? COLORS.rustLight : COLORS.rust,
      onClick: () => this.scene.start(SCENES.HERO),
    })
    by += gap
    createButton(this, bx, by, {
      label: State.canPrestige() ? `☢  Перерождение (+${State.coresFromRun()})` : '☢  Перерождение',
      width: 340, height: 58,
      color: State.canPrestige() ? COLORS.toxicDark : COLORS.rust, hover: COLORS.toxic,
      onClick: () => this.scene.start(SCENES.PRESTIGE),
    })

    this.add.text(cx, GAME.HEIGHT - 20, 'v0.2.0', { fontFamily: 'monospace', fontSize: '13px', color: '#9a8c70' }).setOrigin(0.5)

    // Debug-сброс прогресса — только в dev-сборке (Vite вырежет в проде).
    if (import.meta.env?.DEV) {
      createButton(this, 110, GAME.HEIGHT - 30, {
        label: '⟲ Сброс (debug)', width: 190, height: 38, fontSize: 15,
        color: COLORS.blood, hover: 0xc23b3b,
        onClick: () => { State.wipe(); this.scene.start(SCENES.CLASS_SELECT) },
      })
    }

    // Офлайн-доход
    this.showOfflineReward()

    // Новичку показываем «Как играть» один раз.
    let seenHow = false
    try { seenHow = localStorage.getItem('yp_howto') === '1' } catch (e) { /* */ }
    if (!seenHow) { try { localStorage.setItem('yp_howto', '1') } catch (e) { /* */ } this.showHowTo() }
  }

  showHowTo() {
    const cx = GAME.WIDTH / 2, cy = GAME.HEIGHT / 2
    const ov = this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, COLORS.ink, 0.8).setOrigin(0).setDepth(90).setInteractive()
    const w = 760, h = 470
    const g = panel(this, cx - w / 2, cy - h / 2, w, h, { fill: COLORS.steelDark, border: COLORS.cap, borderAlpha: 0.8 })
    g.setDepth(91)
    const title = this.add.text(cx, cy - h / 2 + 34, '❔  КАК ИГРАТЬ', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '30px', color: CSS.cap, fontStyle: 'bold', stroke: '#120d09', strokeThickness: 4 }).setOrigin(0.5).setDepth(92)
    const lines = [
      '🖱  КЛИК / ТАП по врагу — выстрел. Пуля бьёт БЛИЖАЙШЕГО — целься в опасных.',
      '☢  SPACE или кнопка УЛЬТА — залп по ВСЕЙ волне (копится от попаданий).',
      '🍾  Крышки за убийства → «Апгрейды»: урон, броня, союзники.',
      '🤖  Союзники бьют сами (и приносят доход, пока игра закрыта).',
      '💥  В конце каждой зоны — БОСС-ВОРОТА: пробей, чтобы идти дальше.',
      '🦸  За уровни — очки в Силу / Живучесть / Удачу (раздел «Герой»).',
      '🎁  С врагов падает лут → «Инвентарь» и «Верстак» (крафт за металлолом).',
      '☢  «Перерождение» — сброс забега ради вечных бонусов (Ядра). Мета-цель.',
      '⚠️  Враги крепнут по мере твоего роста — качайся и не зевай удары!',
    ]
    const body = this.add.text(cx - w / 2 + 40, cy - h / 2 + 76, lines.join('\n\n'), {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '17px', color: CSS.paper, lineSpacing: 2, wordWrap: { width: w - 80 },
    }).setOrigin(0, 0).setDepth(92)
    const close = createButton(this, cx, cy + h / 2 - 34, { label: 'Понятно!', width: 220, height: 46, fontSize: 20, color: COLORS.toxicDark, hover: COLORS.toxic, onClick: () => { ov.destroy(); g.destroy(); title.destroy(); body.destroy(); close.destroy() } })
    close.setDepth(92)
  }

  showOfflineReward() {
    const res = State.computeOffline()
    if (res.caps <= 0 || res.seconds < 60) { State.lastSeen = Date.now(); State.save(); return }
    State.claimOffline()

    const cx = GAME.WIDTH / 2, cy = GAME.HEIGHT / 2
    const overlay = this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, COLORS.ink, 0.6).setOrigin(0).setInteractive()
    const box = this.add.container(cx, cy)
    const bg = this.add.graphics()
    bg.fillStyle(COLORS.steelDark, 1); bg.fillRoundedRect(-230, -130, 460, 260, 14)
    bg.lineStyle(3, COLORS.cap, 0.8); bg.strokeRoundedRect(-230, -130, 460, 260, 14)
    const t1 = this.add.text(0, -90, 'С возвращением, выживший!', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0.5)
    const t2 = this.add.text(0, -40, `Отряд работал ${fmtDuration(res.seconds)}\nи собрал:`, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', color: CSS.paper, align: 'center' }).setOrigin(0.5)
    const cap = this.add.image(-40, 30, TEX.CAP).setScale(1.6)
    const t3 = this.add.text(-10, 30, `+${fmt(res.caps)}`, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '30px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    box.add([bg, t1, t2, cap, t3])
    const close = () => { overlay.destroy(); box.destroy(); take.destroy(); dbl.destroy() }
    const take = createButton(this, cx - 108, cy + 95, { label: 'Забрать', width: 180, height: 50, onClick: close })
    const dbl = createButton(this, cx + 108, cy + 95, {
      label: '📺 ×2', width: 180, height: 50, color: COLORS.toxicDark, hover: COLORS.toxic,
      onClick: () => { Platform.showRewarded(() => State.addCaps(res.caps)); close() },
    })
  }
}
