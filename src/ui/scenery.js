// Общий визуальный слой: атмосферный фон, виньетка, панели, заголовки.
// Используется всеми сценами для единого «чистового» вида.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, TEX } from '../config.js'

export function darken(c, f) {
  const r = Math.floor((c >> 16 & 255) * f)
  const g = Math.floor((c >> 8 & 255) * f)
  const b = Math.floor((c & 255) * f)
  return (r << 16) | (g << 8) | b
}
export function lighten(c, f) {
  const r = Math.min(255, Math.floor((c >> 16 & 255) + 255 * f))
  const g = Math.min(255, Math.floor((c >> 8 & 255) + 255 * f))
  const b = Math.min(255, Math.floor((c & 255) + 255 * f))
  return (r << 16) | (g << 8) | b
}

// Полноэкранная виньетка поверх всего (мягко затемняет края).
export function addVignette(scene) {
  return scene.add.image(GAME.WIDTH / 2, GAME.HEIGHT / 2, TEX.VIGNETTE)
    .setDisplaySize(GAME.WIDTH + 60, GAME.HEIGHT + 60)
    .setDepth(900).setAlpha(0.85)
}

// Дрейфующая пыль (частицы). Возвращает эмиттер.
export function addDust(scene, groundY = GAME.HEIGHT) {
  return scene.add.particles(0, 0, TEX.DOT, {
    x: { min: 0, max: GAME.WIDTH },
    y: { min: GAME.HEIGHT * 0.25, max: GAME.HEIGHT },
    lifespan: 7000,
    speedY: { min: -16, max: -3 },
    speedX: { min: -10, max: 10 },
    scale: { min: 0.12, max: 0.55 },
    alpha: { start: 0.22, end: 0 },
    quantity: 1, frequency: 190, blendMode: 'ADD',
  }).setDepth(-5)
}

