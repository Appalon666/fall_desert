// Обёртка над Яндекс.Играми SDK с мягким откатом.
// Локально (без SDK) всё работает: реклама сразу даёт награду, сейв идёт в
// localStorage (через GameState), лидерборды — заглушка. На Яндексе —
// облачные сейвы, реклама, таблицы рекордов.

import { Pause, PAUSE } from '../util/pause.js'

// Технический id таблицы рекордов. Должен совпадать с тем, что заведён в
// личном кабинете Яндекса (чек-лист в dock/README.md): пока таблицы с этим id
// нет, setLeaderboardScore молча ничего не делает.
export const LEADERBOARD = 'kills'

// Клиентский троттлинг межстраничной. Яндекс требует ≥60 с между показами и не
// одобряет частый показ — берём с запасом. Вынесены в константы, потому что по
// ним же сцена решает, рисовать ли предупреждение (см. interstitialReady).
const AD_MIN_GAP = 75000  // между СОСТОЯВШИМИСЯ показами
const AD_TRY_GAP = 20000  // между ПОПЫТКАМИ (показа могло и не быть — нет инвентаря)

class YandexPlatform {
  constructor() {
    this.available = false
    this.ya = null
    this.player = null
    this.lb = null
    this._initP = null
    this._pendingScore = undefined // рекорд, ждущий готовности SDK (см. submitScore)
    this._lastCloud = 0
    this._lastAd = Date.now() // не показываем межстраничную сразу после загрузки
    this._reviewAsked = false // оценку игры платформа разрешает просить раз за сессию
    this._reviewSent = false
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
      this.lb = await this._resolveLeaderboards()
      // Догоняем вызовы, сделанные до готовности SDK (см. _flushPlatformState).
      this._flushPlatformState()
      this._flushScore() // и рекорд, если игрок успел закончить вылазку раньше
      return true
    } catch (e) {
      this.available = false
      return false
    }
  }

  // ЭТО МЕСТО И ЛОМАЛО ТАБЛИЦУ. У SDK две несовместимые версии API лидербордов,
  // и различаются они не только способом получения объекта, но и ИМЕНАМИ МЕТОДОВ:
  //
  //   ysdk.leaderboards        (новый)  → setScore / getEntries
  //   ysdk.getLeaderboards()   (старый) → setLeaderboardScore / getLeaderboardEntries
  //
  // Раньше здесь стояло `this.ya.leaderboards || await this.ya.getLeaderboards()`,
  // а вызывались на результате СТАРЫЕ имена. Свойство ysdk.leaderboards истинное,
  // поэтому забиралось всегда — и каждый вызов падал в TypeError, который молча
  // съедался catch'ем: рекорд не отправлялся, таблица приходила как «недоступна».
  // Снаружи это выглядело как «лидерборда нет», хотя он был заведён правильно.
  //
  // Старый метод вдобавок объявлен устаревшим и сыплет ошибкой в консоль, поэтому
  // новый API пробуем первым. Наружу отдаём свой маленький переходник с
  // постоянными именами — остальному коду знать про версии SDK незачем.
  _wrapLeaderboards(o) {
    if (!o) return null
    if (typeof o.setScore === 'function' && typeof o.getEntries === 'function') {
      return { setScore: (n, s) => o.setScore(n, s), getEntries: (n, q) => o.getEntries(n, q) }
    }
    if (typeof o.setLeaderboardScore === 'function' && typeof o.getLeaderboardEntries === 'function') {
      return { setScore: (n, s) => o.setLeaderboardScore(n, s), getEntries: (n, q) => o.getLeaderboardEntries(n, q) }
    }
    return null
  }

  async _resolveLeaderboards() {
    const candidates = [
      // Свойство может оказаться «тенабельным» — тогда дожидаемся значения.
      async () => { const o = this.ya.leaderboards; return (o && typeof o.then === 'function') ? await o : o },
      async () => await this.ya.getLeaderboards(),
    ]
    for (const get of candidates) {
      try {
        const lb = this._wrapLeaderboards(await get())
        if (lb) return lb
      } catch (e) { /* пробуем следующий путь */ }
    }
    return null
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

  // Пауза на время ролика и два сторожа против вечной паузы:
  //    15 с — ролик так и не открылся (SDK не прислал ни одного колбэка);
  //     3 мин — ролик открылся и не закрылся (не пришли ни onClose, ни onError).
  // Сроки намеренно большие: снять паузу раньше, чем реклама успела открыться,
  // хуже — тогда под роликом заиграет музыка (нарушение п.4.7). Но не «никогда»:
  // висящая пауза для игрока неотличима от зависшей игры (п.1.14).
  //
  // onStuck — что сделать, если сторож всё-таки сработал. Через него вызвавшая
  // сторона узнаёт, что показа не было: rewarded не выдаст награду, а переход,
  // который ждал конца ролика, всё же состоится.
  _adStart(onStuck = null) {
    this._adBusy = true
    this._adStuck = onStuck
    Pause.add(PAUSE.AD)
    this._adOpened = false // хвост от прошлого показа не должен глушить сторожа
    this._clearAdGuards()
    this._adGuard = setTimeout(() => { if (!this._adOpened) this._adGiveUp() }, 15000)
  }
  _adOpen() {
    this._adOpened = true
    if (this._adGuard) { clearTimeout(this._adGuard); this._adGuard = null }
    Pause.add(PAUSE.AD) // на случай, если ролик стартовал без нашего _adStart
    // Старый сторож снимаем обязательно: SDK может прислать onOpen дважды за
    // один показ, и тогда первый таймер стал бы недосягаем для _clearAdGuards —
    // сработал бы посреди СЛЕДУЮЩЕГО ролика и вернул музыку прямо под ним.
    if (this._adHard) clearTimeout(this._adHard)
    this._adHard = setTimeout(() => this._adGiveUp(), 180000)
  }
  // Сдаёмся: снимаем паузу и сообщаем об этом тому, кто показ заказывал.
  _adGiveUp() {
    const stuck = this._adStuck
    this._adEnd()
    try { if (stuck) stuck() } catch (e) { /* */ }
  }
  _adEnd() {
    this._adBusy = false
    this._adOpened = false
    this._adStuck = null
    this._clearAdGuards()
    Pause.remove(PAUSE.AD)
  }
  _clearAdGuards() {
    if (this._adGuard) { clearTimeout(this._adGuard); this._adGuard = null }
    if (this._adHard) { clearTimeout(this._adHard); this._adHard = null }
  }

  // СТРАХОВКА ОТ ВЕЧНОЙ ПАУЗЫ. Сторож в _adStart снимается по onOpen, поэтому
  // ролик, который открылся и не прислал ни onClose, ни onError, оставлял игру
  // на паузе навсегда: экран живой, кнопки мёртвые. Именно так «зависало» окно
  // «Как играть» — оно открывается сразу за кнопкой rewarded.
  //
  // Ролик показывается поверх страницы и забирает себе весь ввод, поэтому
  // настоящий клик или нажатие клавиши В ИГРЕ означает, что рекламы на экране
  // уже нет. Снимаем паузу, чего бы там ни намолчал SDK.
  //
  // Окно оценки — ровно та же история: оно тоже рисуется платформой поверх игры
  // и тоже держит паузу до своего промиса. Если этот промис не придёт никогда,
  // без этой страховки игра осталась бы стоять.
  wakeFromStuckAd() {
    if (Pause.has(PAUSE.REVIEW)) Pause.remove(PAUSE.REVIEW)
    if (!Pause.has(PAUSE.AD)) return
    // ТОЛЬКО про уже ОТКРЫТЫЙ ролик. Между нажатием кнопки и onOpen проходит от
    // сотен миллисекунд до секунд — игра в это время уже стоит (паузу берём до
    // вызова SDK, иначе музыка успеет заиграть под роликом). Экран замер, и
    // игрок жмёт ещё раз — вот этот второй тап и приходит сюда. Если сдаться на
    // нём, показ считается несостоявшимся: ролик потом откроется, честно
    // прокрутится до конца, а награда уже никому не достанется («settled»).
    // Случай «ролик так и не открылся» закрывает сторож на 15 секунд.
    if (!this._adOpened) return
    // Ролик открылся и молчит: показа фактически нет, и вызвавшая сторона должна
    // это узнать — иначе переход, ждавший конца ролика, не состоится никогда.
    this._adGiveUp()
  }

  // На платформе игра всегда живёт в iframe Яндекса. Вне его (localhost,
  // прямое открытие) SDK подгружается и available=true, но реклама работать
  // не может: postMessage слать некому («No parent to post message»), колбэки
  // onOpen/onClose/onError не приходят — и пауза, взятая в _adStart ДО показа,
  // висела до 15-секундного сторожа. Выглядело как зависание на смене зоны.
  _embedded() { try { return window.self !== window.top } catch (e) { return true } }

  // Реклама за награду (Яндекс 4.5).
  //
  // ГЛАВНОЕ ПРАВИЛО: награду выдаёт ТОЛЬКО колбэк onRewarded самого SDK. Раньше
  // здесь стояло «не наказываем игрока — если награды не было, выдаём», и
  // onClose выдавал приз даже когда ролик закрывали на первой секунде. Для
  // игрока это значило, что смотреть рекламу незачем, а для платформы — прямое
  // нарушение п.4.5 (награда при отказе от просмотра), с которым игра и
  // вернулась с модерации.
  //
  // Ровно один из колбэков срабатывает всегда: onReward — досмотрел; onFail — во
  // всех остальных случаях (закрыл раньше, ошибка показа, ролик не открылся,
  // сработал сторож). onFail нужен, чтобы экран объяснил игроку, почему награды
  // нет, — иначе кнопка выглядит сломанной.
  //
  // Награду отдаём после _adEnd(), уже без паузы: всплывашки и твины, созданные
  // под роликом, стояли бы неподвижно до его конца.
  showRewarded(onReward, onFail) {
    let settled = false
    let rewarded = false
    // Один показ за раз. Сторожа и флаги показа в Platform одни на всех, и
    // второй вызов затёр бы их у первого — тот остался бы вообще без развязки:
    // ни награды, ни отказа, кнопка молча ничего не делает.
    if (this._adBusy) { try { if (onFail) onFail() } catch (e) { /* */ } return }
    const fire = (fn) => { if (settled) return; settled = true; try { if (fn) fn() } catch (e) { /* */ } }
    const finish = () => { this._adEnd(); fire(rewarded ? onReward : onFail) }
    // Вне iframe платформы (localhost, dist открытый файлом) рекламы нет вовсе:
    // postMessage слать некому, колбэки не придут. Это режим разработки — награду
    // выдаём сразу, чтобы экраны можно было проверять. На Яндексе игра всегда в
    // iframe, так что сюда там не попасть.
    if (!this._embedded()) { fire(onReward); return }
    // В iframe, но SDK нет (не загрузился, вырезан блокировщиком): показать
    // рекламу нечем — значит, и награды нет.
    if (!this.available || !this.ya?.adv) { fire(onFail); return }
    this._adStart(() => fire(onFail))
    try {
      this.ya.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => this._adOpen(),
          onRewarded: () => { rewarded = true },
          onClose: finish,
          onError: finish,
        },
      })
    } catch (e) { finish() }
  }

  // Межстраничная реклама (Яндекс 4.4).
  //
  // ГДЕ ЕЁ ЗОВУТ. Игра — реалтайм с короткими локациями, а для такого случая
  // требование прямо запрещает показ по ИГРОВОМУ действию: ролик уместен только
  // на неигровом. Поэтому точка вызова одна — выход из вылазки в лагерь, то есть
  // переход в меню. Раньше реклама висела на кнопках «идти дальше» и «смириться
  // и продолжить»: обе продолжают геймплей, и именно за это игра вернулась с
  // модерации по п.4.4.
  //
  // onDone вызывается РОВНО один раз и всегда: после закрытия ролика, сразу же
  // при отказе от показа (троттл, нет SDK) и по сторожу, если SDK замолчал.
  // Через него сцена делает переход — экран сменяется после рекламы, а не под ней.
  //
  // Клиентский троттлинг — см. AD_MIN_GAP / AD_TRY_GAP.
  //
  // ПРЕДУПРЕЖДЕНИЕ. Игрок в отзыве: «появление рекламы в кликере без
  // предупреждения». Ролик и правда стартовал молча — экран боя просто сменялся
  // рекламой. Плашку рисует сцена (Phaser здесь недоступен), но решать, показывать
  // ли её, должна платформа: иначе предупреждение мигало бы на каждом выходе в
  // лагерь, даже когда рекламы не будет — а не будет её чаще, чем будет (троттл
  // 75 с при вылазке в пару минут).
  interstitialReady() {
    if (!this.available || !this.ya?.adv || !this._embedded()) return false
    if (this._adBusy) return false
    const now = Date.now()
    if (now - this._lastAd < AD_MIN_GAP) return false
    if (now - (this._lastAdTry || 0) < AD_TRY_GAP) return false
    return true
  }

  showInterstitial(onDone = null) {
    let settled = false
    const done = () => { if (settled) return; settled = true; try { if (onDone) onDone() } catch (e) { /* */ } }
    // Показ уже идёт — второй не начинаем и onDone НЕ зовём: переход принадлежит
    // первому вызову, он его и сделает, когда ролик закроется. Позвать done()
    // здесь значило бы открыть лагерь прямо под работающей рекламой (п.4.7).
    // Проверка идёт ПЕРВОЙ и отдельно от interstitialReady: тот на занятую
    // рекламу отвечает тем же false, а развязка здесь принципиально другая.
    if (this._adBusy) return
    if (!this.interstitialReady()) { done(); return }
    this._lastAdTry = Date.now()
    // Глушим звук и геймплей ДО вызова: ролик может стартовать раньше onOpen.
    this._adStart(done)
    try {
      this.ya.adv.showFullscreenAdv({
        callbacks: {
          // Троттл сбрасываем только когда реклама реально открылась (onOpen).
          onOpen: () => { this._lastAd = Date.now(); this._adOpen() },
          onClose: () => { this._adEnd(); done() },
          onError: () => { this._adEnd(); done() },
        },
      })
    } catch (e) { this._adEnd(); done() }
  }

  // ---------------- Оценка игры ----------------
  //
  // ysdk.feedback: canReview() → { value, reason }, requestReview() → { feedbackSent }.
  // Два жёстких правила платформы, из-за которых все точки вызова в игре сходятся
  // в этот шлюз, а не дёргают SDK сами:
  //   1) requestReview ТОЛЬКО после canReview — иначе SDK отвечает ошибкой
  //      «use canReview before requestReview»;
  //   2) не чаще одного запроса за сессию.
  // Причины отказа (reason): NO_AUTH, GAME_RATED, REVIEW_ALREADY_REQUESTED,
  // REVIEW_WAS_REQUESTED, UNKNOWN — игре они нужны только для понимания «нельзя»,
  // поэтому наружу отдаём их как есть и нигде не разбираем.

  // Можно ли сейчас просить оценку. Никогда не бросает: экран лагеря по этому
  // ответу решает, показывать ли кнопку «оценить».
  async canReview() {
    // Свой запрос за сессию мы уже потратили — SDK ответил бы тем же
    // REVIEW_ALREADY_REQUESTED, но лишний раз ходить в него незачем.
    if (this._reviewAsked) return { value: false, reason: 'REVIEW_ALREADY_REQUESTED' }
    const fb = this.ya?.feedback
    if (!this.available || typeof fb?.canReview !== 'function') return { value: false, reason: 'UNKNOWN' }
    try {
      const r = await fb.canReview()
      return { value: !!r?.value, reason: r?.reason || '' }
    } catch (e) { return { value: false, reason: 'UNKNOWN' } }
  }

  // Показать окно оценки. Возвращает true, если окно РЕАЛЬНО открыли, — по этому
  // ответу вызывающая сторона решает, отдавать ли момент межстраничной рекламе.
  async requestReview() {
    if (this._reviewAsked) return false
    // Поверх рекламного ролика окно не лепим: он и так забрал себе весь экран.
    if (Pause.has(PAUSE.AD)) return false
    const { value } = await this.canReview()
    if (!value) return false
    this._reviewAsked = true // ровно один запрос за сессию, даже если ниже упадём
    // Яндекс 4.7: пока поверх игры висит окно платформы, игра не идёт и молчит.
    Pause.add(PAUSE.REVIEW)
    // Тот же сторож, что у рекламы (п.1.14): если промис SDK не придёт никогда,
    // снимать паузу будет некому, и для игрока игра просто зависнет.
    const guard = setTimeout(() => Pause.remove(PAUSE.REVIEW), 60000)
    let opened = true
    try {
      const r = await this.ya.feedback.requestReview()
      // В документации поле называется feedbackSent, а в примере кода на той же
      // странице — sentFeedback. Читаем оба: игре важно лишь, оценил игрок или
      // просто закрыл окно.
      this._reviewSent = !!(r && (r.feedbackSent ?? r.sentFeedback))
    } catch (e) {
      // Окно не открылось — момент свободен, пусть его займёт реклама.
      opened = false
      this._reviewSent = false
    } finally {
      clearTimeout(guard)
      Pause.remove(PAUSE.REVIEW)
    }
    return opened
  }

  // Лидерборды.
  //
  // Рекорд отправляется в двух местах — по смерти героя и по кнопке «В лагерь»
  // (BattleScene). Оба момента могут прийтись на время, когда SDK ещё не доехал:
  // тогда таблицы (this.lb) просто нет, и рекорд ПРОПАДАЛ насовсем — до
  // следующего конца вылазки. Поэтому запоминаем лучшее значение и досылаем его,
  // когда SDK готов (тот же приём, что в _flushPlatformState для LoadingAPI).
  submitScore(value, name = LEADERBOARD) {
    const score = Math.floor(value)
    // NaN/Infinity из битого сейва SDK отвергает, и вместе с ними теряется
    // вообще вся отправка. Числа держим конечными, как и везде в игре.
    if (!Number.isFinite(score) || score < 0) return
    const prev = this._pendingScore
    this._pendingScore = prev === undefined ? score : Math.max(prev, score)
    this._pendingName = name
    return this._flushScore()
  }

  // Возвращает промис отправки — экран рекордов ждёт его, чтобы прочитать
  // таблицу уже со своим результатом, а не на кадр раньше.
  _flushScore() {
    if (this._pendingScore === undefined) return Promise.resolve()
    if (!this.available || !this.lb) return Promise.resolve() // SDK не готов — досылаем из _doInit
    const score = this._pendingScore
    const name = this._pendingName || LEADERBOARD
    this._pendingScore = undefined
    // setLeaderboardScore возвращает ПРОМИС. Прежний try/catch ловил только
    // синхронный бросок, а настоящий отказ (нет таблицы с таким id, игрок не
    // авторизован, сеть) приходил отклонением промиса — мимо catch, в
    // unhandled rejection. Отправка могла падать каждый раз, и снаружи это
    // выглядело просто как «рекорд не появился».
    try {
      const p = this.lb.setScore(name, score)
      return (p && typeof p.catch === 'function')
        ? p.catch(() => { /* таблица недоступна */ })
        : Promise.resolve()
    } catch (e) { return Promise.resolve() }
  }
  async getEntries(name = LEADERBOARD) {
    if (!this.available || !this.lb) return null
    try {
      return await this.lb.getEntries(name, { quantityTop: 10, includeUser: true, quantityAround: 3 })
    } catch (e) { return null }
  }
}

export const Platform = new YandexPlatform()
