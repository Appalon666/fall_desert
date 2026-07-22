// Фоновая музыка. Треки-файлы кладутся в public/music/ (см. README там).
// Если файлов нет — модуль молча бездействует (игра работает без музыки).
// Один зацикленный трек за раз: меню и бой — разные, переключаются плавно.

import { Sfx } from './sfx.js'

class MusicEngine {
  constructor() {
    this.currentKey = null
    this.sound = null
    this.vol = 0.32
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
    try {
      this.sound = scene.sound.add(key, { loop: true, volume: Sfx.muted ? 0 : this.vol })
      this.sound.play()
      // мягкое появление
      if (!Sfx.muted && scene.tweens) { this.sound.setVolume(0); scene.tweens.add({ targets: this.sound, volume: this.vol, duration: 900 }) }
    } catch (e) { this.sound = null; this.currentKey = null }
  }

  stop() {
    if (this.sound) { try { this.sound.stop(); this.sound.destroy() } catch (e) { /* */ } }
    this.sound = null; this.currentKey = null
  }

  setMuted(m) { if (this.sound) { try { this.sound.setVolume(m ? 0 : this.vol) } catch (e) { /* */ } } }
}

export const Music = new MusicEngine()
