// Крошечный синхронный EventEmitter — чтобы состояние/данные не зависели от
// Phaser (тестируется в обычном node) и не тянули движок ради pub/sub.
// API совместимо с тем, что использует игра (on/once/off/emit).

export class Emitter {
  constructor() { this._h = Object.create(null) }
  on(ev, fn, ctx) { (this._h[ev] || (this._h[ev] = [])).push({ fn, ctx }); return this }
  off(ev, fn) { if (this._h[ev]) this._h[ev] = this._h[ev].filter(h => h.fn !== fn); return this }
  once(ev, fn, ctx) {
    const wrap = (...a) => { this.off(ev, wrap); fn.apply(ctx, a) }
    return this.on(ev, wrap, ctx)
  }
  emit(ev, ...args) {
    const hs = this._h[ev]
    if (!hs || !hs.length) return false
    for (const h of hs.slice()) h.fn.apply(h.ctx, args)
    return true
  }
  removeAllListeners(ev) { if (ev) delete this._h[ev]; else this._h = Object.create(null); return this }
}
