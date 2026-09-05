// Сквозной обход игры: заходим на каждый экран, жмём то, что там есть, и ловим
// ЛЮБУЮ ошибку в консоли.
//
// Зачем отдельно от остальных проверок. Те стерегут конкретные требования
// (реклама, звук, рекорд, боссы), а этот — про «не развалилось ли вообще
// что-нибудь»: после правок модели предмета или разметки сцена может падать на
// первом же кадре, и ни один точечный тест этого не увидит.
//
// Требуется запущенный dev-сервер: npm run dev
// Запуск: node tools/smoke-check.mjs
import { chromium } from 'playwright'

const errors = []
const ok = []
const check = (n, v, d = '') => { ok.push(v); console.log(`  ${v ? '✓' : '✗'} ${n}${d ? '  — ' + d : ''}`) }

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
// Вне iframe Яндекса SDK ругается на каждый вызов рекламы («No parent to post
// message») — это ожидаемо и к игре отношения не имеет (см. Platform._embedded).
const ourFault = (txt) => !String(txt).includes('No parent to post message')
const watch = (p, tag) => {
  p.on('pageerror', (e) => { if (ourFault(e.message)) errors.push(`${tag}pageerror: ${e.message}`) })
  p.on('console', (m) => { if (m.type() === 'error' && ourFault(m.text())) errors.push(`${tag}console: ${m.text()}`) })
}
watch(page, '')

await page.goto('http://localhost:5173/?lang=ru', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__yp?.game?.scene.getScenes(true).length, null, { timeout: 60000 })
await page.waitForTimeout(2500)

console.log('\n=== Сквозной обход экранов ===\n')

// Богатое состояние: есть всё, что можно нажать.
await page.evaluate(async () => {
  const { State } = window.__yp
  const { rollItem } = await import('/src/data/loot.js')
  const rng = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(11)
  State.heroClass = 'gunner'
  State.hero = { level: 120, xp: 0, points: 60, str: 200, vit: 300, luck: 90 }
  State.caps = 1e9; State.scrap = 1e6; State.cores = 40
  State.totalKills = 20000; State.bestScore = 20000; State.zoneIndex = 65
  State.killBudget = 1e6; State.battleSeconds = 1e5
  State.relicParts = ['gear', 'core', 'coil', 'lens', 'grip']
  State.inventory = []
  for (let i = 0; i < 40; i++) State.addItem(rollItem(rng, 50, 3))
  for (const [key, slot] of [['weapon', 'weapon'], ['helmet', 'helmet'], ['armor', 'armor'], ['boots', 'boots']]) {
    State.equipment[key] = rollItem(rng, 50, 0, 'epic', slot)
  }
  State.hp = State.heroMaxHp()
})

const scenes = ['HubScene', 'ShopScene', 'InventoryScene', 'HeroScene', 'ForgeScene', 'PrestigeScene', 'LeaderboardScene', 'BattleScene']
for (const key of scenes) {
  const before = errors.length
  await page.evaluate((k) => {
    const { game } = window.__yp
    for (const sc of game.scene.getScenes(true)) if (sc.scene.key !== 'BootScene') sc.scene.stop()
    game.scene.start(k)
  }, key)
  await page.waitForTimeout(1300)
  const alive = await page.evaluate((k) => {
    const sc = window.__yp.game.scene.getScene(k)
    return !!sc && sc.scene.isActive() && sc.children.list.length > 0
  }, key)
  check(`${key}: открылся и отрисовался`, alive && errors.length === before,
    errors.slice(before).join(' | ') || `объектов на сцене есть`)
}

// --- Инвентарь: надеть, снять, разобрать, продать, выковать реликвию ---
{
  const before = errors.length
  const r = await page.evaluate(async () => {
    const { State, game, SCENES } = window.__yp
    for (const sc of game.scene.getScenes(true)) if (sc.scene.key !== 'BootScene') sc.scene.stop()
    game.scene.start(SCENES.INVENTORY)
    await new Promise(res => setTimeout(res, 900))
    const sc = game.scene.getScene('InventoryScene')
    const uid = State.inventory[0].uid
    State.equip(uid); sc.safeRender()
    State.unequip('weapon'); sc.safeRender()
    State.scrapItem(State.inventory[0].uid); sc.safeRender()
    State.sellItem(State.inventory[0].uid); sc.safeRender()
    const relic = State.craftRelic(); sc.safeRender()
    const bulk = State.scrapAllUpTo(1); sc.safeRender()
    return { relic: relic && relic.rarity, разобрано: bulk.count, осталось: State.inventory.length }
  })
  await page.waitForTimeout(500)
  check('инвентарь: надеть/снять/разобрать/продать/выковать', errors.length === before && r.relic === 'relic',
    `реликвия: ${r.relic}, массовый разбор: ${r.разобрано}`)
}

