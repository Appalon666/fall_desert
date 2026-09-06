// Реклама: rewarded и межстраничная.
//
// Зачем этот файл. Ровно на этих двух местах игра вернулась с модерации:
//   п.4.5 — награда начислялась при ОТКАЗЕ от просмотра: onClose выдавал приз,
//           даже если ролик закрыли на первой секунде;
//   п.4.4 — межстраничная висела на игровых действиях («идти дальше»,
//           «смириться и продолжить»), а в реалтайм-игре с короткими локациями
//           показ по игровому действию запрещён.
// Оба правила легко вернуть назад одной строчкой, поэтому они здесь под замком.
//
// Третья опасность та же, что у окна оценки, — вечная пауза: если SDK не
// пришлёт ни одного колбэка, снимать PAUSE.AD будет некому, и для игрока это
// неотличимо от зависшей игры (п.1.14).
//
// SDK подменяем заглушкой: Platform не тянет ни Phaser, ни сеть.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { Platform } from '../src/platform/yandex.js'
import { Pause, PAUSE } from '../src/util/pause.js'

// Заглушка ysdk.adv: запоминает колбэки, чтобы тест сам решал, что «прислал» SDK.
function adv() {
  const cb = {}
  return {
    cb,
    adv: {
      showRewardedVideo({ callbacks }) { cb.rewarded = callbacks },
      showFullscreenAdv({ callbacks }) { cb.full = callbacks },
    },
  }
}

// Platform и Pause — синглтоны: между тестами возвращаем их в исходное состояние.
beforeEach(() => {
  Platform.available = true
  Platform.ya = null
  Platform._lastAd = 0
  Platform._lastAdTry = 0
  Platform._embedded = () => true // на платформе игра всегда в iframe
  // Сбрасываем незакрытый показ от предыдущего теста: Platform — синглтон, и
  // флаг «идёт реклама» иначе протёк бы в следующий тест.
  Platform._adEnd()
  for (const r of [...Pause.reasons]) Pause.remove(r)
})
afterEach(() => {
  delete Platform._embedded
  vi.useRealTimers()
})

describe('rewarded: награда только за досмотренный ролик (п.4.5)', () => {
  it('onRewarded → награда', () => {
    const raw = adv(); Platform.ya = raw
    const got = []
    Platform.showRewarded(() => got.push('reward'), () => got.push('fail'))
    raw.cb.rewarded.onOpen()
    raw.cb.rewarded.onRewarded()
    raw.cb.rewarded.onClose()
    expect(got).toEqual(['reward'])
  })

  // Ровно тот случай, из-за которого игру сняли: игрок закрыл ролик, не досмотрев.
  it('закрыли, не досмотрев → награды НЕТ', () => {
    const raw = adv(); Platform.ya = raw
    const got = []
    Platform.showRewarded(() => got.push('reward'), () => got.push('fail'))
    raw.cb.rewarded.onOpen()
    raw.cb.rewarded.onClose()
    expect(got).toEqual(['fail'])
  })

  it('ошибка показа → награды нет', () => {
    const raw = adv(); Platform.ya = raw
    const got = []
    Platform.showRewarded(() => got.push('reward'), () => got.push('fail'))
    raw.cb.rewarded.onError(new Error('нет инвентаря'))
    expect(got).toEqual(['fail'])
  })

  it('колбэк срабатывает ровно один раз, что бы SDK ни прислал', () => {
    const raw = adv(); Platform.ya = raw
    const got = []
    Platform.showRewarded(() => got.push('reward'), () => got.push('fail'))
    raw.cb.rewarded.onOpen()
    raw.cb.rewarded.onRewarded()
    raw.cb.rewarded.onClose()
    raw.cb.rewarded.onClose() // повтор от SDK
    raw.cb.rewarded.onError() // и ошибка следом
    expect(got).toEqual(['reward'])
  })

  it('в iframe без SDK награды нет (блокировщик, скрипт не загрузился)', () => {
    Platform.available = false
    const got = []
    Platform.showRewarded(() => got.push('reward'), () => got.push('fail'))
    expect(got).toEqual(['fail'])
    expect(Pause.paused).toBe(false) // и паузу при этом не берём
  })

  // Локальный запуск: рекламы нет вовсе, иначе экраны нечем было бы проверять.
  // На Яндексе игра всегда внутри iframe, так что сюда там не попасть.
  it('вне iframe (локально) награда выдаётся сразу', () => {
    Platform._embedded = () => false
    const got = []
    Platform.showRewarded(() => got.push('reward'), () => got.push('fail'))
    expect(got).toEqual(['reward'])
  })
})

