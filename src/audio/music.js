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

  has(scene, key) { try { return scene.sound && scene.cache.audio.exists(key) } catch (e) { return false } }

  // Треки догружаются фоном (см. assets.js): когда файлы приехали, включаем тот
  // трек, который сцена уже просила.
  retry() {
    const s = this.wantScene, k = this.wantKey
    if (!s || !k) return
    try { if (!s.scene || !s.scene.isActive()) return } catch (e) { return }
    this.play(s, k)
  }

  // Включить трек key (если он загружен). Тот же трек уже играет — ничего.
  play(scene, key) {
    this.wantScene = scene; this.wantKey = key
    if (this.currentKey === key && this.sound && this.sound.isPlaying) return
    if (!this.has(scene, key)) return
    // Аудио заблокировано до первого жеста — дождёмся разблокировки. Вешаем
    // ОДИН слушатель на всё время блокировки и будим через retry(): он играет
    // последний запрошенный трек и проверяет, что сцена ещё жива. Раньше здесь
    // подписывался новый once на каждый вызов play, и переход «лагерь → бой →
    // лагерь» до первого жеста оставлял очередь колбэков с ссылками на уже
    // уничтоженные сцены.
    if (scene.sound.locked) {
      if (!this._waitingUnlock) {
        this._waitingUnlock = true
        scene.sound.once('unlocked', () => { this._waitingUnlock = false; this.retry() })
      }
      return
    }
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
