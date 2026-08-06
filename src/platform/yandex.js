// Обёртка над Яндекс.Играми SDK с мягким откатом.
// Локально (без SDK) всё работает: реклама сразу даёт награду, сейв идёт в
// localStorage (через GameState), лидерборды — заглушка. На Яндексе —
// облачные сейвы, реклама, таблицы рекордов.

import { Pause, PAUSE } from '../util/pause.js'

// Технический id таблицы рекордов. Должен совпадать с тем, что заведён в
// личном кабинете Яндекса (чек-лист в dock/README.md): пока таблицы с этим id
// нет, setLeaderboardScore молча ничего не делает.
export const LEADERBOARD = 'kills'

class YandexPlatform {
  constructor() {
    this.available = false
    this.ya = null
    this.player = null
    this.lb = null
    this._initP = null
    this._lastCloud = 0
    this._lastAd = Date.now() // не показываем межстраничную сразу после загрузки
  }

  init() {
    if (!this._initP) this._initP = this._doInit()
    return this._initP
  }

  async _doInit() {
    try {
      // SDK подключён тегом <script> в index.html (п.1.19.1). Обычно к этому
      // моменту window.YaGames уже готов; на всякий случай коротко ждём, а если
      // тега нет вовсе (локальный запуск) — подгружаем скрипт вручную.
      await this._waitForSdk(3000)
      if (!window.YaGames) {
        try { await this._loadScript('https://yandex.ru/games/sdk/v2?days=180') } catch (e) { /* */ }
      }
      if (!window.YaGames) return false
      this.ya = await window.YaGames.init()
      this.available = true
      try { this.player = await this.ya.getPlayer({ scopes: false }) } catch (e) { this.player = null }
      // Новый API — ysdk.leaderboards; getLeaderboards() оставлен как запасной.
      try { this.lb = this.ya.leaderboards || await this.ya.getLeaderboards() } catch (e) { this.lb = null }
      // Догоняем вызовы, сделанные до готовности SDK (см. _flushPlatformState).
      this._flushPlatformState()
      return true
    } catch (e) {
      this.available = false
      return false
    }
  }

