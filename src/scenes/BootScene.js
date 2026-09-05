// Boot: грузим только критичные ассеты, генерируем процедурные текстуры и
// уходим в меню. Тяжёлое (враги/фоны зон — в BattleScene, музыка — фоном отсюда)
// не задерживает первый экран: Яндекс 1.14 требует, чтобы игра запускалась, а не
// висела на чёрном экране, пока качается всё сразу.

import Phaser from 'phaser'
import { SCENES } from '../config.js'
import { generateTextures } from '../gfx/textures.js'
import { loadCore, loadDeferredUi, loadBosses, loadMusic, buildHeroSheets, buildBossSheets } from '../assets.js'
import { State } from '../state/GameState.js'
import { Platform } from '../platform/yandex.js'
import { Music } from '../audio/music.js'
import { setLang } from '../i18n.js'

// HTML-прелоадер из index.html: показываем реальный прогресс загрузки.
function setPreloaderProgress(frac) {
  try {
    const fill = document.getElementById('pl-fill')
    const pct = document.getElementById('pl-pct')
    const p = Math.round(Math.min(1, Math.max(0, frac)) * 100)
    if (fill) fill.style.width = `${Math.max(4, p)}%`
    if (pct) pct.textContent = `${p}%`
  } catch (e) { /* */ }
}
function hidePreloader() {
  try {
    const pre = document.getElementById('preloader')
    if (pre) pre.style.display = 'none'
  } catch (e) { /* */ }
}

export default class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT)
  }

  preload() {
    // Отсутствующий ассет — не повод падать: у всего есть процедурный фолбэк.
    this.load.on('loaderror', () => { /* */ })
    // Прогресс критичной загрузки → в HTML-прелоадер (0…90%, хвост — шрифты/SDK).
    this.load.on('progress', (v) => setPreloaderProgress(v * 0.9))
    loadCore(this.load)
  }

  create() {
    generateTextures(this)
    buildHeroSheets(this) // режем листы героев по их собственной раскладке
    setPreloaderProgress(0.93)

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
    // cloudSettled — успело ли облако ответить ДО старта игры.
    //
    // Флаг _started закрывает применение облачного сейва (см. GameState.applyCloud).
    // Раньше он взводился и на пути сторожевого таймера: на медленной сети SDK не
    // укладывался в 3.5 секунды, игра стартовала, приехавший следом облачный сейв
    // молча отбрасывался — а первое же сохранение затирало им же облако. То есть
    // на новом устройстве игрок с плохой связью терял весь прогресс НАВСЕГДА.
    // Теперь по сторожу флаг остаётся снятым: облако ещё сможет догнать, а от
    // затирания активной игры защищает сравнение прогресса внутри applyCloud.
    const proceed = (cloudSettled) => {
      if (done) return
      done = true
      setPreloaderProgress(1)
      hidePreloader()
      setLang(Platform.lang()) // язык из Яндекс SDK (или браузера) до старта сцен
      State._started = cloudSettled
      Platform.ready()
      // Первый вход без класса — на экран выбора класса, иначе в лагерь.
      // launch (а не start): BootScene остаётся жить и догружает музыку фоном.
      this.scene.launch(State.heroClass ? SCENES.HUB : SCENES.CLASS_SELECT)
      this.backgroundLoadMusic()
    }
    // Сторож на setTimeout, а не на таймере сцены: сцена может стоять на паузе
    // (вкладка свёрнута), и тогда таймер сцены не тикает, а игра не стартует.
    const safety = setTimeout(() => proceed(false), 3500) // не зависаем, если SDK молчит
    Platform.init()
      .then(() => Platform.loadCloud())
      .then((cloud) => { if (cloud) State.applyCloud(cloud) })
      .catch(() => { /* нет SDK — работаем локально */ })
      .finally(() => {
        clearTimeout(safety)
        // Облако отработало (успешно или нет) — окно для позднего применения
        // закрыто в любом случае, даже если игра уже стартовала по сторожу.
        State._started = true
        proceed(true)
      })
  }

  // Иконки разделов и музыка (~4 МБ) догружаются уже во время игры: до первого
  // экрана они не нужны, а без них работают эмодзи-фолбэки и тишина.
  backgroundLoadMusic() {
    try {
      this.load.removeAllListeners('progress')
      // Режем лист босса СРАЗУ, как он доехал, а не когда до него доберётся бой.
      // Текстуры и анимации в Phaser общие для всей игры, так что нарезка из
      // загрузочной сцены работает так же. Иначе к первым воротам файл лежал
      // готовым, но не нарезанным — и босс показывался процедурной заглушкой.
      this.load.on('filecomplete', (key) => {
        if (typeof key === 'string' && key.startsWith('boss-')) {
          try { buildBossSheets(this) } catch (e) { /* останется фолбэк */ }
        }
      })
      // Боссы (девять листов, ~900 КБ) идут ВТОРЫМИ: до первых ворот у игрока
      // около минуты, и раньше они грузились только из боя — кто добегал
      // быстрее загрузки, видел вместо босса процедурную заглушку. Музыка
      // тяжелее всего (~4 МБ) и ждёт последней: без неё игра просто тише.
      this.loadChain([loadDeferredUi, loadBosses, loadMusic], () => {
        try { Music.retry() } catch (e) { /* */ }
        this.scene.stop() // всё догружено — Boot больше не нужен
      })
    } catch (e) { /* без иконок и музыки игра работает */ }
  }

  // Последовательная фоновая догрузка: следующая пачка стартует, когда
  // предыдущая доехала. Так музыка (самая тяжёлая) не мешает иконкам.
  loadChain(steps, done) {
    const next = (i) => {
      if (i >= steps.length) { try { done() } catch (e) { /* */ } return }
      this.load.once('complete', () => next(i + 1))
      steps[i](this.load)
      this.load.start()
    }
    next(0)
  }
}
