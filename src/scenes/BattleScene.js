// Battle — основной геймплей (волновая модель): на арене несколько врагов строем,
// стрельба по курсору бьёт ближайшего к пуле (целиться важно), каждый враг
// наступает и бьёт в упор, ульта — AoE по всей волне, комбо/крит, HP героя и
// смерть, союзники (idle), зоны и БОСС-ворота в конце зоны, дроп лута.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX, TEX_SS } from '../config.js'
import { State } from '../state/GameState.js'
import { BAL } from '../data/balance.js'
import { defOf, sheetKey } from '../data/bosses.js'
import { ALLIES } from '../data/allies.js'
import { enemyStats } from '../data/scaling.js'
import { getZone } from '../data/zones.js'
import { enemiesInWave, bossDue } from '../data/progression.js'
import { rollItem, RARITY_BY_ID } from '../data/loot.js'
import { createButton } from '../ui/Button.js'
import {
  loadBattle, battleAssetsReady, buildEnemySheets, buildEnemyAnims, heroScaleFor, buildHeroAnim,
  loadBosses, bossAssetsReady, buildBossSheets,
} from '../assets.js'
import { darken, lighten, addRim, addDust, addVignette, addFog, addGodRays, applyPostFX, resIcon } from '../ui/scenery.js'
import { Platform } from '../platform/yandex.js'
import { Sfx } from '../audio/sfx.js'
import { Music } from '../audio/music.js'
import { t, itemName } from '../i18n.js'
import { fmt } from '../util/format.js'

const PANEL_W = 320
const TEX_H = 72
// Высота ФИГУРЫ героя на экране в пикселях дизайн-разрешения. Раньше была
// зашита множителем 0.95 к кадру 341×279; теперь задаём результат, а не множитель.
const HERO_ON_SCREEN_H = 225
// Высота врага на экране = ENEMY_H_PER_SCALE × scale из enemies.js.
// Гуль (scale 2.1) выходит ~210 px — как и было на старом арте.
const ENEMY_H_PER_SCALE = 100

export default class BattleScene extends Phaser.Scene {
  constructor() { super(SCENES.BATTLE) }

  // Спрайтшиты врагов и фоны зон (~4 МБ) грузим здесь, а не на старте игры:
  // до первого «Похода» они не нужны, зато меню открывается мгновенно (п.1.14).
  // Показываем понятный прогресс-бар, чтобы экран не выглядел «зависшим».
  preload() {
    if (battleAssetsReady(this)) return
    this.buildLoadingBar()
    this.load.on('loaderror', () => { /* нет ассета — останется процедурный фолбэк */ })
    loadBattle(this.load)
  }

