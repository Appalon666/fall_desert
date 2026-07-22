// Фоновая музыка. Треки-файлы кладутся в public/music/ (см. README там).
// Если файлов нет — модуль молча бездействует (игра работает без музыки).
// Один зацикленный трек за раз: меню и бой — разные, переключаются плавно.

import { Sfx } from './sfx.js'

const MUS_KEY = 'yp_musvol'
const MUSIC_BASE = 0.4 // базовая громкость музыки при volume=1

class MusicEngine {
  constructor() {
    this.currentKey = null
    this.sound = null
    let v = 1
    try { const s = parseFloat(localStorage.getItem(MUS_KEY)); if (Number.isFinite(s)) v = Math.min(1, Math.max(0, s)) } catch (e) { /* */ }
    this.userVolume = v // 0..1
  }

  effVol() { return Sfx.muted ? 0 : MUSIC_BASE * this.userVolume }
  setUserVolume(v) {
    this.userVolume = Math.min(1, Math.max(0, v))
    try { localStorage.setItem(MUS_KEY, String(this.userVolume)) } catch (e) { /* */ }
    if (this.sound) { try { this.sound.setVolume(this.effVol()) } catch (e) { /* */ } }
  }

  // Очередь загрузки в BootScene.preload(). Отсутствующие файлы дают loaderror
  // (перехвачен в Boot) и просто не воспроизводятся.
  queue(loader) {
    loader.audio('bgm_menu', ['music/menu.ogg', 'music/menu.mp3'])
    loader.audio('bgm_battle', ['music/battle.ogg', 'music/battle.mp3'])
  }

  has(scene, key) { try { return scene.sound && scene.cache.audio.exists(key) } catch (e) { return false } }

  // Включить трек key (если он загружен). Тот же трек уже играет — ничего.
  play(scene, key) {
    if (this.currentKey === key && this.sound && this.sound.isPlaying) return
    if (!this.has(scene, key)) return
    // Аудио заблокировано до первого жеста — дождёмся разблокировки.
    if (scene.sound.locked) { scene.sound.once('unlocked', () => this.play(scene, key)); return }
    this.stop()
    this.currentKey = key
    const vol = this.effVol()
    try {
      this.sound = scene.sound.add(key, { loop: true, volume: vol })
      this.sound.play()
      // мягкое появление
      if (vol > 0 && scene.tweens) { this.sound.setVolume(0); scene.tweens.add({ targets: this.sound, volume: vol, duration: 900 }) }
    } catch (e) { this.sound = null; this.currentKey = null }
  }

  stop() {
    if (this.sound) { try { this.sound.stop(); this.sound.destroy() } catch (e) { /* */ } }
    this.sound = null; this.currentKey = null
  }

  setMuted(m) { if (this.sound) { try { this.sound.setVolume(m ? 0 : MUSIC_BASE * this.userVolume) } catch (e) { /* */ } } }
}

export const Music = new MusicEngine()
