// Процедурные звуки через WebAudio — без файлов-ассетов. Короткие синты.
// Контекст создаётся при первом звуке (внутри пользовательского жеста).

const MUTE_KEY = 'yp_muted'

class SfxEngine {
  constructor() {
    this.ctx = null
    this.master = null
    let m = false
    try { m = localStorage.getItem(MUTE_KEY) === '1' } catch (e) { /* */ }
    this.muted = m
  }

  ensure() {
    if (this.ctx) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.28
      this.master.connect(this.ctx.destination)
    } catch (e) { this.ctx = null }
  }
  resume() { this.ensure(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume() }

  setMuted(m) {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.28
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch (e) { /* */ }
  }
  toggleMute() { this.setMuted(!this.muted); return this.muted }

  _tone(freq, dur, type = 'square', vol = 0.3, slideTo = null, delay = 0) {
    this.ensure()
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime + delay
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
    o.connect(g); g.connect(this.master)
    o.start(t); o.stop(t + dur + 0.02)
  }

  _noise(dur, vol = 0.3, filterFreq = 1600, delay = 0) {
    this.ensure()
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime + delay
    const n = Math.floor(this.ctx.sampleRate * dur)
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource(); src.buffer = buf
    const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = filterFreq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
    src.connect(flt); flt.connect(g); g.connect(this.master)
    src.start(t); src.stop(t + dur + 0.02)
  }

  shoot() { this._noise(0.07, 0.22, 1400); this._tone(240, 0.07, 'square', 0.12, 90) }
  hit() { this._tone(430, 0.05, 'square', 0.16, 220) }
  crit() { this._tone(720, 0.12, 'sawtooth', 0.2, 300); this._noise(0.06, 0.12, 2500) }
  kill() { this._noise(0.16, 0.28, 900); this._tone(160, 0.16, 'square', 0.14, 60) }
  cap() { this._tone(920, 0.05, 'sine', 0.14, 1300) }
  boss() { this._tone(70, 0.5, 'sawtooth', 0.32, 48); this._tone(110, 0.5, 'square', 0.16, 70) }
  ult() { this._noise(0.4, 0.35, 700); this._tone(130, 0.4, 'sawtooth', 0.28, 900) }
  levelup() { this._tone(523, 0.1, 'sine', 0.22, null, 0); this._tone(659, 0.1, 'sine', 0.22, null, 0.09); this._tone(784, 0.16, 'sine', 0.22, null, 0.18) }
  click() { this._tone(320, 0.035, 'square', 0.1) }
  death() { this._tone(300, 0.5, 'sawtooth', 0.28, 55) }
  prestige() { this._tone(392, 0.14, 'sine', 0.24, null, 0); this._tone(587, 0.14, 'sine', 0.24, null, 0.12); this._tone(880, 0.22, 'sine', 0.24, null, 0.24) }
}

export const Sfx = new SfxEngine()
