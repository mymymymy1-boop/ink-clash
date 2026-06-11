// 単一ファイルビルド（依存ゼロ・Node標準のみ）— ADR-008
// 1) dev.html   + 2Dモジュール群        → classic.html（v1温存）
// 2) dev3d.html + three.min.js + 3D群   → index.html（v2・スマホ3D版）
// 理由: file://やPagesで確実に動く単一HTMLにする（ESM外部参照はfile://でCORSブロック）
// 実行: node scripts/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CORE = [
  'src/core/rng.js', 'src/core/config.js', 'src/core/grid.js', 'src/core/stage.js',
  'src/core/entities.js', 'src/core/special.js', 'src/core/weapons.js', 'src/core/bots.js',
  'src/core/hud.js', 'src/core/match.js',
];
const BUILDS = [
  { dev: 'dev.html', out: 'classic.html', entry: 'game.js', mods: [...CORE, 'src/render.js', 'src/game.js'], vendor: null },
  { dev: 'dev3d.html', out: 'index.html', entry: 'game3d.js', mods: [...CORE, 'src/paintcanvas.js', 'src/render3d.js', 'src/touch.js', 'src/game3d.js'], vendor: 'vendor/three.min.js' },
];

function strip(code) {
  return code
    .replace(/^import .*$/gm, '')
    .replace(/^export (function|const|class)/gm, '$1');
}

// FP-001ガード: 結合バンドルはトップレベル名が同一スコープになるため、重複名をビルド時に検知する
function checkCollisions(mods) {
  const seen = new Map();
  for (const p of mods) {
    const code = strip(readFileSync(join(ROOT, p), 'utf8'));
    for (const m of code.matchAll(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      const name = m[1];
      if (seen.has(name)) throw new Error(`FP-001: トップレベル名衝突 "${name}" (${seen.get(name)} と ${p})`);
      seen.set(name, p);
    }
  }
}

for (const b of BUILDS) {
  checkCollisions(b.mods);
  const bundle = b.mods.map((p) => `// ===== ${p} =====\n${strip(readFileSync(join(ROOT, p), 'utf8'))}`).join('\n');
  let out = readFileSync(join(ROOT, b.dev), 'utf8');
  if (b.vendor) {
    const v = readFileSync(join(ROOT, b.vendor), 'utf8');
    const tag = `<script src="./${b.vendor}"></script>`;
    if (!out.includes(tag)) throw new Error(`vendorタグが見つからない: ${tag}`);
    out = out.replace(tag, () => `<script>\n${v}\n</script>`);
  }
  const entryTag = `<script type="module" src="./src/${b.entry}"></script>`;
  if (!out.includes(entryTag)) throw new Error(`entryタグが見つからない: ${entryTag}`);
  out = out.replace(entryTag, () => `<script type="module">\n${bundle}\n</script>`);
  writeFileSync(join(ROOT, b.out), out);
  console.log(`OK: ${b.out} (${(out.length / 1024).toFixed(1)} KB)`);
}
