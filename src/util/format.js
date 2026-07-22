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
export function fmtDuration(sec) {
  sec = Math.floor(sec)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h} ч ${m} мин`
  if (m > 0) return `${m} мин ${s} сек`
  return `${s} сек`
}
