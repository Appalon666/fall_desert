import { describe, it, expect, vi } from 'vitest'
import { Emitter } from '../src/util/emitter.js'

describe('Emitter', () => {
  it('on/emit вызывает подписчика с аргументами', () => {
    const e = new Emitter()
    const fn = vi.fn()
    e.on('x', fn)
    e.emit('x', 1, 2)
    expect(fn).toHaveBeenCalledWith(1, 2)
  })
  it('off отписывает', () => {
    const e = new Emitter()
    const fn = vi.fn()
    e.on('x', fn); e.off('x', fn); e.emit('x')
    expect(fn).not.toHaveBeenCalled()
  })
  it('once срабатывает ровно один раз', () => {
    const e = new Emitter()
    const fn = vi.fn()
    e.once('x', fn); e.emit('x'); e.emit('x')
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('emit без подписчиков не падает', () => {
    const e = new Emitter()
    expect(() => e.emit('nope')).not.toThrow()
    expect(e.emit('nope')).toBe(false)
  })
})
