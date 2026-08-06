// Промо-скриншоты для Яндекс.Игр.
//
// Снимает РЕАЛЬНЫЙ геймплей (п.5.1.1.2 требует ≥70% геймплея на кадре): бой в
// разных локациях и бой с боссом-воротами. Наружных рамок, коллажей и текста
// поверх не добавляем — только сам холст игры.
//
// Как это работает: dev-сборка выставляет window.__yp (см. main.js), через него
// ставим класс, зону и прокачку и открываем нужную сцену. Иначе каждый кадр
// пришлось бы проходить руками.
//
// Требуется запущенный dev-сервер: npm run dev
// Запуск: node tools/shots.mjs            (оба набора)
//         SET=pc node tools/shots.mjs     (только ПК)

import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'

const URL = process.env.URL || 'http://localhost:5173/'
// Язык интерфейса на кадрах. Яндекс (п.8.2.3) требует, чтобы материалы в
// языковых полях черновика были на соответствующем языке, поэтому для англ.
// карточки кадры снимаются отдельно: LANG=en node tools/shots.mjs
const LANG = process.env.LANG_UI || 'ru'
const OUT = LANG === 'ru' ? 'dock/screenshots' : `dock/screenshots-${LANG}`

// Кадры: локации с разным артом + ворота. zone — индекс локации (0 = первая).
const SHOTS = [
  { id: '1-pustyr', zone: 0, cls: 'gunner', kills: 60, note: 'Ржавый Пустырь' },
  { id: '2-gorod', zone: 2, cls: 'brute', kills: 90, note: 'Руины Города' },
  { id: '3-metro', zone: 4, cls: 'mechanic', kills: 70, note: 'Метро' },
  { id: '4-krater', zone: 6, cls: 'scavenger', kills: 80, note: 'Кратер' },
  { id: '5-logovo', zone: 9, cls: 'gunner', kills: 50, note: 'Логово Босса' },
  { id: '6-boss', zone: 3, cls: 'brute', kills: 'boss', note: 'Босс-ворота' },
]

// Два набора: ПК и телефон. Оба 1920×1080 — Яндекс просит 16:9, а холст игры
// всё равно тянется FIT, поэтому на телефоне отличается только эмуляция ввода
// (isMobile/hasTouch) и плотность пикселей.
const SETS = {
  pc: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}

