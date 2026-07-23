// Типы врагов (10). Спрайт один (процедурный), вариативность — тинт/масштаб/поведение.
// hpMul/rewardMul/dmgMul — множители относительно базы из balance.js.
// speedMul — скорость приближения к герою.

export const ENEMIES = {
  radrat:   { name: 'Радкрыса',   tint: 0x8fbf3f, scale: 1.7, hpMul: 0.7, rewardMul: 0.9, dmgMul: 0.7, speedMul: 1.6, flip: true },
  crawler:  { name: 'Ползун',     tint: 0xb5652f, scale: 1.8, hpMul: 0.8, rewardMul: 1.0, dmgMul: 0.8, speedMul: 1.4, flip: true },
  wasp:     { name: 'Радоса',     tint: 0xd8b64a, scale: 1.4, hpMul: 0.5, rewardMul: 1.1, dmgMul: 0.6, speedMul: 2.2, flip: true },
  ghoul:    { name: 'Гуль',       tint: 0x9fae86, scale: 2.1, hpMul: 1.1, rewardMul: 1.1, dmgMul: 1.0, speedMul: 1.0, flip: true },
  raider:   { name: 'Рейдер',     tint: 0x7a5230, scale: 2.1, hpMul: 1.2, rewardMul: 1.3, dmgMul: 1.2, speedMul: 1.1, flip: true },
  dog:      { name: 'Пёс-мутант', tint: 0x6b6b73, scale: 1.9, hpMul: 0.9, rewardMul: 1.0, dmgMul: 1.1, speedMul: 1.9, flip: true },
  lurker:   { name: 'Тень',       tint: 0x4a4358, scale: 2.0, hpMul: 1.0, rewardMul: 1.2, dmgMul: 1.3, speedMul: 1.3, flip: true },
  spitter:  { name: 'Плевун',     tint: 0x5a7a26, scale: 2.0, hpMul: 1.1, rewardMul: 1.3, dmgMul: 1.1, speedMul: 0.9, flip: true },
  bloat:    { name: 'Пузырь',     tint: 0x8fbf6f, scale: 2.6, hpMul: 2.0, rewardMul: 1.8, dmgMul: 1.0, speedMul: 0.6, flip: true },
  brute:    { name: 'Громила',    tint: 0x9c2b2b, scale: 2.8, hpMul: 2.6, rewardMul: 2.2, dmgMul: 1.8, speedMul: 0.7, flip: true },
}

export const ENEMY_IDS = Object.keys(ENEMIES)
