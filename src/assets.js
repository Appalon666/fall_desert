// Загрузка ассетов по этапам (Яндекс 1.14: игра должна стартовать быстро,
// а не висеть на чёрном экране, пока качаются все 10 МБ сразу).
//
//  1. CORE   — нужно, чтобы показать меню/выбор класса (~2.5 МБ): плашка кнопки,
//              фон меню, спрайты героев, иконки, арт оружия.
//  2. BATTLE — спрайтшиты врагов и фоны зон (~4 МБ). Грузятся в BattleScene.preload
//              с видимым прогресс-баром — до первого «Похода» они не нужны.
//  3. MUSIC  — два ogg-трека (~3.6 МБ). Догружаются фоном уже во время игры;
//              когда готовы, Music сам включит нужный трек (Music.retry()).

import { ENEMY_IDS } from './data/enemies.js'

// Иконки ресурсов нужны сразу (крышки/металлолом/ядра видны в лагере).
const RES_ICONS = ['res-caps', 'res-scrap', 'res-core']
// Иконки апгрейдов/союзников/слотов — только внутри «Апгрейдов», «Инвентаря» и
// «Верстака». Пока не приехали, у всех есть эмодзи-фолбэк, поэтому грузим фоном.
const UI_ICONS = [
  'up-damage', 'up-hp', 'up-allyPower', 'up-multishot', 'up-crit',
  'ally-dog', 'ally-gunner', 'ally-turret', 'ally-sniper', 'ally-mech',
  'slot-weapon', 'slot-helmet', 'slot-armor', 'slot-boots', 'slot-accessory',
]

const ZONE_BGS = ['rust', 'city', 'bunker', 'lair']

export const HERO_CLASSES = ['gunner', 'brute', 'mechanic', 'scavenger']

// --- 1. Критичные ассеты (BootScene.preload) ---
export function loadCore(load) {
  // Листы героев грузим как ОБЫЧНЫЕ картинки: раскладку (сколько кадров и
  // какого размера) определяем потом по самому файлу — см. buildHeroSheets.
  // Так новый арт можно подменять, не трогая код.
  for (const c of HERO_CLASSES) load.image(`hero-${c}-src`, `sprites/hero-${c}.png`)
  load.image('bg-menu', 'bg/menu.jpg')      // фон лагеря
  load.image('ui-button', 'ui/button.png')  // плашка кнопки (9-slice)
  for (const k of RES_ICONS) load.image(k, `icons/${k}.png`)
}

// Превращаем загруженную картинку героя в спрайт-лист.
// Раскладка определяется по пропорциям файла:
//   широкий (соотношение > 1.5) — старый лист 3×2, 6 кадров;
//   ближе к квадрату            — новый лист 2×2, 4 кадра (атака).
// Это позволяет менять арт по одному персонажу за раз, ничего не ломая.
export function buildHeroSheets(scene) {
  for (const c of HERO_CLASSES) {
    const key = `hero-${c}`
    const srcKey = `${key}-src`
    if (scene.textures.exists(key) || !scene.textures.exists(srcKey)) continue
    const image = scene.textures.get(srcKey).getSourceImage()
    if (!image || !image.width) continue
    const cols = (image.width / image.height) > 1.5 ? 3 : 2
    const rows = 2
    const frameWidth = Math.floor(image.width / cols)
    const frameHeight = Math.floor(image.height / rows)
    try {
      scene.textures.addSpriteSheet(key, image, { frameWidth, frameHeight })
    } catch (e) { /* битый файл — останется процедурный фолбэк */ }
  }
}

// --- 1б. Иконки разделов (догружаются фоном сразу после первого экрана) ---
export function loadDeferredUi(load) {
  for (let i = 0; i < 5; i++) load.image(`weapon-${i}`, `weapons/w${i}.png`)
  for (const k of UI_ICONS) load.image(k, `icons/${k}.png`)
}

// Доля кадра, занятая персонажем на СТАРЫХ листах 3×2 (там вокруг фигуры
// оставлены поля). Новый арт обрезан вплотную, там доля равна 1.
const LEGACY_FILL = 0.85

// Масштаб героя под нужную высоту ПЕРСОНАЖА на экране. Считаем от кадра, потому
// что у нового арта размер листа свой у каждого класса; поправка на поля
// старого листа держит одинаковый вид до и после подмены арта.
export function heroScaleFor(scene, texKey, targetH) {
  try {
    const tex = scene.textures.get(texKey)
    const frame = tex.get(0)
    if (frame && frame.height) {
      const fill = tex.frameTotal - 1 > 4 ? LEGACY_FILL : 1
      return targetH / (frame.height * fill)
    }
  } catch (e) { /* */ }
  return targetH / (279 * LEGACY_FILL)
}

// Анимация атаки героя: кадры 0→3 (готов → замах → выстрел → возврат).
// На старом листе 3×2 кадров шесть, из них осмысленны первые два — там
// анимации нет, сцена просто переключает кадр.
export function buildHeroAnim(scene, texKey) {
  const key = `${texKey}-attack`
  if (scene.anims.exists(key)) return key
  let total = 0
  try { total = scene.textures.get(texKey).frameTotal - 1 } catch (e) { return null }
  if (total < 4) return null
  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(texKey, { start: 0, end: 3 }),
    frameRate: 18,
    repeat: 0,
  })
  return key
}

// --- 2. Ассеты боя (BattleScene.preload) ---
export function battleAssetsReady(scene) {
  if (!scene.textures.exists('bg-rust')) return false
  for (const id of ENEMY_IDS) {
    if (!scene.textures.exists(`enemy-${id}-src`)) return false
  }
  return true
}

export function loadBattle(load) {
  // Как и у героев — грузим картинкой, режем потом по её собственной раскладке.
  for (const id of ENEMY_IDS) load.image(`enemy-${id}-src`, `sprites/enemy-${id}.png`)
  for (const k of ZONE_BGS) load.image(`bg-${k}`, `bg/${k}.jpg`)
}

// Режем листы врагов: сетка 2×2, четыре кадра ходьбы.
export function buildEnemySheets(scene) {
  for (const id of ENEMY_IDS) {
    const key = `enemy-${id}`
    const srcKey = `${key}-src`
    if (scene.textures.exists(key) || !scene.textures.exists(srcKey)) continue
    const image = scene.textures.get(srcKey).getSourceImage()
    if (!image || !image.width) continue
    try {
      scene.textures.addSpriteSheet(key, image, {
        frameWidth: Math.floor(image.width / 2),
        frameHeight: Math.floor(image.height / 2),
      })
    } catch (e) { /* битый файл — останется процедурный фолбэк */ }
  }
}

// Цикл ходьбы врага: 4 кадра по кругу. Отдельной анимации смерти больше нет —
// вместо неё сцена играет процедурный взрыв (он и раньше был запасным путём).
export function buildEnemyAnims(scene) {
  for (const id of ENEMY_IDS) {
    const key = `enemy-${id}`
    if (!scene.textures.exists(key) || scene.textures.get(key).frameTotal - 1 < 4) continue
    if (!scene.anims.exists(`${id}-walk`)) {
      scene.anims.create({
        key: `${id}-walk`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      })
    }
  }
}

// --- 3. Музыка (фоновая догрузка из BootScene) ---
export function loadMusic(load) {
  load.audio('bgm_menu', ['music/menu.ogg', 'music/menu.mp3'])
  load.audio('bgm_battle', ['music/battle.ogg', 'music/battle.mp3'])
}
