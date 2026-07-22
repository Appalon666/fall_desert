// Классы героя. Выбираются один раз при первом входе. Дают постоянные бонусы,
// стартовые характеристики и иногда стартового союзника.
// bonus.* складывается с апгрейдами/экипировкой в GameState.

// Поля-сигнатуры (уникальная механика класса), с дефолтами в GameState:
//   pierce      — сколько врагов пробивает одна пуля (Стрелок)
//   lifesteal   — доля нанесённого урона, возвращаемая в HP (Бугай)
//   offlineBonus— +доля к офлайн-доходу (Механик)
//   lootLuck    — бонус к качеству лута (Мародёр)
export const CLASSES = [
  {
    id: 'gunner', name: 'Стрелок', icon: '🔫',
    desc: 'Мастер точного выстрела. Пули ПРОБИВАЮТ строй врагов насквозь.',
    perks: ['🎯 пуля бьёт до 2 врагов', '+30% урон клика, +6% крит, +35% HP'],
    bonus: { clickMul: 0.30, critChance: 0.06, hpMul: 0.35 },
    pierce: 2,
    startStats: { str: 2, vit: 0, luck: 1 },
    startAllies: {}, lootLuck: 0,
    tex: 'tex-hero-gunner', color: 0xd88a3a,
  },
  {
    id: 'brute', name: 'Бугай', icon: '🛡️',
    desc: 'Ходячий шкаф. Лечится от нанесённого урона и держит удар босса.',
    perks: ['🩸 +4.5% урона возвращается в HP', '+50% макс. HP, старт +3 живучести'],
    bonus: { hpMul: 0.5 },
    lifesteal: 0.045,
    startStats: { str: 1, vit: 3, luck: 0 },
    startAllies: {}, lootLuck: 0,
    tex: 'tex-hero-brute', color: 0xc23b3b,
  },
  {
    id: 'mechanic', name: 'Механик', icon: '🤖',
    desc: 'Командир железа. Отряд бьёт сильнее, а офлайн-доход заметно жирнее.',
    perks: ['⚙️ +35% урон союзников', '📦 +60% офлайн-дохода, старт с псом'],
    bonus: { allyMul: 0.35 },
    offlineBonus: 0.6,
    startStats: { str: 0, vit: 1, luck: 1 },
    startAllies: { dog: 1 }, lootLuck: 0,
    tex: 'tex-hero-mechanic', color: 0x8fa2b8,
  },
  {
    id: 'scavenger', name: 'Мародёр', icon: '🍀',
    desc: 'Нюх на добро. Больше крышек, лучше лут — экономика на первом месте.',
    perks: ['🍾 +18% крышек', '🎁 заметно лучший лут, +2% крит'],
    bonus: { capsMul: 0.18, critChance: 0.02 },
    startStats: { str: 0, vit: 0, luck: 3 },
    startAllies: {}, lootLuck: 0.7,
    tex: 'tex-hero-scavenger', color: 0x8fbf3f,
  },
]

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map(c => [c.id, c]))
