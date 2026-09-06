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
// Запуск: node tools/shots.mjs                        (оба набора, все кадры)
//         SET=pc node tools/shots.mjs                 (только ПК)
//         SHOTS=2-svalka,3-steklo node tools/shots.mjs (только эти кадры)

import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'

const URL = process.env.URL || 'http://localhost:5173/'
// Язык интерфейса на кадрах. Яндекс (п.8.2.3) требует, чтобы материалы в
// языковых полях черновика были на соответствующем языке, поэтому для англ.
// карточки кадры снимаются отдельно: LANG=en node tools/shots.mjs
const LANG = process.env.LANG_UI || 'ru'
const OUT = LANG === 'ru' ? 'dock/screenshots' : `dock/screenshots-${LANG}`
// Список id кадров через запятую — снять только их (пересъёмка одного кадра
// после замечания модерации, а не всего набора).
const ONLY = process.env.SHOTS ? process.env.SHOTS.split(',').map(s => s.trim()) : null
// Сколько раз пересобирать волну, пока кадр не пройдёт проверки (см. frame).
const ATTEMPTS = Number(process.env.ATTEMPTS || 8)

// ЗАПРЕЩЁННЫЕ В ПРОМО ВРАГИ (п.8.3.6 требований к материалам).
//
// Пункт запрещает в промо «уродства, болезни, искажённые существа, вызывающие
// сильное отвращение или страх», и отдельно — фокус на крови и тяжёлых травмах.
// Исключение для реалистичных скелетов дано только фэнтези-играм, наш
// постапокалипсис под него не подпадает.
//
// На этом сняли мобильные кадры «Руины Города» и «Метро» с A/B-теста 6 сентября
// 2026: гуль — истощённая полуобнажённая человекоподобная фигура с рёбрами и
// черепом вместо лица, пиявка — пасть в кольцах зубов с розовым мясом внутри.
// В кадр они попали не по нашей воле: состав волны берётся рандомом из пула
// локации (BattleScene.spawnTick), поэтому ПК-набор той же зоны отснялся чистым,
// а мобильный — нет. Промо-кадр не должен зависеть от броска кубика, поэтому на
// время съёмки эти враги вырезаются из пула (см. sanitizePool ниже).
const BANNED = [
  'ghoul',    // Гуль — истощённый полутруп, рёбра и череп
  'drowned',  // Утопленник — раздутое тело
  'leech',    // Пиявка — раскрытая мясная пасть
  'butcher',  // Мясник — название и вид про расчленение
  'bloat',    // Пузырь — нарыв с глазом
  'dog',      // Пёс-мутант — облезлый, с обнажённой плотью
  'roller',   // Катала — тот же истощённый череп-гуманоид, только в покрышке
]

// Кадры: локации с разным артом + ворота. zone — индекс локации (0 = первая).
//
// Локации подобраны так, чтобы пул был безопасен ЕЩЁ ДО фильтра: BANNED здесь
// страховка, а не рабочий механизм. Поэтому «Руины Города» (зона 2) и «Метро»
// (зона 4) из набора убраны совсем — после вычёркивания гулей, утопленников и
// пиявки от их пулов остаётся слишком мало, чтобы кадр был живым. Взамен —
// «Литейный Цех» и «Стеклянная Пустошь»: другие фоны, тот же этап игры.
//
// Обе замены — ГЛУБОКИЕ локации, и это не случайность: на ранних волна редкая и
// мелкая, и после вычёркивания запрещённых в кадре оставался один враг у самого
// края (так провалилась проба с «Автосвалкой»). Плотный строй даёт только
// глубина.
const SHOTS = [
  { id: '1-pustyr', zone: 0, cls: 'gunner', kills: 60, note: 'Ржавый Пустырь' },
  { id: '2-liteyka', zone: 7, cls: 'brute', kills: 90, note: 'Литейный Цех' },
  { id: '3-steklo', zone: 8, cls: 'mechanic', kills: 70, note: 'Стеклянная Пустошь' },
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
    if (ONLY && !ONLY.includes(s.id)) continue
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
    // Кадр снимается с нескольких попыток. Волна — поток: враги выходят из-за
    // правого края и идут влево, герой их по дороге убивает. Момент, когда строй
    // уже вошёл в кадр, но ещё не выбит, ловится не с первой попытки — до сих
    // пор это компенсировалось тем, что кадры отбирали глазами. После отказа
    // модерации отбор формализован — проверки внутри frame() ниже.
    let png = null
    for (let attempt = 1; attempt <= ATTEMPTS && !png; attempt++) {
      png = await frame(page, s)
      if (!png && attempt < ATTEMPTS) {
        console.log(`  … ${s.id}: попытка ${attempt} не годится, переснимаю`)
        await page.evaluate(() => { for (const sc of window.__yp.game.scene.getScenes(true)) sc.scene.stop() })
        await page.waitForTimeout(300)
      }
    }
    if (!png) { console.log(`  ! ${s.id}: чистый кадр не собрался за ${ATTEMPTS} попыток`); continue }
    await writeFile(`${OUT}/${setName}-${s.id}.png`, png)
    console.log(`  ✓ ${setName}-${s.id}.png  (${s.note}, ${(png.length / 1024).toFixed(0)} КБ)`)
  }
  await ctx.close()
}