// --- Верстак: все пять тиров ---
{
  const before = errors.length
  const r = await page.evaluate(async () => {
    const { State, game, SCENES } = window.__yp
    const { CRAFT_TIERS } = await import('/src/data/loot.js')
    for (const sc of game.scene.getScenes(true)) if (sc.scene.key !== 'BootScene') sc.scene.stop()
    game.scene.start(SCENES.FORGE)
    await new Promise(res => setTimeout(res, 900))
    const sc = game.scene.getScene('ForgeScene')
    const out = []
    for (const t of CRAFT_TIERS) { const it = State.craft(t.id); sc.doCraft(t.id); out.push(it && it.rarity) }
    return out
  })
  await page.waitForTimeout(500)
  check('верстак: все пять тиров куют', errors.length === before && r.every(Boolean), `результаты: ${r.join(', ')}`)
}

// --- Герой: +1 / +10 / MAX ---
{
  const before = errors.length
  const r = await page.evaluate(async () => {
    const { State, game, SCENES } = window.__yp
    State.hero.points = 100
    for (const sc of game.scene.getScenes(true)) if (sc.scene.key !== 'BootScene') sc.scene.stop()
    game.scene.start(SCENES.HERO)
    await new Promise(res => setTimeout(res, 900))
    const sc = game.scene.getScene('HeroScene')
    const a = State.spendPoints('str', 1); sc.render()
    const b = State.spendPoints('vit', 10); sc.render()
    const c = State.spendPoints('luck', State.hero.points); sc.render()
    return { a, b, c, осталось: State.hero.points }
  })
  await page.waitForTimeout(400)
  check('герой: +1 / +10 / MAX', errors.length === before && r.осталось === 0, `вложено ${r.a}+${r.b}+${r.c}`)
}

// --- Бой: стрельба, ульта, босс, окно локации, смерть ---
{
  const before = errors.length
  const r = await page.evaluate(async () => {
    const { State, game, SCENES } = window.__yp
    for (const sc of game.scene.getScenes(true)) if (sc.scene.key !== 'BootScene') sc.scene.stop()
    game.scene.start(SCENES.BATTLE)
    await new Promise(res => setTimeout(res, 1200))
    const sc = game.scene.getScene('BattleScene')
    for (let i = 0; i < 30; i++) sc.shoot(300 + i * 7, 320 + (i % 5) * 20)
    State.ult = 999; sc.tryUlt()
    sc.clearEnemies(); sc.spawnBoss()
    const boss = sc.enemies.find(e => e.isBoss)
    const tex = boss && boss.sprite.texture.key
    sc.killEnemy(boss)                       // босс убит → окно «локация взята»
    await new Promise(res => setTimeout(res, 500))
    const zoneModal = !!sc._zoneModal
    State.hp = 0; sc.heroDie()
    await new Promise(res => setTimeout(res, 500))
    return { tex, zoneModal, death: !!sc._deathModal }
  })
  await page.waitForTimeout(600)
  check('бой: выстрелы, ульта, босс, окно локации, смерть',
    errors.length === before && r.zoneModal && r.death && String(r.tex).startsWith('boss-'),
    `босс: ${r.tex}, окно локации: ${r.zoneModal}, окно смерти: ${r.death}`)
}

