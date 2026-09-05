// Inventory — «кукла» персонажа как в шутерах: слоты вокруг героя
// (оружие, шлем, броня, обувь, 2 аксессуара) + список добычи справа.
// Клик по слоту — снять; клик по предмету — надеть; «продать» — за крышки.

import Phaser from 'phaser'
import { GAME, COLORS, CSS, SCENES, TEX } from '../config.js'
import { State } from '../state/GameState.js'
import { RARITY_BY_ID, SLOT_BY_ID, STAT_SHORT, scrapValue, itemQuality, itemRank, itemStats } from '../data/loot.js'
import { RELIC_PARTS } from '../data/relics.js'
import { createButton } from '../ui/Button.js'
import { buildBackground, titleText, applyPostFX, resIcon, itemIcon } from '../ui/scenery.js'
import { heroScaleFor } from '../assets.js'
import { Sfx } from '../audio/sfx.js'
import { t, itemName } from '../i18n.js'
import { fmt } from '../util/format.js'

// Метаданные гнёзд «куклы».
const SLOT_META = {
  weapon: { name: 'Оружие', icon: '🔫' },
  helmet: { name: 'Шлем', icon: '⛑️' },
  armor: { name: 'Броня', icon: '🦺' },
  boots: { name: 'Обувь', icon: '🥾' },
  acc1: { name: 'Аксессуар', icon: '📿' },
  acc2: { name: 'Аксессуар', icon: '📿' },
}

// Панель набора реликвии живёт под списком добычи; список ужат до 6 строк,
// чтобы они не наезжали друг на друга.
const RELIC_PANEL_Y = 516

// Сравнение с тем, что уже надето в этом гнезде. Без него список — набор
// несравнимых процентов: «+20.0% шанс крита» у реликвии рядом с «+75% крышек» у
// легенды читается как понижение, хотя реликвия сильнее в 1.6 раза (проценты
// разных статов просто считаются по разным коэффициентам, см. itemRank).
//
// Для аксессуаров сравниваем с ЗАНЯТЫМ гнездом — с тем, что реально уступит
// место (targetKey в GameState отдаёт acc1, когда оба заняты).
function compareToEquipped(it) {
  const cur = State.equipment[State.targetKey(it.slot)]
  if (!cur) return { mark: t('↑ пусто'), color: CSS.toxic }
  const a = itemRank(it), b = itemRank(cur)
  if (a > b) return { mark: t('↑ лучше'), color: CSS.toxic }
  if (a < b) return { mark: t('↓ хуже'), color: '#c98a8a' }
  return { mark: t('= как есть'), color: '#b8ad9a' }
}

// Только что добытый предмет (ковка, дроп, крафт на верстаке) — см.
// GameState.addItem. Список показывает шесть строк из сотен, и без этого
// свежая вещь тонула среди старых.
const isNew = (it) => !!(it && State.lastItemUid && it.uid === State.lastItemUid)

// Проценты у статов печатаются по-разному: шанс крита считается по другому
// коэффициенту и бывает дробным, остальные — целые.
const pct = (st) => (st.stat === 'critChance' ? (st.value * 100).toFixed(1) : (st.value * 100).toFixed(0))

// Статы словами — для списка добычи (там на строку есть 320 px).
function statText(it) {
  return itemStats(it).map(st => `+${pct(st)}% ${t(STAT_SHORT[st.stat] || st.stat)}`).join(' · ')
}
// Статы для карточки «куклы» — одной строкой; переносит её wordWrap по ширине
// карточки. Раскладывать вручную нельзя: длина подписи зависит от стата
// («союзники» вдвое длиннее «HP»), и любое ручное деление где-нибудь вылезет.
function statLines(it) {
  return itemStats(it).map(st => `+${pct(st)}% ${t(STAT_SHORT[st.stat] || st.stat)}`).join(' · ')
}

export default class InventoryScene extends Phaser.Scene {
  constructor() { super(SCENES.INVENTORY) }

