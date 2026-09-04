// Боевые эффекты: всплывающие цифры, искры, дождь крышек, взрыв, кольцо удара.
// Вынесены из BattleScene — они ничего не знают про состояние игры и работают
// только со сценой, поэтому держать их в файле боя незачем.
//
// Все функции первым аргументом принимают сцену и сами убирают за собой
// созданные объекты по завершении твина.

import { COLORS, TEX } from '../config.js'
import { resIcon } from '../ui/scenery.js'

// Сообщение поверх всего экрана — например «награда не начислена» после
// незакрытого до конца ролика. Слой выше модалок (у окна смерти 85-86):
// обычная всплывашка спряталась бы под их затемнением, и игрок решил бы, что
// кнопка просто не сработала.
export function toast(scene, text, color = '#ff9a6a', y = 96) {
  // Приходит из колбэка рекламы, а он может сработать сильно позже клика (после
  // сторожа — минутами), когда сцены уже нет.
  //
  // Проверяем И paused: Phaser кладёт pause/resume сцены в очередь и применяет
  // их следующим кадром, поэтому в колбэке «реклама закрылась» сцена ещё
  // числится приостановленной, хотя жива и через кадр пойдёт. Проверка одной
  // только isActive() глушила подсказку «награда не начислена» ровно там, где
  // она и нужна, — сразу после незакрытого ролика.
  const plugin = scene.scene
  if (!plugin || !(plugin.isActive() || plugin.isPaused())) return null
  const o = scene.add.text(scene.scale.width / 2, y, text, {
    fontFamily: 'Rubik, sans-serif', fontSize: '24px', color, fontStyle: 'bold',
    align: 'center', stroke: '#120d09', strokeThickness: 5,
  }).setOrigin(0.5).setDepth(200)
  scene.tweens.add({ targets: o, y: y - 26, alpha: 0, delay: 1600, duration: 700, onComplete: () => o.destroy() })
  return o
}

// Всплывающая надпись (урон, лечение, имя предмета).
export function floatText(scene, x, y, text, color, size = 22) {
  const t = scene.add.text(x, y, text, {
    fontFamily: 'Rubik, sans-serif', fontSize: `${size}px`, color, fontStyle: 'bold',
    stroke: '#000', strokeThickness: 3,
  }).setOrigin(0.5)
  scene.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 800, ease: 'Cubic.out', onComplete: () => t.destroy() })
  return t
}

// Искры в точке попадания.
export function hitSpark(scene, x, y) {
  for (let i = 0; i < 4; i++) {
    const p = scene.add.rectangle(x, y, 5, 5, COLORS.gold).setOrigin(0.5)
    const a = Math.random() * Math.PI * 2
    scene.tweens.add({ targets: p, x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 30, alpha: 0, duration: 260, onComplete: () => p.destroy() })
  }
}

// Дождь крышек с убитого врага.
export function capsBurst(scene, x, y, n) {
  for (let i = 0; i < n; i++) {
    const c = resIcon(scene, x, y, 'caps', 26)
    const a = Math.random() * Math.PI * 2
    const d = 30 + Math.random() * 50
    scene.tweens.add({
      targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 20,
      alpha: 0, angle: 180, duration: 500 + Math.random() * 200, ease: 'Cubic.out',
      onComplete: () => c.destroy(),
    })
  }
}

// Взрыв на месте смерти: вспышка и разлетающиеся куски. big — для босса.
export function explode(scene, x, y, big) {
  const flash = scene.add.image(x, y, TEX.GLOW).setTint(big ? 0xff8a4a : 0xfff0b0)
    .setScale(big ? 2.2 : 1.2).setDepth(44).setBlendMode('ADD')
  scene.tweens.add({ targets: flash, scale: 0, alpha: 0, duration: big ? 380 : 240, onComplete: () => flash.destroy() })
  const n = big ? 16 : 8
  for (let i = 0; i < n; i++) {
    const col = [COLORS.toxic, COLORS.rustLight, COLORS.gold][i % 3]
    const chunk = scene.add.rectangle(x, y, 6 + Math.random() * 5, 6 + Math.random() * 5, col).setDepth(43)
    const a = Math.random() * Math.PI * 2
    const d = 40 + Math.random() * (big ? 120 : 60)
    scene.tweens.add({
      targets: chunk, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + 30,
      angle: Math.random() * 360, alpha: 0, duration: 400 + Math.random() * 300, ease: 'Quad.out',
      onComplete: () => chunk.destroy(),
    })
  }
}

// Расходящееся кольцо в точке попадания (шире и золотое на крите).
export function impactRing(scene, x, y, crit) {
  const ring = scene.add.circle(x, y, 6, 0xffffff, 0)
    .setStrokeStyle(3, crit ? 0xffd23c : 0xffffff, 0.9).setDepth(45).setBlendMode('ADD')
  scene.tweens.add({
    targets: ring, scale: crit ? 4.2 : 2.6, alpha: 0, duration: 300, ease: 'Cubic.out',
    onComplete: () => ring.destroy(),
  })
}
