// Battle — основной геймплей: стрельба по курсору, HP врагов, смерть/спавн,
// крышки, цифры урона, комбо, HP героя и смерть, союзники (idle), ульта,
// боссы каждые 10 врагов, зоны и дроп лута.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX } from '../config.js'
import { State } from '../state/GameState.js'
import { BAL } from '../data/balance.js'
import { ENEMIES } from '../data/enemies.js'
import { enemyStats } from '../data/scaling.js'
import { getZone } from '../data/zones.js'
import { rollItem, RARITY_BY_ID } from '../data/loot.js'
import { createButton } from '../ui/Button.js'
import { darken, addDust, addVignette, addFog, addGodRays, applyPostFX } from '../ui/scenery.js'
import { Platform } from '../platform/yandex.js'
import { Sfx } from '../audio/sfx.js'
import { fmt } from '../util/format.js'

const PANEL_W = 320

export default class BattleScene extends Phaser.Scene {
  constructor() { super(SCENES.BATTLE) }

  create() {
    this.arenaW = GAME.WIDTH - PANEL_W
    this.groundY = GAME.HEIGHT - 130
    this.bullets = []
    this.enemy = null
    this.spawnCount = 0
    this.lastHitTime = 0
    State.hp = State.heroMaxHp() // полное лечение в начале вылазки

    this.buildArena()
    this.buildPanel()
    applyPostFX(this, true, 0.65)

    // Герой (посадка по ногам, свой спрайт класса)
    const heroScale = 2.1
    const heroTex = (State.classDef() && State.classDef().tex) || TEX.HERO
    this.hero = this.add.image(this.arenaW * 0.16, this.groundY - 124 * heroScale * 0.42, heroTex).setScale(heroScale)
    this.tweens.add({ targets: this.hero, y: this.hero.y - 5, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    this.muzzle = { x: this.hero.x + 66, y: this.hero.y - 8 }

    // Ввод: клик по арене = выстрел (панель справа не стреляет)
    this.input.on('pointerdown', (p) => {
      if (p.x < this.arenaW) this.shoot(p.x, p.y)
    })
    this.input.keyboard.on('keydown-SPACE', () => this.tryUlt())

    this.applyZoneVisuals()
    this.spawnEnemy()
    this.maybeTutorial()
  }

  // Разовая подсказка новичку.
  maybeTutorial() {
    let seen = false
    try { seen = localStorage.getItem('yp_tut_shoot') === '1' } catch (e) { /* */ }
    if (seen || State.totalKills > 0) return
    try { localStorage.setItem('yp_tut_shoot', '1') } catch (e) { /* */ }
    const t = this.add.text(this.arenaW / 2, GAME.HEIGHT / 2 + 60,
      'Наведись на врага и КЛИКАЙ — стреляй!\nКрышки трать в «Мастерской», Space — ульта.',
      { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '20px', color: CSS.paper, align: 'center', lineSpacing: 6, stroke: '#120d09', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(70)
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, delay: 4000, duration: 1400, onComplete: () => t.destroy() })
  }

  // ---------------- Арена и фон ----------------
  buildArena() {
    const W = this.arenaW, gy = this.groundY
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
    this.groundRect = this.add.rectangle(0, gy, W, GAME.HEIGHT - gy, COLORS.rust).setOrigin(0).setDepth(-7)
    this.accentLine = this.add.rectangle(0, gy, W, 4, COLORS.rustLight).setOrigin(0).setDepth(-6).setAlpha(0.8)
    this.debris = []
    for (let i = 0; i < 6; i++) {
      this.debris.push(this.add.rectangle(60 + i * (W - 120) / 5, gy + 30 + (i % 3) * 12, 26, 6, COLORS.steelDark).setOrigin(0.5).setDepth(-6))
    }
    addFog(this, gy)
    addDust(this, gy)
    addVignette(this)

    this.zoneLabel = this.add.text(W / 2, 34, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', color: CSS.sand, fontStyle: 'bold',
      stroke: '#120d09', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(60)
    this.progressLabel = this.add.text(W / 2, 62, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#c9b58a',
      stroke: '#120d09', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(60)
  }

  applyZoneVisuals() {
    this.zone = getZone(State.zoneIndex)
    const skyTop = darken(this.zone.sky, 0.45)
    this.skyGfx.clear()
    this.skyGfx.fillGradientStyle(skyTop, skyTop, this.zone.sky, this.zone.sky, 1)
    this.skyGfx.fillRect(0, 0, this.arenaW, this.groundY)
    this.sun.setTint(this.zone.accent)
    this.groundRect.setFillStyle(this.zone.ground)
    this.accentLine.setFillStyle(this.zone.accent)
    const ruinCol = darken(this.zone.ground, 0.55)
    this.ruins.forEach(r => r.setTint(ruinCol))
    this.debris.forEach(d => d.setFillStyle(darken(this.zone.ground, 0.7)))
  }

  // ---------------- Панель (боевой HUD) ----------------
  buildPanel() {
    const px = this.arenaW
    const g = this.add.graphics()
    g.fillStyle(COLORS.steelDark, 1); g.fillRect(px, 0, PANEL_W, GAME.HEIGHT)
    g.lineStyle(4, COLORS.ink, 0.6); g.strokeRect(px + 2, 2, PANEL_W - 4, GAME.HEIGHT - 4)
    const cx = px + PANEL_W / 2

    // Крышки
    this.add.image(px + 34, 40, TEX.GLOW).setTint(COLORS.cap).setScale(1.2).setAlpha(0.5).setBlendMode('ADD')
    this.add.image(px + 34, 40, TEX.CAP).setScale(1.3)
    this.capsText = this.add.text(px + 54, 40, '0', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '24px', color: CSS.cap, fontStyle: 'bold',
    }).setOrigin(0, 0.5)

    // Комбо
    this.comboText = this.add.text(cx, 78, '', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '20px', color: CSS.toxic, fontStyle: 'bold',
    }).setOrigin(0.5)

    // HP героя
    this.add.text(px + 22, 108, 'HP героя', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: CSS.paper }).setOrigin(0)
    this.hpBarW = PANEL_W - 48
    this.add.rectangle(px + 24, 130, this.hpBarW, 22, COLORS.ink).setOrigin(0)
    this.hpFill = this.add.rectangle(px + 26, 132, this.hpBarW - 4, 18, COLORS.blood).setOrigin(0)
    this.hpText = this.add.text(cx, 141, '', { fontFamily: 'monospace', fontSize: '13px', color: '#fff' }).setOrigin(0.5)

    // Ульта
    this.add.text(px + 22, 172, 'Заряд ульты', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', color: CSS.paper }).setOrigin(0)
    this.add.rectangle(px + 24, 194, this.hpBarW, 22, COLORS.ink).setOrigin(0)
    this.ultFill = this.add.rectangle(px + 26, 196, 1, 18, COLORS.toxicDark).setOrigin(0)
    createButton(this, cx, 250, {
      label: '☢  УЛЬТА (Space)', width: PANEL_W - 60, height: 46, fontSize: 18,
      color: COLORS.toxicDark, hover: COLORS.toxic, onClick: () => this.tryUlt(),
    })

    // Инфо-статы
    this.statsText = this.add.text(px + 24, 300, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#c9bfa6', lineSpacing: 6,
    }).setOrigin(0)

    // Назад
    createButton(this, cx, GAME.HEIGHT - 50, {
      label: '⟵ В лагерь', width: PANEL_W - 60, height: 50, fontSize: 20,
      onClick: () => { State.lastSeen = Date.now(); State.save(true); Platform.submitScore(State.bestScore); this.scene.start(SCENES.HUB) },
    })
  }

  // ---------------- Спавн врага ----------------
  spawnEnemy() {
    this.spawnCount++
    const isBoss = this.spawnCount % BAL.bossEvery === 0
    const pool = this.zone.enemies
    const defId = pool[Math.floor(Math.random() * pool.length)]
    const def = ENEMIES[defId]
    const { hp, reward, dmg } = enemyStats(def, State.totalKills, isBoss)
    const speed = BAL.enemySpeed * def.speedMul * (isBoss ? 0.7 : 1)
    const texH = 72
    const scale = isBoss ? 3.1 : def.scale
    const yPos = this.groundY - texH * scale * 0.42
    const texKey = `tex-e-${defId}`
    // боссы выходят почти вплотную (сразу обмен ударами = угроза), мобы — справа
    const spawnX = isBoss ? (this.hero.x + BAL.enemyAttackRange + 50) : (this.arenaW - 90)

    // аура босса
    let aura = null
    if (isBoss) {
      aura = this.add.image(spawnX, yPos, TEX.GLOW).setTint(0xff3a1a).setScale(scale * 1.7).setAlpha(0.5).setBlendMode('ADD').setDepth(-1)
      this.tweens.add({ targets: aura, alpha: { from: 0.5, to: 0.85 }, scale: scale * 1.95, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    }

    const sprite = this.add.image(spawnX, yPos, texKey).setScale(scale)
    sprite.setAlpha(0)
    this.tweens.add({ targets: sprite, alpha: 1, duration: 200 })
    this.tweens.add({ targets: sprite, y: yPos - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

    // полоска HP над врагом
    const barW = (isBoss ? 30 : 40) * scale
    const bg = this.add.rectangle(sprite.x, 0, barW + 4, 12, COLORS.ink).setOrigin(0.5).setDepth(40)
    const fill = this.add.rectangle(sprite.x, 0, barW, 8, COLORS.toxic).setOrigin(0.5).setDepth(41)
    const nameLabel = this.add.text(sprite.x, 0, isBoss ? `☠ ${def.name}` : def.name, {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: isBoss ? '18px' : '14px',
      color: isBoss ? '#ff8a6a' : CSS.paper, fontStyle: 'bold', stroke: '#120d09', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(41)

    this.enemy = {
      sprite, aura, bg, fill, nameLabel, barW, def, isBoss,
      maxHp: hp, hp, reward, dmg, speed, scale, texH,
      hitR: 30 * scale,
      state: 'approach', attackTimer: 0,
    }
    if (isBoss) {
      this.cameras.main.flash(220, 60, 0, 0)
      this.cameras.main.shake(200, 0.006)
      this.showBossBanner(def.name)
      Sfx.boss()
    }
  }

  // ---------------- Стрельба ----------------
  shoot(tx, ty) {
    Sfx.resume(); Sfx.shoot()
    const b = this.add.image(this.muzzle.x, this.muzzle.y, TEX.BULLET).setScale(2.3).setBlendMode('ADD').setDepth(30)
    const ang = Phaser.Math.Angle.Between(this.muzzle.x, this.muzzle.y, tx, ty)
    b.setRotation(ang)
    const speed = 1500
    b.vx = Math.cos(ang) * speed
    b.vy = Math.sin(ang) * speed
    this.bullets.push(b)

    // вспышка ствола (свечение)
    const flash = this.add.image(this.muzzle.x, this.muzzle.y, TEX.GLOW).setTint(0xffe08a).setScale(0.85).setDepth(20).setBlendMode('ADD')
    this.tweens.add({ targets: flash, scale: 0.2, alpha: 0, duration: 130, onComplete: () => flash.destroy() })
    // отдача героя
    this.tweens.add({ targets: this.hero, x: this.hero.x - 5, duration: 45, yoyo: true })
  }

  hitEnemy(x, y) {
    if (!this.enemy) return
    const crit = Math.random() < State.critChance()
    let dmg = State.clickDamage()
    if (crit) dmg *= BAL.critMultiplier
    dmg = Math.max(1, Math.round(dmg))
    this.enemy.hp -= dmg

    // комбо и ульта
    State.combo++
    this.lastHitTime = this.time.now
    State.ult = Math.min(BAL.ultMax, State.ult + BAL.ultChargePerHit)

    crit ? Sfx.crit() : Sfx.hit()
    this.floatText(x, y, `${fmt(dmg)}${crit ? '!' : ''}`, crit ? '#ffd23c' : '#ffffff', crit ? 32 : 22)
    this.spawnHitSpark(x, y)
    this.punchEnemy()
    this.impactRing(x, y, crit)
    if (crit) this.cameras.main.shake(70, 0.004)
    if (this.enemy.hp <= 0) this.killEnemy()
  }

  // Вспышка + сжатие врага от попадания.
  punchEnemy() {
    const e = this.enemy
    if (!e) return
    e.sprite.setTintFill(0xffffff)
    this.time.delayedCall(45, () => { if (this.enemy === e) e.sprite.clearTint() })
    this.tweens.add({ targets: e.sprite, scaleX: e.scale * 1.14, scaleY: e.scale * 0.86, duration: 55, yoyo: true, ease: 'Quad.out' })
  }

  // Расходящееся кольцо удара.
  impactRing(x, y, crit) {
    const ring = this.add.circle(x, y, 6, 0xffffff, 0).setStrokeStyle(3, crit ? 0xffd23c : 0xffffff, 0.9).setDepth(45).setBlendMode('ADD')
    this.tweens.add({ targets: ring, scale: crit ? 4.2 : 2.6, alpha: 0, duration: 300, ease: 'Cubic.out', onComplete: () => ring.destroy() })
  }

  // ---------------- Смерть врага ----------------
  killEnemy() {
    const e = this.enemy
    this.enemy = null

    State.addCaps(Math.ceil(e.reward * (1 + State.capsBonus())))
    if (State.addXp(Math.ceil(e.reward * 0.6))) Sfx.levelup()
    State.ult = Math.min(BAL.ultMax, State.ult + BAL.ultChargePerKill)
    Sfx.kill(); Sfx.cap()
    this.capsBurst(e.sprite.x, e.sprite.y, e.isBoss ? 14 : 6)
    this.explode(e.sprite.x, e.sprite.y, e.isBoss)
    if (e.isBoss) this.cameras.main.shake(260, 0.012)

    // дроп лута
    const chance = e.isBoss ? BAL.bossDropChance : BAL.dropChance
    if (Math.random() < chance) {
      const luck = State.lootLuck()
      const item = rollItem(Math.random, Math.floor(State.enemyLevel()), luck)
      State.addItem(item)
      const rar = RARITY_BY_ID[item.rarity]
      this.floatText(e.sprite.x, e.sprite.y - 40, `🎁 ${item.name}`, rar.css, 18)
    }

    // очистка спрайтов врага
    this.tweens.killTweensOf(e.sprite)
    if (e.aura) this.tweens.killTweensOf(e.aura)
    ;[e.sprite, e.aura, e.bg, e.fill, e.nameLabel].filter(Boolean).forEach(o => o.destroy())

    const advanced = State.registerKill()
    if (advanced) { this.applyZoneVisuals(); this.cameras.main.flash(300, 40, 60, 20); Platform.showInterstitial() }

    this.time.delayedCall(220, () => { if (!this.scene.isActive()) return; this.spawnEnemy() })
  }

  // ---------------- Ульта ----------------
  tryUlt() {
    if (State.ult < BAL.ultMax) {
      this.floatText(this.arenaW / 2, 120, 'Ульта не заряжена', '#ff6a6a', 22)
      return
    }
    State.ult = 0
    Sfx.ult()
    this.cameras.main.shake(400, 0.02)
    this.cameras.main.flash(300, 140, 220, 60)
    if (this.enemy) {
      const dmg = Math.round(State.clickDamage(false) * BAL.ultDamageMul)
      this.enemy.hp -= dmg
      this.floatText(this.enemy.sprite.x, this.enemy.sprite.y - 30, `☢ ${fmt(dmg)}`, '#b6ff5a', 34)
      if (this.enemy.hp <= 0) this.killEnemy()
    }
  }

  // ---------------- Урон герою / смерть ----------------
  heroTakeDamage(dmg) {
    State.hp -= dmg
    this.floatText(this.hero.x, this.hero.y - 60, `-${fmt(Math.round(dmg))}`, '#ff5a5a', 20)
    this.cameras.main.shake(120, 0.006)
    // вспышка HP-бара и героя
    this.hpFill.setFillStyle(0xffffff)
    this.time.delayedCall(70, () => this.hpFill.setFillStyle(COLORS.blood))
    this.hero.setTintFill(0xff5a5a)
    this.time.delayedCall(70, () => this.hero.clearTint())
    // красный «эджевый» флеш по краю
    const edge = this.add.rectangle(0, 0, this.arenaW, GAME.HEIGHT, 0xff0000, 0.18).setOrigin(0).setDepth(70)
    this.tweens.add({ targets: edge, alpha: 0, duration: 220, onComplete: () => edge.destroy() })
    if (State.hp <= 0) this.heroDie()
  }

  heroDie() {
    Sfx.death()
    this.cameras.main.flash(400, 120, 0, 0)
    if (this.enemy) {
      this.tweens.killTweensOf(this.enemy.sprite)
      if (this.enemy.aura) this.tweens.killTweensOf(this.enemy.aura)
      ;[this.enemy.sprite, this.enemy.aura, this.enemy.bg, this.enemy.fill, this.enemy.nameLabel].filter(Boolean).forEach(o => o.destroy())
      this.enemy = null
    }
    Platform.submitScore(State.bestScore)
    this.showDeathModal()
  }

  showDeathModal() {
    const cx = this.arenaW / 2, cy = GAME.HEIGHT / 2
    const ov = this.add.rectangle(0, 0, this.arenaW, GAME.HEIGHT, COLORS.ink, 0.72).setOrigin(0).setDepth(85).setInteractive()
    const t = this.add.text(cx, cy - 90, 'Ты пал на пустоши', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '30px', color: '#ff5a5a', fontStyle: 'bold', stroke: '#120d09', strokeThickness: 4 }).setOrigin(0.5).setDepth(86)
    const revive = createButton(this, cx, cy - 6, {
      label: '📺 Возродиться (реклама)', width: 340, height: 56, fontSize: 20,
      color: COLORS.toxicDark, hover: COLORS.toxic,
      onClick: () => { this.closeDeathModal(); Platform.showRewarded(() => { State.hp = State.heroMaxHp(); this.spawnEnemy() }) },
    })
    const give = createButton(this, cx, cy + 66, {
      label: 'Смириться (откат зоны)', width: 340, height: 50, fontSize: 18,
      onClick: () => { this.closeDeathModal(); State.onHeroDeath(); this.spawnCount = 0; this.spawnEnemy() },
    })
    revive.setDepth(86); give.setDepth(86)
    this._deathModal = [ov, t, revive, give]
  }
  closeDeathModal() {
    if (this._deathModal) { this._deathModal.forEach(o => o.destroy()); this._deathModal = null }
  }

  // ---------------- Эффекты ----------------
  floatText(x, y, text, color, size = 22) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: `${size}px`, color, fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5)
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 800, ease: 'Cubic.out', onComplete: () => t.destroy() })
  }

  spawnHitSpark(x, y) {
    for (let i = 0; i < 4; i++) {
      const p = this.add.rectangle(x, y, 5, 5, COLORS.gold).setOrigin(0.5)
      const a = Math.random() * Math.PI * 2
      this.tweens.add({
        targets: p, x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 30, alpha: 0,
        duration: 260, onComplete: () => p.destroy(),
      })
    }
  }

  capsBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const c = this.add.image(x, y, TEX.CAP).setScale(1)
      const a = Math.random() * Math.PI * 2
      const d = 30 + Math.random() * 50
      this.tweens.add({
        targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 20, alpha: 0, angle: 180,
        duration: 500 + Math.random() * 200, ease: 'Cubic.out', onComplete: () => c.destroy(),
      })
    }
  }

