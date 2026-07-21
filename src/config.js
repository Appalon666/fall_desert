// Глобальные константы игры: размеры, палитра, ключи сцен и текстур.
// Держим здесь всё «магическое», чтобы не расползалось по коду.

export const GAME = {
  WIDTH: 1280,
  HEIGHT: 720,
}

// Палитра пустоши (пост-апок, ржавчина + токсичная зелень + песок).
export const COLORS = {
  bgDark: 0x1a1410,
  bgWasteland: 0x2c2416,
  sand: 0xc9a76a,
  rust: 0x8a4b2a,
  rustLight: 0xb5652f,
  toxic: 0x8fbf3f,
  toxicDark: 0x5a7a26,
  steel: 0x6b6b73,
  steelDark: 0x3c3c42,
  cap: 0xd8b64a,
  capEdge: 0x8a7320,
  blood: 0x9c2b2b,
  ink: 0x120d09,
  paper: 0xe8dcc0,
  gold: 0xc9a227,
}

// CSS-строки тех же цветов (для текста/обводок Phaser, где нужен '#rrggbb').
export const CSS = {
  sand: '#c9a76a',
  rust: '#b5652f',
  toxic: '#8fbf3f',
  cap: '#d8b64a',
  paper: '#e8dcc0',
  gold: '#c9a227',
  ink: '#120d09',
  steel: '#6b6b73',
}

export const SCENES = {
  BOOT: 'BootScene',
  CLASS_SELECT: 'ClassSelectScene',
  HUB: 'HubScene',
  BATTLE: 'BattleScene',
  SHOP: 'ShopScene',
  INVENTORY: 'InventoryScene',
  HERO: 'HeroScene',
  PRESTIGE: 'PrestigeScene',
  LEADERBOARD: 'LeaderboardScene',
}

// Ключи процедурно сгенерированных текстур.
export const TEX = {
  HERO: 'tex-hero',                    // запасной обобщённый
  HERO_GUNNER: 'tex-hero-gunner',
  HERO_BRUTE: 'tex-hero-brute',
  HERO_MECHANIC: 'tex-hero-mechanic',
  HERO_SCAVENGER: 'tex-hero-scavenger',
  ENEMY: 'tex-enemy',
  BOSS: 'tex-boss',
  BULLET: 'tex-bullet',
  CAP: 'tex-cap',
  GLOW: 'tex-glow',
  DOT: 'tex-dot',
  VIGNETTE: 'tex-vignette',
  RUIN: 'tex-ruin',
}
