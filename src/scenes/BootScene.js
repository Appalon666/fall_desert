// Boot: генерируем процедурные текстуры и уходим в хаб.
// Позже сюда добавится загрузка звуков и инициализация SDK.

import Phaser from 'phaser'
import { SCENES } from '../config.js'
import { generateTextures } from '../gfx/textures.js'
import { ENEMY_IDS } from '../data/enemies.js'
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
    this.load.on('loaderror', () => { /* нет ассета — не страшно, есть фолбэк */ })
    Music.queue(this.load)
    // Спрайтшиты героев (6 кадров 3×2, кадр 341×279). Есть — используются вместо
    // процедурных; нет — остаётся процедурный fallback (tex-hero-*).
    for (const c of ['gunner', 'brute', 'mechanic', 'scavenger']) {
      this.load.spritesheet(`hero-${c}`, `sprites/hero-${c}.png`, { frameWidth: 341, frameHeight: 279 })
    }
    // Спрайтшиты врагов (18 кадров 6×3: idle/walk/death, кадр 170×186).
    for (const id of ENEMY_IDS) {
      this.load.spritesheet(`enemy-${id}`, `sprites/enemy-${id}.png`, { frameWidth: 170, frameHeight: 186 })
    }
    // Фоны зон + меню (нарисованные). Нет файла — процедурный fallback.
    for (const k of ['rust', 'city', 'bunker', 'lair', 'menu']) {
      this.load.image(`bg-${k}`, `bg/${k}.jpg`)
    }
    // Нарисованная плашка кнопки (9-slice). Нет — рисуем графикой.
    this.load.image('ui-button', 'ui/button.png')
  }

  create() {
    generateTextures(this)
    this.buildEnemyAnims()

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

  // Анимации врагов из спрайтшитов (если загрузились): idle/walk/death.
  buildEnemyAnims() {
    for (const id of ENEMY_IDS) {
      const key = `enemy-${id}`
      if (!this.textures.exists(key) || this.textures.get(key).frameTotal <= 1) continue
      if (!this.anims.exists(`${id}-idle`)) this.anims.create({ key: `${id}-idle`, frames: this.anims.generateFrameNumbers(key, { start: 0, end: 5 }), frameRate: 7, repeat: -1 })
      if (!this.anims.exists(`${id}-walk`)) this.anims.create({ key: `${id}-walk`, frames: this.anims.generateFrameNumbers(key, { start: 6, end: 11 }), frameRate: 11, repeat: -1 })
      if (!this.anims.exists(`${id}-death`)) this.anims.create({ key: `${id}-death`, frames: this.anims.generateFrameNumbers(key, { start: 12, end: 17 }), frameRate: 11, repeat: 0 })
    }
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
