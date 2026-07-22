// Обёртка над Яндекс.Играми SDK с мягким откатом.
// Локально (без SDK) всё работает: реклама сразу даёт награду, сейв идёт в
// localStorage (через GameState), лидерборды — заглушка. На Яндексе —
// облачные сейвы, реклама, таблицы рекордов.

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
  // Локально (без SDK) — сразу выдаём награду.
  showRewarded(onReward, onClose) {
    let settled = false
    const reward = () => { if (settled) return; settled = true; try { onReward && onReward() } catch (e) { /* */ } }
    const closed = () => { try { onClose && onClose() } catch (e) { /* */ } }
    if (!this.available || !this.ya?.adv) { reward(); closed(); return }
    this.gameplayStop()
    try {
      this.ya.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => reward(),
          // Досмотрели/закрыли: не наказываем игрока — если награды не было, выдаём.
          onClose: () => { this.gameplayStart(); reward(); closed() },
          onError: () => { this.gameplayStart(); reward(); closed() },
        },
      })
    } catch (e) { this.gameplayStart(); reward(); closed() }
  }

  // Межстраничная реклама. Клиентский троттлинг ≥75с (Яндекс требует ≥60с и
  // не одобряет частый показ; зоны могут сменяться чаще). Пауза геймплея.
  showInterstitial() {
    if (!this.available || !this.ya?.adv) return
    const now = Date.now()
    if (now - this._lastAd < 75000) return
    this._lastAd = now
    this.gameplayStop()
    try {
      this.ya.adv.showFullscreenAdv({
        callbacks: { onClose: () => this.gameplayStart(), onError: () => this.gameplayStart() },
      })
    } catch (e) { this.gameplayStart() }
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
