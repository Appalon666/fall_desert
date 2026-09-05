// Боссы должны показываться СВОИМ артом, а не процедурной заглушкой.
//
// Заглушка — законный запасной путь (файл не доехал, битый PNG), но она
// включалась и там, где арт был: нарезка листов ждала, пока доедут ВСЕ девять,
// и отменялась совсем, если загрузка добегала на паузе. Юнит-тесты этого не
// видят — тут нужен настоящий Phaser с настоящим загрузчиком.
//
// Проверяется:
//   1) после обычного старта у всех девяти боссов есть нарезанный лист;
//   2) босс на арене берёт свой лист, а не tex-boss;
//   3) листы нарезаются, даже если загрузка добежала, пока сцена НА ПАУЗЕ
//      (реклама, скрытая вкладка) — ровно тот случай, что ломался;
//   4) частично доехавший набор режется по частям, а не «всё или ничего».
//
// Чего здесь НЕТ и почему. Была ещё проверка «каждый файл запрошен один раз» —
// на случай, если бой закажет листы, которые в этот момент уже тянет BootScene.
// Её пришлось убрать: она не падает даже с выключенной защитой. Замер показал,
// что второго СЕТЕВОГО запроса не возникает — браузер склеивает одинаковые
// запросы, находящиеся в полёте (9 запросов на 9 файлов, ноль ошибок в
// консоли). Проверка, которая не может упасть, хуже её отсутствия: она даёт
// ложную уверенность. Сама защита (bossLoadInFlight) оставлена — она верна и
// ничего не стоит, но выдавать её за исправленный баг не за что.
//
// Требуется запущенный dev-сервер: npm run dev
// Запуск: node tools/boss-check.mjs
import { chromium } from 'playwright'

const ok = []
const check = (n, v, d = '') => { ok.push(v); console.log(`  ${v ? '✓' : '✗'} ${n}${d ? '  — ' + d : ''}`) }

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })

// --- 1-2. Обычный старт ---
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.goto('http://localhost:5173/?lang=ru', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__yp?.game?.scene.getScenes(true).length, null, { timeout: 60000 })
  // Ждём фоновую догрузку из BootScene (боссы идут вторыми, до музыки).
  // Модуль со списком боссов подтягиваем один раз и кладём в window: делать
  // динамический import внутри условия ожидания — гонка на ровном месте.
  await page.evaluate(async () => {
    window.__bossIds = (await import('/src/data/bosses.js')).BOSS_IDS
  })
  const sliced = () => page.evaluate(() => {
    const tex = window.__yp.game.textures
    return {
      src: window.__bossIds.filter(id => tex.exists(`boss-${id}-src`)).length,
      cut: window.__bossIds.filter(id => tex.exists(`boss-${id}`) && tex.get(`boss-${id}`).frameTotal - 1 >= 4).length,
      total: window.__bossIds.length,
    }
  })
  await page.waitForFunction(() => {
    const tex = window.__yp.game.textures
    return window.__bossIds.every(id => tex.exists(`boss-${id}`))
  }, null, { timeout: 60000 }).catch(() => {})
  const r1 = await sliced()
  check('после старта нарезаны листы всех боссов', r1.cut === r1.total,
    `нарезано ${r1.cut} из ${r1.total} (файлов доехало ${r1.src})`)

  // Босс на арене должен взять свой лист.
  const used = await page.evaluate(async () => {
    const { State, game, SCENES } = window.__yp
    State.heroClass = 'gunner'
    State.hero = { level: 10, xp: 0, points: 0, str: 20, vit: 40, luck: 5 }
    State.zoneIndex = 0; State.hp = State.heroMaxHp()
    // BootScene НЕ трогаем: в живой игре она продолжает догружать фоном, и
    // именно её загрузчик доносит листы боссов.
    for (const sc of game.scene.getScenes(true)) if (sc.scene.key !== 'BootScene') sc.scene.stop()
    game.scene.start(SCENES.BATTLE)
    await new Promise(r => setTimeout(r, 1200))
    const sc = game.scene.getScene('BattleScene')
    sc.clearEnemies(); sc.spawnBoss()
    const boss = sc.enemies.find(e => e.isBoss)
    return boss ? boss.sprite.texture.key : null
  })
  check('босс на арене нарисован своим листом', !!used && used.startsWith('boss-'), `текстура: ${used}`)
  await page.close()
}

// --- 3. Загрузка добежала, пока сцена на паузе ---
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  // Держим листы боссов, пока не разрешим: так бой стартует заведомо раньше их.
  let release
  const held = new Promise(r => { release = r })
  await page.route('**/sprites/boss-*.png', async (route) => { await held; await route.continue() })
  await page.goto('http://localhost:5173/?lang=ru', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__yp?.game?.scene.getScenes(true).length, null, { timeout: 60000 })
  await page.waitForTimeout(2000)
  await page.evaluate(() => {
    const { State, game, SCENES } = window.__yp
    State.heroClass = 'gunner'
    State.hero = { level: 10, xp: 0, points: 0, str: 20, vit: 40, luck: 5 }
    State.zoneIndex = 0; State.hp = State.heroMaxHp()
    for (const sc of game.scene.getScenes(true)) if (sc.scene.key !== 'BootScene') sc.scene.stop()
    game.scene.start(SCENES.BATTLE)
  })
  await page.waitForTimeout(1200)
  // Ставим игру на паузу (как под рекламой) и только теперь отпускаем файлы.
  await page.evaluate(() => window.__yp.Platform._adStart())
  await page.waitForTimeout(300)
  const pausedNow = await page.evaluate(() => window.__yp.Pause.paused)
  release()
  await page.waitForTimeout(6000)
  const slicedUnderPause = await page.evaluate(async () => {
    const { BOSS_IDS } = await import('/src/data/bosses.js')
    const tex = window.__yp.game.textures
    return BOSS_IDS.filter(id => tex.exists(`boss-${id}`)).length
  })
  await page.evaluate(() => window.__yp.Platform._adEnd())
  check('листы нарезаются, даже если загрузка добежала на паузе',
    pausedNow && slicedUnderPause > 0, `на паузе: ${pausedNow}, нарезано: ${slicedUnderPause}`)
  await page.close()
}

// --- 4. Часть файлов не доехала вовсе ---
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.route('**/sprites/boss-worm.png', route => route.abort())
  await page.route('**/sprites/boss-toad.png', route => route.abort())
  await page.goto('http://localhost:5173/?lang=ru', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__yp?.game?.scene.getScenes(true).length, null, { timeout: 60000 })
  await page.waitForTimeout(8000)
  const r = await page.evaluate(async () => {
    const { BOSS_IDS } = await import('/src/data/bosses.js')
    const tex = window.__yp.game.textures
    return { sliced: BOSS_IDS.filter(id => tex.exists(`boss-${id}`)).length, total: BOSS_IDS.length }
  })
  check('два битых файла не отменяют остальные семь', r.sliced === r.total - 2, `нарезано ${r.sliced} из ${r.total}`)
  await page.close()
}

await browser.close()
const bad = ok.filter(v => !v).length
console.log(`\nИтог: ${ok.length - bad}/${ok.length}`)
if (bad) process.exit(1)
