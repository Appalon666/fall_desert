// Точка входа: конфигурация Phaser и запуск игры.
// Масштабирование FIT + автоцентр — одинаково тянется на ПК и телефоне.

import Phaser from 'phaser'
import { GAME, COLORS, SCENES } from './config.js'
import { State } from './state/GameState.js'
import BootScene from './scenes/BootScene.js'
import ClassSelectScene from './scenes/ClassSelectScene.js'
import HubScene from './scenes/HubScene.js'
import BattleScene from './scenes/BattleScene.js'
import ShopScene from './scenes/ShopScene.js'
import InventoryScene from './scenes/InventoryScene.js'
import HeroScene from './scenes/HeroScene.js'
import PrestigeScene from './scenes/PrestigeScene.js'
import LeaderboardScene from './scenes/LeaderboardScene.js'
import ForgeScene from './scenes/ForgeScene.js'
import { Platform } from './platform/yandex.js'
import { Pause, PAUSE } from './util/pause.js'

// Сигнал сторожу в index.html: модуль игры выполнился, чёрного экрана не будет.
try { window.__ypBooted = true } catch (e) { /* */ }

// Глобальный контраст текста: тёмная обводка + тень под каждой надписью,
// чтобы текст читался поверх пёстрых нарисованных фонов. Уважаем стиль:
// если у текста уже задана своя обводка (stroke) — не трогаем.
// Плюс минимальный кегль (Яндекс 1.8): мелкие подписи должны читаться и на
// телефоне — всё, что меньше MIN_FONT, поднимаем до него.
const MIN_FONT = 16
const _origText = Phaser.GameObjects.GameObjectFactory.prototype.text
Phaser.GameObjects.GameObjectFactory.prototype.text = function (x, y, text, style) {
  const t = _origText.call(this, x, y, text, style)
  const size = parseInt(t.style.fontSize, 10)
  if (Number.isFinite(size) && size > 0 && size < MIN_FONT) t.setFontSize(MIN_FONT)
  const hasStroke = style && (style.stroke || style.strokeThickness)
  if (!hasStroke && !(style && style.noOutline)) {
    const fs = parseInt(t.style.fontSize, 10) || 16
    t.setStroke('#1a1206', Math.min(6, Math.max(2, Math.round(fs * 0.13))))
    t.setShadow(0, 2, '#000000', 4, false, true)
    t.setResolution(2) // резче на масштабировании FIT
  }
  return t
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bgDark,
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
  scene: [BootScene, ClassSelectScene, HubScene, BattleScene, ShopScene, InventoryScene, HeroScene, PrestigeScene, LeaderboardScene, ForgeScene],
}

const game = new Phaser.Game(config)
Platform.attachGame(game)

// Яндекс 1.6: отключаем контекстное меню браузера в игровой области
// (правый клик на ПК, долгий тап на мобиле).
game.events.once('ready', () => {
  try { game.input.mouse?.disableContextMenu() } catch (e) { /* */ }
  // Если пауза уже была запрошена до готовности движка (например, вкладку
  // свернули на загрузке) — применяем её к звуку и сценам сейчас.
  Pause.reapply()
})
try { window.addEventListener('contextmenu', (e) => e.preventDefault()) } catch (e) { /* */ }

// Одна пауза на всех: реклама, скрытая вкладка и окно оценки просто
// «набрасывают» свою причину. Игра звучит и идёт, только когда причин нет.
Pause.onChange = (paused) => { paused ? Platform.gameplayStop() : Platform.gameplayStart() }

// Про ориентацию экрана здесь НЕТ НИ СТРОЧКИ — и это намеренно (Яндекс 1.15).
//
// Раньше тут жил экран «поверни устройство»: в портрете на сенсорном устройстве
// он показывался и вдобавок ставил игру на паузу (причина ORIENTATION). Две беды
// сразу:
//   1) свои заглушки о повороте платформа запрещает — ориентация объявляется в
//      консоли разработчика (у нас ландшафт), и заглушку рисует сам Яндекс;
//   2) он залипал. `orientationchange` на мобильных прилетает ДО того, как
//      window.innerWidth/innerHeight обновятся, поэтому при повороте в ландшафт
//      условие «высота больше ширины» ещё истинно — заглушка вставала и в
//      ландшафте, а если следом не приходил resize, снять её было некому. Пауза
//      при этом висела: экран живой, игра стоит. Ровно это модерация и увидела —
//      «заглушка в обеих ориентациях» и «игра зависает».
// Игра просто масштабируется под окно (Phaser Scale.FIT + autoCenter).

// Страховка от зависания на рекламе: см. Platform.wakeFromStuckAd. Слушаем на
// уровне документа, а не сцены, — при паузе сцены ввод Phaser не обрабатывает.
try {
  const wake = () => { try { Platform.wakeFromStuckAd() } catch (e) { /* */ } }
  document.addEventListener('pointerdown', wake, true)
  document.addEventListener('keydown', wake, true)
} catch (e) { /* */ }

// Жизненный цикл вкладки (Яндекс 1.3): при сворачивании окна, переключении
// вкладки и уходе страницы в фон на Android звука быть не должно вообще.
// visibilitychange закрывает оба случая в Chromium/Firefox; pagehide/freeze —
// подстраховка для мобильных браузеров, усыпляющих страницу без него.
//
// Возврат на вкладку (Яндекс 1.14) страхуем с запасом: паузу снимает не только
// visibilitychange, но и focus/pageshow/resume, а сверх того — секундный сторож.
// Пауза, снятая лишний раз, ничего не стоит; ЗАЛИПШАЯ пауза выглядит как
// зависшая игра, а какое именно событие браузер пришлёт при возврате из фона
// (особенно на мобильных, из bfcache), заранее не известно.
try {
  const syncVisibility = () => {
    if (document.hidden) Pause.add(PAUSE.HIDDEN)
    else Pause.remove(PAUSE.HIDDEN)
  }
  document.addEventListener('visibilitychange', syncVisibility)
  window.addEventListener('pagehide', () => Pause.add(PAUSE.HIDDEN))
  window.addEventListener('freeze', () => Pause.add(PAUSE.HIDDEN))
  window.addEventListener('pageshow', syncVisibility)
  window.addEventListener('resume', syncVisibility)
  window.addEventListener('focus', syncVisibility)
  setInterval(syncVisibility, 1000) // сторож: событие могло не прийти вовсе
  syncVisibility()
} catch (e) { /* */ }

// Отладочная ссылка на сцены в консоли браузера. Только в dev-сборке: в
// production этот блок вырезается целиком, наружу ничего не торчит.
//
// window.__yp нужен ещё и для автопроверок: съёмки промо-скриншотов
// (tools/shots.mjs) и проверки поведения звука по требованиям Яндекса
// (tools/audio-check.mjs) — без него пришлось бы каждый сценарий проходить
// руками и верить на глаз.
if (import.meta.env?.DEV) {
  console.log('[Пустошь] Каркас запущен. Сцены:', Object.values(SCENES).join(' → '))
  window.__yp = { game, State, SCENES, Pause, PAUSE, Platform }
}