// --- Окно «локация взята»: бой обязан стоять, пока игрок выбирает ---
//
// Раньше вставала только подача НОВЫХ врагов, а те, кто уже стоял на арене,
// продолжали подходить и бить: игрок читал награду, а его в это время убивали.
{
  const before = errors.length
  // Работаем с ТОЙ ЖЕ сценой боя, что осталась от предыдущего блока (там герой
  // пал). Перезапускать её не нужно: stop+start в одном кадре оставляют сцену
  // полусобранной — cameras.main ещё нет, и spawnBoss падает.
  await page.evaluate(() => {
    const { State, game } = window.__yp
    const sc = game.scene.getScene('BattleScene')
    sc.closeDeathModal()
    State.resolvePendingDeath()
    State.hp = State.heroMaxHp()
  })
  await page.waitForTimeout(500)
  const r = await page.evaluate(async () => {
    const { State, game } = window.__yp
    const sc = game.scene.getScene('BattleScene')
    // Ставим полную волну вплотную к герою и добиваем босса — ровно та картинка,
    // на которой игрока и убивали.
    sc.clearEnemies()
    for (let i = 0; i < 6; i++) sc.enemies.push(sc.makeEnemy(sc.zone.enemies[0], false, i, 6, sc.hero.x + 50 + i * 30))
    State.hp = State.heroMaxHp()
    State.killsInZone = 100
    sc.spawnBoss()
    sc.killEnemy(sc.enemies.find(x => x.isBoss))
    const t0 = { hp: State.hp, n: sc.enemies.length, bs: State.battleSeconds, modal: !!sc._zoneModal }
    await new Promise(res => setTimeout(res, 5000))     // «игрок читает и выбирает»
    const t1 = { hp: State.hp, n: sc.enemies.length, bs: State.battleSeconds }
    return { t0, t1 }
  })
  check('окно «локация взята»: герой не теряет HP и волна не растёт',
    errors.length === before && r.t0.modal && r.t1.hp === r.t0.hp && r.t1.n === r.t0.n,
    `HP ${Math.round(r.t0.hp)} → ${Math.round(r.t1.hp)}, врагов ${r.t0.n} → ${r.t1.n}`)
  check('и время боя на окне не копится (бюджет рекорда не растёт)',
    Math.abs(r.t1.bs - r.t0.bs) < 0.5, `+${(r.t1.bs - r.t0.bs).toFixed(2)} с за 5 с`)

  // Кнопка «Идти дальше» закрывает окно и начинает новую локацию с чистой ареной.
  const btn = await page.evaluate(() => {
    const sc = window.__yp.game.scene.getScene('BattleScene')
    for (const o of sc._zoneModal || []) {
      const txt = o.list && o.list.find(k => k.type === 'Text' && String(k.text).includes('дальше'))
      if (txt) return { x: Math.round(o.x), y: Math.round(o.y) }
    }
    return null
  })
  if (btn) await page.mouse.click(btn.x, btn.y)
  await page.waitForTimeout(900)
  const after = await page.evaluate(() => {
    const sc = window.__yp.game.scene.getScene('BattleScene')
    return { modal: !!sc._zoneModal, n: sc.enemies.length }
  })
  check('«Идти дальше» закрывает окно и убирает прошлую волну',
    btn && !after.modal, `окно: ${after.modal ? 'осталось' : 'закрыто'}, врагов на арене: ${after.n}`)
}

// --- Английский язык: все экраны ещё раз ---
{
  const before = errors.length
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  watch(p2, 'EN ')
  await p2.goto('http://localhost:5173/?lang=en', { waitUntil: 'domcontentloaded' })
  await p2.waitForFunction(() => window.__yp?.game?.scene.getScenes(true).length, null, { timeout: 60000 })
  await p2.waitForTimeout(2000)
  await p2.evaluate(() => {
    const { State } = window.__yp
    State.heroClass = 'gunner'; State.caps = 1e6; State.scrap = 1e5; State.hero.points = 20
  })
  for (const key of scenes) {
    await p2.evaluate((k) => {
      const { game } = window.__yp
      for (const sc of game.scene.getScenes(true)) if (sc.scene.key !== 'BootScene') sc.scene.stop()
      game.scene.start(k)
    }, key)
    await p2.waitForTimeout(700)
  }
  await p2.close()
  check('английская локализация: все экраны без ошибок', errors.length === before,
    errors.slice(before).join(' | ') || 'чисто')
}

await browser.close()
console.log(`\nОшибок в консоли за весь обход: ${errors.length}`)
if (errors.length) console.log(errors.map(e => '  - ' + e).join('\n'))
const bad = ok.filter(v => !v).length
console.log(`\nИтог: ${ok.length - bad}/${ok.length}`)
if (bad || errors.length) process.exit(1)
