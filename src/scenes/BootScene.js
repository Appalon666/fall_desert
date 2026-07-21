// Boot: генерируем процедурные текстуры и уходим в хаб.
// Позже сюда добавится загрузка звуков и инициализация SDK.

import Phaser from 'phaser'
import { SCENES } from '../config.js'
import { generateTextures } from '../gfx/textures.js'
import { State } from '../state/GameState.js'
import { Platform } from '../platform/yandex.js'

export default class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT)
  }

  create() {
    generateTextures(this)

    // Прячем HTML-прелоадер — движок готов.
    const pre = document.getElementById('preloader')
    if (pre) pre.style.display = 'none'

    this.boot()
  }

  // Инициализация платформы (Яндекс), загрузка облачного сейва, старт игры.
  boot() {
    let done = false
    const proceed = () => {
      if (done) return
      done = true
      Platform.ready()
      // Первый вход без класса — на экран выбора класса, иначе в лагерь.
      this.scene.start(State.heroClass ? SCENES.HUB : SCENES.CLASS_SELECT)
    }
    const safety = this.time.delayedCall(3500, proceed) // не зависаем, если SDK молчит
    Platform.init()
      .then(() => Platform.loadCloud())
      .then((cloud) => { if (cloud) State.applyCloud(cloud) })
      .catch(() => { /* нет SDK — работаем локально */ })
      .finally(() => { safety.remove(); proceed() })
  }
}
