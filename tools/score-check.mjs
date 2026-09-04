// Защита таблицы рекордов от невозможных результатов (см. GameState.leaderboardScore).
//
// Юнит-тесты (tests/gamestate.test.js) проверяют саму формулу, а здесь меряется
// то, чего они увидеть не могут: РЕАЛЬНЫЙ темп убийств в живой игре против
// потолка maxKillsPerSec(зона). Именно этот зазор и решает, не заденет ли
// защита честного игрока, — и он поедет, как только тронут поток врагов
// (spawnGapFloor / abyssSpawnRamp / spawnBatchMax / zoneKills). Тогда сюда и
// надо смотреть.
//
// Проверяется:
//   1) идеальный читер (враг умирает в тот же кадр, ворота зон отключены) всё
//      равно не дотягивает до потолка — значит, у живого игрока запас есть;
//   2) при этом его собственный рекорд не урезается;
//   3) время боя не идёт в лагере;
//   4) счёт, дорисованный прямо в состоянии игры, в таблицу не уходит.
//
// Требуется запущенный dev-сервер: npm run dev
// Запуск: node tools/score-check.mjs
import { chromium } from 'playwright'

const SECONDS = Number(process.env.SECONDS || 40)
const ok = []
const check = (n, v, d = '') => { ok.push(v); console.log(`  ${v ? '✓' : '✗'} ${n}${d ? '  — ' + d : ''}`) }

const browser = await chromium.launch({ args: [
  '--autoplay-policy=no-user-gesture-required',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.goto('http://localhost:5173/?lang=ru', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__yp?.game?.scene.getScenes(true).length, null, { timeout: 60000 })
await page.waitForTimeout(2500)

// Потолок берём для ТОЙ локации, где идёт замер: он считается по локации, а не
// одним числом на всю игру — за BAL.abyssZoneStart поток разгоняется.
const ZONE = 40
const MAX = await page.evaluate(async (z) => (await import('/src/data/progression.js')).maxKillsPerSec(z), ZONE)
console.log(`\n=== Рекорд: защита от невозможного (локация ${ZONE + 1}, потолок ${MAX.toFixed(2)} убийств/с) ===\n`)

// Игрок с настоящим прошлым: 33000 убийств и честно наигранное время.
await page.evaluate(() => {
  const { State, game, SCENES } = window.__yp
  State._apply({
    heroClass: 'gunner', bestScore: 33000, totalKills: 33000, battleSeconds: 4000, killBudget: 33000, zoneIndex: 40,
    hero: { level: 400, xp: 0, points: 0, str: 100000, vit: 100000, luck: 100 },
  })
  for (const sc of game.scene.getScenes(true)) sc.scene.stop()
  game.scene.start(SCENES.BATTLE)
})
await page.waitForTimeout(1500)

// «Идеальный читер»: враг умирает в тот же кадр, как вышел на арену (быстрее не
// может быть ни один автокликер — тут вообще нет ни пуль, ни попаданий), герой
// неуязвим, ворота зон отключены. Остаётся только сам поток врагов.
await page.evaluate(() => {
  const sc = window.__yp.game.scene.getScene('BattleScene')
  const { State } = window.__yp
  sc.heroTakeDamage = () => {}
  State.save = () => {}            // сейв каждый килл — не предмет замера
  State.hp = State.heroMaxHp()
  const step = () => {
    State.killsInZone = 0
    State.bossActive = false
    for (const e of [...sc.enemies]) sc.killEnemy(e)
    window.__raf = requestAnimationFrame(step)
  }
  step()
})
const a = await page.evaluate(() => ({ k: window.__yp.State.totalKills, s: window.__yp.State.battleSeconds }))
await page.waitForTimeout(SECONDS * 1000)
const b = await page.evaluate(() => {
  cancelAnimationFrame(window.__raf)
  return { k: window.__yp.State.totalKills, s: window.__yp.State.battleSeconds }
})

const rate = (b.k - a.k) / (b.s - a.s)
check('темп идеального читера ниже потолка', rate < MAX,
  `${rate.toFixed(2)} убийств/с против ${MAX.toFixed(2)} — запас ×${(MAX / rate).toFixed(2)}`)
check('его собственный рекорд не урезан',
  await page.evaluate(() => window.__yp.State.leaderboardScore() === window.__yp.State.bestScore),
  `${b.k} убийств за ${Math.round(b.s)} с боя`)

// В лагере бой не идёт — и время боя тоже.
await page.evaluate(() => { const { game, SCENES } = window.__yp; game.scene.getScene('BattleScene').scene.start(SCENES.HUB) })
await page.waitForTimeout(4000)
const s1 = await page.evaluate(() => window.__yp.State.battleSeconds)
check('в лагере время боя стоит', Math.abs(s1 - b.s) < 0.5, `+${(s1 - b.s).toFixed(2)} с за 4 с`)

// Дорисовка на ходу — ровно тот случай, ради которого защита и делалась.
const r = await page.evaluate(() => {
  const { State } = window.__yp
  const honest = State.leaderboardScore()
  State.bestScore += 7000
  State.totalKills += 7000
  return { honest, best: State.bestScore, sent: State.leaderboardScore() }
})
const passed = r.sent - r.honest
check('дорисованные 7000 в таблицу не уходят', passed < 1000,
  `сейв говорит ${r.best}, в таблицу уйдёт ${r.sent} (прошло ${passed} из 7000)`)

await browser.close()
const bad = ok.filter(v => !v).length
console.log(`\nИтог: ${ok.length - bad}/${ok.length}`)
if (bad) process.exit(1)
