// Отправка рекорда в таблицу Яндекса.
//
// Главное, что здесь стережётся: у SDK ДВЕ несовместимые версии API лидербордов
// с разными именами методов (setScore/getEntries против
// setLeaderboardScore/getLeaderboardEntries). Игра работала только со старыми
// именами, а SDK отдавал новый объект — вызовы падали в TypeError, который
// глотался catch'ем, и снаружи это выглядело как «лидерборда нет».
// Сам SDK подменяем заглушкой — Platform не тянет ни Phaser, ни сеть.
import { describe, it, expect, beforeEach } from 'vitest'
import { Platform, LEADERBOARD } from '../src/platform/yandex.js'

// Заглушка НОВОГО API (ysdk.leaderboards).
function sdkNew(reject = false) {
  const calls = []
  return {
    calls,
    setScore(name, score) {
      calls.push({ name, score })
      return reject ? Promise.reject(new Error('LEADERBOARD_NOT_FOUND')) : Promise.resolve()
    },
    getEntries(name) { return Promise.resolve({ name, entries: [] }) },
  }
}
// Заглушка СТАРОГО API (ysdk.getLeaderboards()).
function sdkOld(reject = false) {
  const calls = []
  return {
    calls,
    setLeaderboardScore(name, score) {
      calls.push({ name, score })
      return reject ? Promise.reject(new Error('LEADERBOARD_NOT_FOUND')) : Promise.resolve()
    },
    getLeaderboardEntries(name) { return Promise.resolve({ name, entries: [] }) },
  }
}
// Подключить заглушку так, как это сделал бы _doInit.
function attach(raw) {
  Platform.available = true
  Platform.lb = Platform._wrapLeaderboards(raw)
  return raw
}

// Platform — синглтон, поэтому между тестами возвращаем его в исходное состояние.
beforeEach(() => {
  Platform.available = false
  Platform.lb = null
  Platform.ya = null
  Platform._pendingScore = undefined
  Platform._pendingName = undefined
})

describe('техническое имя таблицы', () => {
  it('это «kills» — ровно то, что заведено в личном кабинете', () => {
    expect(LEADERBOARD).toBe('kills')
  })
  it('submitScore и getEntries берут одно и то же имя по умолчанию', async () => {
    const raw = attach(sdkNew())
    await Platform.submitScore(10)
    expect(raw.calls[0].name).toBe(LEADERBOARD)
    expect((await Platform.getEntries()).name).toBe(LEADERBOARD)
  })
})

describe('две версии API лидербордов', () => {
  it('новый объект (setScore/getEntries) работает', async () => {
    const raw = attach(sdkNew())
    await Platform.submitScore(11)
    expect(raw.calls).toEqual([{ name: 'kills', score: 11 }])
    expect(await Platform.getEntries()).toEqual({ name: 'kills', entries: [] })
  })

  it('старый объект (setLeaderboardScore/getLeaderboardEntries) тоже работает', async () => {
    const raw = attach(sdkOld())
    await Platform.submitScore(12)
    expect(raw.calls).toEqual([{ name: 'kills', score: 12 }])
    expect(await Platform.getEntries()).toEqual({ name: 'kills', entries: [] })
  })

  it('объект без обоих наборов методов не принимается', () => {
    expect(Platform._wrapLeaderboards({ что: 'то совсем другое' })).toBe(null)
    expect(Platform._wrapLeaderboards(null)).toBe(null)
  })

  it('полумера не принимается: есть setScore, нет getEntries', () => {
    expect(Platform._wrapLeaderboards({ setScore: () => {} })).toBe(null)
  })
})

describe('выбор объекта таблиц из SDK', () => {
  it('предпочитает ysdk.leaderboards устаревшему getLeaderboards()', async () => {
    const neu = sdkNew()
    Platform.ya = { leaderboards: neu, getLeaderboards: () => { throw new Error('не должен вызываться') } }
    const lb = await Platform._resolveLeaderboards()
    await lb.setScore('kills', 5)
    expect(neu.calls).toHaveLength(1)
  })

  it('переходит на getLeaderboards(), если свойства нет', async () => {
    const old = sdkOld()
    Platform.ya = { getLeaderboards: () => Promise.resolve(old) }
    const lb = await Platform._resolveLeaderboards()
    await lb.setScore('kills', 6)
    expect(old.calls).toHaveLength(1)
  })

  it('переходит на getLeaderboards(), если свойство есть, но чужой формы', async () => {
    const old = sdkOld()
    Platform.ya = { leaderboards: { совсем: 'другое' }, getLeaderboards: () => Promise.resolve(old) }
    const lb = await Platform._resolveLeaderboards()
    await lb.setScore('kills', 7)
    expect(old.calls).toHaveLength(1)
  })

  it('разворачивает свойство-промис', async () => {
    const neu = sdkNew()
    Platform.ya = { leaderboards: Promise.resolve(neu) }
    const lb = await Platform._resolveLeaderboards()
    await lb.setScore('kills', 8)
    expect(neu.calls).toHaveLength(1)
  })

  it('падение обоих путей даёт null, а не бросок', async () => {
    Platform.ya = {
      get leaderboards() { throw new Error('нет такого свойства') },
      getLeaderboards: () => Promise.reject(new Error('устарел')),
    }
    expect(await Platform._resolveLeaderboards()).toBe(null)
  })
})

describe('отправка рекорда', () => {
  it('уходит целым неотрицательным числом', async () => {
    const raw = attach(sdkNew())
    await Platform.submitScore(1234.7)
    expect(raw.calls).toEqual([{ name: 'kills', score: 1234 }])
  })

  it('NaN и Infinity не отправляются (иначе SDK отвергает всю посылку)', async () => {
    const raw = attach(sdkNew())
    await Platform.submitScore(NaN)
    await Platform.submitScore(Infinity)
    await Platform.submitScore(-5)
    expect(raw.calls).toEqual([])
  })

  it('рекорд не теряется, если SDK ещё не готов — досылается по готовности', async () => {
    // Игрок закончил вылазку раньше, чем доехал SDK: таблицы нет.
    await Platform.submitScore(700)
    expect(Platform._pendingScore).toBe(700)
    const raw = attach(sdkNew())
    await Platform._flushScore() // это делает _doInit, когда SDK приехал
    expect(raw.calls).toEqual([{ name: 'kills', score: 700 }])
  })

  it('из нескольких отложенных отправок уходит лучшая', async () => {
    await Platform.submitScore(120)
    await Platform.submitScore(90)
    await Platform.submitScore(300)
    const raw = attach(sdkNew())
    await Platform._flushScore()
    expect(raw.calls).toEqual([{ name: 'kills', score: 300 }])
  })

  it('отказ SDK не всплывает наружу необработанным отклонением', async () => {
    const raw = attach(sdkNew(true)) // «нет таблицы с таким id»
    await expect(Platform.submitScore(50)).resolves.toBeUndefined()
    expect(raw.calls).toHaveLength(1)
  })

  it('без SDK ничего не шлётся и не падает', async () => {
    await expect(Platform.submitScore(42)).resolves.toBeUndefined()
    expect(await Platform.getEntries()).toBe(null)
  })
})