  create() {
    buildBackground(this, { sky: 0x1c1a20, ground: 0x2a2630, accent: 0x6b6b73 }, { groundY: GAME.HEIGHT * 0.88, dust: false })
    applyPostFX(this, true, 0.4)
    titleText(this, GAME.WIDTH / 2, 36, t('ИНВЕНТАРЬ'), { size: 32 })
    resIcon(this, 40, 36, 'caps', 36)
    this.capsText = this.add.text(62, 36, '', { fontFamily: 'Rubik, sans-serif', fontSize: '24px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0, 0.5)
    resIcon(this, 220, 36, 'scrap', 26)
    this.scrapText = this.add.text(242, 36, '', { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: '#d8d8e0', fontStyle: 'bold' }).setOrigin(0, 0.5)

    this.add.text(GAME.WIDTH * 0.72, 74, t('ДОБЫЧА'), { fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: CSS.toxic, fontStyle: 'bold' }).setOrigin(0.5)
    // Три массовые операции в ряд под списком добычи. Разбор хлама (серое+
    // зелёное) идёт без вопросов — терять там нечего; «всё в лом» и «продать
    // всё» спрашивают, потому что заметают и легенды с реликвиями.
    // Надетое ни одна из них не трогает: оно лежит не в рюкзаке (см. bulkValue).
    const bx = GAME.WIDTH * 0.72, by = GAME.HEIGHT - 40, bw = 164
    createButton(this, bx - bw - 14, by, {
      label: t('🔩 Хлам и годное'), width: bw, height: 52, fontSize: 15, color: COLORS.steelDark, hover: COLORS.steel,
      onClick: () => { const r = State.scrapAllUpTo(1); if (r.count) Sfx.click(); this.safeRender() },
    })
    createButton(this, bx, by, {
      label: t('🔩 Всё в лом'), width: bw, height: 52, fontSize: 15, color: COLORS.steelDark, hover: COLORS.steel,
      onClick: () => this.confirmBulk('scrap'),
    })
    createButton(this, bx + bw + 14, by, {
      label: t('💰 Продать всё'), width: bw, height: 52, fontSize: 15, color: COLORS.rust, hover: COLORS.rustLight,
      onClick: () => this.confirmBulk('sell'),
    })

    createButton(this, GAME.WIDTH * 0.28, GAME.HEIGHT - 40, { label: t('⟵ В лагерь'), width: 260, height: 50, onClick: () => this.scene.start(SCENES.HUB) })

    this.uiObjs = []
    this.safeRender()
  }

  // Подтверждение массовой операции. Спрашиваем всегда, даже когда рюкзак
  // пуст, — молчаливая кнопка выглядит как сломанная; вместо суммы тогда
  // показываем, что чистить нечего.
  //
  // Слои обязательны (тот же приём, что в сбросе прогресса на экране героя):
  // без depth окно живёт на нулевом слое вместе со списком добычи, и строки
  // предметов под ним перехватывают клики по «Да».
  confirmBulk(mode) {
    if (this._modal) return // второй клик не должен вешать окно поверх окна
    const cx = GAME.WIDTH / 2, cy = GAME.HEIGHT / 2
    const { count, scrapGain, capsGain } = State.bulkValue()
    const gain = mode === 'scrap' ? scrapGain : capsGain
    const body = count === 0
      ? t('В рюкзаке пусто — разбирать нечего.')
      : mode === 'scrap'
        ? t('Разобрать {n} предметов в металлолом?\nНадетое останется на герое.\nПолучишь 🔩 {g}', { n: count, g: fmt(gain) })
        : t('Продать {n} предметов за крышки?\nНадетое останется на герое.\nПолучишь 🍾 {g}', { n: count, g: fmt(gain) })

    const objs = []
    const close = () => { objs.forEach(o => o.destroy()); this._modal = null }
    this._modal = true
    objs.push(this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, COLORS.ink, 0.78).setOrigin(0).setDepth(120).setInteractive())
    objs.push(this.add.text(cx, cy - 64, body, {
      fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: '#fff', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5).setDepth(121))
    if (count === 0) {
      objs.push(createButton(this, cx, cy + 40, { label: t('Понятно!'), width: 220, height: 54, onClick: close }).setDepth(122))
      return
    }
    objs.push(createButton(this, cx - 120, cy + 40, {
      label: mode === 'scrap' ? t('В лом') : t('Продать'), width: 200, height: 54,
      color: COLORS.blood, hover: 0xc23b3b,
      onClick: () => {
        const r = mode === 'scrap' ? State.scrapAll() : State.sellAll()
        close()
        if (r.count) Sfx.levelup()
        this.safeRender()
      },
    }).setDepth(122))
    objs.push(createButton(this, cx + 120, cy + 40, { label: t('Отмена'), width: 200, height: 54, onClick: close }).setDepth(122))
  }

  // Отрисовка с защитой: любой сбой не «замораживает» игру — кнопка выхода жива.
  safeRender() {
    try { this.render() } catch (e) {
      console.error('[Инвентарь] ошибка отрисовки:', e)
      this.add.text(GAME.WIDTH / 2, GAME.HEIGHT / 2, t('Не удалось открыть инвентарь.\nВернись в лагерь.'), {
        fontFamily: 'Rubik, sans-serif', fontSize: '22px', color: '#ff6a6a', align: 'center',
      }).setOrigin(0.5)
    }
  }

  render() {
    this.uiObjs.forEach(o => o.destroy())
    this.uiObjs = []
    this.capsText.setText(fmt(State.caps))
    this.scrapText.setText(fmt(State.scrap))

    // --- Кукла персонажа ---
    const hx = GAME.WIDTH * 0.26, hy = 330
    const cls = State.classDef()
    const heroTex = (cls && cls.tex) || TEX.HERO
    const footY = (cls && cls.footY) || 0.98 // ноги на одной линии для всех классов
    // Кукла чуть уже: карточки слотов подросли под крупный шрифт (п.1.8),
    // и герой не должен на них наезжать.
    const heroImg = this.add.image(hx, hy + 85, heroTex, 0).setOrigin(0.5, footY).setScale(heroScaleFor(this, heroTex, 130))
    const clsLabel = this.add.text(hx, hy + 148, cls ? t(cls.name) : '', { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: CSS.cap, fontStyle: 'bold' }).setOrigin(0.5)
    this.uiObjs.push(heroImg, clsLabel)

    const slotPos = {
      helmet: [hx, hy - 180],
      weapon: [hx - 205, hy - 40],
      armor: [hx + 205, hy - 40],
      acc1: [hx - 205, hy + 80],
      acc2: [hx + 205, hy + 80],
      boots: [hx, hy + 210],
    }
    for (const key of Object.keys(SLOT_META)) {
      const [x, y] = slotPos[key]
      this.makeSlot(key, x, y)
    }

    // Сводка бонусов экипировки
    const sum = this.add.text(hx, hy + 272, this.equipSummary(), { fontFamily: 'monospace', fontSize: '16px', color: '#ddd2b4', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0)
    this.uiObjs.push(sum)

    // --- Список добычи ---
    this.renderLoot()
    // --- Набор реликвии ---
    this.renderRelicPanel()
  }

  // Панель набора: пять гнёзд под части + ковка, когда собраны все.
  // Части падают только с босса десятой локации (см. isRelicZone), поэтому до
  // первой части панель объясняет, куда идти, а не просто светит пустотой.
  renderRelicPanel() {
    // Панель шире и выше прежней (520×108). Причина: подписи частей набраны
    // 16-м кеглем — ниже нельзя (MIN_FONT, п.1.8), — и в прежний шаг гнёзд 62 px
    // «Сердечник» не помещался: подписи налезали друг на друга, а нижняя строка
    // уезжала за край панели.
    const x = GAME.WIDTH * 0.72 - 260, y = RELIC_PANEL_Y, w = 600, h = 124
    const ready = State.canCraftRelic()
    const relic = RARITY_BY_ID.relic
    const c = this.add.container(x, y)
    const bg = this.add.graphics()
    bg.fillStyle(0x241a12, 0.92); bg.fillRoundedRect(0, 0, w, h, 10)
    bg.lineStyle(2, relic.color, ready ? 1 : 0.5); bg.strokeRoundedRect(0, 0, w, h, 10)
    const owned = State.relicPartsOwned().length
    const head = this.add.text(12, 10, t('НАБОР РЕЛИКВИИ  {a}/{b}', { a: owned, b: RELIC_PARTS.length }), {
      fontFamily: 'Rubik, sans-serif', fontSize: '17px', color: relic.css, fontStyle: 'bold',
    }).setOrigin(0)
    c.add([bg, head])

    // Гнёзда частей: собранная — своя иконка и красная рамка, недостающая — тусклая.
    RELIC_PARTS.forEach((p, i) => {
      const px = 14 + i * 84, py = 40, s = 54
      const has = State.hasRelicPart(p.id)
      const box = this.add.graphics()
      box.fillStyle(has ? 0x3a2410 : COLORS.steelDark, 1); box.fillRoundedRect(px, py, s, s, 8)
      box.lineStyle(2, has ? relic.color : COLORS.ink, has ? 1 : 0.6); box.strokeRoundedRect(px, py, s, s, 8)
      const icon = this.add.text(px + s / 2, py + s / 2, has ? p.icon : '·', {
        fontSize: has ? '26px' : '22px', color: has ? '#ffd8a8' : '#6a6458',
      }).setOrigin(0.5)
      // Только первое слово имени: «Шестерня Ядра» целиком не влезет ни в какой
      // разумный шаг гнёзд, а первого слова хватает, чтобы часть узнать.
      const nm = this.add.text(px + s / 2, py + s + 4, has ? t(p.name).split(' ')[0] : '—', {
        fontFamily: 'Rubik, sans-serif', fontSize: '11px', color: has ? '#ddd2b4' : '#7a7268',
      }).setOrigin(0.5, 0)
      c.add([box, icon, nm])
    })

    if (ready) {
      // Кнопка правее и уже прежней: гнёзда с подписями теперь занимают
      // 14…404 по ширине панели, и старая (220 px по центру w-130) на них лезла.
      const btn = createButton(this, x + w - 90, y + h / 2, {
        label: t('🔥 Выковать'), width: 160, height: 56, fontSize: 19,
        color: 0x8a4b10, hover: 0xc06a18,
        onClick: () => {
          const item = State.craftRelic()
          if (!item) return
          Sfx.levelup()
          this.safeRender()
          this.flashRelic(itemName(item.name))
        },
      })
      this.uiObjs.push(btn)
    } else {
      const hint = owned === 0
        ? t('Части падают с босса 10-й локации')
        : t('Собери все части — выкуешь случайную реликвию')
      c.add(this.add.text(w - 14, 18, hint, {
        // Уже прежнего: гнёзда с подписями заканчиваются на 404 по ширине панели.
        fontFamily: 'Rubik, sans-serif', fontSize: '13px', color: '#b8ad9a', align: 'right', wordWrap: { width: 170 },
      }).setOrigin(1, 0))
    }
    this.uiObjs.push(c)
  }

  // Всплывашка о выкованной реликвии — иначе предмет молча уезжает в список.
  flashRelic(name) {
    const txt = this.add.text(GAME.WIDTH / 2, GAME.HEIGHT / 2, t('⭐ {name}', { name }), {
      fontFamily: 'Rubik, sans-serif', fontSize: '34px', color: RARITY_BY_ID.relic.css, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100)
    this.tweens.add({ targets: txt, y: GAME.HEIGHT / 2 - 90, alpha: 0, duration: 1600, ease: 'Cubic.easeOut', onComplete: () => txt.destroy() })
  }

  equipSummary() {
    // Словами, но КОРОТКИМИ: значок стата без подписи не читается, а полными
    // названиями строка вылезала за экран — со смешанными статами ненулевыми
    // становятся почти все пять сразу.
    const parts = []
    for (const stat of ['clickMul', 'hpMul', 'critChance', 'allyMul', 'capsMul']) {
      const v = State.equipSum(stat)
      if (v > 0) {
        const n = stat === 'critChance' ? (v * 100).toFixed(1) : (v * 100).toFixed(0)
        parts.push(`+${n}% ${t(STAT_SHORT[stat] || stat)}`)
      }
    }
    if (!parts.length) return t('Экипировка пуста')
    // В ДВЕ строки: пять статов словами в одну не помещаются — строка уходила
    // за левый край экрана и под панель добычи справа.
    // Заголовок ставим В ОДНУ строку с первой половиной статов: отдельной
    // строкой сводка вырастала до трёх и наезжала на кнопку «В лагерь».
    const half = Math.ceil(parts.length / 2)
    const nl = String.fromCharCode(10)
    return t('От экипировки:') + '  ' + parts.slice(0, half).join('   ') + nl + parts.slice(half).join('   ')
  }

  // Сама иконка живёт в ui/scenery.js — её делит с верстаком (результат ковки).
  slotIcon(x, y, item, fallbackIcon, px, slotKey) {
    return itemIcon(this, x, y, item, fallbackIcon, px, slotKey)
  }

  makeSlot(key, x, y) {
    const w = 210, h = 112
    const raw = State.equipment[key]
    const it = (raw && RARITY_BY_ID[raw.rarity] && SLOT_BY_ID[raw.slot]) ? raw : null
    const rar = it ? RARITY_BY_ID[it.rarity] : null
    const meta = SLOT_META[key]
    const c = this.add.container(x, y)
    const bg = this.add.graphics()
    bg.fillStyle(COLORS.steelDark, 1); bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8)
    bg.lineStyle(2, rar ? rar.color : COLORS.ink, 0.9); bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8)
    const icon = this.slotIcon(-w / 2 + 10, 0, it, meta.icon, 36, key)
    // Заголовок слота показываем только у ПУСТОЙ карточки: там он единственное,
    // что объясняет, чего не хватает. У занятой его роль играют иконка предмета
    // и место на кукле, а строка нужна статам — их три, и в две они не влезают.
    const head = this.add.text(-w / 2 + 52, -44, it ? '' : t(meta.name), { fontFamily: 'Rubik, sans-serif', fontSize: '16px', color: '#c4b998' }).setOrigin(0, 0)
    // Имя — РОВНО В ОДНУ СТРОКУ. С переносом («Счастливый самопал» в 148 px не
    // помещается) вторая строка съезжала на статы, а те вылезали за карточку;
    // уменьшить кегль нельзя — 16 px это минимум по читаемости (см. MIN_FONT).
    // Режем по факту ширины, а не по числу букв: буквы разной ширины.
    const body = this.add.text(-w / 2 + 52, it ? -44 : -22, it ? itemName(it.name) : t('— пусто —'), {
      fontFamily: 'Rubik, sans-serif', fontSize: '16px',
      color: it ? rar.css : '#9a9078', fontStyle: 'bold',
    }).setOrigin(0, 0)
    if (it) {
      const maxW = w - 62
      let txt = itemName(it.name)
      while (body.width > maxW && txt.length > 4) {
        txt = txt.slice(0, -1)
        body.setText(txt.trimEnd() + '…')
      }
    }
    // СЛОВАМИ, а не значками: значок статa читается только если помнишь, какой
    // из них какой, — по одной иконке понять «это урон или крышки» нельзя.
    // Три стата в одну строку не влезают (кегль ниже 16 px запрещён, см.
    // MIN_FONT), поэтому раскладываем в две: главный стат отдельно, два
    // остальных — под ним. Ради этого карточка и подросла с 96 до 112.
    const st = this.add.text(-w / 2 + 52, -20, it ? statLines(it) : '', {
      fontFamily: 'Rubik, sans-serif', fontSize: '16px', color: CSS.toxic, lineSpacing: 2,
      wordWrap: { width: w - 62 },
    }).setOrigin(0, 0)
    c.add([bg, icon, head, body, st])
    if (it) {
      const z = this.add.zone(-w / 2, -h / 2, w, h).setOrigin(0).setInteractive({ useHandCursor: true })
      z.on('pointerover', () => { bg.clear(); bg.fillStyle(COLORS.rust, 1); bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8); bg.lineStyle(2, rar.color, 1); bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8) })
      z.on('pointerout', () => { bg.clear(); bg.fillStyle(COLORS.steelDark, 1); bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8); bg.lineStyle(2, rar.color, 0.9); bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8) })
      z.on('pointerup', () => { State.unequip(key); this.safeRender() })
      c.add(z)
    }
    this.uiObjs.push(c)
  }

  renderLoot() {
    // Порядок как был: по тиру, внутри тира — по качеству (доля от потолка), а
    // не по сырому value: value у крит-вещей впятеро меньше по формуле, и лучший
    // шлем оказывался ниже рядовых сапог.
    //
    // Свежую вещь наверх БОЛЬШЕ НЕ поднимаем — так решили: список должен
    // отвечать на вопрос «что у меня лучшее», а не «что упало последним».
    // Пометка «НОВОЕ» осталась: она ничего не двигает, просто помечает.
    const items = [...State.inventory].sort((a, b) =>
      (RARITY_BY_ID[b.rarity].mul - RARITY_BY_ID[a.rarity].mul)
      || (itemQuality(b) - itemQuality(a)))
    const ix = GAME.WIDTH * 0.72 - 260
    let iy = 108
    const maxRows = 6

    if (items.length === 0) {
      this.uiObjs.push(this.add.text(GAME.WIDTH * 0.72, 200, t('Пусто. Иди в поход за лутом!'), { fontFamily: 'Rubik, sans-serif', fontSize: '18px', color: '#b8ad9a' }).setOrigin(0.5))
      return
    }

    items.slice(0, maxRows).forEach(it => {
      const rar = RARITY_BY_ID[it.rarity]
      const slot = SLOT_BY_ID[it.slot]
      if (!rar || !slot) return // страховка от битых предметов
      const w = 520, h = 54
      const c = this.add.container(ix, iy)
      const bg = this.add.graphics()
      bg.fillStyle(COLORS.steelDark, 1); bg.fillRoundedRect(0, 0, w, h, 8)
      bg.lineStyle(2, rar.color, 1); bg.strokeRoundedRect(0, 0, w, h, 8)
      const icon = this.slotIcon(14, h / 2, it, slot.icon, 34, it.slot)
      const name = this.add.text(50, 12, itemName(it.name), { fontFamily: 'Rubik, sans-serif', fontSize: '17px', color: rar.css, fontStyle: 'bold' }).setOrigin(0)
      // Название слота из подписи убрано: его и так показывают иконка предмета и
      // гнездо, в которое он пойдёт, а место на строке нужно приговору справа.
      // Три стата вместо одного, поэтому названия статов короткие, а имя тира из
      // подписи убрано: тир и так виден по цвету имени и рамки.
      const st = this.add.text(50, 33, statText(it), { fontFamily: 'Rubik, sans-serif', fontSize: '13px', color: '#ddd2b4' }).setOrigin(0)
      c.add([bg, icon, name, st])
      if (isNew(it)) {
        c.add(this.add.text(56 + name.width, 14, t('НОВОЕ'), {
          fontFamily: 'Rubik, sans-serif', fontSize: '13px', color: CSS.toxic, fontStyle: 'bold',
        }).setOrigin(0))
      }
      // Приговор «лучше/хуже» — на строку С ИМЕНЕМ, к правому краю. Вторая строка
      // теперь занята тремя статами: любой кегль в игре не меньше 16 px
      // (см. MIN_FONT), и приговор туда уже не помещался.
      const cmp = compareToEquipped(it)
      c.add(this.add.text(w - 158, 14, cmp.mark, {
        fontFamily: 'Rubik, sans-serif', fontSize: '13px', color: cmp.color, fontStyle: 'bold',
      }).setOrigin(1, 0))

      const equipZone = this.add.zone(0, 0, w - 150, h).setOrigin(0).setInteractive({ useHandCursor: true })
      equipZone.on('pointerup', () => { State.equip(it.uid); this.safeRender() })
      // разобрать на металлолом
      const scrapTxt = this.add.text(w - 142, h / 2, `🔩${scrapValue(it)}`, { fontFamily: 'Rubik, sans-serif', fontSize: '14px', color: '#c8c8d2', fontStyle: 'bold' }).setOrigin(0, 0.5)
      const scrapZone = this.add.zone(w - 150, 0, 80, h).setOrigin(0).setInteractive({ useHandCursor: true })
      scrapZone.on('pointerup', () => { State.scrapItem(it.uid); Sfx.click(); this.safeRender() })
      // продать за крышки
      const sell = this.add.text(w - 16, h / 2, '💰', { fontFamily: 'Rubik, sans-serif', fontSize: '20px', color: CSS.cap }).setOrigin(1, 0.5)
      const sellZone = this.add.zone(w - 66, 0, 66, h).setOrigin(0).setInteractive({ useHandCursor: true })
      sellZone.on('pointerup', () => { State.sellItem(it.uid); this.safeRender() })
      c.add([equipZone, scrapTxt, scrapZone, sell, sellZone])
      this.uiObjs.push(c)
      iy += h + 8
    })

    if (items.length > maxRows) {
      this.uiObjs.push(this.add.text(GAME.WIDTH * 0.72, iy + 6, t('…и ещё {n} предметов', { n: items.length - maxRows }), { fontFamily: 'monospace', fontSize: '14px', color: '#b8ad9a' }).setOrigin(0.5))
    }
  }
}