describe('rewarded: пауза не залипает (п.1.14 / 4.7)', () => {
  it('под роликом игра стоит, после закрытия — идёт', () => {
    const raw = adv(); Platform.ya = raw
    Platform.showRewarded(() => {}, () => {})
    expect(Pause.has(PAUSE.AD)).toBe(true)
    raw.cb.rewarded.onOpen()
    expect(Pause.has(PAUSE.AD)).toBe(true)
    raw.cb.rewarded.onClose()
    expect(Pause.paused).toBe(false)
  })

  it('SDK промолчал вовсе → сторож снимает паузу и сообщает об отказе', () => {
    vi.useFakeTimers()
    const raw = adv(); Platform.ya = raw
    const got = []
    Platform.showRewarded(() => got.push('reward'), () => got.push('fail'))
    expect(Pause.has(PAUSE.AD)).toBe(true)
    vi.advanceTimersByTime(15000) // ролик так и не открылся
    expect(Pause.paused).toBe(false)
    expect(got).toEqual(['fail'])
  })

  it('ролик открылся и не закрылся → второй сторож всё равно расклинит игру', () => {
    vi.useFakeTimers()
    const raw = adv(); Platform.ya = raw
    const got = []
    Platform.showRewarded(() => got.push('reward'), () => got.push('fail'))
    raw.cb.rewarded.onOpen()
    vi.advanceTimersByTime(15000) // короткий сторож снят по onOpen — пауза держится
    expect(Pause.has(PAUSE.AD)).toBe(true)
    vi.advanceTimersByTime(180000)
    expect(Pause.paused).toBe(false)
    expect(got).toEqual(['fail'])
  })

  // Между нажатием кнопки и onOpen игра УЖЕ стоит (паузу берём до вызова SDK,
  // иначе музыка заиграет под роликом), а экран замирает на секунду-две. Игрок
  // жмёт ещё раз — и раньше этот второй тап объявлял показ несостоявшимся:
  // ролик потом честно крутился до конца, а награда уже не доходила.
  it('тап ДО открытия ролика не отменяет ещё не начавшийся показ', () => {
    const raw = adv(); Platform.ya = raw
    const got = []
    Platform.showRewarded(() => got.push('reward'), () => got.push('fail'))
    Platform.wakeFromStuckAd() // игрок ткнул в замерший экран
    expect(got).toEqual([])     // ничего не решилось
    raw.cb.rewarded.onOpen()    // ролик всё-таки открылся…
    raw.cb.rewarded.onRewarded()
    raw.cb.rewarded.onClose()
    expect(got).toEqual(['reward']) // …и награда дошла
  })

  it('клик в игре при зависшем ролике снимает паузу и не дарит награду', () => {
    const raw = adv(); Platform.ya = raw
    const got = []
    Platform.showRewarded(() => got.push('reward'), () => got.push('fail'))
    raw.cb.rewarded.onOpen()
    Platform.wakeFromStuckAd() // реального ролика на экране нет — игрок кликнул
    expect(Pause.paused).toBe(false)
    expect(got).toEqual(['fail'])
  })
})

// Сторожа и флаги показа в Platform одни на всех: второй показ поверх первого
// затирал их, и первый оставался вообще без развязки — ни награды, ни отказа.
describe('два показа разом не наступают друг другу на ноги', () => {
  it('второй rewarded во время первого сразу отвечает отказом', () => {
    const raw = adv(); Platform.ya = raw
    const first = [], second = []
    Platform.showRewarded(() => first.push('reward'), () => first.push('fail'))
    raw.cb.rewarded.onOpen()
    Platform.showRewarded(() => second.push('reward'), () => second.push('fail'))
    expect(second).toEqual(['fail'])
    // и первый показ при этом цел: досмотр по-прежнему платит
    raw.cb.rewarded.onRewarded()
    raw.cb.rewarded.onClose()
    expect(first).toEqual(['reward'])
  })

  it('межстраничная во время ролика не начинается и переход не крадёт', () => {
    const raw = adv(); Platform.ya = raw
    let done = 0
    Platform.showRewarded(() => {}, () => {})
    raw.cb.rewarded.onOpen()
    Platform.showInterstitial(() => done++)
    expect(raw.cb.full).toBeUndefined() // второго показа нет
    expect(done).toBe(0)                // и лагерь под работающим роликом не открылся
  })
})

describe('межстраничная: переход ждёт конца ролика', () => {
  it('onDone вызывается после закрытия, ровно один раз', () => {
    const raw = adv(); Platform.ya = raw
    let done = 0
    Platform.showInterstitial(() => done++)
    expect(done).toBe(0) // переход не состоялся, пока идёт реклама
    raw.cb.full.onOpen()
    raw.cb.full.onClose()
    raw.cb.full.onClose() // повтор от SDK
    expect(done).toBe(1)
    expect(Pause.paused).toBe(false)
  })

  it('троттл ≥75 с: показа нет, но переход происходит сразу', () => {
    const raw = adv(); Platform.ya = raw
    Platform._lastAd = Date.now()
    let done = 0
    Platform.showInterstitial(() => done++)
    expect(done).toBe(1)
    expect(raw.cb.full).toBeUndefined() // до SDK дело не дошло
    expect(Pause.paused).toBe(false)
  })

  it('нет SDK → переход всё равно происходит', () => {
    Platform.available = false
    let done = 0
    Platform.showInterstitial(() => done++)
    expect(done).toBe(1)
  })

  it('SDK промолчал → сторож не оставляет игрока на боевом экране', () => {
    vi.useFakeTimers()
    const raw = adv(); Platform.ya = raw
    let done = 0
    Platform.showInterstitial(() => done++)
    expect(done).toBe(0)
    vi.advanceTimersByTime(15000)
    expect(done).toBe(1)
    expect(Pause.paused).toBe(false)
  })
})

