// Hub — стартовый лагерь: навигация, крышки, уровень героя, офлайн-доход.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX, TEX_SS } from '../config.js'
import { State } from '../state/GameState.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, panel, applyPostFX, resIcon } from '../ui/scenery.js'
import { heroScaleFor } from '../assets.js'
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

    // Заголовок = название игры, слово в слово как в черновике (п.5.1.3).
    titleText(this, cx, 84, t('Ядрён-Пустошь'), { size: 54 })

    // Крышки (крупно, слева сверху)
    resIcon(this, 60, 44, 'caps', 42)
    this.add.text(86, 44, fmt(State.caps), { fontFamily: 'Rubik, sans-serif', fontSize: '30px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    if (State.cores > 0) {
      resIcon(this, 60, 84, 'core', 26)
      this.add.text(78, 84, t('{n} ядер', { n: fmt(State.cores) }), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: '#b6ff5a', fontStyle: 'bold' }).setOrigin(0, 0.5)
    }

    // Рекорд
    this.add.text(GAME.WIDTH - 20, 30, t('Рекорд: {n} убийств', { n: fmt(State.bestScore) }), { fontFamily: 'monospace', fontSize: '16px', color: CSS.sand }).setOrigin(1, 0.5)
    this.add.text(GAME.WIDTH - 20, 54, t('Зона {z} · ур. {l}', { z: State.zoneIndex + 1, l: State.hero.level }), { fontFamily: 'monospace', fontSize: '16px', color: '#cbb98e' }).setOrigin(1, 0.5)
    // Компактные иконки-кнопки в ряд (рекорды / как играть / настройки)
    const iy = 102, iw = 58, ig = 68
    createButton(this, GAME.WIDTH - 44, iy, { label: '⚙', width: iw, height: 54, fontSize: 28, onClick: () => this.showSettings() })
    createButton(this, GAME.WIDTH - 44 - ig, iy, { label: '❔', width: iw, height: 54, fontSize: 28, color: COLORS.rust, hover: COLORS.rustLight, onClick: () => this.showHowTo() })
    createButton(this, GAME.WIDTH - 44 - ig * 2, iy, { label: '🏆', width: iw, height: 54, fontSize: 28, onClick: () => this.scene.start(SCENES.LEADERBOARD) })

    // Герой + полоска опыта
    const heroCls = State.classDef()
    const heroTex = (heroCls && heroCls.tex) || TEX.HERO
    const footY = (heroCls && heroCls.footY) || 0.98 // ноги на одной линии для всех классов
    const hero = this.add.image(cx - 360, 556, heroTex, 0).setOrigin(0.5, footY).setScale(heroScaleFor(this, heroTex, 147))
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

    this.add.text(cx, GAME.HEIGHT - 20, 'v0.2.1', { fontFamily: 'monospace', fontSize: '13px', color: '#9a8c70' }).setOrigin(0.5)

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
    const w = 830, h = 668
    const g = panel(this, cx - w / 2, cy - h / 2, w, h, { fill: COLORS.steelDark, border: COLORS.cap, borderAlpha: 0.8 })
    g.setDepth(91)
    const title = this.add.text(cx, cy - h / 2 + 30, t('КАК ИГРАТЬ'), { fontFamily: 'Rubik, sans-serif', fontSize: '28px', color: CSS.cap, fontStyle: 'bold', stroke: '#120d09', strokeThickness: 4 }).setOrigin(0.5).setDepth(92)
    const lines = [
      '🖱  КЛИК / ТАП по врагу — выстрел. Пуля бьёт БЛИЖАЙШЕГО, целься в опасных.',
      '☢  SPACE или кнопка УЛЬТА — залп по ВСЕЙ волне (копится от попаданий).',
      '🍾  Крышки за убийства → «Апгрейды»: урон, броня, картечь, крит, союзники.',
      '🤖  Союзники бьют сами и приносят доход, пока игра закрыта (офлайн).',
      '💥  Каждые 20 убийств в зоне волна пополняется врагом — под конец жарче.',
      '🚪  В конце каждой зоны — БОСС-ВОРОТА: пробей, чтобы идти дальше.',
      '🦸  За уровни героя — очки в Силу / Живучесть / Удачу (раздел «Герой»).',
      '🎁  С врагов падает ЛУТ. Хлам разбирай в металлолом, куй новое на «Верстаке».',
      '🎨  Редкость: Хлам ‹ Годное ‹ Редкое ‹ Легенда ‹ РЕЛИКВИЯ (оранж). Выше — сильнее бонус.',
      '⚒  Чем дороже сборка на «Верстаке», тем выше шанс редкого предмета.',
      '☢  ПЕРЕРОЖДЕНИЕ откроется после босса 4-й локации и даёт 4 ЯДРА.',
      '💠  Ядра — на вечные бонусы (урон/HP/крышки/старт). Забег сбрасывается.',
      '🔥  Каждое перерождение делает врагов на +5% сильнее — пустошь звереет.',
      '⚠️  Враги крепнут по мере твоего роста — качайся и не зевай удары!',
    ].map(l => t(l))
    const body = this.add.text(cx - w / 2 + 40, cy - h / 2 + 70, lines.join('\n'), {
      fontFamily: 'Rubik, sans-serif', fontSize: '15px', color: CSS.paper, lineSpacing: 9, wordWrap: { width: w - 80 },
    }).setOrigin(0, 0).setDepth(92)
    const close = createButton(this, cx, cy + h / 2 - 40, { label: t('Понятно!'), width: 220, height: 46, fontSize: 20, color: COLORS.toxicDark, hover: COLORS.toxic, onClick: () => { ov.destroy(); g.destroy(); title.destroy(); body.destroy(); close.destroy() } })
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
      dyn.push(...this.volumeRow(cx, cy - 10, t('Звук'), Sfx.volume, (frac) => { Sfx.setVolume(frac); Sfx.resume() }, () => Sfx.hit()))
      dyn.push(...this.volumeRow(cx, cy + 60, t('Музыка'), Music.userVolume, (frac) => { Music.setUserVolume(frac) }))
    }
    draw()
    const close = createButton(this, cx, cy + h / 2 - 32, { label: t('Закрыть'), width: 200, height: 44, fontSize: 18, color: COLORS.toxicDark, hover: COLORS.toxic, onClick: () => { base.forEach(o => o.destroy()); clear(); close.destroy() } }).setDepth(92)
  }

  // Строка регулятора громкости: label, [–] полоска [+], NN%.
  // frac0 — начальное значение 0..1; onSet(frac) применяет громкость;
  // onFeedback() — опциональный звук-отклик. Полоску можно тянуть мышью/тачем.
  volumeRow(cx, y, label, frac0, onSet, onFeedback) {
    const objs = []
    const barX = cx + 6, barW = 108, innerW = barW - 4
    let frac = Math.min(1, Math.max(0, frac0))

    objs.push(this.add.text(cx - 240, y, label, { fontFamily: 'Rubik, sans-serif', fontSize: '19px', color: CSS.paper, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(92))
    const barBg = this.add.rectangle(barX, y, barW, 16, COLORS.ink).setOrigin(0, 0.5).setDepth(92)
    const barFill = this.add.rectangle(barX + 2, y, innerW * frac, 12, COLORS.toxic).setOrigin(0, 0.5).setDepth(92)
    const knob = this.add.circle(barX + 2 + innerW * frac, y, 10, COLORS.toxic).setStrokeStyle(2, COLORS.ink).setDepth(93)
    const txt = this.add.text(cx + 200, y, `${Math.round(frac * 100)}%`, { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(92)

    const refresh = () => {
      barFill.width = innerW * frac
      knob.x = barX + 2 + innerW * frac
      txt.setText(`${Math.round(frac * 100)}%`)
    }
    const apply = (f, feedback) => {
      frac = Math.min(1, Math.max(0, f))
      refresh(); onSet(frac)
      if (feedback && onFeedback) onFeedback()
    }

    const minus = createButton(this, cx - 30, y, { label: '–', width: 52, height: 52, fontSize: 26, onClick: () => apply(Math.round((frac - 0.1) * 10) / 10, true) }).setDepth(92)
    const plus = createButton(this, cx + 150, y, { label: '+', width: 52, height: 52, fontSize: 26, onClick: () => apply(Math.round((frac + 0.1) * 10) / 10, true) }).setDepth(92)

    // Перетаскивание/клик по полоске: зона чуть выше для удобного тача.
    const hit = this.add.zone(barX, y, barW, 46).setOrigin(0, 0.5).setInteractive({ useHandCursor: true, draggable: true }).setDepth(94)
    const setFromX = (px, feedback) => apply((px - (barX + 2)) / innerW, feedback)
    hit.on('pointerdown', (p) => setFromX(p.x, false))
    hit.on('drag', (p) => setFromX(p.x, false)) // тянем ползунок за курсором/пальцем
    hit.on('pointerup', () => { if (onFeedback) onFeedback() })

    objs.push(minus, plus, barBg, barFill, knob, txt, hit)
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
    bg.fillStyle(COLORS.steelDark, 1); bg.fillRoundedRect(-290, -140, 580, 290, 14)
    bg.lineStyle(3, COLORS.cap, 0.8); bg.strokeRoundedRect(-290, -140, 580, 290, 14)
    const t1 = this.add.text(0, -90, t('С возвращением, выживший!'), { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0.5)
    const t2 = this.add.text(0, -40, t('Отряд работал {t}\nи собрал:', { t: fmtDuration(res.seconds) }), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.paper, align: 'center' }).setOrigin(0.5)
    const cap = resIcon(this, -40, 30, 'caps', 42)
    const t3 = this.add.text(-10, 30, `+${fmt(res.caps)}`, { fontFamily: 'Rubik, sans-serif', fontSize: '30px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    box.add([bg, t1, t2, cap, t3])
    const close = () => { overlay.destroy(); box.destroy(); take.destroy(); dbl.destroy() }
    const take = createButton(this, cx - 145, cy + 105, { label: t('Забрать'), width: 200, height: 56, onClick: close })
    // Яндекс 4.5.1: на кнопке вызова rewarded video должно быть однозначно
    // написано, что за награду покажут рекламу — одной иконки 📺 недостаточно.
    const dbl = createButton(this, cx + 145, cy + 105, {
      label: t('📺 Реклама: ×2'), width: 240, height: 56, fontSize: 20, color: COLORS.toxicDark, hover: COLORS.toxic,
      onClick: () => { Platform.showRewarded(() => State.addCaps(res.caps)); close() },
    })
  }
}
