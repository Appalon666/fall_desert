// Процедурная генерация графики: спрайты через Phaser Graphics + мягкие
// текстуры (свечение/виньетка/пыль) через Canvas. Без внешних ассетов.

import { COLORS, TEX } from '../config.js'

function make(scene, key, w, h, drawFn) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false })
  drawFn(g)
  g.generateTexture(key, w, h)
  g.destroy()
}

// Радиальная мягкая текстура через Canvas.
function makeRadial(scene, key, size, stops) {
  if (scene.textures.exists(key)) scene.textures.remove(key)
  const t = scene.textures.createCanvas(key, size, size)
  const ctx = t.getContext()
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [pos, color] of stops) grad.addColorStop(pos, color)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  t.refresh()
}

// --- Герой: выживший в плаще, противогаз, дробовик ---
function drawHero(g) {
  // тень под ногами
  g.fillStyle(COLORS.ink, 0.35); g.fillEllipse(48, 118, 54, 12)
  // ноги
  g.fillStyle(0x2a2118, 1); g.fillRect(34, 88, 12, 26); g.fillRect(50, 88, 12, 26)
  // ботинки
  g.fillStyle(0x171310, 1); g.fillRect(31, 108, 17, 10); g.fillRect(49, 108, 17, 10)
  // плащ (два тона для объёма)
  g.fillStyle(0x6e3a1f, 1); g.fillRoundedRect(24, 34, 48, 60, 8)
  g.fillStyle(COLORS.rustLight, 1); g.fillRect(24, 34, 12, 60)
  g.fillStyle(0x4a2513, 1); g.fillRect(60, 34, 12, 60)
  // ремень
  g.fillStyle(0x1c150f, 1); g.fillRect(24, 74, 48, 7)
  g.fillStyle(COLORS.cap, 1); g.fillRect(44, 74, 8, 7)
  // шея
  g.fillStyle(0xb8a074, 1); g.fillRect(40, 28, 14, 8)
  // голова + противогаз
  g.fillStyle(0x8a7452, 1); g.fillCircle(47, 18, 15)
  g.fillStyle(0x2b2b30, 1); g.fillRoundedRect(35, 12, 26, 16, 6) // маска
  g.fillStyle(0x14312e, 1); g.fillCircle(41, 18, 5); g.fillCircle(53, 18, 5) // окуляры
  g.fillStyle(COLORS.toxic, 0.9); g.fillCircle(41, 18, 2.4); g.fillCircle(53, 18, 2.4)
  g.fillStyle(0x1c1c20, 1); g.fillCircle(47, 27, 5) // фильтр
  // дробовик
  g.fillStyle(0x3a3a42, 1); g.fillRect(58, 52, 40, 8)
  g.fillStyle(0x55555f, 1); g.fillRect(58, 52, 40, 3)
  g.fillStyle(0x5a3418, 1); g.fillRect(52, 56, 16, 7) // приклад
}

// === Классовые герои (каждый — свой силуэт и экипировка) ===

// Стрелок — поджарый ганфайтер: плащ-дастер, ковбойская шляпа, винтовка.
function drawGunner(g) {
  g.fillStyle(COLORS.ink, 0.35); g.fillEllipse(48, 118, 50, 11)
  g.fillStyle(0x5a4326, 1); g.fillRect(39, 90, 8, 24); g.fillRect(49, 90, 8, 24)
  g.fillStyle(0x241a0e, 1); g.fillRect(36, 110, 13, 9); g.fillRect(48, 110, 13, 9)
  g.fillStyle(0xc59a5b, 1); g.fillRoundedRect(29, 38, 38, 54, 6)
  g.fillStyle(0xdcb87e, 1); g.fillRect(29, 38, 9, 54)
  g.fillStyle(0x9c7638, 1); g.fillRect(59, 38, 8, 54)
  g.fillStyle(0xb0894a, 1); g.fillTriangle(29, 80, 22, 96, 37, 92); g.fillTriangle(67, 80, 74, 96, 59, 92)
  g.fillStyle(0x241a0e, 1); g.fillRect(29, 74, 38, 6)
  g.fillStyle(COLORS.cap, 1); g.fillRect(44, 74, 8, 6)
  g.fillStyle(0xb8935f, 1); g.fillRect(42, 30, 12, 9)
  g.fillStyle(0x8a2f2f, 1); g.fillRect(36, 25, 24, 8) // бандана
  g.fillStyle(0xcaa877, 1); g.fillCircle(48, 20, 13)
  g.fillStyle(0x2b2b30, 1); g.fillRect(40, 17, 7, 4); g.fillRect(50, 17, 7, 4)
  g.fillStyle(COLORS.toxic, 0.9); g.fillCircle(43, 19, 1.8); g.fillCircle(53, 19, 1.8)
  g.fillStyle(0x5a3b1e, 1); g.fillEllipse(48, 11, 42, 9)   // поля шляпы
  g.fillStyle(0x6b4a26, 1); g.fillRoundedRect(38, 2, 20, 11, 3)
  g.fillStyle(0x36230f, 1); g.fillRect(38, 9, 20, 3)
  g.fillStyle(0x3a3a42, 1); g.fillRect(56, 54, 36, 5)      // винтовка
  g.fillStyle(0x55555f, 1); g.fillRect(56, 54, 36, 2)
  g.fillStyle(0x5a3418, 1); g.fillRect(50, 56, 12, 7)
}