async function shoot(browser, setName, cfg) {
  const ctx = await browser.newContext({ ...cfg, locale: LANG === 'ru' ? 'ru-RU' : 'en-US' })
  const page = await ctx.newPage()
  await page.goto(`${URL}?lang=${LANG}`, { waitUntil: 'domcontentloaded' })
  // Ждём, пока Boot догрузит ассеты и поднимет отладочный хук.
  await page.waitForFunction(() => window.__yp && window.__yp.game && window.__yp.game.scene.getScenes(true).length, null, { timeout: 60000 })
  await page.waitForTimeout(2500)

  // Прогрев: листы боссов (~2.5 МБ) догружаются ФОНОМ уже в бою, поэтому первый
  // же кадр с воротами ловил процедурный фолбэк вместо нарисованного босса.
  // Заходим в бой заранее и ждём, пока текстуры доедут.
  await page.evaluate(() => {
    const { State, game, SCENES } = window.__yp
    State.heroClass = 'gunner'; State.zoneIndex = 0; State.killsInZone = 10
    // Прогрев длится до полутора минут — голый герой за это время погибнет, и
    // окно смерти будет мешать первым кадрам.
    State.hero = { level: 14, xp: 0, points: 0, str: 26, vit: 900, luck: 8 }
    State.upgrades = { damage: 26, hp: 10 }
    State.hp = State.heroMaxHp()
    for (const sc of game.scene.getScenes(true)) sc.scene.stop()
    game.scene.start(SCENES.BATTLE)
  })
  await page.waitForFunction(() => {
    const g = window.__yp.game
    return ['boss-toad', 'boss-ratking', 'boss-sledge'].every(k => g.textures.exists(k))
  }, null, { timeout: 90000 }).catch(() => console.log('  (листы боссов не доехали — босс будет на фолбэке)'))

  for (const s of SHOTS) {
    await page.evaluate(({ zone, cls, kills }) => {
      const { State, game, SCENES } = window.__yp
      // Прокачанный, но не абсурдный герой: на кадре должны быть живые числа.
      State.heroClass = cls
      // Живучесть с запасом под глубину: на кадр герой должен ПРОЖИТЬ несколько
      // секунд, иначе вместо боя снимается окно смерти. Урон врагов растёт с
      // зоной, поэтому и запас растёт вместе с ней.
      State.hero = { level: 14, xp: 0, points: 0, str: 26, vit: 60 + zone * 45, luck: 8 }
      State.upgrades = { damage: 26, hp: 10, crit: 6, multishot: 5, allyPower: 4 }
      State.allies = { dog: 3 }
      State.caps = 48000 + zone * 12000
      State.zoneIndex = zone
      State.totalKills = 200 * zone + 60
      State.killsInZone = kills === 'boss' ? 200 : kills
      State.bossActive = false
      State.combo = 24
      State.ult = kills === 'boss' ? 100 : 62
      State.hp = State.heroMaxHp()
      // Стоп и старт РАЗНЕСЕНЫ по тикам: если гасить и поднимать бой в одном
      // тике, Phaser через раз оставлял сцену незапущенной — каждый второй
      // кадр выходил пустым фоном.
      for (const sc of game.scene.getScenes(true)) sc.scene.stop()
    }, s)
    await page.waitForTimeout(400)
    await page.evaluate(() => { const { game, SCENES } = window.__yp; game.scene.start(SCENES.BATTLE) })
    // Даём волне выйти, анимациям заиграть, а полоскам HP — заполниться.
    // Боссу нужно больше: он выходит с баннером и подъездом, а до того экран
    // затемнён — ранний кадр получался чёрным.
    await page.waitForTimeout(s.kills === 'boss' ? 7000 : 3200)
    const dead = await page.evaluate(() => !!window.__yp.game.scene.getScene('BattleScene')?._deathModal)
    if (dead) { console.log(`  ! ${s.id}: герой погиб, кадр пропущен`); continue }
    // Ждём «чистый» кадр: при попадании по герою бой заливает его спрайт
    // красным на 70 мс, и промо-кадр ловил именно этот момент — герой выходил
    // сплошным красным силуэтом.
    for (let i = 0; i < 16; i++) {
      const busy = await page.evaluate(() => {
        const sc = window.__yp.game.scene.getScene('BattleScene')
        return !!(sc && (sc.hero?.isTinted || sc.enemies?.some(e => e.sprite?.isTinted)))
      })
      if (!busy) break
      await page.waitForTimeout(120)
    }
    // Снимаем через renderer.snapshot самого Phaser, а НЕ screenshot() браузера:
    // WebGL-холст без preserveDrawingBuffer читается пустым, если кадр уже
    // сброшен, — половина кадров выходила чёрными (8 КБ вместо мегабайта).
    // Снапшот отдаёт ровно тот буфер, который отрисован, в родном разрешении.
    const dataUrl = await page.evaluate(() => new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('снапшот не пришёл')), 15000)
      window.__yp.game.renderer.snapshot((img) => { clearTimeout(t); resolve(img.src) })
    }))
    const png = Buffer.from(dataUrl.split(',')[1], 'base64')
    if (png.length < 20000) { console.log(`  ! ${s.id}: кадр пустой, пропущен`); continue }
    await writeFile(`${OUT}/${setName}-${s.id}.png`, png)
    console.log(`  ✓ ${setName}-${s.id}.png  (${s.note}, ${(png.length / 1024).toFixed(0)} КБ)`)
  }
  await ctx.close()
}

await mkdir(OUT, { recursive: true })
const only = process.env.SET
const browser = await chromium.launch()
for (const [name, cfg] of Object.entries(SETS)) {
  if (only && only !== name) continue
  console.log(`\n=== ${name} ===`)
  await shoot(browser, name, cfg)
}
await browser.close()
console.log(`\nГотово. Файлы в ${OUT}/`)
