import { t } from '../i18n.js'

// Форматирование больших чисел (крышки растут быстро): 1234 -> «1.2K».
const SUF = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad']

export function fmt(n) {
  if (!Number.isFinite(n)) return '∞'
  n = Math.floor(n)
  if (n < 1000) return `${n}`
  let tier = 0
  let v = n
  while (v >= 1000 && tier < SUF.length - 1) { v /= 1000; tier++ }
  const s = v >= 100 ? v.toFixed(0) : v.toFixed(1)
  return `${s}${SUF[tier]}`
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