// Бугай — громадный танк: красная броня, огромные наплечники, кулаки.
function drawBrute(g) {
  g.fillStyle(COLORS.ink, 0.4); g.fillEllipse(48, 119, 62, 12)
  g.fillStyle(0x3a3a42, 1); g.fillRect(34, 92, 13, 24); g.fillRect(49, 92, 13, 24)
  g.fillStyle(0x1c1c22, 1); g.fillRect(31, 110, 17, 10); g.fillRect(48, 110, 17, 10)
  g.fillStyle(0x8a3030, 1); g.fillRoundedRect(20, 40, 56, 56, 8)
  g.fillStyle(0xb04040, 1); g.fillRect(20, 40, 14, 56)
  g.fillStyle(0x5c1e1e, 1); g.fillRect(64, 40, 12, 56)
  g.fillStyle(0x6b2424, 1); g.fillRect(20, 64, 56, 4); g.fillRect(46, 40, 4, 56)
  g.fillStyle(0x6b6b73, 1); g.fillCircle(20, 44, 15); g.fillCircle(76, 44, 15) // наплечники
  g.fillStyle(0x8a8a92, 1); g.fillCircle(16, 40, 7); g.fillCircle(72, 40, 7)
  g.fillStyle(0x8a7452, 1); g.fillCircle(48, 32, 11)      // маленькая голова
  g.fillStyle(0x4a4a52, 1); g.fillRoundedRect(37, 22, 22, 14, 5)
  g.fillStyle(0x14130f, 1); g.fillRect(39, 29, 18, 5)
  g.fillStyle(COLORS.blood, 1); g.fillRect(41, 30, 4, 3); g.fillRect(51, 30, 4, 3)
  g.fillStyle(0x6b6b73, 1); g.fillCircle(20, 86, 11); g.fillCircle(76, 86, 11) // кулаки
  g.fillStyle(0x8a8a92, 1); g.fillCircle(17, 83, 4); g.fillCircle(73, 83, 4)
}

// Механик — инженер: комбинезон, маска сварщика, антенна, механорука, ранец.
function drawMechanic(g) {
  g.fillStyle(COLORS.ink, 0.35); g.fillEllipse(48, 118, 50, 11)
  g.fillStyle(0x3a4650, 1); g.fillRoundedRect(22, 40, 13, 42, 4) // ранец
  g.fillStyle(0x3f5462, 1); g.fillRect(39, 90, 8, 24); g.fillRect(49, 90, 8, 24)
  g.fillStyle(0x1c2228, 1); g.fillRect(37, 110, 12, 9); g.fillRect(48, 110, 12, 9)
  g.fillStyle(0x50697c, 1); g.fillRoundedRect(30, 38, 36, 54, 6)
  g.fillStyle(0x6a869a, 1); g.fillRect(30, 38, 9, 54)
  g.fillStyle(0x3a4e5c, 1); g.fillRect(58, 38, 8, 54)
  g.fillStyle(0x2a3640, 1); g.fillRect(46, 38, 3, 38)     // молния
  g.fillStyle(0x2a1f12, 1); g.fillRect(30, 74, 36, 7)     // пояс с инструментом
  g.fillStyle(COLORS.cap, 1); g.fillRect(33, 75, 5, 5); g.fillRect(41, 75, 5, 5)
  g.fillStyle(0x8a8a92, 1); g.fillRect(56, 72, 5, 11)
  g.fillStyle(0x9a8a6a, 1); g.fillRect(42, 30, 12, 9)
  g.fillStyle(0x8a7452, 1); g.fillCircle(48, 20, 12)
  g.fillStyle(0x394a56, 1); g.fillRoundedRect(36, 10, 24, 20, 5) // маска сварщика
  g.fillStyle(0x14312e, 1); g.fillRect(39, 17, 18, 6)
  g.fillStyle(COLORS.toxic, 0.9); g.fillRect(41, 18, 14, 3)
  g.fillStyle(0x8a8a92, 1); g.fillRect(56, 2, 2, 10)      // антенна
  g.fillStyle(0xff5a3c, 1); g.fillCircle(57, 3, 2.5)
  g.fillStyle(0x6b6b73, 1); g.fillRect(58, 50, 10, 6); g.fillRect(66, 48, 6, 13) // механорука
  g.fillStyle(0x8a8a92, 1); g.fillCircle(69, 61, 5)
  g.fillStyle(COLORS.toxic, 1); g.fillCircle(69, 61, 2)
}

