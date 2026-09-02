// Оценка игры через ysdk.feedback.
//
// Что здесь стережётся. У платформы два жёстких правила: requestReview можно
// звать ТОЛЬКО после canReview (иначе SDK отвечает «use canReview before
// requestReview») и не чаще одного раза за сессию. В игре три точки, откуда
// оценку просят — взятая локация, новый рекорд и кнопка в лагере, — и все они
// ходят через один шлюз Platform, иначе второе же срабатывание съело бы запрос
// впустую или получило ошибку.
//
// Третья опасность — вечная пауза: под окном оценки игра стоит (Яндекс 4.7), и
// если промис SDK не придёт, снимать паузу будет некому.
//
// Сам SDK подменяем заглушкой — Platform не тянет ни Phaser, ни сеть.
import { describe, it, expect, beforeEach } from 'vitest'
import { Platform } from '../src/platform/yandex.js'
import { Pause, PAUSE } from '../src/util/pause.js'
import { GameState, REVIEW_MIN_ZONE } from '../src/state/GameState.js'

// Заглушка ysdk.feedback. can — что вернёт canReview, req — что вернёт
// requestReview (или Error, который надо бросить).
function sdk(can, req = { feedbackSent: true }) {
  const calls = []
  return {
    calls,
    feedback: {
      canReview() { calls.push('canReview'); return Promise.resolve(can) },
      requestReview() {
        calls.push('requestReview')
        return req instanceof Error ? Promise.reject(req) : Promise.resolve(req)
      },
    },
  }
}
function attach(raw) {
  Platform.available = true
  Platform.ya = raw
  return raw
}

// Platform и Pause — синглтоны: между тестами возвращаем их в исходное состояние.
beforeEach(() => {
  Platform.available = false
  Platform.ya = null
  Platform._reviewAsked = false
  Platform._reviewSent = false
  for (const r of [...Pause.reasons]) Pause.remove(r)
})

describe('canReview', () => {
  it('без SDK отвечает «нельзя», а не падает', async () => {
    expect(await Platform.canReview()).toEqual({ value: false, reason: 'UNKNOWN' })
  })

  it('старый SDK без feedback тоже даёт «нельзя»', async () => {
    attach({ adv: {} })
    expect((await Platform.canReview()).value).toBe(false)
  })

  it('пропускает разрешение платформы', async () => {
    attach(sdk({ value: true }))
    expect((await Platform.canReview()).value).toBe(true)
  })

  it('отдаёт причину отказа как есть', async () => {
    attach(sdk({ value: false, reason: 'NO_AUTH' }))
    expect(await Platform.canReview()).toEqual({ value: false, reason: 'NO_AUTH' })
  })

  it('падение SDK не всплывает наружу', async () => {
    attach({ feedback: { canReview: () => Promise.reject(new Error('платформа прилегла')) } })
    expect(await Platform.canReview()).toEqual({ value: false, reason: 'UNKNOWN' })
  })
})

describe('requestReview зовётся только после canReview', () => {
  it('порядок вызовов именно такой', async () => {
    const raw = attach(sdk({ value: true }))
    await Platform.requestReview()
    expect(raw.calls).toEqual(['canReview', 'requestReview'])
  })

  it('запрет платформы означает, что requestReview не трогаем вовсе', async () => {
    const raw = attach(sdk({ value: false, reason: 'GAME_RATED' }))
    expect(await Platform.requestReview()).toBe(false)
    expect(raw.calls).toEqual(['canReview'])
  })
})

describe('один запрос за сессию', () => {
  it('второй вызов до SDK не доходит', async () => {
    const raw = attach(sdk({ value: true }))
    expect(await Platform.requestReview()).toBe(true)
    expect(await Platform.requestReview()).toBe(false)
    expect(raw.calls).toEqual(['canReview', 'requestReview'])
  })

  it('потраченный запрос виден и через canReview — кнопка в лагере погаснет', async () => {
    attach(sdk({ value: true }))
    await Platform.requestReview()
    expect(await Platform.canReview()).toEqual({ value: false, reason: 'REVIEW_ALREADY_REQUESTED' })
  })

  it('запрос считается потраченным, даже если SDK потом упал', async () => {
    const raw = attach(sdk({ value: true }, new Error('окно не открылось')))
    expect(await Platform.requestReview()).toBe(false)
    expect(await Platform.requestReview()).toBe(false)
    expect(raw.calls).toEqual(['canReview', 'requestReview'])
  })
})

describe('пауза под окном оценки', () => {
  it('на время окна игра стоит, после — идёт', async () => {
    let pausedInside = null
    attach({
      feedback: {
        canReview: () => Promise.resolve({ value: true }),
        requestReview: () => { pausedInside = Pause.has(PAUSE.REVIEW); return Promise.resolve({ feedbackSent: true }) },
      },
    })
    await Platform.requestReview()
    expect(pausedInside).toBe(true)
    expect(Pause.has(PAUSE.REVIEW)).toBe(false)
  })

  it('падение SDK не оставляет игру на паузе', async () => {
    attach(sdk({ value: true }, new Error('окно не открылось')))
    await Platform.requestReview()
    expect(Pause.paused).toBe(false)
  })

  it('поверх рекламного ролика окно не показываем', async () => {
    const raw = attach(sdk({ value: true }))
    Pause.add(PAUSE.AD)
    expect(await Platform.requestReview()).toBe(false)
    expect(raw.calls).toEqual([]) // до canReview дело не дошло
  })

  it('клик в игре снимает зависшую паузу окна (та же страховка, что для рекламы)', () => {
    Pause.add(PAUSE.REVIEW)
    Platform.wakeFromStuckAd()
    expect(Pause.paused).toBe(false)
  })
})

describe('результат оценки', () => {
  it('читается поле feedbackSent (как в документации)', async () => {
    attach(sdk({ value: true }, { feedbackSent: true }))
    await Platform.requestReview()
    expect(Platform._reviewSent).toBe(true)
  })

  // На той же странице документации метод описан с полем feedbackSent, а в
  // примере кода читается sentFeedback. Понимаем оба имени.
  it('читается и поле sentFeedback (как в примере кода)', async () => {
    attach(sdk({ value: true }, { sentFeedback: true }))
    await Platform.requestReview()
    expect(Platform._reviewSent).toBe(true)
  })

  it('закрытое окно — это не оценка', async () => {
    attach(sdk({ value: true }, { feedbackSent: false }))
    await Platform.requestReview()
    expect(Platform._reviewSent).toBe(false)
  })
})

describe('порог прогресса', () => {
  it('на первых двух локациях оценку не просим', () => {
    const s = new GameState()
    s.zoneIndex = 0
    expect(s.reviewUnlocked()).toBe(false)
    s.zoneIndex = REVIEW_MIN_ZONE - 1
    expect(s.reviewUnlocked()).toBe(false)
  })

  it('порог — третья локация', () => {
    expect(REVIEW_MIN_ZONE).toBe(2) // zoneIndex нулевой: 2 → «Зона 3» на экране
    const s = new GameState()
    s.zoneIndex = REVIEW_MIN_ZONE
    expect(s.reviewUnlocked()).toBe(true)
  })
})