  // Ждём, пока тег из index.html выполнится и объявит window.YaGames.
  _waitForSdk(timeoutMs) {
    if (window.YaGames) return Promise.resolve(true)
    return new Promise((resolve) => {
      const t0 = Date.now()
      const tick = () => {
        if (window.YaGames) return resolve(true)
        if (Date.now() - t0 >= timeoutMs) return resolve(false)
        setTimeout(tick, 50)
      }
      tick()
    })
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src; s.onload = resolve; s.onerror = reject
      document.head.appendChild(s)
    })
  }

  // Язык игрока по правилам Яндекса: из SDK (environment.i18n.lang), иначе из
  // языка браузера. Возвращает ISO-код ('ru','en',...); дефолт 'ru'.
  lang() {
    // Override через URL (?lang=en|ru) — удобно для скриншотов магазина.
    try {
      const q = new URLSearchParams(window.location.search).get('lang')
      if (q) return q
    } catch (e) { /* */ }
    try { const l = this.ya?.environment?.i18n?.lang; if (l) return l } catch (e) { /* */ }
    try { const n = (navigator.language || navigator.userLanguage || 'ru'); return n } catch (e) { /* */ }
    return 'ru'
  }

  // Сообщить платформе, что игра загрузилась / началась / приостановилась.
  //
  // Вызовы ЗАПОМИНАЮТСЯ и повторяются, когда SDK доедет. Иначе была дыра под
  // п.1.19: BootScene стартует игру по сторожевому таймеру через 3.5 секунды,
  // не дожидаясь SDK, и на медленной сети LoadingAPI.ready() уходил в null —
  // игра уже игралась, а платформа считала её вечно загружающейся.
  ready() { this._readyWanted = true; this._flushPlatformState() }
  gameplayStart() { this._playing = true; this._flushPlatformState() }
  gameplayStop() { this._playing = false; this._flushPlatformState() }

  _flushPlatformState() {
    const f = this.ya?.features
    if (!f) return
    if (this._readyWanted) {
      try { f.LoadingAPI?.ready(); this._readyWanted = false } catch (e) { /* */ }
    }
    // GameplayAPI повторяем только при смене состояния: start/stop подряд
    // одинаковыми платформа считает ошибкой интеграции.
    if (this._playing !== this._playingSent) {
      try {
        this._playing ? f.GameplayAPI?.start() : f.GameplayAPI?.stop()
        this._playingSent = this._playing
      } catch (e) { /* */ }
    }
  }

  // Облачный сейв (с троттлингом, чтобы не спамить).
  saveCloud(obj, flush = false) {
    if (!this.available || !this.player) return
    const now = Date.now()
    if (!flush && now - this._lastCloud < 20000) return
    this._lastCloud = now
    try { this.player.setData(obj, flush) } catch (e) { /* */ }
  }
  async loadCloud() {
    if (!this.available || !this.player) return null
    try { return await this.player.getData() } catch (e) { return null }
  }

  // Ссылка на Phaser.Game нужна паузе (Яндекс 4.7: под полноэкранной рекламой
  // должны молчать И звук, И игровой процесс).
  attachGame(game) { this.game = game; Pause.attach(game) }

  // Пауза на время ролика. Сторож нужен на случай, если SDK не вызовет ни один
  // колбэк (реклама не открылась): иначе игра осталась бы висеть на паузе.
  // Срок намеренно большой: снять паузу раньше, чем реклама успела открыться,
  // хуже — тогда под роликом заиграет музыка (нарушение п.4.7).
  _adStart() {
    Pause.add(PAUSE.AD)
    this._adOpened = false // хвост от прошлого показа не должен глушить сторожа
    if (this._adGuard) clearTimeout(this._adGuard)
    this._adGuard = setTimeout(() => { if (!this._adOpened) this._adEnd() }, 15000)
  }
  _adOpen() {
    this._adOpened = true
    if (this._adGuard) { clearTimeout(this._adGuard); this._adGuard = null }
    Pause.add(PAUSE.AD) // на случай, если ролик стартовал без нашего _adStart
  }
  _adEnd() {
    this._adOpened = false
    if (this._adGuard) { clearTimeout(this._adGuard); this._adGuard = null }
    Pause.remove(PAUSE.AD)
  }

  // СТРАХОВКА ОТ ВЕЧНОЙ ПАУЗЫ. Сторож в _adStart снимается по onOpen, поэтому
  // ролик, который открылся и не прислал ни onClose, ни onError, оставлял игру
  // на паузе навсегда: экран живой, кнопки мёртвые. Именно так «зависало» окно
  // «Как играть» — оно открывается сразу за кнопкой rewarded.
  //
  // Ролик показывается поверх страницы и забирает себе весь ввод, поэтому
  // настоящий клик или нажатие клавиши В ИГРЕ означает, что рекламы на экране
  // уже нет. Снимаем паузу, чего бы там ни намолчал SDK.
  wakeFromStuckAd() {
    if (!Pause.has(PAUSE.AD)) return
    this._adEnd()
  }

  // Реклама за награду. Гарантирует РОВНО один вызов onReward (успех/ошибка).
  // Локально (без SDK) — сразу выдаём награду.
  showRewarded(onReward, onClose) {
    let settled = false
    const reward = () => { if (settled) return; settled = true; try { onReward && onReward() } catch (e) { /* */ } }
    const closed = () => { try { onClose && onClose() } catch (e) { /* */ } }
    if (!this.available || !this.ya?.adv) { reward(); closed(); return }
    const finish = () => { this._adEnd(); reward(); closed() }
    this._adStart()
    try {
      this.ya.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => this._adOpen(),
          onRewarded: () => reward(),
          // Досмотрели/закрыли: не наказываем игрока — если награды не было, выдаём.
          onClose: finish,
          onError: finish,
        },
      })
    } catch (e) { finish() }
  }

  // Межстраничная реклама. Клиентский троттлинг ≥75с (Яндекс требует ≥60с и
  // не одобряет частый показ; зоны могут сменяться чаще).
  showInterstitial() {
    if (!this.available || !this.ya?.adv) return
    const now = Date.now()
    if (now - this._lastAd < 75000) return
    // Отдельный троттл на ПОПЫТКИ: если реклама не показалась (нет инвентаря),
    // _lastAd не обновится, и без этого мы дёргали бы SDK на каждой смерти.
    if (now - (this._lastAdTry || 0) < 20000) return
    this._lastAdTry = now
    // Глушим звук и геймплей ДО вызова: ролик может стартовать раньше onOpen.
    this._adStart()
    try {
      this.ya.adv.showFullscreenAdv({
        callbacks: {
          // Троттл сбрасываем только когда реклама реально открылась (onOpen).
          onOpen: () => { this._lastAd = Date.now(); this._adOpen() },
          onClose: () => this._adEnd(),
          onError: () => this._adEnd(),
        },
      })
    } catch (e) { this._adEnd() }
  }

  // Лидерборды.
  submitScore(value, name = LEADERBOARD) {
    if (!this.available || !this.lb) return
    try { this.lb.setLeaderboardScore(name, Math.max(0, Math.floor(value))) } catch (e) { /* */ }
  }
  async getEntries(name = LEADERBOARD) {
    if (!this.available || !this.lb) return null
    try {
      return await this.lb.getLeaderboardEntries(name, { quantityTop: 10, includeUser: true, quantityAround: 3 })
    } catch (e) { return null }
  }
}

export const Platform = new YandexPlatform()
