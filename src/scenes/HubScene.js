// Hub — стартовый лагерь: навигация, крышки, уровень героя, офлайн-доход.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX, TEX_SS, APP_VERSION } from '../config.js'
import { State } from '../state/GameState.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, panel, applyPostFX, resIcon } from '../ui/scenery.js'
import { heroScaleFor, buildHowToSheets } from '../assets.js'
import { Platform } from '../platform/yandex.js'
import { Sfx } from '../audio/sfx.js'
import { Music } from '../audio/music.js'
import { toast } from '../gfx/fx.js'
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
    this.addReviewButton(GAME.WIDTH - 44 - ig * 3, iy, iw)

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

    // Версия одна на весь проект: package.json, этот экран и dock/store-listing.md.
    this.add.text(cx, GAME.HEIGHT - 20, `v${APP_VERSION}`, { fontFamily: 'monospace', fontSize: '13px', color: '#9a8c70' }).setOrigin(0.5)

    // Debug-сброс прогресса — только в dev-сборке (Vite вырежет в проде).
    if (import.meta.env?.DEV) {
      createButton(this, 110, GAME.HEIGHT - 30, {
        label: '⟲ Сброс (debug)', width: 190, height: 38, fontSize: 15,
        color: COLORS.blood, hover: 0xc23b3b,
        onClick: () => { State.wipe(); this.scene.start(SCENES.CLASS_SELECT) },
      })
    }

    // Офлайн-доход
    // Два окна разом показывать нельзя: у каждого свой полноэкранный
    // перехватчик кликов, и верхнее наглухо блокирует кнопки нижнего (игрок
    // видел награду за офлайн и не мог нажать «Забрать»). Поэтому «Как играть»
    // ждёт, пока игрок закроет награду.
    // Листы для «Как играть» могли доехать фоном уже после старта лагеря.
    buildHowToSheets(this)

    this.showOfflineReward(() => {
      let seenHow = false
      try { seenHow = localStorage.getItem('yp_howto') === '1' } catch (e) { /* */ }
      if (seenHow) return
      try { localStorage.setItem('yp_howto', '1') } catch (e) { /* */ }
      this.showHowTo()
    })
  }

  // Кнопка «оценить игру» — единственная точка, где оценку просит сам игрок, а
  // не игра. Мёртвой кнопки быть не должно: рисуем её, только если платформа
  // прямо сказала, что запрос сейчас пройдёт (игрок авторизован, ещё не оценивал,
  // запрос за эту сессию не потрачен). Ответ canReview асинхронный, поэтому
  // кнопка появляется на кадр-другой позже остальных — на глаз незаметно.
  addReviewButton(x, y, w) {
    if (!State.reviewUnlocked()) return
    Platform.canReview().then(({ value }) => {
      if (!value || !this.scene.isActive()) return
      const btn = createButton(this, x, y, {
        label: '⭐', width: w, height: 54, fontSize: 28,
        color: COLORS.rust, hover: COLORS.rustLight,
        // Оценка одна на игрока: после запроса кнопке уже нечего делать, чем бы
        // он ни кончился — оценил, закрыл окно или окно не открылось вовсе.
        onClick: () => { Platform.requestReview().catch(() => {}).then(() => btn.destroy()) },
      })
    }).catch(() => { /* нет SDK — кнопки просто не будет */ })
  }

  // Картинка моба для «Как играть»: настоящий спрайт, если лист доехал, иначе
  // процедурная заглушка. Первый кадр листа — поза стойки.
  mobIcon(x, y, sheetKey, fallbackTex, targetH, fallbackFrameH) {
    if (this.textures.exists(sheetKey)) {
      const img = this.add.image(x, y, sheetKey, 0)
      const frame = this.textures.get(sheetKey).get(0)
      if (frame && frame.height) img.setScale(targetH / frame.height)
      return img
    }
    return this.add.image(x, y, fallbackTex).setScale(targetH / (fallbackFrameH * TEX_SS))
  }

  // «Как играть». Раньше здесь была стена из 14 строк мелким шрифтом — новичок
  // такое не читает. Теперь первая страница отвечает ровно на три вопроса
  // картинками: чем бить, на что тратить, куда идти. Всё, что в первую минуту
  // не нужно (лут, крафт, перерождение), убрано на вторую страницу.
  showHowTo() {
    const cx = GAME.WIDTH / 2, cy = GAME.HEIGHT / 2
    const w = 900, h = 500
    const ov = this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, COLORS.ink, 0.82).setOrigin(0).setDepth(90).setInteractive()
    const g = panel(this, cx - w / 2, cy - h / 2, w, h, { fill: COLORS.steelDark, border: COLORS.cap, borderAlpha: 0.8 }).setDepth(91)
    const title = this.add.text(cx, cy - h / 2 + 34, t('КАК ИГРАТЬ'), {
      fontFamily: 'Rubik, sans-serif', fontSize: '30px', color: CSS.cap, fontStyle: 'bold', stroke: '#120d09', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(92)

    const base = [ov, g, title]
    let page = []
    // Твины Phaser НЕ умирают вместе с объектом (GameObject.destroy их не
    // трогает), а иконки карточек покачиваются бесконечным твином. Без явного
    // killTweensOf при листании страниц оставались твины на уничтоженных
    // объектах.
    const clear = () => {
      page.forEach(o => { try { this.tweens.killTweensOf(o) } catch (e) { /* */ } o.destroy() })
      page = []
    }
    const closeAll = () => { clear(); base.forEach(o => o.destroy()) }

    // Карточка: крупная картинка, короткий заголовок, одна строка пояснения.
    const card = (x, head, line, makeIcon) => {
      const cw = 264, ch = 264, top = cy - h / 2 + 76
      const p = panel(this, x - cw / 2, top, cw, ch, { fill: COLORS.ink, border: COLORS.cap, borderAlpha: 0.3 }).setDepth(92)
      const icon = makeIcon(x, top + 82).setDepth(93)
      this.tweens.add({ targets: icon, y: icon.y - 7, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      const h1 = this.add.text(x, top + 162, t(head), {
        fontFamily: 'Rubik, sans-serif', fontSize: '21px', color: CSS.cap, fontStyle: 'bold',
        align: 'center', wordWrap: { width: cw - 28 },
      }).setOrigin(0.5).setDepth(93)
      const h2 = this.add.text(x, top + 194, t(line), {
        fontFamily: 'Rubik, sans-serif', fontSize: '16px', color: CSS.paper,
        align: 'center', wordWrap: { width: cw - 32 }, lineSpacing: 5,
      }).setOrigin(0.5, 0).setDepth(93)
      page.push(p, icon, h1, h2)
    }

    const footer = (leftLabel, leftAction) => {
      const y = cy + h / 2 - 40
      const left = createButton(this, cx - 130, y, { label: t(leftLabel), width: 220, height: 48, fontSize: 19, onClick: leftAction }).setDepth(92)
      const ok = createButton(this, cx + 130, y, {
        label: t('Понятно!'), width: 220, height: 48, fontSize: 19,
        color: COLORS.toxicDark, hover: COLORS.toxic, onClick: closeAll,
      }).setDepth(92)
      page.push(left, ok)
    }

    const page1 = () => {
      clear()
      card(cx - 292, 'Кликай по врагу', 'Пуля летит в точку клика',
        (x, y) => this.mobIcon(x, y, 'enemy-ghoul', TEX.ENEMY, 132, 72))
      card(cx, 'Крышки — в силу', 'Апгрейды, союзники, снаряга',
        (x, y) => resIcon(this, x, y, 'caps', 100))
      card(cx + 292, 'Босс — ворота зоны', 'Пробей его, чтобы идти дальше',
        (x, y) => this.mobIcon(x, y, 'boss-ratking', TEX.BOSS, 132, 100))
      const hint = this.add.text(cx, cy + h / 2 - 84, t('☢  SPACE — залп по всей волне'), {
        fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.toxic, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(92)
      page.push(hint)
      footer('Что дальше →', page2)
    }

    const page2 = () => {
      clear()
      // Иконки берём игровые (те же, что игрок увидит в инвентаре, на верстаке
      // и в престиже) — эмодзи оставлены только там, где своей картинки нет.
      const rows = [
        ['slot-weapon', '🎁', 'С врагов падает снаряга — надевай в «Инвентаре»'],
        ['res-scrap', '⚒', 'Лишнее разбирай в металлолом и куй новое на «Верстаке»'],
        ['up-damage', '🦸', 'За уровни дают очки: Сила, Живучесть, Удача'],
        ['', '⚙', 'Босс 10-й локации роняет части реликвии — собери 5 и куй'],
        ['res-core', '☢', 'После 4-й локации откроется Перерождение — вечные бонусы'],
      ]
      // Шаг ужат с 68 до 62: пятая строка (реликвии) иначе налезает на кнопки.
      let y = cy - h / 2 + 104
      for (const [iconKey, emoji, text] of rows) {
        const em = this.textures.exists(iconKey)
          ? this.add.image(cx - 330, y, iconKey).setDisplaySize(40, 40).setOrigin(0.5).setDepth(92)
          : this.add.text(cx - 330, y, emoji, { fontSize: '30px' }).setOrigin(0.5).setDepth(92)
        const tx = this.add.text(cx - 288, y, t(text), {
          fontFamily: 'Rubik, sans-serif', fontSize: '19px', color: CSS.paper, wordWrap: { width: 600 },
        }).setOrigin(0, 0.5).setDepth(92)
        page.push(em, tx)
        y += 62
      }
      footer('← Назад', page1)
    }

    page1()
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

  // onClose вызывается и когда награды не было — чтобы то, что стоит в очереди
  // за этим окном (например «Как играть»), не потерялось.
  showOfflineReward(onClose = () => {}) {
    const res = State.computeOffline()
    if (res.caps <= 0 || res.seconds < 60) { State.lastSeen = Date.now(); State.save(); onClose(); return }
    State.claimOffline()

    const cx = GAME.WIDTH / 2, cy = GAME.HEIGHT / 2
    // Слои задаём явно: без них окно оставалось на нулевом слое и любое другое
    // окно накрывало его своим перехватчиком кликов.
    const overlay = this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, COLORS.ink, 0.6).setOrigin(0).setDepth(90).setInteractive()
    const box = this.add.container(cx, cy).setDepth(91)
    const bg = this.add.graphics()
    bg.fillStyle(COLORS.steelDark, 1); bg.fillRoundedRect(-290, -140, 580, 290, 14)
    bg.lineStyle(3, COLORS.cap, 0.8); bg.strokeRoundedRect(-290, -140, 580, 290, 14)
    const t1 = this.add.text(0, -90, t('С возвращением, выживший!'), { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0.5)
    const t2 = this.add.text(0, -40, t('Отряд работал {t}\nи собрал:', { t: fmtDuration(res.seconds) }), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.paper, align: 'center' }).setOrigin(0.5)
    const cap = resIcon(this, -40, 30, 'caps', 42)
    const t3 = this.add.text(-10, 30, `+${fmt(res.caps)}`, { fontFamily: 'Rubik, sans-serif', fontSize: '30px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    box.add([bg, t1, t2, cap, t3])
    const close = () => { overlay.destroy(); box.destroy(); take.destroy(); dbl.destroy(); onClose() }
    const take = createButton(this, cx - 145, cy + 105, { label: t('Забрать'), width: 200, height: 56, onClick: close }).setDepth(92)
    // Яндекс 4.5.1: на кнопке вызова rewarded video должно быть однозначно
    // написано, что за награду покажут рекламу — одной иконки 📺 недостаточно.
    const dbl = createButton(this, cx + 145, cy + 105, {
      label: t('📺 Реклама: ×2'), width: 240, height: 56, fontSize: 20, color: COLORS.toxicDark, hover: COLORS.toxic,
      // Сначала close(), потом реклама. В обратном порядке showRewarded ставит
      // игру на паузу, и следом за ним close() открывал «Как играть» — окно
      // рождалось уже в паузе, с мёртвыми кнопками.
      onClick: () => {
        close()
        Platform.showRewarded(
          () => State.addCaps(res.caps),
          // Яндекс 4.5: не досмотрел — удвоения нет. Базовую награду игрок уже
          // забрал (claimOffline выше), так что терять ему нечего.
          () => toast(this, t('Награда не начислена: ролик не досмотрен'), '#ff9a6a'),
        )
      },
    }).setDepth(92)
  }
}