// Полный атмосферный фон по палитре зоны/меню.
// pal = { sky, ground, accent }
export function buildBackground(scene, pal, opts = {}) {
  const W = GAME.WIDTH, H = GAME.HEIGHT
  const groundY = opts.groundY ?? H * 0.8
  const skyTop = darken(pal.sky, 0.45)

  const g = scene.add.graphics().setDepth(-10)
  g.fillGradientStyle(skyTop, skyTop, pal.sky, pal.sky, 1)
  g.fillRect(0, 0, W, groundY)

  // солнце сквозь смог + лучи
  const sunX = W * 0.76, sunY = groundY * 0.4
  scene.add.image(sunX, sunY, TEX.GLOW).setDepth(-9).setTint(pal.accent).setAlpha(0.32).setScale(4.6)
  addGodRays(scene, sunX, sunY - 40, lighten(pal.accent, 0.3))

  // дальние руины двумя слоями (параллакс-дрейф)
  const ruinFar = darken(pal.ground, 0.4)
  const ruinNear = darken(pal.ground, 0.6)
  const farLayer = scene.add.container(0, 0).setDepth(-8)
  const nearLayer = scene.add.container(0, 0).setDepth(-7)
  for (let i = 0; i < 8; i++) {
    const s = 0.7 + ((i * 53) % 60) / 80
    farLayer.add(scene.add.image(i * (W / 6) - 40, groundY + 2, TEX.RUIN).setOrigin(0.5, 1).setTint(ruinFar).setAlpha(0.45).setScale(s * 1.3, s * 1.4))
  }
  for (let i = 0; i < 6; i++) {
    const s = 0.9 + ((i * 41) % 50) / 60
    nearLayer.add(scene.add.image(i * (W / 5), groundY + 3, TEX.RUIN).setOrigin(0.5, 1).setTint(ruinNear).setAlpha(0.6).setScale(s * 1.6, s * 1.9))
  }
  scene.tweens.add({ targets: farLayer, x: -30, duration: 22000, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
  scene.tweens.add({ targets: nearLayer, x: 24, duration: 15000, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
  if (opts.fog !== false) addFog(scene, groundY, lighten(pal.ground, 0.15))

  // земля
  scene.add.rectangle(0, groundY, W, H - groundY, pal.ground).setOrigin(0).setDepth(-7)
  scene.add.rectangle(0, groundY, W, 4, pal.accent).setOrigin(0).setDepth(-6).setAlpha(0.8)
  for (let i = 0; i < 8; i++) {
    scene.add.rectangle(40 + i * (W - 80) / 7, groundY + 20 + (i % 3) * 14, 20 + (i % 4) * 6, 6, darken(pal.ground, 0.7)).setOrigin(0.5).setDepth(-6)
  }

  if (opts.dust !== false) addDust(scene, groundY)
  if (opts.vignette !== false) addVignette(scene)
  return { groundY }
}

// Стилизованная панель со скруглением, тенью и рамкой. Возвращает graphics.
export function panel(scene, x, y, w, h, opts = {}) {
  const { radius = 14, fill = COLORS.steelDark, border = COLORS.ink, borderAlpha = 0.7, borderW = 3, fillAlpha = 0.96 } = opts
  const g = scene.add.graphics()
  g.fillStyle(COLORS.ink, 0.4); g.fillRoundedRect(x + 4, y + 6, w, h, radius)
  g.fillStyle(fill, fillAlpha); g.fillRoundedRect(x, y, w, h, radius)
  g.lineStyle(borderW, border, borderAlpha); g.strokeRoundedRect(x, y, w, h, radius)
  return g
}

// Контурная подсветка объекта (rim/outline) через preFX-glow. Только WebGL —
// на Canvas тихо пропускается. Делает спрайты «сочными» и читаемыми на фоне.
export function addRim(obj, color = 0xffffff, outer = 3, quality = 0.08, distance = 12) {
  try { if (obj && obj.preFX) obj.preFX.addGlow(color, outer, 0, false, quality, distance) } catch (e) { /* нет WebGL FX */ }
  return obj
}

// Постобработка камеры: bloom (свечение ярких участков). Только WebGL.
export function applyPostFX(scene, bloom = true, strength = 0.7) {
  const cam = scene.cameras.main
  if (!cam || !cam.postFX) return
  try {
    if (bloom) cam.postFX.addBloom(0xffffff, 1, 1, 1, strength, 4)
  } catch (e) { /* нет WebGL-пайплайна — пропускаем */ }
}

// Дрейфующий туман — несколько мягких облаков ползут по горизонту.
export function addFog(scene, groundY = GAME.HEIGHT * 0.7, tint = 0x8a7a5a) {
  for (let i = 0; i < 3; i++) {
    const y = groundY * (0.5 + i * 0.16)
    const f = scene.add.image(200 + i * 480, y, TEX.GLOW)
      .setTint(tint).setAlpha(0.06 + i * 0.02).setScale(9, 3.2).setDepth(-6).setBlendMode('ADD')
    scene.tweens.add({ targets: f, x: f.x + (i % 2 ? 260 : -260), duration: 16000 + i * 4000, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
  }
}

// Лучи света от солнца — тонкие наклонные конусы с лёгкой пульсацией.
export function addGodRays(scene, x, y, color = 0xffdf9a) {
  const rays = scene.add.container(x, y).setDepth(-8).setAngle(18)
  for (let i = -2; i <= 2; i++) {
    const g = scene.add.graphics()
    g.fillStyle(color, 0.05)
    const w = 26
    g.fillTriangle(i * 60, 0, i * 60 - w, 620, i * 60 + w, 620)
    g.setBlendMode('ADD')
    rays.add(g)
  }
  scene.tweens.add({ targets: rays, alpha: { from: 0.6, to: 1 }, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
  return rays
}

// Заголовок с обводкой и мягким свечением.
export function titleText(scene, x, y, text, opts = {}) {
  const { size = 48, color = CSS.cap, glow = COLORS.cap } = opts
  scene.add.image(x, y, TEX.GLOW).setTint(glow).setAlpha(0.25).setScale(size / 18, size / 34).setDepth(0)
  return scene.add.text(x, y, text, {
    fontFamily: 'Trebuchet MS, sans-serif', fontSize: `${size}px`, color, fontStyle: 'bold',
    stroke: '#120d09', strokeThickness: Math.max(3, size / 8),
    shadow: { offsetX: 0, offsetY: 3, color: '#000', blur: 6, fill: true },
  }).setOrigin(0.5)
}
