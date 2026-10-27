// Each brand's logo (lib/brands.mjs) from its own site, kept as a 128 px PNG
// in public/img/brand/<id>.png (committed: logos hardly change). The site's
// largest apple-touch-icon or icon, else /apple-touch-icon.png, else its
// favicon.ico, or Google's copy of it; a picture under 64 px is left out (a blurry tile is worse
// than none). Brands whose sites turn this machine away got their App Store app icon by hand
// (itunes.apple.com/search, country=tw); white plates were cleared to transparent.
// Needs curl and ImageMagick's convert. Run by hand:
//   node scripts/brand-logos.mjs [id…]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { BRANDS } from '../public/lib/brands.mjs';

const out = new URL('../public/img/brand/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const get = (url, file) => {
  try {
    const code = execFileSync('curl', ['-sSL', '-m', '20', '-A', UA, '-o', file, '-w', '%{http_code}', url], { encoding: 'utf8' });
    return code === '200' && existsSync(file);
  } catch {
    return false;
  }
};
const text = url => {
  try {
    return execFileSync('curl', ['-sSL', '-m', '20', '-A', UA, url], { encoding: 'utf8', maxBuffer: 20e6 });
  } catch {
    return '';
  }
};
const size = file => {
  try {
    const [w, h] = execFileSync('identify', ['-format', '%w %h\n', file], { encoding: 'utf8' }).split('\n')[0].split(' ').map(Number);
    return Math.min(w, h) || 0;
  } catch {
    return 0;
  }
};

const only = process.argv.slice(2);
const missing = only[0] === '--missing';
const tmp = `${out}.tmp`;
const MIN = 64;
for (const b of BRANDS) {
  if (b.logo || (missing ? existsSync(`${out}${b.id}.png`) : only.length && !only.includes(b.id))) continue;
  const html = text(b.site);
  const links = [...html.matchAll(/<link[^>]+>/gi)].map(m => m[0]).filter(l => /rel=["'][^"']*(apple-touch-icon|icon)[^"']*["']/i.test(l));
  const cands = links
    .map(l => ({ href: /href=["']([^"']+)["']/i.exec(l)?.[1], size: Number(/sizes=["'](\d+)/i.exec(l)?.[1] || (/apple-touch/i.test(l) ? 180 : 0)) }))
    .filter(c => c.href && !/\.svg(\?|$)/i.test(c.href))
    .sort((a, b) => b.size - a.size)
    .map(c => new URL(c.href, b.site).href);
  const origin = new URL(b.site).origin;
  // (Google's copy of the site's icon too: it reaches sites that turn this machine away.)
  cands.push(`${origin}/apple-touch-icon.png`, `${origin}/apple-touch-icon-precomposed.png`, `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${origin}/&size=256`, `${origin}/favicon.ico`);
  // The largest found, at least MIN px.
  let best = null;
  for (const [i, url] of cands.entries()) {
    const file = `${tmp}${i}`;
    if (!get(url, file)) continue;
    const s = size(`${file}[0]`);
    if (s >= MIN && (!best || s > best.s)) best = { s, url, file };
    if (s >= 180) break;
  }
  if (best) {
    execFileSync('convert', [`${best.file}[0]`, '-background', 'none', '-resize', '128x128', '-gravity', 'center', '-extent', '128x128', '-strip', `${out}${b.id}.png`]);
    console.log(`${b.id}: ${best.s}px from ${best.url}`);
  } else console.log(`${b.id}: none`);
  for (let i = 0; i < cands.length; i++) rmSync(`${tmp}${i}`, { force: true });
}
writeFileSync(`${out}.gitkeep`, '');
// The list the page reads (lib/logos.mjs), from what's there now.
const have = readdirSync(out).filter(f => f.endsWith('.png')).map(f => `'${f.slice(0, -4)}'`).sort();
writeFileSync(new URL('../public/lib/logos.mjs', import.meta.url), `// The brands with a logo in img/brand/ (scripts/brand-logos.mjs writes this).\nexport const LOGOS = new Set([${have.join(', ')}]);\n`);