// Одна попытка снять кадр. Возвращает PNG или null, если кадр не годится —
// решение принимает вызывающий цикл, он же и переснимает.
async function frame(page, s) {
    await page.waitForTimeout(400)
    await page.evaluate(() => { const { game, SCENES } = window.__yp; game.scene.start(SCENES.BATTLE) })
    // Чистим пул СРАЗУ после create(), пока спавнер не выпустил вторую пачку:
    // дальше он берёт только разрешённых. Единственного врага, что успел выйти
    // из самого create(), снимаем с арены вручную — через destroyEnemy, а не
    // killEnemy, чтобы не проигрывать анимацию смерти и не начислять награду.
    //
    // sc.zone — поверхностная копия из getZone(), поэтому массив enemies в ней
    // общий с ZONES. ПРИСВАИВАЕМ новый массив, а не режем старый на месте:
    // splice здесь испортил бы пул локации для всей сессии.
    await page.waitForTimeout(150)
    await page.evaluate((banned) => {
      const sc = window.__yp.game.scene.getScene('BattleScene')
      if (!sc || !sc.zone) return
      const pool = sc.zone.enemies.filter(id => !banned.includes(id))
      if (pool.length) sc.zone.enemies = pool
      for (const e of [...sc.enemies]) {
        if (e.isBoss || !banned.includes(e.defId)) continue
        sc.enemies.splice(sc.enemies.indexOf(e), 1)
        sc.destroyEnemy(e)
      }
      // Отключаем урон по герою на время съёмки. heroTakeDamage на каждом ударе
      // кладёт поверх арены красный прямоугольник (alpha 0.18, гаснет 220 мс),
      // заливает спрайт героя и трясёт камеру. На глубине бьют почти непрерывно,
      // и ждать просвета бесполезно: между проверкой «кадр чистый» и снапшотом
      // прилетает новый удар — так весь набор и ушёл в ЛК под красным фильтром.
      // Проще убрать причину: на промо-кадре полоска HP всё равно полная.
      sc.heroTakeDamage = () => {}
    }, BANNED)
    // Даём волне выйти, анимациям заиграть, а полоскам HP — заполниться.
    // Боссу нужно больше: он выходит с баннером и подъездом, а до того экран
    // затемнён — ранний кадр получался чёрным.
    //
    // Обычному кадру раньше хватало 3.2 с, но чистка пула снимает с арены уже
    // выпущенного врага, и на ранних локациях (редкие мелкие пачки) кадр выходил
    // почти пустым: герой слева, один враг у правого края. Ждём дольше, чтобы
    // спавнер успел добрать строй.
    await page.waitForTimeout(s.kills === 'boss' ? 7000 : 5200)
    const dead = await page.evaluate(() => !!window.__yp.game.scene.getScene('BattleScene')?._deathModal)
    if (dead) { console.log(`  ! ${s.id}: герой погиб`); return null }
    // Композиция: строй должен быть В кадре, а не вжат в правый край под панель.
    // Кадр «Автосвалки» провалился именно так — один враг у самой панели и пустая
    // середина; на глаз это видно сразу, а скрипт раньше писал что дали.
    const ok = await page.evaluate((isBoss) => {
      const sc = window.__yp.game.scene.getScene('BattleScene')
      if (!sc || !sc.enemies?.length) return false
      if (isBoss) return sc.enemies.some(e => e.isBoss)
      // Панель HUD занимает правую часть экрана, арена — всё, что левее arenaW.
      // Врага у самой её кромки считаем «ещё не вошедшим в кадр».
      const xs = sc.enemies.map(e => e.sprite.x).filter(x => x < sc.arenaW * 0.88)
      return xs.length >= 3 && Math.min(...xs) < sc.arenaW * 0.62
    }, s.kills === 'boss')
    if (!ok) return null
    // Ждём «чистый» кадр. При попадании по герою бой делает две вещи, и обе
    // портят промо-кадр:
    //   1) заливает спрайт красным на 70 мс — герой выходит красным силуэтом;
    //   2) кладёт поверх ВСЕЙ арены красный прямоугольник (depth 70, alpha 0.18,
    //      гаснет за 220 мс) — кадр выходит залитым малиновым целиком.
    // Раньше проверялся только пункт 1, поэтому половина набора («Кратер»,
    // «Метро») ушла в ЛК с красным светофильтром на весь экран.
    let clean = false
    for (let i = 0; i < 30 && !clean; i++) {
      clean = await page.evaluate(() => {
        const sc = window.__yp.game.scene.getScene('BattleScene')
        if (!sc) return false
        if (sc.hero?.isTinted || sc.enemies?.some(e => e.sprite?.isTinted)) return false
        // Оверлей опознаём по глубине и цвету заливки: своего имени у него нет,
        // он живёт как локальная переменная в hurt() и сам себя удаляет.
        return !sc.children.list.some(o => o.depth === 70 && o.fillColor === 0xff0000 && o.alpha > 0.01)
      })
      if (!clean) await page.waitForTimeout(100)
    }
    // В глубоких локациях по герою бьют почти непрерывно. Если просвета так и не
    // случилось — не снимаем вовсе: волну пересоберут заново.
    if (!clean) { console.log(`  ! ${s.id}: не поймали кадр без вспышки урона`); return null }
    // Снимаем через renderer.snapshot самого Phaser, а НЕ screenshot() браузера:
    // WebGL-холст без preserveDrawingBuffer читается пустым, если кадр уже
    // сброшен, — половина кадров выходила чёрными (8 КБ вместо мегабайта).
    // Снапшот отдаёт ровно тот буфер, который отрисован, в родном разрешении.
    const dataUrl = await page.evaluate(() => new Promise((resolve, reject) => {
      // Подчищаем в ТОМ ЖЕ вызове, что и снимаем: снапшот отдаёт следующий
      // отрисованный кадр, поэтому всё, что убрано здесь, в него уже не попадёт.
      // Ловим остатки от ударов, прилетевших до отключения heroTakeDamage.
      const sc = window.__yp.game.scene.getScene('BattleScene')
      for (const o of [...sc.children.list]) {
        if (o.depth === 70 && o.fillColor === 0xff0000) o.destroy()
      }
      if (sc.hero?.isTinted) sc.hero.clearTint()
      for (const e of sc.enemies) if (e.sprite?.isTinted) e.sprite.clearTint()
      const t = setTimeout(() => reject(new Error('снапшот не пришёл')), 15000)
      window.__yp.game.renderer.snapshot((img) => { clearTimeout(t); resolve(img.src) })
    }))
    const png = Buffer.from(dataUrl.split(',')[1], 'base64')
    if (png.length < 20000) { console.log(`  ! ${s.id}: кадр пустой`); return null }
    // Страховка по п.8.3.6: спавнер мог выпустить пачку между чисткой пула и
    // снапшотом. Проверяем ПОСЛЕ съёмки — в кадре ровно те, кто на арене сейчас.
    // Кадр с запрещённым врагом не пишем совсем: лучше пустое место в наборе,
    // чем ещё один отказ модерации.
    const dirty = await page.evaluate((banned) => {
      const sc = window.__yp.game.scene.getScene('BattleScene')
      return (sc?.enemies || []).map(e => e.defId).filter(id => banned.includes(id))
    }, BANNED)
    if (dirty.length) { console.log(`  ! ${s.id}: в кадре запрещённые (${dirty.join(', ')})`); return null }
    return png
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
