// Зоны (3-4) с разным визуалом и своим пулом врагов.
// После последней зоны включается бесконечный режим (endless) с ростом сложности.

export const ZONES = [
  {
    name: 'Ржавый Пустырь',
    sky: 0x2c2416, ground: 0x8a4b2a, accent: 0xc9a76a,
    enemies: ['radrat', 'crawler', 'wasp', 'ghoul'],
    bossTint: 0xb5652f,
  },
  {
    name: 'Руины Города',
    sky: 0x23262b, ground: 0x3c3c42, accent: 0x6b6b73,
    enemies: ['ghoul', 'raider', 'lurker', 'dog'],
    bossTint: 0x8a8a92,
  },
  {
    name: 'Токсичный Бункер',
    sky: 0x16240f, ground: 0x2c3a12, accent: 0x8fbf3f,
    enemies: ['bloat', 'spitter', 'brute', 'ghoul'],
    bossTint: 0x8fbf3f,
  },
  {
    name: 'Логово Босса',
    sky: 0x2a1010, ground: 0x3a1414, accent: 0x9c2b2b,
    enemies: ['brute', 'lurker', 'raider', 'bloat', 'dog'],
    bossTint: 0xff5a3c,
  },
]

// Зона по индексу; за пределами списка — бесконечное повторение последних с усложнением.
export function getZone(index) {
  if (index < ZONES.length) return { ...ZONES[index], endless: false, loop: 0 }
  const loop = index - ZONES.length + 1
  const base = ZONES[ZONES.length - 1]
  return { ...base, name: `${base.name} +${loop}`, endless: true, loop }
}
