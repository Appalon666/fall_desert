// Единая пауза игры со «счётчиком причин».
//
// Паузу просят сразу несколько независимых источников:
//   HIDDEN      — вкладка свёрнута/скрыта (Яндекс 1.3),
//   AD          — идёт полноэкранная реклама (Яндекс 4.7),
//   ORIENTATION — телефон в портрете, показан экран «поверни устройство» (1.8).
// Раньше каждый источник дёргал звук и сцены сам — и они затирали друг друга
// (например, реклама закрывалась, пока вкладка ещё скрыта, и звук возвращался).
// Теперь игра звучит и идёт, только когда НИ ОДНОЙ причины не осталось.

import { Sfx } from '../audio/sfx.js'

export const PAUSE = {
  HIDDEN: 'hidden',
  AD: 'ad',
  ORIENTATION: 'orientation',
}

class PauseManager {
  constructor() {
    this.reasons = new Set()
    this.game = null
    this.onChange = null // (paused) => {} — сюда вешаем GameplayAPI Яндекса
    this._mute = false        // громкость до паузы (чтобы вернуть как было)
    this._muteCaptured = false
  }

  attach(game) { this.game = game }

  // Пауза могла прийти ДО того, как Phaser поднял звук и сцены (телефон уже в
  // портрете на старте). Вызывается по 'ready', чтобы догнать состояние.
  reapply() { if (this.paused) this._silence() }

  get paused() { return this.reasons.size > 0 }
  has(reason) { return this.reasons.has(reason) }

  add(reason) {
    if (this.reasons.has(reason)) return
    const wasPaused = this.paused
    this.reasons.add(reason)
    if (!wasPaused) this._apply(true)
  }

  remove(reason) {
    if (!this.reasons.delete(reason)) return
    if (!this.paused) this._apply(false)
  }

  _apply(paused) {
    if (paused) this._silence()
    else this._restore()
    try { if (this.onChange) this.onChange(paused) } catch (e) { /* */ }
  }

  // Полная тишина: и свой WebAudio для SFX, и звуковой менеджер Phaser (музыка),
  // и сам аудиоконтекст. Плюс останавливаем активные сцены.
  _silence() {
    try { Sfx.suspend() } catch (e) { /* */ }
    const snd = this.game && this.game.sound
    if (snd) {
      // Запоминаем исходное значение ОДИН раз за паузу: reapply() не должен
      // «запомнить» уже выставленный mute=true и оставить игру немой навсегда.
      try {
        if (!this._muteCaptured) { this._mute = !!snd.mute; this._muteCaptured = true }
        snd.mute = true
      } catch (e) { /* */ }
      try { snd.pauseAll() } catch (e) { /* */ }
      // Аудиоконтекст Phaser НЕ трогаем: во-первых, Phaser сам поднимает его
      // обратно каждый кадр (WebAudioSoundManager.onFocus), во-вторых — пока
      // контекст усыплён, назначенное mute-значение не успевает примениться,
      // и после пробуждения звук возвращается. Тишину дают mute + pauseAll.
    }
    try {
      if (this.game) for (const sc of this.game.scene.getScenes(true)) sc.scene.pause()
    } catch (e) { /* */ }
  }

  _restore() {
    // Именно resume, а не ensure: контекст SFX создаётся при первом звуке,
    // раньше времени его поднимать незачем.
    try { if (Sfx.ctx) Sfx.resume() } catch (e) { /* */ }
    const snd = this.game && this.game.sound
    if (snd) {
      try { snd.mute = this._mute } catch (e) { /* */ }
      try { snd.resumeAll() } catch (e) { /* */ }
    }
    this._muteCaptured = false
    // Снимаем паузу со ВСЕХ приостановленных сцен, а не со списка, снятого в
    // момент паузы: пока игра стояла, набор сцен мог измениться.
    try {
      if (this.game) {
        for (const sc of this.game.scene.getScenes(false)) {
          if (sc.scene.isPaused()) sc.scene.resume()
        }
      }
    } catch (e) { /* */ }
  }
}

export const Pause = new PauseManager()
