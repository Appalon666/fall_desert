// Глобальные константы игры: размеры, палитра, ключи сцен и текстур.
// Держим здесь всё «магическое», чтобы не расползалось по коду.

export const GAME = {
  WIDTH: 1280,
  HEIGHT: 720,
}

// Версия игры. Держим ЗДЕСЬ и повторяем в package.json и dock/store-listing.md
// (в личном кабинете Яндекса номер указывается вручную). Раньше число было
// зашито в трёх местах по-разному: 0.1.0, 0.2.0 и v0.2.1 на экране лагеря.
export const APP_VERSION = '0.3.0'

// Суперсэмплинг ключевых спрайтов: текстуры генерируются в TEX_SS× разрешении,
// а на экране показываются в том же размере (scale / TEX_SS) → чёткие края.
export const TEX_SS = 2

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
  sand: '#e6c98a',
  rust: '#e0824a',
  toxic: '#b6f24a',
  cap: '#ffd24a',
  paper: '#fbf3df',
  gold: '#e8bf3a',
  ink: '#120d09',
  steel: '#9a9aa6',
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
  FORGE: 'ForgeScene',
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
  ALLY: 'tex-ally',
  BULLET: 'tex-bullet',
  CAP: 'tex-cap',
  GLOW: 'tex-glow',
  DOT: 'tex-dot',
  VIGNETTE: 'tex-vignette',
  RUIN: 'tex-ruin',
}
