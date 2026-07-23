// Обёртка над Яндекс.Играми SDK с мягким откатом.
// Локально (без SDK) всё работает: реклама сразу даёт награду, сейв идёт в
// localStorage (через GameState), лидерборды — заглушка. На Яндексе —
// облачные сейвы, реклама, таблицы рекордов.

import { Sfx } from '../audio/sfx.js'

export const LEADERBOARD = 'Leaderboard'

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
      await this._loadScript('https://yandex.ru/games/sdk/v2?days=180')
      if (!window.YaGames) return false
      this.ya = await window.YaGames.init()
      this.available = true
      try { this.player = await this.ya.getPlayer({ scopes: false }) } catch (e) { this.player = null }
      try { this.lb = await this.ya.getLeaderboards() } catch (e) { this.lb = null }
      return true
    } catch (e) {
      this.available = false
      return false
    }
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
  ready() { try { this.ya?.features?.LoadingAPI?.ready() } catch (e) { /* */ } }
  gameplayStart() { try { this.ya?.features?.GameplayAPI?.start() } catch (e) { /* */ } }
  gameplayStop() { try { this.ya?.features?.GameplayAPI?.stop() } catch (e) { /* */ } }

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

  // Реклама за награду. Гарантирует РОВНО один вызов onReward (успех/ошибка),
  // ставит геймплей на паузу на время ролика и всегда снимает её в onClose.
  // Ссылка на Phaser.Game — чтобы паузить активные сцены на время рекламы
  // (Яндекс 4.7: и звук, и игровой процесс должны стоять под fullscreen-рекламой).
  attachGame(game) { this.game = game }
  _pauseGame() {
    try {
      Sfx.suspend()
      if (!this.game) return
      this._paused = this.game.scene.getScenes(true)
      for (const s of this._paused) s.scene.pause()
    } catch (e) { /* */ }
  }
  _resumeGame() {
    try {
      Sfx.resume()
      if (this._paused) { for (const s of this._paused) s.scene.resume() }
    } catch (e) { /* */ }
    this._paused = null
  }

  // Локально (без SDK) — сразу выдаём награду.
  showRewarded(onReward, onClose) {
    let settled = false
    const reward = () => { if (settled) return; settled = true; try { onReward && onReward() } catch (e) { /* */ } }
    const closed = () => { try { onClose && onClose() } catch (e) { /* */ } }
    if (!this.available || !this.ya?.adv) { reward(); closed(); return }
    this.gameplayStop(); this._pauseGame()
    try {
      this.ya.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => reward(),
          // Досмотрели/закрыли: не наказываем игрока — если награды не было, выдаём.
          onClose: () => { this._resumeGame(); this.gameplayStart(); reward(); closed() },
          onError: () => { this._resumeGame(); this.gameplayStart(); reward(); closed() },
        },
      })
    } catch (e) { this._resumeGame(); this.gameplayStart(); reward(); closed() }
  }

  // Межстраничная реклама. Клиентский троттлинг ≥75с (Яндекс требует ≥60с и
  // не одобряет частый показ; зоны могут сменяться чаще). Пауза геймплея.
  showInterstitial() {
    if (!this.available || !this.ya?.adv) return
    const now = Date.now()
    if (now - this._lastAd < 75000) return
    try {
      this.ya.adv.showFullscreenAdv({
        callbacks: {
          // Троттл сбрасываем только когда реклама реально открылась (onOpen).
          onOpen: () => { this._lastAd = Date.now(); this.gameplayStop(); this._pauseGame() },
          onClose: () => { this._resumeGame(); this.gameplayStart() },
          onError: () => { this._resumeGame(); this.gameplayStart() },
        },
      })
    } catch (e) { this._resumeGame(); this.gameplayStart() }
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
