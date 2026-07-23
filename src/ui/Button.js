// Простая переиспользуемая кнопка: скруглённый прямоугольник + подпись,
// с надёжной реакцией на наведение и нажатие. Возвращает Phaser-контейнер.
//
// Хит-таргет — отдельная невидимая Zone внутри контейнера. Так hover/click
// срабатывают стабильно, а useHandCursor даёт правильный курсор без глобальных
// setDefaultCursor (которые умеют «залипать» при смене сцены).

import Phaser from 'phaser'
import { COLORS, CSS } from '../config.js'
import { Sfx } from '../audio/sfx.js'

export function createButton(scene, x, y, opts = {}) {
  const {
    width = 260,
    height = 60,
    label = 'Кнопка',
    onClick = () => {},
    color = COLORS.rust,
    hover = COLORS.rustLight,
    fontSize = 24,
    enabled = true,
  } = opts

  const container = scene.add.container(x, y)
  const baseColor = enabled ? color : COLORS.steelDark

  // Нарисованная плашка (9-slice) — если текстура загрузилась. Тинт передаёт
  // цвет кнопки/состояние (наведение — теплее, выключено — приглушённо).
  const usePlate = scene.textures.exists('ui-button')
  let plate = null
  let g = null
  let draw
  if (usePlate) {
    plate = scene.add.nineslice(0, 0, 'ui-button', undefined, width, height, 70, 70, 60, 60)
    // Плашка самодостаточна по цвету — тинтом лишь передаём состояние:
    // обычное — как есть, наведение — теплее/ярче, выключено — приглушённо.
    draw = (fill) => { plate.setTint(!enabled ? 0x8f867c : fill === hover ? 0xffe4b0 : 0xffffff) }
    draw(baseColor)
  } else {
    g = scene.add.graphics()
    draw = (fill) => {
      g.clear()
      // тень
      g.fillStyle(COLORS.ink, 0.4)
      g.fillRoundedRect(-width / 2 + 3, -height / 2 + 4, width, height, 10)
      // тело
      g.fillStyle(fill, 1)
      g.fillRoundedRect(-width / 2, -height / 2, width, height, 10)
      // обводка
      g.lineStyle(2, COLORS.ink, 0.6)
      g.strokeRoundedRect(-width / 2, -height / 2, width, height, 10)
    }
    draw(baseColor)
  }

  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Rubik, sans-serif',
    fontSize: `${fontSize}px`,
    color: enabled ? CSS.paper : '#a89e90',
    fontStyle: 'bold',
  }).setOrigin(0.5)

  container.add([plate || g, text])
  container.setSize(width, height)

  if (enabled) {
    // Невидимая зона-хиттест поверх содержимого — надёжный приём событий.
    const zone = scene.add.zone(0, 0, width, height).setOrigin(0.5)
    zone.setInteractive({ useHandCursor: true })
    container.add(zone)

    let pressed = false
    const lift = () => { if (pressed) { container.y -= 2; pressed = false } }

    zone.on('pointerover', () => draw(hover))
    zone.on('pointerout', () => { draw(baseColor); lift() })
    zone.on('pointerdown', () => { Sfx.resume(); if (!pressed) { container.y += 2; pressed = true } })
    zone.on('pointerup', () => {
      const wasPressed = pressed
      lift()
      draw(hover) // курсор всё ещё над кнопкой
      if (wasPressed) { Sfx.click(); onClick() }
    })
  }

  return container
}
