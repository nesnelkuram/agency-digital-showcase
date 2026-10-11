#!/usr/bin/env node
/**
 * Planlayıcı stil dosyasını (review/styles.css, küresel: body/h1/button…) Studio sayfasında KULLANILABİLİR hâle getirir:
 * her kural `.planner-scope` altına alınır, :root/body → .planner-scope. Studio'nun kalan sayfaları etkilenmez.
 * Kullanım: node scripts/scope-planner-css.mjs [--check]   (--check: üretilmiş dosya güncel değilse çıkış kodu 1)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'studio/feedPlanner/review/styles.css';
const OUT = 'studio/feedPlanner/review/scoped.css';
const SCOPE = '.planner-scope';

export function scopeCss(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  const out = [];
  const readBlock = () => {
    // '{' sonrası eşleşen '}' konumuna kadar içerik
    let depth = 1;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    return src.slice(start, i - 1);
  };
  const scopeSel = (sel) =>
    sel
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        if (/^:root/.test(s)) return null; // tema değişkenleri aşağıda tek blok olarak eklenir
        if (/^(html|body)$/.test(s)) return SCOPE;
        return `${SCOPE} ${s}`;
      })
      .filter(Boolean)
      .join(', ');
  const walk = (text, depthOut) => {
    const res = [];
    let j = 0;
    while (j < text.length) {
      const open = text.indexOf('{', j);
      if (open < 0) break;
      const head = text.slice(j, open).trim();
      let depth = 1;
      let k = open + 1;
      while (k < text.length && depth > 0) {
        if (text[k] === '{') depth++;
        else if (text[k] === '}') depth--;
        k++;
      }
      const body = text.slice(open + 1, k - 1);
      if (head.startsWith('@media')) {
        const inner = walk(body, depthOut + 1);
        if (/prefers-color-scheme:\s*dark/.test(head)) {
          // Studio açık temadır; koyu tema değişkenleri sayfaya sızdırılmaz
        } else if (inner.length) res.push(`${head} {\n${inner.map((l) => '  ' + l).join('\n')}\n}`);
      } else if (head) {
        const sel = scopeSel(head);
        if (sel) res.push(`${sel} {${body.replace(/\s+/g, ' ')}}`);
      }
      j = k;
    }
    return res;
  };
  void readBlock;
  void out;
  const vars = '--bg:#f7f3ec; --panel:#fffdf8; --ink:#1c1915; --muted:#6e645a; --accent:#7a1f2b; --line:#e4dccf; --warn:#9a5b00; color-scheme: light;';
  return `/* ÜRETİLDİ: node scripts/scope-planner-css.mjs — kaynak ${SRC}; elle düzenlemeyin */\n${SCOPE} { ${vars} }\n${walk(src, 0).join('\n')}\n`;
}

if (process.argv[1] && process.argv[1].endsWith('scope-planner-css.mjs')) {
  const next = scopeCss(readFileSync(SRC, 'utf8'));
  if (process.argv.includes('--check')) {
    let cur = '';
    try { cur = readFileSync(OUT, 'utf8'); } catch { /* yok */ }
    if (cur !== next) { console.error('scoped.css güncel değil'); process.exit(1); }
  } else writeFileSync(OUT, next);
}
