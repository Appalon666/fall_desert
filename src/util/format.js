import { t } from '../i18n.js'

// Форматирование больших чисел (крышки растут быстро): 1234 -> «1.2K».
//
// Суффиксы: K, M, B, T, дальше двухбуквенные aa, ab, … zz. Раньше список
// кончался на `ad` (10^24), и всё, что выше, печаталось как есть: на глубине
// награда за локацию выглядела как «2.3583123223069979e+30ad» и уезжала за край
// экрана. Двух букв хватает до 10^2039 — заведомо больше числового предела
// игры (1e300, см. data/scaling.js).
const BASE_SUF = ['', 'K', 'M', 'B', 'T']
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
const MAX_TIER = BASE_SUF.length - 1 + LETTERS.length * LETTERS.length

function suffix(tier) {
  if (tier < BASE_SUF.length) return BASE_SUF[tier]
  const i = tier - BASE_SUF.length
  return LETTERS[Math.floor(i / LETTERS.length)] + LETTERS[i % LETTERS.length]
}

export function fmt(n) {
  if (!Number.isFinite(n)) return '∞'
  n = Math.floor(n)
  if (n < 1000) return `${n}`
  let tier = 0
  let v = n
  while (v >= 1000 && tier < MAX_TIER) { v /= 1000; tier++ }
  // Округление способно дотянуть мантиссу до 1000: 999 999 -> v = 999.999 ->
  // toFixed(0) = «1000», и на экран уходило «1000K» вместо «1.0M». Порог берём
  // 99.95, чтобы 99 999 не печаталось как «100.0K». Если после округления всё
  // же вышла тысяча — поднимаем тир.
  let s = v >= 99.95 ? v.toFixed(0) : v.toFixed(1)
  if (s === '1000' && tier < MAX_TIER) { v /= 1000; tier++; s = v.toFixed(1) }
  return `${s}${suffix(tier)}`
}

// Короткое «сколько прошло»: 3720 сек -> «1 ч 2 мин».
// Единицы переводятся: строка уходит в окно офлайн-дохода, и на английском
// «2 ч 15 мин» смотрелось бы недоделкой.
export function fmtDuration(sec) {
  sec = Math.floor(sec)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h} ${t('ч')} ${m} ${t('мин')}`
  if (m > 0) return `${m} ${t('мин')} ${s} ${t('сек')}`
  return `${s} ${t('сек')}`
}
