// A page's parts cut into n columns, each a run of them in reading order
// (shell.mjs flow): the cut whose tallest column is shortest, and of cuts as
// tall (within a pixel), the evenest. `tall`: each part's height; `first`
// parts always stay together at the head of the first column. Returns each
// column's end (an index into the parts, the last one parts.length).
// (Only the shortest tallest column, the first found: when the first
// column was the tallest anyway every cut tied on it, and 統計 left 預算 alone
// in the middle beside a long right column: Jay's iPad 2026-11-11.)
export function evenCuts(tall, n, first = 1) {
  const len = tall.length;
  const cuts = (from, left) => {
    if (left === 1) return [[len]];
    const out = [];
    for (let i = from + 1; i <= len - left + 1; i++) for (const rest of cuts(i, left - 1)) out.push([i, ...rest]);
    return out;
  };
  const all = cuts(Math.max(0, first - 1), n).map(c => {
    let from = 0;
    const hs = c.map(to => tall.slice(from, (from = to)).reduce((s, x) => s + x, 0));
    return { c, max: Math.max(...hs), even: hs.reduce((s, x) => s + x * x, 0) };
  });
  const low = Math.min(...all.map(x => x.max));
  return all.filter(x => x.max <= low + 1).reduce((a, b) => (b.even < a.even ? b : a)).c;
}

// k cards in a grid of at most n across, every row full: as few rows as n
// allows, their sizes as even as can be (the fuller first), each card a span
// of a grid of `tracks` columns. 8 tools on an iPad: 3, 3, 2 (the last two
// each half the row), never 拍照記帳 stretched over two of three (Jay's iPad
// 2026-11-11: "the first row has an uneven card span").
export function evenRows(k, n) {
  if (k < 1 || n < 1) return { tracks: 1, spans: [] };
  const rows = Math.ceil(k / n);
  const base = Math.floor(k / rows);
  const sizes = Array.from({ length: rows }, (_, r) => base + (r < k % rows ? 1 : 0));
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const tracks = [...new Set(sizes)].reduce((a, b) => (a * b) / gcd(a, b), 1);
  return { tracks, spans: sizes.flatMap(s => Array(s).fill(tracks / s)) };
}