  buildLoadingBar() {
    const cx = GAME.WIDTH / 2, cy = GAME.HEIGHT / 2
    const W = 520, H = 26
    const label = this.add.text(cx, cy - 56, t('Готовим вылазку…'), {
      fontFamily: 'Rubik, sans-serif', fontSize: '28px', color: CSS.cap, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100)
    const bg = this.add.rectangle(cx, cy, W, H, COLORS.ink).setDepth(100)
    const fill = this.add.rectangle(cx - W / 2 + 3, cy, 10, H - 6, COLORS.toxic).setOrigin(0, 0.5).setDepth(101)
    const pct = this.add.text(cx, cy + 44, '0%', {
      fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.paper, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100)
    this.load.on('progress', (v) => {
      fill.width = Math.max(10, (W - 6) * v)
      pct.setText(`${Math.round(v * 100)}%`)
    })
    this.load.once('complete', () => { [label, bg, fill, pct].forEach(o => o.destroy()) })
  }

  // Листы боссов (~2.5 МБ) не держат вход в бой: босс приходит только после
  // BAL.zoneKills убийств. Догружаем их фоном и режем, когда приехали; если не
  // успели (или файла нет) — босс выйдет на процедурном фолбэке, бой не встанет.
  ensureBossAssets() {
    try {
      if (bossAssetsReady(this)) { buildBossSheets(this); return }
      // Не доехавший лист — не повод падать: у босса останется процедурный
      // фолбэк (как и у врагов, см. preload).
      this.load.on('loaderror', () => { /* */ })
      this.load.once('complete', () => {
        try { if (this.scene && this.scene.isActive()) buildBossSheets(this) } catch (e) { /* */ }
      })
      loadBosses(this.load)
      this.load.start()
    } catch (e) { /* останется процедурный фолбэк */ }
  }

  create() {
    buildEnemySheets(this) // режем листы врагов по их раскладке
    buildEnemyAnims(this)  // и заводим цикл ходьбы
    this.ensureBossAssets() // листы боссов — фоном, они нужны только к воротам
    this.arenaW = GAME.WIDTH - PANEL_W
    this.groundY = GAME.HEIGHT - 130
    this.bullets = []
    this.enemies = []
    this.wavePending = false
    this.lastHitTime = 0
    State.hp = State.heroMaxHp() // полное лечение в начале вылазки
    // Флаг «идёт бой с боссом» живёт только внутри одной вылазки. Если игрок
    // ушёл в лагерь прямо во время боя с воротами, флаг оставался поднятым, а
    // босса на арене уже не было: bossDue гейтится этим флагом, и зона больше
    // не могла закрыться до самой смерти героя. Каждый вход в бой начинается
    // с чистого листа — босс придёт заново, когда набьётся норма убийств.
    State.bossActive = false

    this.buildArena()
    this.buildPanel()
    applyPostFX(this, true, 0.65)
    Music.play(this, 'bgm_battle')

    const cls = State.classDef()
    const heroKey = (cls && cls.tex) || TEX.HERO
    const hx = this.arenaW * 0.16
    // Новый арт = спрайтшит (6 кадров). Если не загрузился — процедурный fallback.
    this.heroNew = this.textures.exists(heroKey) && this.textures.get(heroKey).frameTotal > 1
    if (this.heroNew) {
      // Масштаб считаем от кадра — у нового арта размер листа свой у каждого класса.
      const HS = heroScaleFor(this, heroKey, HERO_ON_SCREEN_H)
      const footY = (cls && cls.footY) || 0.98 // якорь по ногам: все классы на одной линии
      this.hero = this.add.sprite(hx, this.groundY + 18, heroKey, 0).setOrigin(0.5, footY).setScale(HS)
      this.heroAnim = buildHeroAnim(this, heroKey)
      // Дуло — в долях от кадра, а не в пикселях: иначе при смене арта уезжает.
      const fw = this.hero.width, fh = this.hero.height
      const m = (cls && cls.muzzle) || { x: 0.42, y: 0.60 }
      this.muzzle = { x: hx + fw * m.x * HS, y: this.hero.y - fh * m.y * HS }
    } else {
      const fk = (cls && `tex-${cls.tex}`) || TEX.HERO
      const HS = 2.1
      this.hero = this.add.image(hx, this.groundY - 124 * HS * 0.42, this.textures.exists(fk) ? fk : TEX.HERO).setScale(HS / TEX_SS)
      addRim(this.hero, 0xffe0a8, 3, 0.08, 12)
      this.muzzle = { x: hx + 66, y: this.hero.y - 8 }
    }
    this.tweens.add({ targets: this.hero, y: this.hero.y - 6, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

    this.input.on('pointerdown', (p) => { if (this._deathModal || State.hp <= 0) return; if (p.x < this.arenaW) this.shoot(p.x, p.y) })
    this.input.keyboard.on('keydown-SPACE', () => this.tryUlt())

    this.buildAllies()
    this.applyZoneVisuals()
    this.spawnWave()
    this.maybeTutorial()

    // Яндекс: активный геймплей начался; на выходе из сцены — остановить.
    Platform.gameplayStart()
    this.events.once('shutdown', () => Platform.gameplayStop())
  }

  // Онбординг боя: не абзац про все механики сразу, а прицел прямо на первом
  // враге — куда смотреть и что делать, видно без чтения. Гаснет от первого же
  // выстрела: дальше игрок понял руками.
  maybeTutorial() {
    let seen = false
    try { seen = localStorage.getItem('yp_tut_shoot') === '1' } catch (e) { /* */ }
    if (seen || State.totalKills > 0) return
    const target = this.frontEnemy()
    if (!target) return
    const ring = this.add.circle(target.sprite.x, target.sprite.y, 58).setStrokeStyle(4, COLORS.toxic, 0.95).setDepth(70)
    const label = this.add.text(target.sprite.x, target.sprite.y - 108, t('🖱  КЛИКАЙ ПО ВРАГУ'), {
      fontFamily: 'Rubik, sans-serif', fontSize: '26px', color: CSS.toxic, fontStyle: 'bold',
      stroke: '#120d09', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(70)
    this.tweens.add({ targets: ring, scale: { from: 1.45, to: 0.9 }, alpha: { from: 0.25, to: 1 }, duration: 900, repeat: -1 })
    this.tweens.add({ targets: label, y: label.y - 9, duration: 720, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    this._tut = { ring, label, target }
  }

  // Прицел живёт, пока цель жива: враг подходит — кружок едет за ним.
  updateTutorial() {
    if (!this._tut) return
    const { ring, label, target } = this._tut
    if (!target.sprite || !target.sprite.active || this.enemies.indexOf(target) < 0) { this.clearTutorial(); return }
    ring.x = target.sprite.x; ring.y = target.sprite.y
    label.x = target.sprite.x
  }

  clearTutorial() {
    if (!this._tut) return
    try { localStorage.setItem('yp_tut_shoot', '1') } catch (e) { /* */ }
    const { ring, label } = this._tut
    this._tut = null
    this.tweens.killTweensOf(ring); this.tweens.killTweensOf(label)
    this.tweens.add({
      targets: [ring, label], alpha: 0, duration: 260,
      onComplete: () => { ring.destroy(); label.destroy() },
    })
  }

  // Про ульту рассказываем не в начале боя (когда шкала пуста и слово ни о чём
  // не говорит), а ровно в тот момент, когда она впервые заполнилась.
  maybeUltHint() {
    if (this._ultHintDone || State.ult < BAL.ultMax) return
    this._ultHintDone = true
    let seen = false
    try { seen = localStorage.getItem('yp_tut_ult') === '1' } catch (e) { /* */ }
    if (seen) return
    try { localStorage.setItem('yp_tut_ult', '1') } catch (e) { /* */ }
    const tip = this.add.text(this.arenaW / 2, GAME.HEIGHT - 96, t('☢  Ульта заряжена — SPACE'), {
      fontFamily: 'Rubik, sans-serif', fontSize: '26px', color: CSS.toxic, fontStyle: 'bold',
      stroke: '#120d09', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(72)
    this.tweens.add({ targets: tip, scale: { from: 0.75, to: 1 }, duration: 240, ease: 'Back.out' })
    this.tweens.add({ targets: tip, alpha: 0, delay: 3200, duration: 800, onComplete: () => tip.destroy() })
  }

  // ---------------- Арена и фон ----------------
  buildArena() {
    const W = this.arenaW, gy = this.groundY
    // Нарисованный фон зоны (если загружен) — за всем; иначе процедурное небо.
    this.zoneBg = this.add.image(W / 2, GAME.HEIGHT / 2, TEX.GLOW).setDepth(-12).setVisible(false)
    this.skyGfx = this.add.graphics().setDepth(-10)
    this.sun = this.add.image(W * 0.7, gy * 0.4, TEX.GLOW).setDepth(-9).setAlpha(0.32).setScale(4.6)
    this.godrays = addGodRays(this, W * 0.7, gy * 0.4 - 30, 0xffdf9a)
    this.ruinLayer = this.add.container(0, 0).setDepth(-8)
    this.ruins = []
    for (let i = 0; i < 6; i++) {
      const s = 0.8 + ((i * 41) % 50) / 70
      const r = this.add.image(i * (W / 5), gy + 2, TEX.RUIN).setOrigin(0.5, 1).setAlpha(0.5).setScale(s * 1.5, s * 1.7)
      this.ruins.push(r); this.ruinLayer.add(r)
    }
    this.tweens.add({ targets: this.ruinLayer, x: 26, duration: 16000, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    // свечение горизонта (мягкая полоса света у земли) — тинт задаётся по зоне
    this.horizonGlow = this.add.image(W / 2, gy - 6, TEX.GLOW).setBlendMode('ADD')
      .setDepth(-7).setAlpha(0.28).setScale(W / 90, 1.5)
    this.groundRect = this.add.rectangle(0, gy, W, GAME.HEIGHT - gy, COLORS.rust).setOrigin(0).setDepth(-7)
    this.accentLine = this.add.rectangle(0, gy, W, 4, COLORS.rustLight).setOrigin(0).setDepth(-6).setAlpha(0.9)
    // мягкая тень-градиент у верха земли (объём)
    this.add.rectangle(0, gy, W, 26, COLORS.ink).setOrigin(0).setDepth(-6).setAlpha(0.28)
    this.debris = []
    for (let i = 0; i < 6; i++) {
      this.debris.push(this.add.rectangle(60 + i * (W - 120) / 5, gy + 30 + (i % 3) * 12, 26, 6, COLORS.steelDark).setOrigin(0.5).setDepth(-6))
    }
    addFog(this, gy)
    addDust(this, gy)
    addVignette(this)

    this.zoneLabel = this.add.text(W / 2, 34, '', {
      fontFamily: 'Rubik, sans-serif', fontSize: '26px', color: CSS.sand, fontStyle: 'bold',
      stroke: '#120d09', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(60)
    this.progressLabel = this.add.text(W / 2, 66, '', {
      fontFamily: 'monospace', fontSize: '17px', color: '#e6d2a4',
      stroke: '#120d09', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(60)
  }

  applyZoneVisuals() {
    this.zone = getZone(State.zoneIndex)
    const bgKey = this.zone.bg
    const usePainted = bgKey && this.textures.exists(bgKey)
    // Процедурное небо/солнце/руины показываем только без нарисованного фона.
    this.skyGfx.setVisible(!usePainted)
    this.sun.setVisible(!usePainted)
    if (this.godrays) this.godrays.setVisible(!usePainted)
    if (this.ruinLayer) this.ruinLayer.setVisible(!usePainted)

    if (usePainted) {
      const src = this.textures.get(bgKey).getSourceImage()
      const sc = Math.max(this.arenaW / src.width, GAME.HEIGHT / src.height)
      this.zoneBg.setTexture(bgKey).setScale(sc).setVisible(true)
    } else {
      this.zoneBg.setVisible(false)
      const skyTop = darken(this.zone.sky, 0.45)
      this.skyGfx.clear()
      this.skyGfx.fillGradientStyle(skyTop, skyTop, this.zone.sky, this.zone.sky, 1)
      this.skyGfx.fillRect(0, 0, this.arenaW, this.groundY)
      this.sun.setTint(this.zone.accent)
      const ruinCol = darken(this.zone.ground, 0.55)
      this.ruins.forEach(r => r.setTint(ruinCol))
    }
    if (this.horizonGlow) this.horizonGlow.setTint(this.zone.accent)
    this.groundRect.setFillStyle(this.zone.ground)
    this.accentLine.setFillStyle(this.zone.accent)
    this.debris.forEach(d => d.setFillStyle(darken(this.zone.ground, 0.7)))
  }

  // ---------------- Панель (боевой HUD) ----------------
  buildPanel() {
    const px = this.arenaW
    const g = this.add.graphics()
    g.fillStyle(COLORS.steelDark, 1); g.fillRect(px, 0, PANEL_W, GAME.HEIGHT)
    g.lineStyle(4, COLORS.ink, 0.6); g.strokeRect(px + 2, 2, PANEL_W - 4, GAME.HEIGHT - 4)
    const cx = px + PANEL_W / 2

    this.add.image(px + 34, 40, TEX.GLOW).setTint(COLORS.cap).setScale(1.2).setAlpha(0.5).setBlendMode('ADD')
    resIcon(this, px + 34, 40, 'caps', 34)
    this.capsText = this.add.text(px + 56, 40, '0', {
      fontFamily: 'Rubik, sans-serif', fontSize: '28px', color: CSS.cap, fontStyle: 'bold',
    }).setOrigin(0, 0.5)

    this.comboText = this.add.text(cx, 80, '', {
      fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.toxic, fontStyle: 'bold',
    }).setOrigin(0.5)

    this.add.text(px + 22, 106, t('HP героя'), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.paper }).setOrigin(0)
    this.hpBarW = PANEL_W - 48
    this.add.rectangle(px + 24, 132, this.hpBarW, 26, COLORS.ink).setOrigin(0)
    this.hpFill = this.add.rectangle(px + 26, 134, this.hpBarW - 4, 22, COLORS.blood).setOrigin(0)
    this.hpText = this.add.text(cx, 145, '', { fontFamily: 'monospace', fontSize: '16px', color: '#fff' }).setOrigin(0.5)

    this.add.text(px + 22, 174, t('Заряд ульты'), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.paper }).setOrigin(0)
    this.add.rectangle(px + 24, 200, this.hpBarW, 26, COLORS.ink).setOrigin(0)
    this.ultFill = this.add.rectangle(px + 26, 202, 1, 22, COLORS.toxicDark).setOrigin(0)
    createButton(this, cx, 262, {
      label: t('☢  УЛЬТА (Space)'), width: PANEL_W - 44, height: 58, fontSize: 21,
      color: COLORS.toxicDark, hover: COLORS.toxic, onClick: () => this.tryUlt(),
    })

    this.statsText = this.add.text(px + 24, 312, '', {
      fontFamily: 'monospace', fontSize: '17px', color: '#e8ddc0', lineSpacing: 8,
    }).setOrigin(0)

    createButton(this, cx, GAME.HEIGHT - 52, {
      label: t('⟵ В лагерь'), width: PANEL_W - 44, height: 60, fontSize: 22,
      onClick: () => { State.lastSeen = Date.now(); State.save(true); Platform.submitScore(State.bestScore); this.scene.start(SCENES.HUB) },
    })
  }

  // ---------------- Компаньоны (видимые союзники) ----------------
  buildAllies() {
    this.allySprites = []
    const owned = ALLIES.filter(a => (State.allies[a.id] || 0) > 0)
    owned.forEach((a, i) => {
      const n = State.allies[a.id] || 0
      const col = i % 3
      const x = this.hero.x - 34 + col * 36
      const y = this.groundY - 18 - Math.floor(i / 3) * 42 + (i % 2) * 6
      const s = this.add.image(x, y, TEX.ALLY).setScale(0.95 / TEX_SS).setTint(a.color).setDepth(6)
      addRim(s, lighten(a.color, 0.3), 2, 0.08, 8)
      this.tweens.add({ targets: s, y: y - 4, duration: 1300 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
      const badge = this.add.text(x + 14, y + 14, `×${fmt(n)}`, {
        fontFamily: 'Rubik, sans-serif', fontSize: '13px', color: CSS.paper, fontStyle: 'bold',
        stroke: '#120d09', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(7)
      this.allySprites.push({ sprite: s, badge, def: a })
    })
    // Периодические трассеры компаньонов по переднему врагу (визуал idle-урона).
    if (owned.length) {
      this.allyFireEvt = this.time.addEvent({ delay: 620, loop: true, callback: () => this.allyFire() })
    }
  }

  allyFire() {
    if (!this.allySprites || !this.allySprites.length) return
    const front = this.frontEnemy()
    if (!front) return
    const a = this.allySprites[Math.floor(Math.random() * this.allySprites.length)]
    const sx = a.sprite.x + 16, sy = a.sprite.y - 2
    const flash = this.add.image(sx, sy, TEX.GLOW).setTint(a.def.color).setScale(0.4).setDepth(20).setBlendMode('ADD')
    this.tweens.add({ targets: flash, scale: 0.1, alpha: 0, duration: 120, onComplete: () => flash.destroy() })
    const b = this.add.image(sx, sy, TEX.DOT).setTint(lighten(a.def.color, 0.3)).setScale(0.6).setDepth(28).setBlendMode('ADD')
    this.tweens.add({ targets: b, x: front.sprite.x, y: front.sprite.y, duration: 170, ease: 'Quad.in', onComplete: () => b.destroy() })
  }

  // ---------------- Спавн волны ----------------
  spawnWave() {
    this.wavePending = false
    State.bumpWave() // +1% к врагам за каждую выпущенную волну
    // Босс-ворота: набрали норму убийств в зоне → один жирный босс.
    const isBoss = !State.bossActive && bossDue(State.killsInZone)
    if (isBoss) {
      State.bossActive = true
      // У зоны свой пул боссов; на старых сейвах/самопальных зонах его может не
      // быть — тогда, как раньше, ворота держит раздутый обычный враг.
      const pool = (this.zone.bosses && this.zone.bosses.length) ? this.zone.bosses : this.zone.enemies
      const defId = pool[Math.floor(Math.random() * pool.length)]
      this.enemies.push(this.makeEnemy(defId, true, 0, 1))
      this.cameras.main.flash(220, 60, 0, 0)
      this.cameras.main.shake(200, 0.006)
      this.showBossBanner(defOf(defId).name)
      Sfx.boss()
      return
    }
    const n = enemiesInWave(State.zoneIndex, State.killsInZone)
    const pool = this.zone.enemies
    // Разводим строй по РЕАЛЬНОЙ ширине спрайтов: у нового арта она разная
    // (ползун вытянутый, оса компактная), и фиксированный шаг их слепляет.
    let x = this.arenaW - 90
    for (let i = 0; i < n; i++) {
      const defId = pool[Math.floor(Math.random() * pool.length)]
      const e = this.makeEnemy(defId, false, i, n, x)
      this.enemies.push(e)
      x -= Math.max(72, e.onScreenW * 0.52)
    }
  }

  // Создать один враг-объект (спрайт, полоска HP, имя, стат).
  makeEnemy(defId, isBoss, i, n, atX = null) {
    const def = defOf(defId)
    const af = this.zone.affix || { hp: 1, dmg: 1, rew: 1, spd: 1 }
    const base = enemyStats(def, State.totalKills, isBoss)
    const mHp = State.enemyMetaHpMul(), mDmg = State.enemyMetaDmgMul()
    const wave = State.waveScaleMul() // +1% за волну (HP и урон)
    // боссам прогрессию даём мягче (^0.6), иначе бой с воротами затягивается
    const prog = isBoss ? Math.pow(State.enemyProgMul(), 0.6) : State.enemyProgMul()
    // Кэпим ИТОГ (base уже закэплен, но множители могут пробить MAX_SAFE → Infinity
    // → неубиваемый враг). Держим числа конечными.
    const MAX = Number.MAX_SAFE_INTEGER
    const hp = Math.min(MAX, Math.ceil(base.hp * af.hp * mHp * prog * wave))
    const reward = Math.min(MAX, Math.ceil(base.reward * af.rew))
    const dmg = Math.min(MAX, base.dmg * af.dmg * mDmg * wave)
    const speed = BAL.enemySpeed * def.speedMul * (isBoss ? 0.7 : 1) * af.spd
    // У боссов свой арт со своими пропорциями — берём их собственный scale.
    // BAL.bossScale остаётся запасным для «босса из обычного врага».
    const baseScale = isBoss ? (def.scale > BAL.bossScale ? def.scale : BAL.bossScale) : def.scale
    // Новый арт = спрайтшит 2×2 (цикл ходьбы). Иначе процедурный fallback.
    const newKey = sheetKey(defId)
    const useNew = this.textures.exists(newKey) && this.textures.get(newKey).frameTotal - 1 >= 4
    // Кадр у каждого врага свой, поэтому задаём ВЫСОТУ НА ЭКРАНЕ, а не множитель:
    // ENEMY_H_PER_SCALE × scale из enemies.js. Так баланс размеров не зависит от арта.
    // Процедурный фолбэк: у босса своя текстура (100×100), у врагов — 72×72.
    const fbKey = this.textures.exists(`tex-e-${defId}`) ? `tex-e-${defId}` : (isBoss ? TEX.BOSS : TEX.ENEMY)
    // Размер в «дизайнерских» px (текстура сгенерирована в TEX_SS× и ужимается
    // обратно множителем dispScale) — как и было для врагов.
    const fbSide = fbKey === TEX.BOSS ? 100 : TEX_H
    const texH = useNew ? this.textures.get(newKey).get(0).height : fbSide
    const dispScale = useNew ? (ENEMY_H_PER_SCALE * baseScale) / texH : baseScale / TEX_SS
    const onScreenH = texH * dispScale
    const texW = useNew ? this.textures.get(newKey).get(0).width : fbSide
    const onScreenW = texW * dispScale
    // строй: боссы выходят вплотную; обычные — колонной у правого края арены.
    const spawnX = isBoss ? (this.arenaW - 130) : (atX !== null ? atX : this.arenaW - 90 - i * 96)
    const rowLift = isBoss ? 0 : (i % 2) * 46
    const yPos = this.groundY - onScreenH * 0.42 - rowLift

    let aura = null
    if (isBoss) {
      aura = this.add.image(spawnX, yPos, TEX.GLOW).setTint(0xff3a1a).setScale(baseScale * 1.7).setAlpha(0.5).setBlendMode('ADD').setDepth(-1)
      this.tweens.add({ targets: aura, alpha: { from: 0.5, to: 0.85 }, scale: baseScale * 1.95, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    }

    let sprite
    if (useNew) {
      sprite = this.add.sprite(spawnX, yPos, newKey, 0).setScale(dispScale).setAlpha(0).setDepth(10 - (i % 2))
      if (def.flip) sprite.setFlipX(true) // смотрящих вправо зеркалим на героя (влево)
      if (this.anims.exists(`${defId}-walk`)) sprite.play(`${defId}-walk`)
    } else {
      sprite = this.add.image(spawnX, yPos, fbKey).setScale(dispScale).setAlpha(0).setDepth(10 - (i % 2))
      addRim(sprite, isBoss ? 0xff5a2a : lighten(def.tint, 0.28), isBoss ? 6 : 3, 0.08, isBoss ? 20 : 11)
    }
    this.tweens.add({ targets: sprite, alpha: 1, duration: 200 })
    this.tweens.add({ targets: sprite, y: yPos - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 60 })

    const barW = (isBoss ? 34 : 44) * baseScale * (useNew ? 0.66 : 1)
    const bg = this.add.rectangle(spawnX, 0, barW + 4, isBoss ? 12 : 8, COLORS.ink).setOrigin(0.5).setDepth(40)
    const fill = this.add.rectangle(spawnX, 0, barW, isBoss ? 8 : 5, COLORS.toxic).setOrigin(0.5).setDepth(41)
    const nameLabel = this.add.text(spawnX, 0, isBoss ? `☠ ${t(def.name)}` : t(def.name), {
      fontFamily: 'Rubik, sans-serif', fontSize: isBoss ? '20px' : '16px',
      color: isBoss ? '#ff8a6a' : CSS.paper, fontStyle: 'bold', stroke: '#120d09', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(41)

    return {
      sprite, aura, bg, fill, nameLabel, barW, def, defId, isBoss, useNew, flip: !!def.flip,
      maxHp: hp, hp, reward, dmg, speed, scale: baseScale, dispScale, texH, onScreenH, onScreenW, baseY: yPos,
      attackTimer: 0,
    }
  }

  // Смерть врага: анимация death (новый арт) или взрыв (процедурный).
  deathFx(e) {
    this.tweens.killTweensOf(e.sprite)
    if (e.aura) { this.tweens.killTweensOf(e.aura); e.aura.destroy() }
    ;[e.bg, e.fill, e.nameLabel].forEach(o => o && o.destroy())
    if (e.useNew && this.anims.exists(`${e.defId}-death`)) {
      e.sprite.setDepth(9)
      e.sprite.play(`${e.defId}-death`)
      e.sprite.once('animationcomplete', () => {
        if (e.sprite && e.sprite.active) this.tweens.add({ targets: e.sprite, alpha: 0, duration: 280, onComplete: () => e.sprite.destroy() })
      })
      this.time.delayedCall(2200, () => { if (e.sprite && e.sprite.active) e.sprite.destroy() }) // подстраховка
    } else {
      this.explode(e.sprite.x, e.sprite.y, e.isBoss)
      e.sprite.destroy()
    }
  }

  destroyEnemy(e) {
    this.tweens.killTweensOf(e.sprite)
    if (e.aura) this.tweens.killTweensOf(e.aura)
    ;[e.sprite, e.aura, e.bg, e.fill, e.nameLabel].filter(Boolean).forEach(o => o.destroy())
  }

  // Попадание пули: враг, в чей хитбокс (по РЕАЛЬНОМУ размеру спрайта) попала точка.
  // Из нескольких — ближайший по центру. skip — уже пробитые этой пулей.
  hitTestEnemy(x, y, skip) {
    let best = null, bd = Infinity
    for (const e of this.enemies) {
      if (skip && skip.has(e)) continue
      // Хитбокс считаем от РЕАЛЬНЫХ размеров спрайта. Раньше ширина бралась от
      // высоты — это осталось от квадратных процедурных текстур 72×72, а на
      // нарисованном арте вытянутые враги (ползун, клещ, червь-босс) шире, чем
      // выше: пуля проходила сквозь голову и хвост, засчитывая попадание только
      // в среднюю треть туши.
      const hw = e.onScreenW * 0.34 // половина ширины хитбокса
      const hh = e.onScreenH * 0.52 // половина высоты (покрывает голову и ноги)
      const dx = x - e.sprite.x, dy = y - e.sprite.y
      if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) {
        const d = dx * dx + dy * dy
        if (d < bd) { bd = d; best = e }
      }
    }
    return best
  }
  // Передний (ближайший к герою) враг — цель союзников.
  frontEnemy() {
    let best = null
    for (const e of this.enemies) if (!best || e.sprite.x < best.sprite.x) best = e
    return best
  }

  // ---------------- Стрельба ----------------
  shoot(tx, ty) {
    this.clearTutorial() // выстрелил — подсказка больше не нужна
    Sfx.resume(); Sfx.shoot()
    const ws = State.weaponStyle() // визуал выстрела зависит от надетого оружия
    const b = this.add.image(this.muzzle.x, this.muzzle.y, TEX.BULLET).setScale(ws.scale / TEX_SS).setTint(ws.tint).setBlendMode('ADD').setDepth(30)
    let ang = Phaser.Math.Angle.Between(this.muzzle.x, this.muzzle.y, tx, ty)
    ang += (Math.random() - 0.5) * ws.spread // лёгкий разброс по типу оружия
    b.setRotation(ang)
    const speed = ws.speed
    b.vx = Math.cos(ang) * speed
    b.vy = Math.sin(ang) * speed
    b.trailTint = ws.trail
    b.pierceLeft = State.classPierce() // сколько врагов пробьёт (Стрелок > 1)
    b.hitSet = new Set()               // кого уже задела эта пуля
    this.bullets.push(b)

    const flash = this.add.image(this.muzzle.x, this.muzzle.y, TEX.GLOW).setTint(ws.tint).setScale(0.85).setDepth(20).setBlendMode('ADD')
    this.tweens.add({ targets: flash, scale: 0.2, alpha: 0, duration: 130, onComplete: () => flash.destroy() })
    this.tweens.add({ targets: this.hero, x: this.hero.x - 5, duration: 45, yoyo: true })
    if (this.heroNew) {
      if (this.heroAnim) {
        // Полная 4-кадровая анимация атаки; новый клик перезапускает её с начала.
        this.hero.play({ key: this.heroAnim, startFrame: 0 }, true)
        this.hero.once('animationcomplete', () => {
          if (this.hero && this.hero.active) this.hero.setFrame(0)
        })
      } else {
        this.hero.setFrame(1) // старый лист: просто кадр выстрела
        if (this._fireReset) this._fireReset.remove()
        this._fireReset = this.time.delayedCall(120, () => { if (this.hero && this.hero.active) this.hero.setFrame(0) })
      }
    }
  }

  hitEnemy(e, x, y) {
    const crit = Math.random() < State.critChance()
    let dmg = State.clickDamage()
    if (crit) dmg *= BAL.critMultiplier
    dmg = Math.max(1, Math.round(dmg))
    e.hp -= dmg

    // Вампиризм (Бугай): часть урона возвращается в HP.
    const ls = State.classLifesteal()
    if (ls > 0) {
      const maxHp = State.heroMaxHp()
      if (State.hp < maxHp) {
        const heal = Math.min(maxHp - State.hp, dmg * ls)
        if (heal >= 1) { State.hp += heal; this.floatText(this.hero.x + 20, this.hero.y - 70, `+${fmt(Math.round(heal))}`, '#6fe36f', 16) }
      }
    }

    State.combo++
    this.lastHitTime = this.time.now
    State.ult = Math.min(BAL.ultMax, State.ult + BAL.ultChargePerHit)

    crit ? Sfx.crit() : Sfx.hit()
    this.floatText(x, y, `${fmt(dmg)}${crit ? '!' : ''}`, crit ? '#ffd23c' : '#ffffff', crit ? 32 : 22)
    this.spawnHitSpark(x, y)
    this.punchEnemy(e)
    this.impactRing(x, y, crit)
    if (crit) this.cameras.main.shake(70, 0.004)

    // Картечь: часть урона разлетается по врагам рядом с целью.
    const splash = State.splashFrac()
    if (splash > 0) this.splashDamage(e, dmg * splash)

    if (e.hp <= 0) this.killEnemy(e)
  }

  // Разлёт урона по врагам в радиусе от цели (сама цель не задевается повторно).
  splashDamage(target, amount) {
    const dmg = Math.max(1, Math.round(amount))
    const R = BAL.splashRadius || 130
    const dead = []
    for (const o of this.enemies) {
      if (o === target || !o.sprite.active) continue
      const dx = o.sprite.x - target.sprite.x, dy = o.sprite.y - target.sprite.y
      if (dx * dx + dy * dy > R * R) continue
      o.hp -= dmg
      this.floatText(o.sprite.x, o.sprite.y - o.onScreenH * 0.4, fmt(dmg), '#ffb066', 15)
      this.punchEnemy(o)
      if (o.hp <= 0) dead.push(o)
    }
    for (const o of dead) this.killEnemy(o)
  }

  punchEnemy(e) {
    if (!e || !e.sprite.active) return
    e.sprite.setTintFill(0xffffff)
    this.time.delayedCall(45, () => { if (e.sprite.active) e.sprite.clearTint() })
    this.tweens.add({ targets: e.sprite, scaleX: e.dispScale * 1.14, scaleY: e.dispScale * 0.86, duration: 55, yoyo: true, ease: 'Quad.out' })
  }

  impactRing(x, y, crit) {
    const ring = this.add.circle(x, y, 6, 0xffffff, 0).setStrokeStyle(3, crit ? 0xffd23c : 0xffffff, 0.9).setDepth(45).setBlendMode('ADD')
    this.tweens.add({ targets: ring, scale: crit ? 4.2 : 2.6, alpha: 0, duration: 300, ease: 'Cubic.out', onComplete: () => ring.destroy() })
  }

  // ---------------- Смерть врага ----------------
  killEnemy(e) {
    const idx = this.enemies.indexOf(e)
    if (idx < 0) return // уже мёртв (двойное попадание в кадре)
    this.enemies.splice(idx, 1)

    State.addCaps(Math.ceil(e.reward * (1 + State.capsBonus())))
    if (State.addXp(Math.ceil(e.reward * 0.55))) Sfx.levelup()
    State.ult = Math.min(BAL.ultMax, State.ult + BAL.ultChargePerKill)
    Sfx.kill(); Sfx.cap()
    this.capsBurst(e.sprite.x, e.sprite.y, e.isBoss ? 14 : 6)
    if (e.isBoss) this.cameras.main.shake(260, 0.012)

    const chance = e.isBoss ? BAL.bossDropChance : BAL.dropChance
    if (Math.random() < chance) {
      const item = rollItem(Math.random, Math.floor(State.enemyLevel()), State.lootLuck())
      State.addItem(item)
      const rar = RARITY_BY_ID[item.rarity]
      this.floatText(e.sprite.x, e.sprite.y - 40, `🎁 ${itemName(item.name)}`, rar.css, 18)
    }

    this.deathFx(e)

    // Продвижение: босс-ворота → зона; обычный → счётчик.
    if (e.isBoss) {
      State.registerBossKill()
      this.applyZoneVisuals()
      this.cameras.main.flash(300, 40, 60, 20)
      Platform.showInterstitial()
    } else {
      State.registerKill()
    }

    // Волна зачищена → следующая (или босс-ворота).
    if (this.enemies.length === 0 && !this.wavePending) {
      this.wavePending = true
      this.time.delayedCall(240, () => { if (this.scene.isActive()) this.spawnWave() })
    }
  }

  // ---------------- Ульта (AoE по волне) ----------------
  tryUlt() {
    if (this._deathModal) return // на экране смерти ульта недоступна
    if (State.ult < BAL.ultMax) {
      this.floatText(this.arenaW / 2, 120, t('Ульта не заряжена'), '#ff6a6a', 22)
      return
    }
    if (this.enemies.length === 0) return // нет целей — не палим заряд впустую
    State.ult = 0
    Sfx.ult()
    this.cameras.main.shake(400, 0.02)
    this.cameras.main.flash(300, 140, 220, 60)
    const dmg = Math.round(State.clickDamage(false) * BAL.ultDamageMul)
    // копия списка — killEnemy мутирует this.enemies
    for (const e of [...this.enemies]) {
      e.hp -= dmg
      this.floatText(e.sprite.x, e.sprite.y - 30, `☢ ${fmt(dmg)}`, '#b6ff5a', 30)
      if (e.hp <= 0) this.killEnemy(e)
    }
  }

  // ---------------- Урон герою / смерть ----------------
  heroTakeDamage(dmg) {
    State.hp -= dmg
    this.floatText(this.hero.x, this.hero.y - 60, `-${fmt(Math.round(dmg))}`, '#ff5a5a', 20)
    this.cameras.main.shake(120, 0.006)
    this.hpFill.setFillStyle(0xffffff)
    this.time.delayedCall(70, () => this.hpFill.setFillStyle(COLORS.blood))
    this.hero.setTintFill(0xff5a5a)
    this.time.delayedCall(70, () => this.hero.clearTint())
    const edge = this.add.rectangle(0, 0, this.arenaW, GAME.HEIGHT, 0xff0000, 0.18).setOrigin(0).setDepth(70)
    this.tweens.add({ targets: edge, alpha: 0, duration: 220, onComplete: () => edge.destroy() })
    if (State.hp <= 0) this.heroDie()
  }

  clearEnemies() {
    for (const e of this.enemies) this.destroyEnemy(e)
    this.enemies = []
  }

  heroDie() {
    Sfx.death()
    this.cameras.main.flash(400, 120, 0, 0)
    this.clearEnemies()
    Platform.submitScore(State.bestScore)
    this.showDeathModal()
  }

  showDeathModal() {
    const cx = this.arenaW / 2, cy = GAME.HEIGHT / 2
    const ov = this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, COLORS.ink, 0.72).setOrigin(0).setDepth(85).setInteractive()
    const title = this.add.text(cx, cy - 90, t('Ты пал на пустоши'), { fontFamily: 'Rubik, sans-serif', fontSize: '30px', color: '#ff5a5a', fontStyle: 'bold', stroke: '#120d09', strokeThickness: 4 }).setOrigin(0.5).setDepth(86)
    const revive = createButton(this, cx, cy - 6, {
      // Яндекс 4.5.1: текст кнопки прямо говорит, что будет реклама за награду.
      label: t('📺 Реклама: возродиться'), width: 380, height: 60, fontSize: 21,
      color: COLORS.toxicDark, hover: COLORS.toxic,
      onClick: () => Platform.showRewarded(() => {
        if (!this._deathModal) return
        // Сбрасываем bossActive: если пали в бою с боссом, иначе он больше не
        // заспавнится (bossDue гейтится bossActive) и зона застрянет навсегда.
        this.closeDeathModal(); State.hp = State.heroMaxHp(); State.bossActive = false; this.spawnWave()
      }),
    })
    const give = createButton(this, cx, cy + 66, {
      label: t('Смириться (откат зоны)'), width: 380, height: 54, fontSize: 19,
      // Смерть без возрождения → межстраничная реклама Яндекса (сама троттлит ≥60с).
      onClick: () => { this.closeDeathModal(); Platform.showInterstitial(); State.onHeroDeath(); this.spawnWave() },
    })
    revive.setDepth(86); give.setDepth(86)
    this._deathModal = [ov, title, revive, give]
  }
  closeDeathModal() {
    if (this._deathModal) { this._deathModal.forEach(o => o.destroy()); this._deathModal = null }
  }

  // ---------------- Эффекты ----------------
  floatText(x, y, text, color, size = 22) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Rubik, sans-serif', fontSize: `${size}px`, color, fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5)
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 800, ease: 'Cubic.out', onComplete: () => t.destroy() })
  }

  spawnHitSpark(x, y) {
    for (let i = 0; i < 4; i++) {
      const p = this.add.rectangle(x, y, 5, 5, COLORS.gold).setOrigin(0.5)
      const a = Math.random() * Math.PI * 2
      this.tweens.add({ targets: p, x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 30, alpha: 0, duration: 260, onComplete: () => p.destroy() })
    }
  }

  capsBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const c = resIcon(this, x, y, 'caps', 26)
      const a = Math.random() * Math.PI * 2
      const d = 30 + Math.random() * 50
      this.tweens.add({ targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 20, alpha: 0, angle: 180, duration: 500 + Math.random() * 200, ease: 'Cubic.out', onComplete: () => c.destroy() })
    }
  }

  explode(x, y, big) {
    const flash = this.add.image(x, y, TEX.GLOW).setTint(big ? 0xff8a4a : 0xfff0b0).setScale(big ? 2.2 : 1.2).setDepth(44).setBlendMode('ADD')
    this.tweens.add({ targets: flash, scale: 0, alpha: 0, duration: big ? 380 : 240, onComplete: () => flash.destroy() })
    const n = big ? 16 : 8
    for (let i = 0; i < n; i++) {
      const col = [COLORS.toxic, COLORS.rustLight, COLORS.gold][i % 3]
      const chunk = this.add.rectangle(x, y, 6 + Math.random() * 5, 6 + Math.random() * 5, col).setDepth(43)
      const a = Math.random() * Math.PI * 2
      const d = 40 + Math.random() * (big ? 120 : 60)
      this.tweens.add({ targets: chunk, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + 30, angle: Math.random() * 360, alpha: 0, duration: 400 + Math.random() * 300, ease: 'Quad.out', onComplete: () => chunk.destroy() })
    }
  }

  showBossBanner(name) {
    const cx = this.arenaW / 2
    const c = this.add.container(cx, 150).setDepth(80).setAlpha(0)
    const bg = this.add.graphics()
    bg.fillStyle(COLORS.ink, 0.75); bg.fillRoundedRect(-220, -34, 440, 68, 10)
    bg.lineStyle(3, 0xff5a3c, 0.9); bg.strokeRoundedRect(-220, -34, 440, 68, 10)
    const t1 = this.add.text(0, -12, t('☠  БОСС-ВОРОТА'), { fontFamily: 'Rubik, sans-serif', fontSize: '24px', color: '#ff6a4a', fontStyle: 'bold' }).setOrigin(0.5)
    const t2 = this.add.text(0, 16, t(name), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: CSS.paper }).setOrigin(0.5)
    c.add([bg, t1, t2])
    c.setScale(0.7)
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 220, ease: 'Back.out' })
    this.tweens.add({ targets: c, alpha: 0, delay: 1400, duration: 350, onComplete: () => c.destroy() })
  }

  // ---------------- Игровой цикл ----------------
  update(time, delta) {
    const dt = delta / 1000

    // Пули — каждая бьёт ближайшего врага в радиусе.
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.x += b.vx * dt; b.y += b.vy * dt
      b.trailToggle = !b.trailToggle
      if (b.trailToggle) {
        const tr = this.add.image(b.x, b.y, TEX.DOT).setTint(b.trailTint || 0xffe08a).setScale(0.55).setDepth(29).setBlendMode('ADD').setAlpha(0.5)
        this.tweens.add({ targets: tr, alpha: 0, scale: 0.1, duration: 150, onComplete: () => tr.destroy() })
      }
      const target = this.hitTestEnemy(b.x, b.y, b.hitSet)
      let spent = false
      if (target) {
        b.hitSet.add(target)
        this.hitEnemy(target, b.x, b.y)
        b.pierceLeft--
        if (b.pierceLeft <= 0) spent = true // пробитие кончилось — пуля гаснет
      }
      if (spent || b.x < 0 || b.x > this.arenaW || b.y < 0 || b.y > GAME.HEIGHT) {
        b.destroy(); this.bullets.splice(i, 1)
      }
    }

    // Союзники (idle-урон) — по переднему врагу.
    if (this.enemies.length) {
      const dps = State.allyDps()
      if (dps > 0) {
        const front = this.frontEnemy()
        if (front) { front.hp -= dps * dt; if (front.hp <= 0) this.killEnemy(front) }
      }
    }

    // Поведение врагов: подход и атака в упор.
    for (const e of this.enemies) {
      const gap = e.sprite.x - this.hero.x
      if (gap > BAL.enemyAttackRange) {
        e.sprite.x -= e.speed * dt
      } else {
        e.attackTimer += delta
        if (e.attackTimer >= BAL.enemyAttackRate) {
          e.attackTimer = 0
          this.heroTakeDamage(e.dmg)
          if (State.hp <= 0) break // герой мёртв → врагов уже уничтожили, не твиним
          this.tweens.add({ targets: e.sprite, x: e.sprite.x - 14, duration: 90, yoyo: true })
        }
      }
      if (e.aura) { e.aura.x = e.sprite.x; e.aura.y = e.sprite.y }
      e.bg.x = e.sprite.x; e.fill.x = e.sprite.x
      const topY = e.sprite.y - e.onScreenH * 0.5 - 12
      e.bg.y = topY; e.fill.y = topY
      e.nameLabel.x = e.sprite.x; e.nameLabel.y = topY - 16
      e.fill.width = Math.max(0, e.barW * (e.hp / e.maxHp))
    }

    if (State.combo > 0 && time - this.lastHitTime > BAL.comboTimeout) State.combo = 0

    this.updateTutorial()
    this.maybeUltHint()
    this.updateHud()
  }

  updateHud() {
    if (this.capsShown === undefined) this.capsShown = State.caps
    if (this.capsShown < State.caps) {
      this.capsShown = Math.min(State.caps, this.capsShown + Math.max(1, (State.caps - this.capsShown) * 0.2))
      if (!this._capsPopping) {
        this._capsPopping = true
        this.tweens.add({ targets: this.capsText, scale: 1.18, duration: 90, yoyo: true, onComplete: () => { this._capsPopping = false } })
      }
    } else { this.capsShown = State.caps }
    this.capsText.setText(fmt(this.capsShown))

    const mult = State.comboMult()
    this.comboText.setText(State.combo > 0 ? t('Комбо x{m} ({n})', { m: mult.toFixed(2), n: State.combo }) : '')

    const maxHp = State.heroMaxHp()
    this.hpFill.width = Math.max(0, (this.hpBarW - 4) * Phaser.Math.Clamp(State.hp / maxHp, 0, 1))
    this.hpText.setText(`${Math.max(0, Math.ceil(State.hp))} / ${maxHp}`)

    const full = State.ult >= BAL.ultMax
    this.ultFill.width = Math.max(1, (this.hpBarW - 4) * (State.ult / BAL.ultMax))
    this.ultFill.setFillStyle(full ? COLORS.toxic : COLORS.toxicDark)
    this.ultFill.setAlpha(full ? 0.55 + 0.45 * Math.abs(Math.sin(this.time.now / 180)) : 1)

    this.zoneLabel.setText(t('ЗОНА {z} · {name}', { z: State.zoneIndex + 1, name: t(this.zone.name).toUpperCase() }))
    const prog = State.bossActive ? t('БОСС-ВОРОТА!') : t('Зачистка: {a}/{b}', { a: State.killsInZone, b: BAL.zoneKills })
    this.progressLabel.setText(t('{prog}   ·   Всего убито: {t}', { prog, t: State.totalKills }))

    this.statsText.setText([
      t('Урон клика: {n}', { n: fmt(State.clickDamage(false)) }),
      t('Крит: {n}%', { n: (State.critChance() * 100).toFixed(0) }),
      t('Союзники: {n}/сек', { n: fmt(State.allyDps()) }),
    ].join('\n'))
  }
}