// Отзыв игрока: «появление рекламы в кликере без предупреждения». Точка показа
// законная, но ролик стартовал молча. Плашку рисует сцена, а решает по этому
// предикату — иначе предупреждение висело бы и там, где рекламы не будет.
describe('предупреждение перед межстраничной', () => {
  it('готова к показу — при тех же условиях, при которых ролик реально пойдёт', () => {
    Platform.ya = adv()
    expect(Platform.interstitialReady()).toBe(true)
  })

  it('троттл показов и попыток гасит предупреждение вместе с рекламой', () => {
    Platform.ya = adv()
    Platform._lastAd = Date.now()
    expect(Platform.interstitialReady()).toBe(false)
    Platform._lastAd = 0
    Platform._lastAdTry = Date.now()
    expect(Platform.interstitialReady()).toBe(false)
  })

  it('без SDK и вне iframe платформы предупреждать не о чем', () => {
    Platform.ya = adv()
    Platform.available = false
    expect(Platform.interstitialReady()).toBe(false)
    Platform.available = true
    Platform._embedded = () => false
    expect(Platform.interstitialReady()).toBe(false)
  })

  it('во время идущего ролика — тоже false', () => {
    const raw = adv(); Platform.ya = raw
    Platform.showInterstitial(() => {})
    raw.cb.full.onOpen()
    expect(Platform.interstitialReady()).toBe(false)
  })

  it('предикат ничего не расходует: спросить можно, не сжигая троттл попыток', () => {
    Platform.ya = adv()
    Platform._lastAdTry = 0
    for (let i = 0; i < 5; i++) expect(Platform.interstitialReady()).toBe(true)
    expect(Platform._lastAdTry).toBe(0) // счётчик попыток двигает только сам показ
  })
})

// Требование 4.4 живёт не в platform, а в том, ОТКУДА рекламу зовут, — поэтому
// проверяем исходники сцен (тот же приём, что в ui-copy.test.js: сцены тянут за
// собой Phaser, а нам нужен текст, а не поведение).
describe('межстраничная зовётся только с неигрового действия (п.4.4)', () => {
  const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
  const scenes = ['BattleScene', 'HubScene', 'ShopScene', 'InventoryScene', 'HeroScene',
    'PrestigeScene', 'LeaderboardScene', 'ForgeScene', 'ClassSelectScene', 'BootScene']

  it('во всей игре ровно одна точка вызова', () => {
    const found = scenes.flatMap((n) => {
      const code = src(`../src/scenes/${n}.js`)
      return [...code.matchAll(/Platform\.showInterstitial\(/g)].map(() => n)
    })
    expect(found).toEqual(['BattleScene'])
  })

  it('и она — на кнопке выхода в лагерь, а не на продолжении боя', () => {
    const code = src('../src/scenes/BattleScene.js')
    // Обработчик кнопки «В лагерь»: от её label до конца onClick.
    const btn = code.slice(code.indexOf("label: t('⟵ В лагерь')"))
    expect(btn.slice(0, 600)).toContain('Platform.showInterstitial(')
    // А на кнопках, которые продолжают забег, рекламы быть не должно.
    for (const label of ["label: t('Идти дальше ⟶')", "label: t('Смириться и продолжить')"]) {
      const at = code.indexOf(label)
      expect(at, label).toBeGreaterThan(-1)
      expect(code.slice(at, at + 600), label).not.toContain('showInterstitial')
    }
  })
  it('перед роликом сцена показывает плашку, а бой на это время стоит', () => {
    const code = src('../src/scenes/BattleScene.js')
    const btn = code.slice(code.indexOf("label: t('⟵ В лагерь')"), code.indexOf("label: t('⟵ В лагерь')") + 900)
    expect(btn).toContain('Platform.interstitialReady()')
    expect(btn).toContain('this.showAdNotice(')
    // update обязан считать плашку такой же остановкой боя, как окна зоны и
    // смерти: иначе героя били бы все две секунды отсчёта.
    const upd = code.slice(code.indexOf('update(time, delta)'))
    expect(upd.slice(0, 1600)).toContain('this._adNotice')
  })
})
