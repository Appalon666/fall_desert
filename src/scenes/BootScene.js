// Boot: генерируем процедурные текстуры и уходим в хаб.
// Позже сюда добавится загрузка звуков и инициализация SDK.

import Phaser from 'phaser'
import { SCENES } from '../config.js'
import { generateTextures } from '../gfx/textures.js'
import { State } from '../state/GameState.js'

export default class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT)
  }

  create() {
    generateTextures(this)

    // Прячем HTML-прелоадер — движок готов.
    const pre = document.getElementById('preloader')
    if (pre) pre.style.display = 'none'

    // Первый вход без класса — на экран выбора класса, иначе в лагерь.
    this.scene.start(State.heroClass ? SCENES.HUB : SCENES.CLASS_SELECT)
  }
}
