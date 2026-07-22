// Мок localStorage для node-раннера (GameState сохраняется/грузится через него).
class MemoryStorage {
  constructor() { this.m = new Map() }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null }
  setItem(k, v) { this.m.set(k, String(v)) }
  removeItem(k) { this.m.delete(k) }
  clear() { this.m.clear() }
}
if (!globalThis.localStorage) globalThis.localStorage = new MemoryStorage()
