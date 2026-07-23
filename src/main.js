// Точка входа: конфигурация Phaser и запуск игры.
// Масштабирование FIT + автоцентр — одинаково тянется на ПК и телефоне.

import Phaser from 'phaser'
import { GAME, COLORS, SCENES } from './config.js'
import BootScene from './scenes/BootScene.js'
import ClassSelectScene from './scenes/ClassSelectScene.js'
import HubScene from './scenes/HubScene.js'
import BattleScene from './scenes/BattleScene.js'
import ShopScene from './scenes/ShopScene.js'
import InventoryScene from './scenes/InventoryScene.js'
import HeroScene from './scenes/HeroScene.js'
import PrestigeScene from './scenes/PrestigeScene.js'
import LeaderboardScene from './scenes/LeaderboardScene.js'
import ForgeScene from './scenes/ForgeScene.js'

// Глобальный контраст текста: тёмная обводка + тень под каждой надписью,
// чтобы текст читался поверх пёстрых нарисованных фонов. Уважаем стиль:
// если у текста уже задана своя обводка (stroke) — не трогаем.
const _origText = Phaser.GameObjects.GameObjectFactory.prototype.text
Phaser.GameObjects.GameObjectFactory.prototype.text = function (x, y, text, style) {
  const t = _origText.call(this, x, y, text, style)
  const hasStroke = style && (style.stroke || style.strokeThickness)
  if (!hasStroke && !(style && style.noOutline)) {
    const fs = parseInt(t.style.fontSize, 10) || 16
    t.setStroke('#1a1206', Math.min(6, Math.max(2, Math.round(fs * 0.13))))
    t.setShadow(0, 2, '#000000', 4, false, true)
    t.setResolution(2) // резче на масштабировании FIT
  }
  return t
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bgDark,
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
  scene: [BootScene, ClassSelectScene, HubScene, BattleScene, ShopScene, InventoryScene, HeroScene, PrestigeScene, LeaderboardScene, ForgeScene],
}

// eslint-disable-next-line no-new
new Phaser.Game(config)

// Отладочная ссылка на сцены в консоли браузера.
if (import.meta.env?.DEV) {
  console.log('[Пустошь] Каркас запущен. Сцены:', Object.values(SCENES).join(' → '))
}
