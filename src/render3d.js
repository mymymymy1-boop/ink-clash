// 3D描画層（Three.js r128 / グローバルTHREE使用）— ADR-006/007, FR-3D-001/002
// シミュレーションは2D(logic x,y)のまま。3D座標は (x, 高さ, y) にマッピング。
/* global THREE */
import { CONFIG } from './core/config.js';
import { obstacleRects } from './core/stage.js';
import { createPaintCanvas } from './paintcanvas.js';

const FIELD_W = CONFIG.WORLD.W, FIELD_H = CONFIG.WORLD.H; // 注: バンドル結合のためトップレベル名は全モジュールで一意にする
const TEAM_HEX = { 1: 0xff6b1a, 2: 0x00b8a9 };
const CAM_DIST = 110, CAM_HEIGHT = 92, CAM_LOOK_AHEAD = 95;

export function createRenderer3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10101a);
  scene.fog = new THREE.Fog(0x10101a, 700, 1700);

  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 1, 3000);

  // ライト
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x32323e, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
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

  // 場外の地面（虚空を見せない）
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(8000, 8000),
    new THREE.MeshLambertMaterial({ color: 0x1a1a24 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(FIELD_W / 2, -2, FIELD_H / 2);
  scene.add(ground);

  // 自機マーカー（白リング）
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(17, 21, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  marker.rotation.x = -Math.PI / 2;
  scene.add(marker);

  // 外周フェンス
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x2c2c38 });
  for (const [x, z, w, d] of [[-20, -20, FIELD_W + 40, 20], [-20, FIELD_H, FIELD_W + 40, 20], [-20, 0, 20, FIELD_H], [FIELD_W, 0, 20, FIELD_H]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 50, d), wallMat);
    m.position.set(x + w / 2, 25, z + d / 2);
    scene.add(m);
  }

  // 障害物（2Dステージ定義と同一座標）
  const obsMat = new THREE.MeshLambertMaterial({ color: 0x52525f });
  for (const [x, y, w, h] of obstacleRects()) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 44, h), obsMat);
    m.position.set(x + w / 2, 22, y + h / 2);
    scene.add(m);
  }

  // ペイントボット（球体+目+ノズル）
  const bots = new Map();
  function makeBot(e) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.PLAYER.RADIUS, 18, 14),
      new THREE.MeshLambertMaterial({ color: TEAM_HEX[e.team] }),
    );
    body.position.y = CONFIG.PLAYER.RADIUS;
    g.add(body);
    const eyeGeo = new THREE.SphereGeometry(2.6, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x101016 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(s * 5, CONFIG.PLAYER.RADIUS + 4, CONFIG.PLAYER.RADIUS - 3);
      g.add(eye);
    }
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 3, 14, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8e8f0 }),
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, CONFIG.PLAYER.RADIUS, CONFIG.PLAYER.RADIUS + 6);
    g.add(nozzle);
    g.userData = { body };
    scene.add(g);
    return g;
  }

  // 弾プール
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

  function reset(state) {
    paint.reset(state);
    tex.needsUpdate = true;
    for (const g of bots.values()) scene.remove(g);
    bots.clear();
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // yaw: カメラ方位角。前方(2D logic) = (sin yaw, cos yaw)
  function draw(state, playerId, yaw) {
    if (paint.applyDirty(state)) tex.needsUpdate = true;

    for (const e of state.entities) {
      let g = bots.get(e.id);
      if (!g) { g = makeBot(e); bots.set(e.id, g); }
      g.visible = e.state === 'ALIVE';
      if (!g.visible) continue;
      g.position.set(e.x, 0, e.y);
      g.rotation.y = Math.atan2(e.aimX, e.aimY); // logic aim → y回転
      // 潜行: 平たく沈む / 無敵: 点滅
      const swimOwn = e.swimming && state.grid.valueAt(e.x, e.y) === e.team;
      g.scale.y = swimOwn ? 0.28 : 1;
      const blink = e.invulnT > 0 && Math.floor(e.invulnT * 10) % 2 === 0;
      g.userData.body.material.transparent = blink || swimOwn;
      g.userData.body.material.opacity = blink ? 0.35 : swimOwn ? 0.75 : 1;
    }

    let bi = 0;
    for (const b of state.bullets) {
      const m = bulletMesh(bi++);
      m.visible = true;
      m.material = bulletMats[b.team];
      // 弾道に山なりの見た目（ロジックは2D直進のまま）
      const t = Math.min(1, b.traveled / b.range);
      m.position.set(b.x, 10 + 26 * Math.sin(Math.PI * t) * (b.range / 520), b.y);
    }
    for (; bi < bulletPool.length; bi++) bulletPool[bi].visible = false;

    // TPSカメラ（FR-3D-001）
    const p = state.entities.find((e) => e.id === playerId) || state.entities[0];
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    marker.position.set(p.x, 0.6, p.y);
    marker.visible = p.state === 'ALIVE';
    camera.position.set(p.x - fx * CAM_DIST, CAM_HEIGHT, p.y - fz * CAM_DIST);
    camera.lookAt(p.x + fx * CAM_LOOK_AHEAD, 0, p.y + fz * CAM_LOOK_AHEAD);

    renderer.render(scene, camera);
  }

  return { reset, draw, resize };
}
