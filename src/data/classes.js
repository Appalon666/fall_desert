// Классы героя. Выбираются один раз при первом входе. Дают постоянные бонусы,
// стартовые характеристики и иногда стартового союзника.
// bonus.* складывается с апгрейдами/экипировкой в GameState.

export const CLASSES = [
  {
    id: 'gunner', name: 'Стрелок', icon: '🔫',
    desc: 'Мастер точного выстрела. Быстрая активная стрельба и криты.',
    perks: ['+25% урон клика', '+5% шанс крита'],
    bonus: { clickMul: 0.25, critChance: 0.05 },
    startStats: { str: 2, vit: 0, luck: 1 },
    startAllies: {}, lootLuck: 0,
    tex: 'tex-hero-gunner', color: 0xd88a3a,
  },
  {
    id: 'brute', name: 'Бугай', icon: '🛡️',
    desc: 'Ходячий шкаф. Прёт напролом и держит удар боссов.',
    perks: ['+50% макс. HP', 'старт: +3 живучести'],
    bonus: { hpMul: 0.5 },
    startStats: { str: 1, vit: 3, luck: 0 },
    startAllies: {}, lootLuck: 0,
    tex: 'tex-hero-brute', color: 0xc23b3b,
  },
  {
    id: 'mechanic', name: 'Механик', icon: '🤖',
    desc: 'Командир железа. Союзники бьют сильнее, есть кем прикрыться.',
    perks: ['+30% урон союзников', 'старт с Верным псом'],
    bonus: { allyMul: 0.3 },
    startStats: { str: 0, vit: 1, luck: 1 },
    startAllies: { dog: 1 }, lootLuck: 0,
    tex: 'tex-hero-mechanic', color: 0x8fa2b8,
  },
  {
    id: 'scavenger', name: 'Мародёр', icon: '🍀',
    desc: 'Нюх на добро. Больше крышек и лучше лут с врагов.',
    perks: ['+15% крышек', 'заметно лучший лут'],
    bonus: { capsMul: 0.15, critChance: 0.02 },
    startStats: { str: 0, vit: 0, luck: 3 },
    startAllies: {}, lootLuck: 0.6,
    tex: 'tex-hero-scavenger', color: 0x8fbf3f,
  },
]

// Ключ спрайта героя по классу (с запасным вариантом).
export function heroTexFor(classId) {
  const c = CLASS_BY_ID[classId]
  return (c && c.tex) || 'tex-hero'
}

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map(c => [c.id, c]))
