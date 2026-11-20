// Tiện ích xử lý chữ Nhật cho chép chính tả
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const PUNCT = /[\s　。、，．,.!?！？「」『』（）()・…～〜~\-ー―:：;；"'“”]/g;
const readingOf = (s) => String(s || '').replace(/\{([^|}]+)\|([^}]*)\}/g, '$2');
const surfaceOf = (s) => String(s || '').replace(/\{([^|}]+)\|[^}]*\}/g, '$1');
function norm(s) {
  return kataToHira(String(s || '').normalize('NFKC')).replace(PUNCT, '').replace(/ー/g, 'ー').toLowerCase().replace(/ー/g, '');   // bỏ cả ー để lệch trường âm không quá khắt khe
}
// LCS theo ký tự -> tỷ lệ giống + đánh dấu ký tự đúng trong chuỗi chuẩn
function align(expected, answer) {
  const a = [...expected], b = [...answer];
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array(a.length).fill(false);
  let i = 0, j = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { hit[i] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
  const lcs = dp[0][0];
  return { hit, ratio: a.length ? lcs / Math.max(a.length, b.length) : 0, a };
}
function checkDictation(jaMarkup, answer) {
  const surface = surfaceOf(jaMarkup), reading = readingOf(jaMarkup);
  const na = norm(answer);
  const cands = [{ kind: 'surface', text: surface }, { kind: 'reading', text: reading }].map((c) => ({ ...c, n: norm(c.text) }));
  const best = cands.map((c) => ({ ...c, ...align(c.n, na) })).sort((x, y) => y.ratio - x.ratio)[0];
  const exact = cands.some((c) => c.n === na) && na.length > 0;
  return { ok: exact, close: !exact && best.ratio >= 0.85, ratio: Math.round(best.ratio * 100) / 100, surface, reading, marks: best.a.map((c, i) => ({ c, hit: best.hit[i] })), against: best.kind };
}
module.exports = { norm, readingOf, surfaceOf, checkDictation };
