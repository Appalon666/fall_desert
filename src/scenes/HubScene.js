// Hub — стартовый лагерь: навигация, крышки, уровень героя, офлайн-доход.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX, TEX_SS } from '../config.js'
import { State } from '../state/GameState.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, panel, applyPostFX } from '../ui/scenery.js'
import { Platform } from '../platform/yandex.js'
import { Sfx } from '../audio/sfx.js'
import { Music } from '../audio/music.js'
import { t } from '../i18n.js'
import { fmt, fmtDuration } from '../util/format.js'

export default class HubScene extends Phaser.Scene {
  constructor() { super(SCENES.HUB) }

  create() {
    const cx = GAME.WIDTH / 2

    // Атмосферный фон: нарисованный арт меню (если есть) или процедурный.
    if (this.textures.exists('bg-menu')) {
      const src = this.textures.get('bg-menu').getSourceImage()
      const sc = Math.max(GAME.WIDTH / src.width, GAME.HEIGHT / src.height)
      this.add.image(GAME.WIDTH / 2, GAME.HEIGHT / 2, 'bg-menu').setScale(sc).setDepth(-20)
      this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, 0x0a0806, 0.42).setOrigin(0).setDepth(-19)
    } else {
      buildBackground(this, { sky: 0x2c2416, ground: 0x3a2a18, accent: 0xc9a76a }, { groundY: GAME.HEIGHT * 0.82 })
    }
    applyPostFX(this, true, 0.45)
    Music.play(this, 'bgm_menu')

    // Заголовок
    titleText(this, cx, 76, t('ЯДРЁН-ПУСТОШЬ'), { size: 54 })
    this.add.text(cx, 124, t('Крышки, пули и абсурд'), { fontFamily: 'Rubik, sans-serif', fontSize: '24px', color: CSS.rust, fontStyle: 'bold' }).setOrigin(0.5)

