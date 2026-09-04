// Линтер. Цель скромная: ловить настоящие ошибки (необъявленные переменные,
// неиспользуемые импорты, потерянные await), а не спорить о стиле — проект
// пишется без точек с запятой и с двухпробельным отступом, так и оставляем.

export default [
  {
    files: ['src/**/*.js', 'sim/**/*.mjs', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        localStorage: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        console: 'readonly', fetch: 'readonly', Image: 'readonly',
        requestAnimationFrame: 'readonly', performance: 'readonly',
        process: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
        TextDecoder: 'readonly',
        describe: 'readonly', it: 'readonly', expect: 'readonly',
        beforeEach: 'readonly', afterEach: 'readonly', vi: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',          // ровно то, чем болел словарь переводов
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-self-assign': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'require-atomic-updates': 'off',
      eqeqeq: ['warn', 'smart'],
    },
  },
]
