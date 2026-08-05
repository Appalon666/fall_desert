// Типы врагов (18). У каждого свой спрайт-лист 2×2 (цикл ходьбы, мордой влево).
// hpMul/rewardMul/dmgMul — множители относительно базы из balance.js.
// speedMul — скорость приближения к герою.
// scale — размер: высота врага на экране = ENEMY_H_PER_SCALE × scale (BattleScene).
// tint — запасной цвет для процедурного спрайта, если арт не загрузился.

export const ENEMIES = {
  radrat:   { name: 'Радкрыса',   tint: 0x8fbf3f, scale: 1.7, hpMul: 0.7, rewardMul: 0.9, dmgMul: 0.7, speedMul: 1.6 },
  crawler:  { name: 'Ползун',     tint: 0xb5652f, scale: 1.8, hpMul: 0.8, rewardMul: 1.0, dmgMul: 0.8, speedMul: 1.4 },
  wasp:     { name: 'Радоса',     tint: 0xd8b64a, scale: 1.4, hpMul: 0.5, rewardMul: 1.1, dmgMul: 0.6, speedMul: 2.2 },
  ghoul:    { name: 'Гуль',       tint: 0x9fae86, scale: 2.1, hpMul: 1.1, rewardMul: 1.1, dmgMul: 1.0, speedMul: 1.0 },
  raider:   { name: 'Рейдер',     tint: 0x7a5230, scale: 2.1, hpMul: 1.2, rewardMul: 1.3, dmgMul: 1.2, speedMul: 1.1 },
  dog:      { name: 'Пёс-мутант', tint: 0x6b6b73, scale: 1.9, hpMul: 0.9, rewardMul: 1.0, dmgMul: 1.1, speedMul: 1.9 },
  lurker:   { name: 'Тень',       tint: 0x4a4358, scale: 2.0, hpMul: 1.0, rewardMul: 1.2, dmgMul: 1.3, speedMul: 1.3 },
  spitter:  { name: 'Плевун',     tint: 0x5a7a26, scale: 2.0, hpMul: 1.1, rewardMul: 1.3, dmgMul: 1.1, speedMul: 0.9 },
  bloat:    { name: 'Пузырь',     tint: 0x8fbf6f, scale: 2.6, hpMul: 2.0, rewardMul: 1.8, dmgMul: 1.0, speedMul: 0.6 },
  brute:    { name: 'Громила',    tint: 0x9c2b2b, scale: 2.8, hpMul: 2.6, rewardMul: 2.2, dmgMul: 1.8, speedMul: 0.7 },
  // — вторая волна арта: разбавляют пулы зон, чтобы бой не приедался —
  vulture:  { name: 'Стервятник', tint: 0x7d6a4a, scale: 1.6, hpMul: 0.6, rewardMul: 1.1, dmgMul: 0.7, speedMul: 2.1 },
  tick:     { name: 'Клещ',       tint: 0x6b5334, scale: 2.0, hpMul: 1.0, rewardMul: 1.1, dmgMul: 0.9, speedMul: 1.2 },
  roller:   { name: 'Катала',     tint: 0x4a4a4a, scale: 1.9, hpMul: 0.9, rewardMul: 1.1, dmgMul: 1.0, speedMul: 2.0 },
  drowned:  { name: 'Утопленник', tint: 0x4a6b6b, scale: 2.1, hpMul: 1.3, rewardMul: 1.2, dmgMul: 1.2, speedMul: 0.95 },
  leech:    { name: 'Пиявка',     tint: 0xa8543a, scale: 1.8, hpMul: 1.2, rewardMul: 1.2, dmgMul: 1.1, speedMul: 1.0 },
  slug:     { name: 'Слизняк',    tint: 0x7a8f3a, scale: 2.3, hpMul: 1.8, rewardMul: 1.6, dmgMul: 0.9, speedMul: 0.55 },
  shard:    { name: 'Стеклокраб', tint: 0xa8c4d4, scale: 2.2, hpMul: 1.5, rewardMul: 1.5, dmgMul: 1.3, speedMul: 0.85 },
  butcher:  { name: 'Мясник',     tint: 0xc98a8a, scale: 2.6, hpMul: 1.9, rewardMul: 2.0, dmgMul: 1.9, speedMul: 0.8 },
}

export const ENEMY_IDS = Object.keys(ENEMIES)