  // Взрыв при смерти врага: вспышка + разлетающиеся куски.
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

  // Баннер появления босса.
  showBossBanner(name) {
    const cx = this.arenaW / 2
    const c = this.add.container(cx, 150).setDepth(80).setAlpha(0)
    const bg = this.add.graphics()
    bg.fillStyle(COLORS.ink, 0.75); bg.fillRoundedRect(-220, -34, 440, 68, 10)
    bg.lineStyle(3, 0xff5a3c, 0.9); bg.strokeRoundedRect(-220, -34, 440, 68, 10)
    const t1 = this.add.text(0, -12, '☠  БОСС', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '26px', color: '#ff6a4a', fontStyle: 'bold' }).setOrigin(0.5)
    const t2 = this.add.text(0, 16, name, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', color: CSS.paper }).setOrigin(0.5)
    c.add([bg, t1, t2])
    c.setScale(0.7)
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 220, ease: 'Back.out' })
    this.tweens.add({ targets: c, alpha: 0, delay: 1400, duration: 350, onComplete: () => c.destroy() })
  }

  // ---------------- Игровой цикл ----------------
  update(time, delta) {
    const dt = delta / 1000

    // Пули
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.x += b.vx * dt; b.y += b.vy * dt
      // трейл (через кадр, чтобы не плодить объекты)
      b.trailToggle = !b.trailToggle
      if (b.trailToggle) {
        const t = this.add.image(b.x, b.y, TEX.DOT).setTint(0xffe08a).setScale(0.55).setDepth(29).setBlendMode('ADD').setAlpha(0.5)
        this.tweens.add({ targets: t, alpha: 0, scale: 0.1, duration: 150, onComplete: () => t.destroy() })
      }
      let hit = false
      if (this.enemy) {
        const r = this.enemy.hitR
        if (Phaser.Math.Distance.Between(b.x, b.y, this.enemy.sprite.x, this.enemy.sprite.y) < r) {
          this.hitEnemy(b.x, b.y); hit = true
        }
      }
      if (hit || b.x < 0 || b.x > this.arenaW || b.y < 0 || b.y > GAME.HEIGHT) {
        b.destroy(); this.bullets.splice(i, 1)
      }
    }

    // Союзники (idle-урон)
    if (this.enemy) {
      const dps = State.allyDps()
      if (dps > 0) {
        this.enemy.hp -= dps * dt
        if (this.enemy.hp <= 0) this.killEnemy()
      }
    }

    // Поведение врага: подход и атака
    if (this.enemy) {
      const e = this.enemy
      const gap = e.sprite.x - this.hero.x
      if (gap > BAL.enemyAttackRange) {
        e.sprite.x -= e.speed * dt
      } else {
        e.attackTimer += delta
        if (e.attackTimer >= BAL.enemyAttackRate) {
          e.attackTimer = 0
          this.heroTakeDamage(e.dmg)
          // рывок-атака
          this.tweens.add({ targets: e.sprite, x: e.sprite.x - 14, duration: 90, yoyo: true })
        }
      }
      // позиция полоски HP и имени
      if (e.aura) { e.aura.x = e.sprite.x; e.aura.y = e.sprite.y }
      e.bg.x = e.sprite.x; e.fill.x = e.sprite.x
      const topY = e.sprite.y - e.texH * e.scale * 0.5 - 12
      e.bg.y = topY; e.fill.y = topY
      e.nameLabel.x = e.sprite.x; e.nameLabel.y = topY - 16
      e.fill.width = Math.max(0, e.barW * (e.hp / e.maxHp))
    }

    // Комбо-таймаут
    if (State.combo > 0 && time - this.lastHitTime > BAL.comboTimeout) State.combo = 0

    this.updateHud()
  }

  updateHud() {
    // Анимированный счётчик крышек (плавный догон + «поп» при росте)
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
    this.comboText.setText(State.combo > 0 ? `Комбо x${mult.toFixed(2)} (${State.combo})` : '')

    const maxHp = State.heroMaxHp()
    this.hpFill.width = Math.max(0, (this.hpBarW - 4) * Phaser.Math.Clamp(State.hp / maxHp, 0, 1))
    this.hpText.setText(`${Math.max(0, Math.ceil(State.hp))} / ${maxHp}`)

    const full = State.ult >= BAL.ultMax
    this.ultFill.width = Math.max(1, (this.hpBarW - 4) * (State.ult / BAL.ultMax))
    this.ultFill.setFillStyle(full ? COLORS.toxic : COLORS.toxicDark)
    this.ultFill.setAlpha(full ? 0.55 + 0.45 * Math.abs(Math.sin(this.time.now / 180)) : 1) // мерцание при заряде

    this.zoneLabel.setText(`ЗОНА ${State.zoneIndex + 1} · ${this.zone.name.toUpperCase()}`)
    this.progressLabel.setText(`Зачистка: ${State.killsInZone}/${BAL.zoneKills}   ·   Всего убито: ${State.totalKills}`)

    this.statsText.setText([
      `Урон клика: ${fmt(State.clickDamage(false))}`,
      `Крит: ${(State.critChance() * 100).toFixed(0)}%`,
      `Союзники: ${fmt(State.allyDps())}/сек`,
    ].join('\n'))
  }
}
