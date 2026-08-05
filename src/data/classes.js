// Классы героя. Выбираются один раз при первом входе. Дают постоянные бонусы,
// стартовые характеристики и иногда стартового союзника.
// bonus.* складывается с апгрейдами/экипировкой в GameState.

// Поля-сигнатуры (уникальная механика класса), с дефолтами в GameState:
//   pierce      — сколько врагов пробивает одна пуля (Стрелок)
//   lifesteal   — доля нанесённого урона, возвращаемая в HP (Бугай)
//   offlineBonus— +доля к офлайн-доходу (Механик)
//   lootLuck    — бонус к качеству лута (Мародёр)
//
// tex/footY/muzzle — визуал: ключ спрайт-листа, якорь по ногам (доля высоты
// кадра) и точка вылета пули (доли ширины/высоты кадра от центра-низа).
// Всё в долях, а не в пикселях, — чтобы смена арта не ломала позиционирование.
export const CLASSES = [
  {
    id: 'gunner', name: 'Стрелок', icon: '🔫',
    desc: 'Мастер точного выстрела. Пули ПРОБИВАЮТ строй врагов насквозь.',
    perks: ['🎯 пуля бьёт до 2 врагов', '+30% урон клика, +6% крит, +35% HP'],
    bonus: { clickMul: 0.30, critChance: 0.06, hpMul: 0.35 },
    pierce: 2,
    startStats: { str: 2, vit: 0, luck: 1 },
    startAllies: {}, lootLuck: 0,
    tex: 'hero-gunner', color: 0xd88a3a, footY: 0.988,
    muzzle: { x: 0.459, y: 0.853 }, // ствол винтовки
  },
  {
    id: 'brute', name: 'Бугай', icon: '🛡️',
    desc: 'Ходячий шкаф. Лечится от нанесённого урона и держит удар босса.',
    perks: ['🩸 +4.5% урона возвращается в HP', '+50% макс. HP, старт +3 живучести'],
    bonus: { hpMul: 0.5 },
    lifesteal: 0.045,
    startStats: { str: 1, vit: 3, luck: 0 },
    startAllies: {}, lootLuck: 0,
    tex: 'hero-brute', color: 0xc23b3b, footY: 0.986,
    muzzle: { x: 0.447, y: 0.715 }, // кулак в точке удара
  },
  {
    id: 'mechanic', name: 'Механик', icon: '🤖',
    desc: 'Командир железа. Отряд бьёт сильнее, а офлайн-доход заметно жирнее.',
    perks: ['⚙️ +35% урон союзников', '📦 +60% офлайн-дохода, старт с псом'],
    bonus: { allyMul: 0.35, clickMul: 0.15, hpMul: 0.1 },
    offlineBonus: 0.6,
    startStats: { str: 0, vit: 1, luck: 1 },
    startAllies: { dog: 1 }, lootLuck: 0,
    tex: 'hero-mechanic', color: 0x8fa2b8, footY: 0.988,
    muzzle: { x: 0.391, y: 0.777 }, // дуло плазмомёта
  },
  {
    id: 'scavenger', name: 'Мародёр', icon: '🍀',
    desc: 'Нюх на добро. Больше крышек, лучше лут — экономика на первом месте.',
    perks: ['🍾 +18% крышек', '🎁 заметно лучший лут, +2% крит'],
    bonus: { capsMul: 0.18, critChance: 0.02 },
    startStats: { str: 0, vit: 0, luck: 3 },
    startAllies: {}, lootLuck: 0.7,
    tex: 'hero-scavenger', color: 0x8fbf3f, footY: 0.988,
    muzzle: { x: 0.466, y: 0.453 }, // ствол самопала
  },
]

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map(c => [c.id, c]))