    // Крышки (крупно, слева сверху)
    this.add.image(60, 44, TEX.CAP).setScale(1.6)
    this.add.text(86, 44, fmt(State.caps), { fontFamily: 'Rubik, sans-serif', fontSize: '30px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    if (State.cores > 0) {
      this.add.text(60, 82, `☢ ${t('{n} ядер', { n: fmt(State.cores) })}`, { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: '#b6ff5a', fontStyle: 'bold' }).setOrigin(0, 0.5)
    }

    // Рекорд
    this.add.text(GAME.WIDTH - 20, 30, t('Рекорд: {n} убийств', { n: fmt(State.bestScore) }), { fontFamily: 'monospace', fontSize: '16px', color: CSS.sand }).setOrigin(1, 0.5)
    this.add.text(GAME.WIDTH - 20, 54, t('Зона {z} · ур. {l}', { z: State.zoneIndex + 1, l: State.hero.level }), { fontFamily: 'monospace', fontSize: '16px', color: '#cbb98e' }).setOrigin(1, 0.5)
    // Компактные иконки-кнопки в ряд (рекорды / как играть / настройки)
    const iy = 96, iw = 48, ig = 56
    createButton(this, GAME.WIDTH - 40, iy, { label: '⚙', width: iw, height: 44, fontSize: 24, onClick: () => this.showSettings() })
    createButton(this, GAME.WIDTH - 40 - ig, iy, { label: '❔', width: iw, height: 44, fontSize: 24, color: COLORS.rust, hover: COLORS.rustLight, onClick: () => this.showHowTo() })
    createButton(this, GAME.WIDTH - 40 - ig * 2, iy, { label: '🏆', width: iw, height: 44, fontSize: 24, onClick: () => this.scene.start(SCENES.LEADERBOARD) })

    // Герой + полоска опыта
    const heroTex = (State.classDef() && State.classDef().tex) || TEX.HERO
    const hero = this.add.image(cx - 360, 470, heroTex, 0).setScale(0.62)
    this.tweens.add({ targets: hero, y: hero.y - 6, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    const xpW = 300, xpX = cx - 510, xpY = 610
    this.add.text(xpX, xpY - 24, t('Уровень {l}', { l: State.hero.level }), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.paper }).setOrigin(0)
    this.add.rectangle(xpX, xpY, xpW, 18, COLORS.ink).setOrigin(0)
    this.add.rectangle(xpX + 2, xpY + 2, (xpW - 4) * Phaser.Math.Clamp(State.hero.xp / State.xpToNext(), 0, 1), 14, COLORS.toxic).setOrigin(0)
    if (State.hero.points > 0) {
      this.add.text(xpX + xpW + 14, xpY + 8, t('+{n} очков!', { n: State.hero.points }), { fontFamily: 'Rubik, sans-serif', fontSize: '16px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    }

    // Кнопки навигации
    const bx = cx + 210
    let by = 250
    const gap = 74
    createButton(this, bx, by, { label: t('ПОХОД'), width: 340, height: 66, fontSize: 30, color: COLORS.toxicDark, hover: COLORS.toxic, onClick: () => this.scene.start(SCENES.BATTLE) })
    by += gap + 6
    createButton(this, bx, by, { label: t('Апгрейды и союзники'), width: 340, height: 58, onClick: () => this.scene.start(SCENES.SHOP) })
    by += gap
    createButton(this, bx, by, { label: t('Инвентарь'), width: 340, height: 58, onClick: () => this.scene.start(SCENES.INVENTORY) })
    by += gap
    createButton(this, bx, by, { label: t('Верстак (крафт)'), width: 340, height: 58, color: COLORS.rust, hover: COLORS.rustLight, onClick: () => this.scene.start(SCENES.FORGE) })
    by += gap
    createButton(this, bx, by, {
      label: State.hero.points > 0 ? t('Герой (+{n})', { n: State.hero.points }) : t('Герой'),
      width: 340, height: 58, color: State.hero.points > 0 ? COLORS.rustLight : COLORS.rust,
      onClick: () => this.scene.start(SCENES.HERO),
    })
    by += gap
    createButton(this, bx, by, {
      label: State.canPrestige() ? t('Перерождение (+{n})', { n: State.coresFromRun() }) : t('Перерождение'),
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
    const w = 760, h = 524
    const g = panel(this, cx - w / 2, cy - h / 2, w, h, { fill: COLORS.steelDark, border: COLORS.cap, borderAlpha: 0.8 })
    g.setDepth(91)
    const title = this.add.text(cx, cy - h / 2 + 34, t('❔  КАК ИГРАТЬ'), { fontFamily: 'Rubik, sans-serif', fontSize: '30px', color: CSS.cap, fontStyle: 'bold', stroke: '#120d09', strokeThickness: 4 }).setOrigin(0.5).setDepth(92)
    const lines = [
      '🖱  КЛИК / ТАП по врагу — выстрел. Пуля бьёт БЛИЖАЙШЕГО — целься в опасных.',
      '☢  SPACE или кнопка УЛЬТА — залп по ВСЕЙ волне (копится от попаданий).',
      '🍾  Крышки за убийства → «Апгрейды»: урон, броня, союзники.',
      '🤖  Союзники бьют сами (и приносят доход, пока игра закрыта).',
      '💥  В конце каждой зоны — БОСС-ВОРОТА: пробей, чтобы идти дальше.',
      '🦸  За уровни — очки в Силу / Живучесть / Удачу (раздел «Герой»).',
      '🎁  С врагов падает лут → «Инвентарь» и «Верстак» (крафт за металлолом).',
      '☢  «Перерождение» — сброс забега ради ЯДЕР и вечных бонусов (урон/HP/крышки).',
      '💠  Ядра даёт ТОЛЬКО перерождение: чем дальше прошёл (выше зона) — тем больше Ядер.',
      '⚠️  Враги крепнут по мере твоего роста — качайся и не зевай удары!',
    ].map(l => t(l))
    const body = this.add.text(cx - w / 2 + 40, cy - h / 2 + 76, lines.join('\n\n'), {
      fontFamily: 'Rubik, sans-serif', fontSize: '17px', color: CSS.paper, lineSpacing: 2, wordWrap: { width: w - 80 },
    }).setOrigin(0, 0).setDepth(92)
    const close = createButton(this, cx, cy + h / 2 - 34, { label: t('Понятно!'), width: 220, height: 46, fontSize: 20, color: COLORS.toxicDark, hover: COLORS.toxic, onClick: () => { ov.destroy(); g.destroy(); title.destroy(); body.destroy(); close.destroy() } })
    close.setDepth(92)
  }

  // Настройки: мьют + громкость звука и музыки (шаг 10%, сохраняется).
  showSettings() {
    const cx = GAME.WIDTH / 2, cy = GAME.HEIGHT / 2
    const w = 560, h = 340
    const ov = this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, COLORS.ink, 0.8).setOrigin(0).setDepth(90).setInteractive()
    const g = panel(this, cx - w / 2, cy - h / 2, w, h, { fill: COLORS.steelDark, border: COLORS.cap, borderAlpha: 0.8 }).setDepth(91)
    const title = this.add.text(cx, cy - h / 2 + 30, t('НАСТРОЙКИ'), { fontFamily: 'Rubik, sans-serif', fontSize: '28px', color: CSS.cap, fontStyle: 'bold', stroke: '#120d09', strokeThickness: 4 }).setOrigin(0.5).setDepth(92)
    const base = [ov, g, title]
    let dyn = []
    const clear = () => { dyn.forEach(o => o.destroy()); dyn = [] }
    const draw = () => {
      clear()
      const mute = createButton(this, cx, cy - 78, {
        label: Sfx.muted ? t('🔇 Звук выключен') : t('🔊 Звук включён'), width: 380, height: 44, fontSize: 18,
        color: Sfx.muted ? COLORS.blood : COLORS.toxicDark, hover: COLORS.toxic,
        onClick: () => { const m = Sfx.toggleMute(); Music.setMuted(m); draw() },
      }).setDepth(92)
      dyn.push(mute)
      dyn.push(...this.volumeRow(cx, cy - 10, t('Звук'), Math.round(Sfx.volume * 100), (d) => { Sfx.setVolume(Sfx.volume + d); Sfx.resume(); Sfx.hit(); draw() }))
      dyn.push(...this.volumeRow(cx, cy + 60, t('Музыка'), Math.round(Music.userVolume * 100), (d) => { Music.setUserVolume(Music.userVolume + d); draw() }))
    }
    draw()
    const close = createButton(this, cx, cy + h / 2 - 32, { label: t('Закрыть'), width: 200, height: 44, fontSize: 18, color: COLORS.toxicDark, hover: COLORS.toxic, onClick: () => { base.forEach(o => o.destroy()); clear(); close.destroy() } }).setDepth(92)
  }

  // Строка регулятора громкости: label, [–] полоска [+], NN%.
  volumeRow(cx, y, label, pct, onDelta) {
    const objs = []
    objs.push(this.add.text(cx - 240, y, label, { fontFamily: 'Rubik, sans-serif', fontSize: '19px', color: CSS.paper, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(92))
    const minus = createButton(this, cx - 30, y, { label: '–', width: 42, height: 40, fontSize: 24, onClick: () => onDelta(-0.1) }).setDepth(92)
    const plus = createButton(this, cx + 150, y, { label: '+', width: 42, height: 40, fontSize: 24, onClick: () => onDelta(0.1) }).setDepth(92)
    const barBg = this.add.rectangle(cx + 6, y, 108, 16, COLORS.ink).setOrigin(0, 0.5).setDepth(92)
    const barFill = this.add.rectangle(cx + 8, y, (108 - 4) * (pct / 100), 12, COLORS.toxic).setOrigin(0, 0.5).setDepth(92)
    const txt = this.add.text(cx + 200, y, `${pct}%`, { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(92)
    objs.push(minus, plus, barBg, barFill, txt)
    return objs
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
    const t1 = this.add.text(0, -90, t('С возвращением, выживший!'), { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0.5)
    const t2 = this.add.text(0, -40, t('Отряд работал {t}\nи собрал:', { t: fmtDuration(res.seconds) }), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.paper, align: 'center' }).setOrigin(0.5)
    const cap = this.add.image(-40, 30, TEX.CAP).setScale(1.6)
    const t3 = this.add.text(-10, 30, `+${fmt(res.caps)}`, { fontFamily: 'Rubik, sans-serif', fontSize: '30px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    box.add([bg, t1, t2, cap, t3])
    const close = () => { overlay.destroy(); box.destroy(); take.destroy(); dbl.destroy() }
    const take = createButton(this, cx - 108, cy + 95, { label: t('Забрать'), width: 180, height: 50, onClick: close })
    const dbl = createButton(this, cx + 108, cy + 95, {
      label: '📺 ×2', width: 180, height: 50, color: COLORS.toxicDark, hover: COLORS.toxic,
      onClick: () => { Platform.showRewarded(() => State.addCaps(res.caps)); close() },
    })
  }
}
