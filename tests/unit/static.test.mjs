// 静的検査 — TC-SEC-001 / TC-LAW-001 / TC-NFR-COST-001 / TC-NFR-PORT-001 / TC-NFR-MAINT-001
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function collect(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) collect(p, out);
    else out.push(p);
  }
  return out;
}

const srcFiles = collect(join(ROOT, 'src'));
// LAW/COST走査対象 = 自作ソース＋devテンプレート（ビルド生成物はvendor(Three.js)内の
// ドキュメントURL等を含むため対象外。生成物の自作コード部はsrc/devと同一内容）— SRS_v2_delta
const lawTargets = [...srcFiles, join(ROOT, 'dev.html'), join(ROOT, 'dev3d.html')].filter((p) => existsSync(p));

test('TC-SEC-001: eval/new Function/外部送信コードなし', () => {
  const banned = [/\beval\s*\(/, /new\s+Function\s*\(/, /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /navigator\.sendBeacon/];
  for (const p of srcFiles) {
    const s = readFileSync(p, 'utf8');
    for (const re of banned) assert.ok(!re.test(s), `${p} に ${re} が含まれる`);
  }
});

test('TC-LAW-001: 任天堂固有名称ゼロ（src/とindex.html）', () => {
  const banned = ['スプラ', 'Splatoon', 'splatoon', 'インクリング', 'ナワバリ', 'イカちゃん', '任天堂', 'Nintendo'];
  for (const p of lawTargets) {
    const s = readFileSync(p, 'utf8');
    for (const w of banned) assert.ok(!s.includes(w), `${p} に「${w}」が含まれる`);
  }
});

test('TC-NFR-COST-001: 依存ゼロ（package.json依存なし・CDN/外部URL参照なし）', () => {
  const pkg = join(ROOT, 'package.json');
  if (existsSync(pkg)) {
    const j = JSON.parse(readFileSync(pkg, 'utf8'));
    assert.equal(Object.keys(j.dependencies || {}).length, 0);
    assert.equal(Object.keys(j.devDependencies || {}).length, 0);
  }
  for (const p of lawTargets) {
    const s = readFileSync(p, 'utf8');
    assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(s), `${p} に外部URL参照`);
  }
});

test('TC-NFR-PORT-001: ビルド生成物はローカル参照のみ（file://直開き可能）', () => {
  for (const name of ['index.html', 'classic.html']) {
    const html = join(ROOT, name);
    assert.ok(existsSync(html), `${name}が存在する`);
    const s = readFileSync(html, 'utf8');
    assert.ok(!/src\s*=\s*["']https?:/.test(s), `${name}に外部script参照`);
    assert.ok(!/href\s*=\s*["']https?:/.test(s), `${name}に外部href`);
    assert.ok(/type\s*=\s*["']module["']/.test(s), `${name}にESM不在`);
  }
});

test('TC-FR-TOUCH-002: タッチUI（スティック・3ボタン・viewport）が存在する', () => {
  const s = readFileSync(join(ROOT, 'dev3d.html'), 'utf8');
  for (const id of ['id="stick"', 'id="stick-knob"', 'id="btn-fire"', 'id="btn-swim"', 'id="btn-sp"', 'id="touch-layer"']) {
    assert.ok(s.includes(id), `dev3d.htmlに ${id} がない`);
  }
  assert.ok(/name="viewport"[^>]*user-scalable=no/.test(s), 'モバイルviewport設定がない');
});

test('TC-NFR-MAINT-001: core全モジュールがDOM非依存でimport可能', async () => {
  const core = collect(join(ROOT, 'src', 'core'));
  for (const p of core) {
    const s = readFileSync(p, 'utf8');
    for (const w of ['document.', 'window.', 'canvas', 'requestAnimationFrame']) {
      assert.ok(!s.includes(w), `${p} がDOM/canvasに依存（${w}）`);
    }
    await import(`file://${p.replaceAll('\\', '/')}`); // Nodeで読み込めること
  }
});

test('P-003: core内で Math.random 直呼びなし（rng.js経由のみ）', () => {
  for (const p of srcFiles) {
    const s = readFileSync(p, 'utf8');
    assert.ok(!s.includes('Math.random'), `${p} に Math.random`);
  }
});
