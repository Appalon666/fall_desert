// Автопроверка поведения звука по требованиям Яндекс.Игр.
//
// Проверяются пункты, по которым игру уже снимали с публикации:
//   п.1.3 — при сворачивании окна и переходе на другую вкладку звук/музыка
//           должны молчать;
//   п.1.14 — возврат на вкладку обязан расклинить игру, даже если браузер не
//           прислал ни одного события;
//   п.1.15 — своей заглушки о повороте устройства в игре нет;
//   п.4.7 — под полноэкранной рекламой (interstitial/rewarded) звук на паузе.
// Плюс то, что легко сломать правкой: снятие одной причины паузы не должно
// возвращать звук, пока держится другая, а пользовательский мьют не должен
// самопроизвольно сниматься после паузы.
//
// Требуется запущенный dev-сервер: npm run dev
// Запуск: node tools/audio-check.mjs

import { chromium } from 'playwright'

const URL = process.env.URL || 'http://localhost:5173/'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`)
}

// Без этого флага headless держит AudioContext усыплённым, а Phaser читает
// mute с аудио-узла (masterMuteNode.gain.value) — у спящего контекста значение
// не пересчитывается, и проверка мерила бы не поведение игры, а состояние
// звуковой подсистемы браузера.
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  locale: 'ru-RU',
  permissions: [],
  bypassCSP: true,
})
const page = await ctx.newPage()
// Ловим события заглушения от самого движка: это прямой ответ на вопрос
// «игра попросила замолчать», без гонок с аудиопотоком.
await page.addInitScript(() => {
  window.__muteLog = []
  const hook = () => {
    const g = window.__yp && window.__yp.game
    if (!g || !g.sound) return setTimeout(hook, 100)
    g.sound.on('mute', (_m, v) => window.__muteLog.push(!!v))
  }
  hook()
})
await page.goto(`${URL}?lang=ru`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__yp?.game?.scene.getScenes(true).length, null, { timeout: 60000 })
await page.waitForTimeout(2000)

// Заходим в бой: там играет боевая музыка и живут звуки.
await page.evaluate(() => {
  const { State, game, SCENES } = window.__yp
  State.heroClass = 'gunner'
  State.hero = { level: 10, xp: 0, points: 0, str: 20, vit: 400, luck: 5 }
  State.hp = State.heroMaxHp()
  for (const sc of game.scene.getScenes(true)) sc.scene.stop()
  game.scene.start(SCENES.BATTLE)
})
await page.waitForTimeout(3000)
// Имитируем жест пользователя — иначе WebAudio так и останется усыплённым.
await page.mouse.click(400, 400)
await page.waitForTimeout(1500)

const snapshot = () => page.evaluate(() => {
  const { game, Pause } = window.__yp
  const snd = game.sound
  const log = window.__muteLog || []
  const scenes = game.scene.getScenes(false)
  return {
    // Последнее, о чём игра попросила движок. Именно это и требует Яндекс:
    // «звук не должен играть». Значение с аудио-узла (snd.mute) читаем как
    // вторую опору — у спящего контекста оно врёт.
    mute: log.length ? log[log.length - 1] : !!snd.mute,
    gainMute: !!snd.mute,
    paused: Pause.paused,
    reasons: [...Pause.reasons],
    // сцены, которые реально идут (не на паузе)
    running: scenes.filter(s => s.scene.isActive() && !s.scene.isPaused()).map(s => s.scene.key),
    pausedScenes: scenes.filter(s => s.scene.isPaused()).map(s => s.scene.key),
  }
})

const setHidden = (hidden) => page.evaluate((h) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') })
  document.dispatchEvent(new Event('visibilitychange'))
}, hidden)

console.log('\n=== Звук: требования Яндекса ===\n')

const base = await snapshot()
check('в бою звук не заглушён и игра идёт', !base.mute && !base.paused && base.running.length > 0,
  `сцены: ${base.running.join(', ') || 'нет'}`)

// --- п.1.3: уход на другую вкладку / сворачивание ---
await setHidden(true)
await page.waitForTimeout(400)
const hidden = await snapshot()
check('п.1.3 вкладка скрыта → звук заглушён', hidden.mute, `причины: ${hidden.reasons.join(',')}`)
check('п.1.3 вкладка скрыта → сцены на паузе', hidden.running.length === 0,
  `идут: ${hidden.running.join(', ') || 'ни одной'}`)

await setHidden(false)
await page.waitForTimeout(400)
const back = await snapshot()
check('возврат на вкладку → звук вернулся', !back.mute && back.running.length > 0,
  `сцены: ${back.running.join(', ') || 'нет'}`)

// --- п.4.7: полноэкранная реклама ---
await page.evaluate(() => window.__yp.Platform._adStart())
await page.waitForTimeout(400)
const ad = await snapshot()
check('п.4.7 реклама → звук заглушён', ad.mute, `причины: ${ad.reasons.join(',')}`)
check('п.4.7 реклама → геймплей на паузе', ad.running.length === 0)

await page.evaluate(() => window.__yp.Platform._adEnd())
await page.waitForTimeout(400)
const adEnd = await snapshot()
check('после рекламы звук вернулся', !adEnd.mute && adEnd.running.length > 0)

// --- две причины разом: реклама закончилась, но вкладка ещё скрыта ---
await page.evaluate(() => window.__yp.Platform._adStart())
await setHidden(true)
await page.waitForTimeout(300)
await page.evaluate(() => window.__yp.Platform._adEnd())
await page.waitForTimeout(400)
const both = await snapshot()
check('реклама кончилась при скрытой вкладке → тишина держится', both.mute,
  `причины: ${both.reasons.join(',') || 'нет'}`)
await setHidden(false)
await page.waitForTimeout(400)
const bothBack = await snapshot()
check('после возврата звук всё-таки вернулся', !bothBack.mute && bothBack.running.length > 0)

// --- пользовательский мьют не должен сниматься сам ---
await page.evaluate(() => { window.__yp.game.sound.mute = true })
await setHidden(true)
await page.waitForTimeout(300)
await setHidden(false)
await page.waitForTimeout(400)
const muteKept = await page.evaluate(() => !!window.__yp.game.sound.mute)
check('выключённый игроком звук не включился сам после паузы', muteKept)
await page.evaluate(() => { window.__yp.game.sound.mute = false })

// --- п.1.15: своей заглушки о повороте в игре быть не должно ---
//
// Раньше здесь жил экран «поверни устройство», и он же ставил игру на паузу.
// Модерация сняла игру дважды: за саму заглушку (свои запрещены — ориентация
// объявляется в консоли, стоп-экран рисует платформа) и за то, что она
// залипала — `orientationchange` прилетает до обновления размеров окна, так что
// в ландшафте заглушка оставалась висеть вместе с паузой.
await page.setViewportSize({ width: 540, height: 960 })
await page.emulateMedia({ media: 'screen' })
await page.waitForTimeout(800)
const portrait = await snapshot()
check('п.1.15 в портрете нет своей заглушки о повороте',
  await page.evaluate(() => !document.getElementById('rotate') && !document.body.classList.contains('portrait-lock')))
check('п.1.15 портрет не ставит игру на паузу', !portrait.paused && portrait.running.length > 0,
  `причины: ${portrait.reasons.join(',') || 'нет'}`)
await page.setViewportSize({ width: 1280, height: 720 })
await page.waitForTimeout(600)

// --- п.1.14: возврат на вкладку расклинивает игру, даже если событие потеряно ---
//
// Сторож в main.js раз в секунду сверяет паузу с document.hidden. Проверяем
// именно его: ставим паузу как «скрытая вкладка», возвращаем видимость БЕЗ
// события visibilitychange — игра всё равно обязана ожить.
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
  document.dispatchEvent(new Event('visibilitychange'))
})
await page.waitForTimeout(400)
const stuck = await snapshot()
check('п.1.14 скрытая вкладка → игра стоит', stuck.paused)
await page.evaluate(() => {
  // Событие «проглочено»: снимать паузу некому, кроме сторожа.
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})
await page.waitForTimeout(2000)
const unstuck = await snapshot()
check('п.1.14 без события возврата сторож всё равно снимает паузу',
  !unstuck.paused && !unstuck.mute && unstuck.running.length > 0,
  `причины: ${unstuck.reasons.join(',') || 'нет'}`)

await browser.close()

const failed = results.filter(r => !r.ok)
console.log(`\nИтог: ${results.length - failed.length}/${results.length} проверок пройдено`)
if (failed.length) {
  console.log('НЕ ПРОЙДЕНО:\n' + failed.map(f => '  - ' + f.name).join('\n'))
  process.exit(1)
}
