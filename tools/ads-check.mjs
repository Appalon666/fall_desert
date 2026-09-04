// Живая проверка поведения рекламы: не юнит-тест, а настоящие клики по кнопкам
// в Phaser. Юнит-тесты (tests/ads.test.js) стерегут сам Platform, а здесь
// проверяется связка «кнопка на экране → SDK → что увидел игрок»: именно на ней
// игра и вернулась с модерации.
//
// Что проверяется:
//   п.4.5 — ролик, закрытый до награды, НЕ возрождает героя, и игрок видит,
//           почему награды нет; досмотренный — возрождает;
//   п.4.4 — «смириться и продолжить» рекламы не показывает (игровое действие),
//           а выход в лагерь показывает (неигровое), и лагерь открывается
//           только ПОСЛЕ ролика, а не под ним;
//   п.4.7 — пока идёт ролик, игра на паузе.
//
// SDK Яндекса подменяем заглушкой — колбэки дёргаем руками.
// Требуется запущенный dev-сервер: npm run dev
// Запуск: node tools/ads-check.mjs
import { chromium } from 'playwright'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`)
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.goto('http://localhost:5173/?lang=ru', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__yp?.game?.scene.getScenes(true).length, null, { timeout: 60000 })
await page.waitForTimeout(2500)

// Заглушка SDK: запоминает вызовы и отдаёт колбэки наружу.
await page.evaluate(() => {
  const P = window.__yp.Platform
  window.__ads = { rewarded: 0, full: 0, cb: {} }
  P.available = true
  P._embedded = () => true
  P._lastAd = 0
  P._lastAdTry = 0
  P.ya = {
    adv: {
      showRewardedVideo({ callbacks }) { window.__ads.rewarded++; window.__ads.cb.r = callbacks },
      showFullscreenAdv({ callbacks }) { window.__ads.full++; window.__ads.cb.f = callbacks },
    },
  }
})

const enterBattle = () => page.evaluate(() => {
  const { State, game, SCENES } = window.__yp
  State.heroClass = 'gunner'
  State.hero = { level: 10, xp: 0, points: 0, str: 20, vit: 40, luck: 5 }
  State.zoneIndex = 3
  State.hp = State.heroMaxHp()
  for (const sc of game.scene.getScenes(true)) sc.scene.stop()
  game.scene.start(SCENES.BATTLE)
})
const die = () => page.evaluate(() => {
  const sc = window.__yp.game.scene.getScene('BattleScene')
  window.__yp.State.hp = 0
  sc.heroDie()
})
const snap = () => page.evaluate(() => {
  const { game, State, Pause } = window.__yp
  const sc = game.scene.getScene('BattleScene')
  const texts = sc.children.list.filter(o => o.type === 'Text').map(o => o.text)
  return {
    ads: window.__ads.rewarded, full: window.__ads.full,
    deathModal: !!sc._deathModal, hp: State.hp, paused: Pause.paused,
    reasons: [...Pause.reasons],
    scene: game.scene.getScenes(true).map(s => s.scene.key),
    toast: texts.some(x => x.includes('Награда не начислена')),
  }
})
const fire = (which, name, arg) => page.evaluate(([w, n, a]) => {
  const cb = window.__ads.cb[w]
  if (cb && cb[n]) cb[n](a)
}, [which, name, arg])

console.log('\n=== Реклама: живая проверка в игре ===\n')

// ---------- 1. Смерть: ролик закрыт до награды → возрождения нет ----------
await enterBattle(); await page.waitForTimeout(1200)
await die(); await page.waitForTimeout(500)
check('на экране смерти открыто окно', (await snap()).deathModal)
await page.mouse.click(480, 354) // «📺 Реклама: возродиться»
await page.waitForTimeout(400)
let s = await snap()
check('кнопка возрождения запускает rewarded', s.ads === 1, `вызовов: ${s.ads}`)
await fire('r', 'onOpen'); await page.waitForTimeout(300)
s = await snap()
check('под роликом игра на паузе', s.paused && s.reasons.includes('ad'), `причины: ${s.reasons}`)
await fire('r', 'onClose'); await page.waitForTimeout(500)
s = await snap()
check('п.4.5 закрыл ролик до награды → НЕ возродился', s.deathModal && s.hp <= 0)
check('п.4.5 игрок видит, почему награды нет', s.toast)
check('пауза после ролика снята', !s.paused, `причины: ${s.reasons}`)

// ---------- 2. Смерть: ролик досмотрен → возрождение ----------
await page.mouse.click(480, 354)
await page.waitForTimeout(300)
await fire('r', 'onOpen')
await fire('r', 'onRewarded')
await fire('r', 'onClose')
await page.waitForTimeout(600)
s = await snap()
check('досмотрел ролик → возродился', !s.deathModal && s.hp > 0, `hp=${Math.round(s.hp)}`)

// ---------- 3. «Смириться и продолжить» — без рекламы (п.4.4) ----------
await die(); await page.waitForTimeout(500)
const fullBefore = (await snap()).full
await page.mouse.click(480, 426) // «Смириться и продолжить»
await page.waitForTimeout(700)
s = await snap()
check('п.4.4 «смириться и продолжить» рекламу НЕ показывает', s.full === fullBefore, `показов: ${s.full}`)
check('и окно смерти закрылось, игра идёт', !s.deathModal && !s.paused)

// ---------- 4. Выход в лагерь — единственная точка межстраничной ----------
await page.mouse.click(1120, 668) // «⟵ В лагерь»
await page.waitForTimeout(500)
s = await snap()
check('п.4.4 выход в лагерь показывает межстраничную', s.full === fullBefore + 1, `показов: ${s.full}`)
// getScenes(true) под рекламой пуст — все сцены приостановлены (это и есть
// требование 4.7). Важно другое: лагерь ещё не запущен.
check('под рекламой лагерь ещё НЕ открыт', !s.scene.includes('HubScene'), `идут: ${s.scene.join(',') || 'ни одной'}`)
await fire('f', 'onOpen')
await fire('f', 'onClose')
await page.waitForTimeout(800)
const scenes = await page.evaluate(() => window.__yp.game.scene.getScenes(true).map(s => s.scene.key))
check('после ролика переход в лагерь состоялся', scenes.includes('HubScene'), `сцены: ${scenes}`)

await browser.close()
const failed = results.filter(r => !r.ok)
console.log(`\nИтог: ${results.length - failed.length}/${results.length}`)
if (failed.length) { console.log('НЕ ПРОЙДЕНО:\n' + failed.map(f => '  - ' + f.name).join('\n')); process.exit(1) }