// Мародёр — старьёвщик: ранец с хламом, противогаз, монтировка, заплатки.
function drawScavenger(g) {
  g.fillStyle(COLORS.ink, 0.35); g.fillEllipse(48, 118, 50, 11)
  g.fillStyle(0x4a3a20, 1); g.fillRoundedRect(20, 44, 20, 44, 4) // ранец
  g.fillStyle(0x6b5a30, 1); g.fillRect(20, 44, 6, 44)
  g.fillStyle(0x6b6b73, 1); g.fillRect(24, 30, 3, 16); g.fillRect(30, 26, 3, 20) // хлам
  g.fillStyle(0x8a8a92, 1); g.fillRect(34, 34, 4, 12)
  g.fillStyle(COLORS.rust, 1); g.fillRect(22, 36, 10, 4)
  g.fillStyle(0x4a4326, 1); g.fillRect(40, 90, 8, 24); g.fillRect(50, 90, 8, 24)
  g.fillStyle(0x241a0e, 1); g.fillRect(37, 110, 12, 9); g.fillRect(49, 110, 12, 9)
  g.fillStyle(0x6f7a3a, 1); g.fillRoundedRect(32, 38, 36, 54, 6)
  g.fillStyle(0x8a9650, 1); g.fillRect(32, 38, 9, 54)
  g.fillStyle(0x50592a, 1); g.fillRect(60, 38, 8, 54)
  g.fillStyle(0x7a5230, 1); g.fillRect(38, 60, 10, 10); g.fillRect(52, 72, 9, 9) // заплатки
  g.fillStyle(0x241a0e, 1); g.fillRect(32, 74, 36, 6)
  g.fillStyle(0x9a8a6a, 1); g.fillRect(43, 30, 11, 9)
  g.fillStyle(0x7a6a4a, 1); g.fillCircle(48, 20, 13)
  g.fillStyle(0x3a3a30, 1); g.fillRoundedRect(37, 14, 24, 16, 6) // противогаз
  g.fillStyle(0x1c1c18, 1); g.fillCircle(43, 20, 4); g.fillCircle(53, 20, 4)
  g.fillStyle(COLORS.toxic, 0.9); g.fillCircle(43, 20, 1.8); g.fillCircle(53, 20, 1.8)
  g.fillStyle(0x2a2a22, 1); g.fillCircle(48, 30, 4)       // фильтр
  g.fillStyle(0xb5652f, 1); g.fillRect(58, 52, 5, 26); g.fillRect(58, 74, 12, 5) // монтировка
}

// --- Враг: токсичный блоб (база для тинта) ---
function drawEnemy(g) {
  g.fillStyle(COLORS.ink, 0.3); g.fillEllipse(36, 66, 44, 9) // тень
  g.fillStyle(0x000000, 0.001); g.fillRect(0, 0, 72, 72) // паддинг
  g.fillStyle(0x2f4514, 1); g.fillCircle(36, 40, 30)      // тёмная основа
  g.fillStyle(0xffffff, 1)
  // тело (рисуем белым — тинт покрасит целиком)
  g.fillStyle(0x9fd94a, 1); g.fillCircle(36, 38, 27)
  g.fillStyle(0xbfe873, 1); g.fillCircle(30, 30, 12)      // блик
  g.fillStyle(0x6f9c2f, 1); g.fillCircle(46, 48, 8); g.fillCircle(22, 44, 5) // пятна
  // глаза
  g.fillStyle(0xffffff, 1); g.fillCircle(28, 36, 8); g.fillCircle(46, 36, 8)
  g.fillStyle(0x14130f, 1); g.fillCircle(30, 37, 3.5); g.fillCircle(48, 37, 3.5)
  // оскал
  g.fillStyle(0x14130f, 1); g.fillRect(25, 50, 24, 7)
  g.fillStyle(0xffffff, 1)
  for (let i = 0; i < 4; i++) { const x = 27 + i * 6; g.fillTriangle(x, 50, x + 4, 50, x + 2, 56) }
}

