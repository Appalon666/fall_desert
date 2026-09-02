// Тесты «подпись не врёт»: числа, которые экраны обещают игроку, должны
// совпадать с тем, что реально делает код.
//
// Зачем отдельный файл. Проценты бонусов живут в двух местах — в формуле
// (GameState / balance.js) и в строке описания на экране. Формулу правят при
// балансировке, строку забывают, и экран месяцами обещает не то. Так уже
// случилось дважды: престиж давал +20/+20/+15%, а показывал +10/+10/+8%;
// живучесть давала +30 HP за очко, а показывала +25.
//
// Описания читаем из ИСХОДНИКА сцен, а не импортом: сцены тянут за собой Phaser,
// а проверяем мы здесь текст, а не поведение (тот же приём, что в проверке
// дублей словаря в data.test.js).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { GameState } from '../src/state/GameState.js'
import { BAL } from '../src/data/balance.js'
import { setLang, t } from '../src/i18n.js'

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')

// Достаём таблицу вида { id: '...', ..., desc: '...' } из исходника сцены.
function descsOf(code) {
  const out = {}
  for (const m of code.matchAll(/id:\s*'([a-z]+)'[^\n]*?desc:\s*'((?:[^'\\]|\\.)*)'/g)) out[m[1]] = m[2]
  return out
}
// Первое число в строке описания («+20% урон клика…» → 20).
const num = (s) => Number((s.match(/-?\d+(?:\.\d+)?/) || [NaN])[0])

describe('описания престижа совпадают с кодом', () => {
  const D = descsOf(src('../src/scenes/PrestigeScene.js'))
  // Множитель одного уровня бонуса, снятый с самой формулы.
  const perLevel = (id, read) => {
    const s = new GameState()
    const before = read(s)
    s.prestige[id] = 1
    return read(s) - before
  }

  it('карточек четыре и у каждой есть описание', () => {
    expect(Object.keys(D).sort()).toEqual(['legacy', 'quickstart', 'stash', 'vitality'])
  })

  it('«Наследие бойца» обещает столько же, сколько даёт prestigeDamageMul', () => {
    expect(num(D.legacy)).toBeCloseTo(perLevel('legacy', s => s.prestigeDamageMul()) * 100, 6)
  })
  it('«Схрон» обещает столько же, сколько даёт prestigeCapsMul', () => {
    expect(num(D.stash)).toBeCloseTo(perLevel('stash', s => s.prestigeCapsMul()) * 100, 6)
  })
  it('«Крепкий род» обещает столько же, сколько даёт prestigeHpMul', () => {
    expect(num(D.vitality)).toBeCloseTo(perLevel('vitality', s => s.prestigeHpMul()) * 100, 6)
  })
  it('«Быстрый старт» обещает столько крышек, сколько кладёт resetRun', () => {
    const s = new GameState()
    s.prestige.quickstart = 1
    s.resetRun()
    expect(num(D.quickstart)).toBe(s.caps)
    expect(s.upgLevel('damage')).toBe(1) // и обещанный уровень «Калибра»
  })
})

describe('описания характеристик совпадают с балансом', () => {
  const D = descsOf(src('../src/scenes/HeroScene.js'))

  it('«Сила» обещает BAL.perStrength урона за очко', () => {
    expect(num(D.str)).toBe(BAL.perStrength)
  })
  it('«Живучесть» обещает BAL.perVitality HP за очко', () => {
    expect(num(D.vit)).toBe(BAL.perVitality)
    // и столько же реально прибавляется к максимуму
    const s = new GameState()
    const before = s.heroMaxHp()
    s.hero.points = 1
    s.spendPoint('vit')
    expect(s.heroMaxHp() - before).toBe(BAL.perVitality)
  })
  it('«Удача» обещает BAL.perLuckCrit крита за очко', () => {
    expect(num(D.luck)).toBeCloseTo(BAL.perLuckCrit * 100, 6)
  })
})

describe('исправленные описания переведены на английский', () => {
  it('строки престижа и характеристик есть в словаре', () => {
    const all = [
      ...Object.values(descsOf(src('../src/scenes/PrestigeScene.js'))),
      ...Object.values(descsOf(src('../src/scenes/HeroScene.js'))),
    ]
    setLang('en')
    try {
      for (const ru of all) expect(t(ru), ru).not.toBe(ru)
    } finally { setLang('ru') }
  })
})
