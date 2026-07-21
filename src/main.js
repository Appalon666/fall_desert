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
  scene: [BootScene, ClassSelectScene, HubScene, BattleScene, ShopScene, InventoryScene, HeroScene],
}

// eslint-disable-next-line no-new
new Phaser.Game(config)

// Отладочная ссылка на сцены в консоли браузера.
if (import.meta.env?.DEV) {
  console.log('[Пустошь] Каркас запущен. Сцены:', Object.values(SCENES).join(' → '))
}