// --- Босс: крупный шипастый мутант (база для тинта) ---
function drawBoss(g) {
  g.fillStyle(COLORS.ink, 0.35); g.fillEllipse(50, 92, 64, 12)
  g.fillStyle(0x000000, 0.001); g.fillRect(0, 0, 100, 100)
  // шипы
  g.fillStyle(0xcf5a3a, 1)
  g.fillTriangle(24, 30, 34, 8, 44, 30)
  g.fillTriangle(56, 30, 66, 8, 76, 30)
  g.fillTriangle(14, 54, 2, 46, 16, 40)
  g.fillTriangle(86, 54, 98, 46, 84, 40)
  // тело
  g.fillStyle(0x7a2020, 1); g.fillCircle(50, 54, 40)
  g.fillStyle(0xb63a3a, 1); g.fillCircle(50, 50, 35)
  g.fillStyle(0xd85a5a, 1); g.fillCircle(40, 40, 15) // блик
  g.fillStyle(0x5c1616, 1); g.fillCircle(64, 62, 10); g.fillCircle(30, 60, 7)
  // злые глаза
  g.fillStyle(0xffe23c, 1); g.fillCircle(38, 48, 9); g.fillCircle(62, 48, 9)
  g.fillStyle(0x14130f, 1); g.fillCircle(40, 50, 4); g.fillCircle(64, 50, 4)
  g.fillStyle(0x3a0d0d, 1) // брови
  g.fillTriangle(28, 40, 48, 44, 28, 48)
  g.fillTriangle(72, 40, 52, 44, 72, 48)
  // пасть с клыками
  g.fillStyle(0x14130f, 1); g.fillEllipse(50, 70, 34, 12)
  g.fillStyle(0xffffff, 1)
  for (let i = 0; i < 5; i++) { const x = 36 + i * 7; g.fillTriangle(x, 64, x + 5, 64, x + 2, 74) }
}

function drawBullet(g) {
  g.fillStyle(COLORS.cap, 1); g.fillRoundedRect(0, 2, 16, 6, 3)
  g.fillStyle(0xfff2b0, 1); g.fillRoundedRect(9, 2, 7, 6, 3)
  g.fillStyle(0xffffff, 1); g.fillCircle(14, 5, 2)
}

function drawCap(g) {
  g.fillStyle(COLORS.capEdge, 1); g.fillCircle(13, 13, 13)
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillStyle(0x6e5c1a, 1); g.fillCircle(13 + Math.cos(a) * 12, 13 + Math.sin(a) * 12, 1.6) }
  g.fillStyle(COLORS.cap, 1); g.fillCircle(13, 13, 9)
  g.fillStyle(0xefd069, 1); g.fillCircle(10, 10, 4)
  g.fillStyle(COLORS.capEdge, 1); g.fillCircle(13, 13, 2.5)
}

// Силуэт руин (тёмный) — для дальнего фона.
function drawRuin(g) {
  g.fillStyle(0x000000, 1)
  g.fillRect(0, 20, 18, 60)
  g.fillRect(20, 6, 14, 74)
  g.fillRect(36, 30, 22, 50)
  g.fillRect(60, 0, 10, 80)
  g.fillRect(72, 40, 20, 40)
  // выбоины
  g.fillStyle(0x000000, 1)
}

export function generateTextures(scene) {
  make(scene, TEX.HERO, 96, 124, drawHero)
  make(scene, TEX.HERO_GUNNER, 96, 124, drawGunner)
  make(scene, TEX.HERO_BRUTE, 96, 124, drawBrute)
  make(scene, TEX.HERO_MECHANIC, 96, 124, drawMechanic)
  make(scene, TEX.HERO_SCAVENGER, 96, 124, drawScavenger)
  make(scene, TEX.ENEMY, 72, 72, drawEnemy)
  make(scene, TEX.BOSS, 100, 100, drawBoss)
  make(scene, TEX.BULLET, 16, 10, drawBullet)
  make(scene, TEX.CAP, 26, 26, drawCap)
  make(scene, TEX.RUIN, 92, 80, drawRuin)

  makeRadial(scene, TEX.GLOW, 128, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']])
  makeRadial(scene, TEX.DOT, 32, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']])
  makeRadial(scene, TEX.VIGNETTE, 512, [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.78)']])
}
