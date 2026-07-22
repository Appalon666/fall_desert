// Boot: генерируем процедурные текстуры и уходим в хаб.
// Позже сюда добавится загрузка звуков и инициализация SDK.

import Phaser from 'phaser'
import { SCENES } from '../config.js'
import { generateTextures } from '../gfx/textures.js'
import { State } from '../state/GameState.js'
import { Platform } from '../platform/yandex.js'
import { Music } from '../audio/music.js'
import { setLang } from '../i18n.js'

export default class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT)
  }

  preload() {
    // Опциональная фоновая музыка (public/music/*). Нет файлов — тихо пропускаем.
    this.load.on('loaderror', () => { /* нет трека — не страшно */ })
    Music.queue(this.load)
  }

  create() {
    generateTextures(this)

    // Прячем HTML-прелоадер — движок готов.
    const pre = document.getElementById('preloader')
    if (pre) pre.style.display = 'none'

    // Ждём шрифт Rubik ДО старта сцен, иначе Phaser отрисует текст запасным
    // шрифтом и не обновит его после загрузки. Локальный woff2 грузится быстро.
    this.ensureFonts().then(() => this.boot())
  }

  ensureFonts() {
    try {
      if (!document || !document.fonts) return Promise.resolve()
      const loads = ['400 20px Rubik', '500 20px Rubik', '700 20px Rubik'].map(f => document.fonts.load(f))
      // подстраховка таймаутом, чтобы не зависнуть, если шрифт не загрузился
      const timeout = new Promise(res => setTimeout(res, 2500))
      return Promise.race([Promise.all(loads).catch(() => {}), timeout])
    } catch (e) { return Promise.resolve() }
  }

  // Инициализация платформы (Яндекс), загрузка облачного сейва, старт игры.
  boot() {
    let done = false
    const proceed = () => {
      if (done) return
      done = true
      setLang(Platform.lang()) // язык из Яндекс SDK (или браузера) до старта сцен
      State._started = true // с этого момента позднее облако не затирает сессию
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
