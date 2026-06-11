// 3D描画層 v3（Three.js r128 / グローバルTHREE使用）
// 人型キャラ・高低差ステージ・パーティクル。シミュレーションは2Dコアのまま（ADR-006）。
/* global THREE */
import { CONFIG } from './core/config.js';
import { obstacleRects, platformRects } from './core/stage.js';
import { createPaintCanvas } from './paintcanvas.js';

const FIELD_W = CONFIG.WORLD.W, FIELD_H = CONFIG.WORLD.H; // 注: バンドル結合のためトップレベル名は全モジュールで一意にする
const TEAM_HEX = { 1: 0xff6b1a, 2: 0x00b8a9 };
const TEAM_DARK = { 1: 0xb24400, 2: 0x007a6e };
const CAM_DIST = 110, CAM_HEIGHT = 92, CAM_LOOK_AHEAD = 95;
const PLT_H = CONFIG.TERRAIN.PLATFORM_H;

export function createRenderer3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c2740); // 夕空風の濃紺
  scene.fog = new THREE.Fog(0x1c2740, 800, 1900);

  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 1, 3000);
  const clock = new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x3a3344, 1.0));
  const sun = new THREE.DirectionalLight(0xfff2dd, 0.75);
  sun.position.set(300, 600, 200);
  scene.add(sun);

  // 床（塗りテクスチャ）
  const paint = createPaintCanvas();
  const tex = new THREE.CanvasTexture(paint.canvas);
  tex.anisotropy = 4;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_W, FIELD_H),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(FIELD_W / 2, 0, FIELD_H / 2);
  scene.add(floor);

  // 場外の地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(8000, 8000),
    new THREE.MeshLambertMaterial({ color: 0x141420 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(FIELD_W / 2, -2, FIELD_H / 2);
  scene.add(ground);

  // 外周フェンス
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x39394a });
  for (const [x, z, w, d] of [[-20, -20, FIELD_W + 40, 20], [-20, FIELD_H, FIELD_W + 40, 20], [-20, 0, 20, FIELD_H], [FIELD_W, 0, 20, FIELD_H]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 60, d), wallMat);
    m.position.set(x + w / 2, 30, z + d / 2);
    scene.add(m);
  }

  // 壁（遮蔽）
  const obsMat = new THREE.MeshLambertMaterial({ color: 0x5a5a6e });
  const obsTop = new THREE.MeshLambertMaterial({ color: 0x6e6e84 });
  for (const [x, y, w, h] of obstacleRects()) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, CONFIG.TERRAIN.WALL_H, h),
      [obsMat, obsMat, obsTop, obsMat, obsMat, obsMat]);
    m.position.set(x + w / 2, CONFIG.TERRAIN.WALL_H / 2, y + h / 2);
    scene.add(m);
  }

  // 台（上面に塗りテクスチャの該当領域を貼る＝塗りが台の上にも見える）
  const pltSide = new THREE.MeshLambertMaterial({ color: 0x46465a });
  const pltTexes = [];
  for (const [x, y, w, h] of platformRects()) {
    const t2 = tex.clone();
    t2.repeat.set(w / FIELD_W, h / FIELD_H);
    t2.offset.set(x / FIELD_W, 1 - (y + h) / FIELD_H);
    pltTexes.push(t2);
    const topMat = new THREE.MeshLambertMaterial({ map: t2 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, PLT_H, h),
      [pltSide, pltSide, topMat, pltSide, pltSide, pltSide]);
    m.position.set(x + w / 2, PLT_H / 2, y + h / 2);
    scene.add(m);
  }

  // ===== 人型ペイントボット =====
  const bots = new Map();
  const barrelByKind = {
    shooter: [3.2, 3.2, 13], roller: [9, 6, 8], charger: [2.2, 2.2, 22],
    slosher: [7, 5, 7], spinner: [5.5, 5.5, 11], blaster: [4.5, 4.5, 10],
  };
  function makeBot(e) {
    const g = new THREE.Group();
    const col = new THREE.MeshLambertMaterial({ color: TEAM_HEX[e.team] });
    const dark = new THREE.MeshLambertMaterial({ color: TEAM_DARK[e.team] });
    const skin = new THREE.MeshLambertMaterial({ color: 0xf2e6d8 });

    const legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(3.6, 10, 3.6), dark);
      leg.position.set(s * 4, 10, 0);
      leg.geometry.translate(0, -5, 0); // 腰から振る
      g.add(leg); legs.push(leg);
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 7.5), col);
    body.position.y = 16;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(6.4, 16, 12), skin);
    head.position.y = 27;
    g.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(9.5, 3.4, 2.2), new THREE.MeshBasicMaterial({ color: 0x16161e }));
    visor.position.set(0, 27.6, 5.4);
    g.add(visor);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(6.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), col);
    hair.position.y = 28.4;
    g.add(hair);

    const arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3, 9.5, 3), col);
      arm.position.set(s * 8.4, 21, 0);
      arm.geometry.translate(0, -4.5, 0);
      g.add(arm); arms.push(arm);
    }
    // 武器（右手前方）
    const bd = barrelByKind[e.weaponKind] || barrelByKind.shooter;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(...bd), new THREE.MeshLambertMaterial({ color: 0xe8e8f0 }));
    gun.position.set(6.5, 15, 8);
    g.add(gun);
    const gunTip = new THREE.Mesh(new THREE.BoxGeometry(bd[0] * 0.7, bd[1] * 0.7, 3), col);
    gunTip.position.set(6.5, 15, 8 + bd[2] / 2 + 1.4);
    g.add(gunTip);

    // 背中のインクタンク（残量が見える）
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 13, 10),
      new THREE.MeshLambertMaterial({ color: 0xccccdd, transparent: true, opacity: 0.45 }));
    tank.position.set(0, 18, -6.8);
    g.add(tank);
    const ink = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 12, 10), col);
    ink.position.set(0, 18, -6.8);
    g.add(ink);

    // 潜行形態（人型を隠してディスク表示）
    const swim = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.SphereGeometry(10, 14, 8), col.clone());
    disc.scale.y = 0.32; disc.position.y = 3.2;
    disc.material.transparent = true; disc.material.opacity = 0.85;
    swim.add(disc);
    const ripple = new THREE.Mesh(new THREE.RingGeometry(11, 13.5, 22),
      new THREE.MeshBasicMaterial({ color: TEAM_HEX[e.team], transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ripple.rotation.x = -Math.PI / 2; ripple.position.y = 0.7;
    swim.add(ripple);
    g.add(swim);

    g.userData = { legs, arms, body, ink, swim, humanoid: [legs[0], legs[1], arms[0], arms[1], body, head, visor, hair, gun, gunTip, tank], lastX: e.x, lastY: e.y, phase: 0 };
    scene.add(g);
    return g;
  }

  // ===== 弾・パーティクル =====
  const bulletPool = [];
  const bulletGeo = new THREE.SphereGeometry(4.5, 8, 8);
  const bulletMats = { 1: new THREE.MeshBasicMaterial({ color: TEAM_HEX[1] }), 2: new THREE.MeshBasicMaterial({ color: TEAM_HEX[2] }) };
  function bulletMesh(i) {
    while (bulletPool.length <= i) {
      const m = new THREE.Mesh(bulletGeo, bulletMats[1]);
      m.visible = false; scene.add(m); bulletPool.push(m);
    }
    return bulletPool[i];
  }

  const parts = [];
  const partGeo = new THREE.SphereGeometry(2.6, 6, 5);
  function spawnPart(x, h, y, team, n, power) {
    for (let i = 0; i < n; i++) {
      let p = parts.find((q) => !q.mesh.visible);
      if (!p) {
        p = { mesh: new THREE.Mesh(partGeo, bulletMats[1].clone()), vx: 0, vy: 0, vz: 0, ttl: 0 };
        scene.add(p.mesh); parts.push(p);
        if (parts.length > 90) { p.mesh.visible = false; return; } // プール上限
      }
      const a = (i / n) * Math.PI * 2 + x % 1;
      p.mesh.material.color.setHex(TEAM_HEX[team]);
      p.mesh.position.set(x, h + 4, y);
      p.mesh.visible = true;
      p.vx = Math.cos(a) * power; p.vy = Math.sin(a) * power;
      p.vz = 60 + power * 0.8;
      p.ttl = 0.55;
    }
  }
  const FX_N = { land: [3, 40], explode: [10, 90], splat: [12, 80], special: [8, 70], swing: [4, 55] };
  function addFx(events) {
    for (const ev of events) {
      const f = FX_N[ev.type];
      if (f) spawnPart(ev.x, 6, ev.y, ev.team, f[0], f[1]);
    }
  }
  function updateParts(dt) {
    for (const p of parts) {
      if (!p.mesh.visible) continue;
      p.ttl -= dt;
      if (p.ttl <= 0) { p.mesh.visible = false; continue; }
      p.vz -= 320 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vy * dt;
      p.mesh.position.y = Math.max(1, p.mesh.position.y + p.vz * dt);
    }
  }

  // 自機マーカー
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(17, 21, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  marker.rotation.x = -Math.PI / 2;
  scene.add(marker);

  function reset(state) {
    paint.reset(state);
    tex.needsUpdate = true;
    for (const t2 of pltTexes) t2.needsUpdate = true;
    for (const g of bots.values()) scene.remove(g);
    bots.clear();
    for (const p of parts) p.mesh.visible = false;
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function draw(state, playerId, yaw) {
    const dt = Math.min(0.1, clock.getDelta());
    if (paint.applyDirty(state)) {
      tex.needsUpdate = true;
      for (const t2 of pltTexes) t2.needsUpdate = true;
    }

    for (const e of state.entities) {
      let g = bots.get(e.id);
      if (!g) { g = makeBot(e); bots.set(e.id, g); }
      g.visible = e.state === 'ALIVE';
      if (!g.visible) continue;
      const u = g.userData;
      g.position.set(e.x, e.z, e.y);
      g.rotation.y = Math.atan2(e.aimX, e.aimY);

      // 歩行アニメ（移動量ベース）
      const md = Math.hypot(e.x - u.lastX, e.y - u.lastY);
      u.lastX = e.x; u.lastY = e.y;
      if (md > 0.05 && e.grounded) u.phase += md * 0.22; else u.phase *= 0.9;
      const sw = Math.sin(u.phase) * 0.65;
      u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
      u.arms[0].rotation.x = -sw * 0.6; u.arms[1].rotation.x = sw * 0.6;
      if (!e.grounded) { u.legs[0].rotation.x = 0.5; u.legs[1].rotation.x = -0.3; } // ジャンプポーズ

      // インクタンク残量
      u.ink.scale.y = Math.max(0.06, e.ink / 100);
      u.ink.position.y = 18 - (1 - u.ink.scale.y) * 6;

      // 潜行/人型の切り替え
      const swimOwn = e.swimming && e.grounded && state.grid.valueAt(e.x, e.y) === e.team;
      u.swim.visible = swimOwn;
      for (const m of u.humanoid) m.visible = !swimOwn;

      // 無敵点滅
      const blink = e.invulnT > 0 && Math.floor(e.invulnT * 10) % 2 === 0;
      g.traverse((m) => { if (m.isMesh) { m.material.transparent = blink || m.material.transparent; if (blink) m.material.opacity = 0.35; else if (m.material.opacity === 0.35) m.material.opacity = 1; } });
    }

    let bi = 0;
    for (const b of state.bullets) {
      const m = bulletMesh(bi++);
      m.visible = true;
      m.material = bulletMats[b.team];
      m.position.set(b.x, Math.max(2, b.h), b.y);
    }
    for (; bi < bulletPool.length; bi++) bulletPool[bi].visible = false;

    updateParts(dt);

    const p = state.entities.find((e) => e.id === playerId) || state.entities[0];
    marker.position.set(p.x, p.z + 0.6, p.y);
    marker.visible = p.state === 'ALIVE';
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    camera.position.set(p.x - fx * CAM_DIST, p.z + CAM_HEIGHT, p.y - fz * CAM_DIST);
    camera.lookAt(p.x + fx * CAM_LOOK_AHEAD, p.z, p.y + fz * CAM_LOOK_AHEAD);

    renderer.render(scene, camera);
  }

  return { reset, draw, resize, addFx };
}
