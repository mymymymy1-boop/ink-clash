// 3D描画層 v3（Three.js r128 / グローバルTHREE使用）
// 人型キャラ・高低差ステージ・パーティクル。シミュレーションは2Dコアのまま（ADR-006）。
/* global THREE */
import { CONFIG } from './core/config.js';
import { obstacleRects, platformRects, getSpawns } from './core/stage.js';
import { createPaintCanvas } from './paintcanvas.js';

const FIELD_W = CONFIG.WORLD.W, FIELD_H = CONFIG.WORLD.H; // 注: バンドル結合のためトップレベル名は全モジュールで一意にする
const TEAM_HEX = { 1: 0xff6b1a, 2: 0x00b8a9 };
const TEAM_DARK = { 1: 0xb24400, 2: 0x007a6e };
// 参考画像分析(2026-06-12): 近接・低めのTPSカメラ／明るい昼の渓谷／インクが主役になる無彩色環境
const CAM_DIST = 78, CAM_HEIGHT = 52, CAM_LOOK_AHEAD = 130, CAM_LOOK_UP = 16;
const PLT_H = CONFIG.TERRAIN.PLATFORM_H;

export function createRenderer3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  // v4-gfx: 実シャドウマップで接地感・立体感を底上げ（色味は既存のキャンバステクスチャ基準を維持）
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87c8ee);
  scene.fog = new THREE.Fog(0xc4e2f2, 1000, 2600);

  // v3.2: グラデーションの空ドーム
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 16; skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, '#2f86d6');   // 天頂: 濃い青
  skyGrad.addColorStop(0.55, '#8ecdf0');
  skyGrad.addColorStop(1, '#e8f4f8');   // 地平線: 白っぽく
  skyCtx.fillStyle = skyGrad; skyCtx.fillRect(0, 0, 16, 256);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2600, 20, 14),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skyCanvas), side: THREE.BackSide, fog: false }),
  );
  sky.position.set(FIELD_W / 2, 0, FIELD_H / 2);
  scene.add(sky);

  // 雲（白い塊をいくつか）
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false });
  const cloudSpots = [[-400, 520, -700, 1.6], [500, 620, -900, 2.2], [1400, 560, -750, 1.4], [200, 580, 1500, 1.9], [1700, 640, 1300, 1.5]];
  for (const [cx, cy, cz, s] of cloudSpots) {
    const cl = new THREE.Group();
    for (const [ox, oy, oz, r] of [[0, 0, 0, 60], [70, 10, 10, 44], [-65, 6, -8, 48], [20, 28, -4, 38]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
      m.position.set(ox, oy, oz);
      m.scale.y = 0.55;
      cl.add(m);
    }
    cl.position.set(cx, cy, cz);
    cl.scale.setScalar(s);
    scene.add(cl);
  }

  const camera = new THREE.PerspectiveCamera(66, 16 / 9, 1, 4000);
  const clock = new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0xe6f2ff, 0x8d8d92, 1.0)); // 地面反射はニュートラルに（インクの色被り防止）
  const sun = new THREE.DirectionalLight(0xfffaf0, 1.15);
  sun.position.set(FIELD_W / 2 - 360, 760, FIELD_H / 2 - 480);
  // v4-gfx: 太陽光で実影を落とす（場全体をカバーする正射影フラスタム）
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 2200;
  sun.shadow.camera.left = -900; sun.shadow.camera.right = 900;
  sun.shadow.camera.top = 900; sun.shadow.camera.bottom = -900;
  sun.shadow.bias = -0.0008;
  sun.target.position.set(FIELD_W / 2, 0, FIELD_H / 2);
  scene.add(sun);
  scene.add(sun.target);

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
  floor.receiveShadow = true; // v4-gfx
  scene.add(floor);

  // 場外の地面（砂漠）
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(8000, 8000),
    new THREE.MeshLambertMaterial({ color: 0xd9b98a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(FIELD_W / 2, -2, FIELD_H / 2);
  scene.add(ground);

  // 遠景の渓谷（岩山）
  const rockCols = [0xc08552, 0xb3754a, 0xd49b6a, 0xa86f48];
  const rocks = [
    [-500, -350, 700, 260, 380], [600, -500, 900, 340, 420], [1500, -380, 760, 300, 360],
    [-550, 800, 800, 280, 400], [700, 900, 1000, 360, 430], [1600, 820, 700, 260, 380],
    [-700, 200, 500, 320, 400], [1750, 250, 520, 310, 420],
  ];
  rocks.forEach(([x, z, w, h, d], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: rockCols[i % rockCols.length] }));
    m.position.set(x + w / 2, h / 2 - 20, z + d / 2);
    m.rotation.y = (i * 0.7) % 0.5 - 0.25;
    scene.add(m);
  });

  // 看板（タイトルロゴ・オリジナル）
  const bbCanvas = document.createElement('canvas');
  bbCanvas.width = 512; bbCanvas.height = 160;
  const bctx = bbCanvas.getContext('2d');
  bctx.fillStyle = '#1c1c24'; bctx.fillRect(0, 0, 512, 160);
  const grad = bctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, CONFIG.BRANDING.TEAM_COLORS[1]); grad.addColorStop(1, CONFIG.BRANDING.TEAM_COLORS[2]);
  bctx.fillStyle = grad; bctx.font = '900 86px sans-serif'; bctx.textAlign = 'center';
  bctx.fillText(CONFIG.BRANDING.TITLE, 256, 112);
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(420, 130),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bbCanvas) }));
  bb.position.set(FIELD_W / 2, 150, -120);
  scene.add(bb);
  for (const px of [FIELD_W / 2 - 180, FIELD_W / 2 + 180]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 160, 8), new THREE.MeshLambertMaterial({ color: 0x6b6b75 }));
    pole.position.set(px, 80, -120);
    scene.add(pole);
  }

  // 外周フェンス（低め・明るいコンクリ）
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xa7a39a });
  for (const [x, z, w, d] of [[-20, -20, FIELD_W + 40, 20], [-20, FIELD_H, FIELD_W + 40, 20], [-20, 0, 20, FIELD_H], [FIELD_W, 0, 20, FIELD_H]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 60, d), wallMat);
    m.position.set(x + w / 2, 30, z + d / 2);
    scene.add(m);
  }

  // 注意縞テクスチャ（工事現場感）
  const stCanvas = document.createElement('canvas');
  stCanvas.width = 64; stCanvas.height = 16;
  const sctx = stCanvas.getContext('2d');
  sctx.fillStyle = '#e8c11c'; sctx.fillRect(0, 0, 64, 16);
  sctx.fillStyle = '#222'; sctx.beginPath();
  for (let x = -16; x < 64; x += 24) { sctx.moveTo(x, 16); sctx.lineTo(x + 12, 0); sctx.lineTo(x + 24, 0); sctx.lineTo(x + 12, 16); }
  sctx.fill();
  const stripeTex = new THREE.CanvasTexture(stCanvas);
  stripeTex.wrapS = THREE.RepeatWrapping; stripeTex.repeat.set(4, 1);
  const stripeMat = new THREE.MeshBasicMaterial({ map: stripeTex });

  // 壁（遮蔽・明るいコンクリ＋天面に注意縞）
  const obsMat = new THREE.MeshLambertMaterial({ color: 0x969288 });
  for (const [x, y, w, h] of obstacleRects()) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, CONFIG.TERRAIN.WALL_H, h),
      [obsMat, obsMat, stripeMat, obsMat, obsMat, obsMat]);
    m.position.set(x + w / 2, CONFIG.TERRAIN.WALL_H / 2, y + h / 2);
    scene.add(m);
  }

  // 台（v4: 多層。上面に塗りテクスチャの該当領域＝塗りが台の上にも見える）
  const pltSides = [
    new THREE.MeshLambertMaterial({ color: 0xb1ada3 }),
    new THREE.MeshLambertMaterial({ color: 0xa39f96 }),
    new THREE.MeshLambertMaterial({ color: 0x969289 }),
  ];
  // v5: ステージ依存ジオメトリ（台・スポーンパッド）は再構築可能にする
  let pltTexes = [];
  let stageMeshes = [];
  function buildStageGeometry() {
    for (const m of stageMeshes) scene.remove(m);
    stageMeshes = [];
    pltTexes = [];
    // スポーンパッド（ステージごとのスポーン位置を使う）
    const spawns = getSpawns();
    for (const team of [1, 2]) {
      const s = spawns[team];
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(46, 50, 4, 24),
        new THREE.MeshLambertMaterial({ color: TEAM_HEX[team] }));
      pad.position.set(s.x, 2, s.y);
      pad.receiveShadow = true;
      scene.add(pad); stageMeshes.push(pad);
    }
    // 台（多層）
    for (const [x, y, w, h, level = 1] of platformRects()) {
      const t2 = tex.clone();
      t2.repeat.set(w / FIELD_W, h / FIELD_H);
      t2.offset.set(x / FIELD_W, 1 - (y + h) / FIELD_H);
      pltTexes.push(t2);
      const topMat = new THREE.MeshLambertMaterial({ map: t2 });
      const side = pltSides[Math.min(2, (level - 1) >> 2)];
      const ph = level * PLT_H;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, ph, h),
        [side, side, topMat, side, side, side]);
      m.position.set(x + w / 2, ph / 2, y + h / 2);
      m.castShadow = true; m.receiveShadow = true; // v4-gfx
      scene.add(m); stageMeshes.push(m);
    }
  }
  buildStageGeometry();

  // ===== 人型ペイントボット =====
  const bots = new Map();
  const mixers = new Map(); // v3.3: モデルアニメーション

  // v3.3: 市販品質キャラ（RobotExpressive・CC0・リグ&アニメ済み）。失敗時は自作キャラにフォールバック
  let robotAsset = null;
  (function loadRobot() {
    if (!THREE.GLTFLoader) return;
    const loader = new THREE.GLTFLoader();
    const onLoad = (gltf) => {
      const box = new THREE.Box3().setFromObject(gltf.scene);
      robotAsset = { gltf, height: box.max.y - box.min.y };
    };
    if (typeof window !== 'undefined' && window.__ROBOT_B64) {
      const bin = atob(window.__ROBOT_B64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      loader.parse(buf.buffer, '', onLoad, () => {});
    } else {
      loader.load('./vendor/robot.glb', onLoad, undefined, () => {});
    }
  })();

  function makeBot(e) {
    return (robotAsset && THREE.SkeletonUtils) ? makeRobotBot(e) : makePrimitiveBot(e);
  }

  function makeRobotBot(e) {
    const g = new THREE.Group();
    const model = THREE.SkeletonUtils.clone(robotAsset.gltf.scene);
    const s = 42 / robotAsset.height;
    model.scale.setScalar(s);
    g.add(model);
    // チームカラー: 本体素材を着色
    model.traverse((m) => {
      if (m.isMesh) {
        m.material = m.material.clone();
        if (m.material.name === 'Main') m.material.color.setHex(TEAM_HEX[e.team]);
        m.castShadow = true; // v4-gfx
      }
    });
    // アニメーション（Idle/Running/Jump）
    const mixer = new THREE.AnimationMixer(model);
    const clips = robotAsset.gltf.animations;
    const act = (n) => { const c = THREE.AnimationClip.findByName(clips, n); return c ? mixer.clipAction(c) : null; };
    const actions = { idle: act('Idle'), run: act('Running'), jump: act('Jump') };
    if (actions.jump) { actions.jump.setLoop(THREE.LoopOnce, 1); actions.jump.clampWhenFinished = true; }
    if (actions.idle) actions.idle.play();
    mixers.set(e.id, { mixer, actions, cur: 'idle' });

    // 背中のインクタンク（残量表示はゲーム情報として維持）
    const col = new THREE.MeshToonMaterial({ color: TEAM_HEX[e.team] });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 11, 10),
      new THREE.MeshLambertMaterial({ color: 0xdddde6, transparent: true, opacity: 0.5 }));
    tank.position.set(0, 15, -11.5);
    g.add(tank);
    const ink = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 10, 10), col);
    ink.position.set(0, 15, -11.5);
    g.add(ink);

    // 落ち影
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(11, 18),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    // 潜行形態
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

    g.userData = { ink, swim, shadow, humanoid: [model, tank], lastX: e.x, lastY: e.y, phase: 0, isRobot: true, inkBaseY: 15 };
    scene.add(g);
    return g;
  }
  const barrelByKind = {
    shooter: [3.2, 3.2, 13], roller: [9, 6, 8], charger: [2.2, 2.2, 22],
    slosher: [7, 5, 7], spinner: [5.5, 5.5, 11], blaster: [4.5, 4.5, 10],
    brush: [6, 3, 9], dualies: [2.8, 2.8, 10], stringer: [3, 5.5, 16], // v7
  };
  // v3.2: キャラはトゥーン調＋主要パーツに輪郭線（インバーテッドハル）
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x20202a, side: THREE.BackSide });
  function addOutline(mesh, parent, scale = 1.07) {
    const o = new THREE.Mesh(mesh.geometry, outlineMat);
    o.position.copy(mesh.position);
    o.rotation.copy(mesh.rotation);
    o.scale.setScalar(scale);
    parent.add(o);
    return o;
  }

  function makePrimitiveBot(e) {
    // フォールバック自作キャラ: 大きな頭・小さな体・両手持ち武器・カラフルな服
    const g = new THREE.Group();
    const col = new THREE.MeshToonMaterial({ color: TEAM_HEX[e.team] });
    const dark = new THREE.MeshToonMaterial({ color: TEAM_DARK[e.team] });
    const skin = new THREE.MeshToonMaterial({ color: 0xf6dfc4 });
    const shirt = new THREE.MeshToonMaterial({ color: 0xf2f2ee });
    const shorts = new THREE.MeshToonMaterial({ color: 0x33333d });

    const legs = [];
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(3.8, 9, 3.8), skin);
      leg.position.set(s * 3.6, 12, 0);
      leg.geometry.translate(0, -4.5, 0); // 腰から振る
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 6.4), col);
      shoe.position.set(0, -8.6, 1);
      leg.add(shoe);
      g.add(leg); legs.push(leg);
    }
    const hip = new THREE.Mesh(new THREE.BoxGeometry(9.5, 5, 6.5), shorts);
    hip.position.y = 13.5;
    g.add(hip);
    const body = new THREE.Mesh(new THREE.BoxGeometry(10.5, 9, 6.5), shirt);
    body.position.y = 20;
    g.add(body);
    const bodyOutline = addOutline(body, g, 1.09);

    // 大きな頭＋顔（頭・キャップ・胴に輪郭線）
    const head = new THREE.Mesh(new THREE.SphereGeometry(8.2, 18, 14), skin);
    head.position.y = 33;
    g.add(head);
    const headOutline = addOutline(head, g, 1.06);
    const eyes = [];
    for (const s of [-1, 1]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(2.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      white.position.set(s * 3.1, 33.6, 7.0);
      g.add(white); eyes.push(white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0x16161e }));
      pupil.position.set(s * 3.1, 33.6, 8.9);
      g.add(pupil); eyes.push(pupil);
    }
    // チームカラーのキャップ
    const cap = new THREE.Mesh(new THREE.SphereGeometry(8.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.3), col);
    cap.position.y = 34.4;
    g.add(cap);
    const capOutline = addOutline(cap, g, 1.06);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.4, 5.5), dark);
    brim.position.set(0, 36.4, 8.6);
    g.add(brim);

    // 両腕（前に構える）
    const arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3, 9, 3), skin);
      arm.position.set(s * 7.2, 23.5, 1);
      arm.geometry.translate(0, -4.5, 0);
      arm.rotation.x = -1.0; // 前へ
      g.add(arms[arms.length] = arm);
    }
    // 武器（両手の中央・大きめ）
    const bd = barrelByKind[e.weaponKind] || barrelByKind.shooter;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(bd[0] * 1.25, bd[1] * 1.25, bd[2] * 1.25), new THREE.MeshLambertMaterial({ color: 0xeaeaef }));
    gun.position.set(0, 19, 10);
    g.add(gun);
    const gunTip = new THREE.Mesh(new THREE.BoxGeometry(bd[0], bd[1], 4), col);
    gunTip.position.set(0, 19, 10 + bd[2] * 0.625 + 2);
    g.add(gunTip);

    // 背中のインクタンク（残量が見える）
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 13, 10),
      new THREE.MeshLambertMaterial({ color: 0xdddde6, transparent: true, opacity: 0.5 }));
    tank.position.set(0, 22, -6.6);
    g.add(tank);
    const ink = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 12, 10), col);
    ink.position.set(0, 22, -6.6);
    g.add(ink);

    // 落ち影（参考画像: 強い日差しの影が立体感の要）
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(11, 18),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

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

    const humanoid = [legs[0], legs[1], hip, body, head, cap, brim, gun, gunTip, tank, ...arms, ...eyes, headOutline, capOutline, bodyOutline];
    // v4-gfx: 本体パーツが実影を落とす（輪郭線=BackSideは除外）
    for (const m of [legs[0], legs[1], hip, body, head, cap, brim, gun, gunTip, ...arms]) m.castShadow = true;
    g.userData = { legs, arms, body, ink, swim, shadow, humanoid, lastX: e.x, lastY: e.y, phase: 0 };
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

  // v5-fx: インク飛沫パーティクル（サイズ揺らぎ＋寿命に応じた縮小フェード）
  const parts = [];
  const partGeo = new THREE.SphereGeometry(2.6, 6, 5);
  const PART_CAP = 160;
  let jseed = 1;
  const jitter = () => { jseed = (jseed * 1103515245 + 12345) & 0x7fffffff; return jseed / 0x7fffffff; }; // 視覚揺らぎ用（決定論ではない描画専用）
  function spawnPart(x, h, y, team, n, power) {
    for (let i = 0; i < n; i++) {
      let p = parts.find((q) => !q.mesh.visible);
      if (!p) {
        if (parts.length >= PART_CAP) return; // プール上限
        p = { mesh: new THREE.Mesh(partGeo, bulletMats[1].clone()), vx: 0, vy: 0, vz: 0, ttl: 0, life: 0, sz: 1 };
        scene.add(p.mesh); parts.push(p);
      }
      const a = (i / n) * Math.PI * 2 + jitter() * 0.9;
      const spd = power * (0.6 + jitter() * 0.7);     // 速度を粒ごとにばらす
      p.sz = 0.55 + jitter() * 1.1;                    // サイズ揺らぎ
      p.mesh.material.color.setHex(TEAM_HEX[team]);
      p.mesh.position.set(x, h + 4, y);
      p.mesh.scale.setScalar(p.sz);
      p.mesh.visible = true;
      p.vx = Math.cos(a) * spd; p.vy = Math.sin(a) * spd;
      p.vz = 60 + power * (0.6 + jitter() * 0.7);
      p.ttl = p.life = 0.5 + jitter() * 0.35;
    }
  }
  // [個数, 勢い]。splat(撃破)は大きく派手に、landは控えめに
  const FX_N = { land: [4, 42], explode: [14, 95], splat: [18, 90], special: [10, 75], swing: [5, 58] };
  // v5-fx: マズルフラッシュ（発砲時に銃口で一瞬光る）
  const flashes = [];
  const flashGeo = new THREE.SphereGeometry(5.5, 8, 6);
  function spawnFlash(x, y, team, size) {
    let f = flashes.find((q) => !q.mesh.visible);
    if (!f) {
      if (flashes.length >= 24) return;
      f = { mesh: new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })), ttl: 0 };
      scene.add(f.mesh); flashes.push(f);
    }
    f.mesh.material.color.setHex(TEAM_HEX[team]);
    f.mesh.position.set(x, 18, y);
    f.mesh.scale.setScalar(size);
    f.mesh.material.opacity = 0.9;
    f.mesh.visible = true;
    f.ttl = 0.09;
  }
  const FLASH_EVENTS = { shoot: 1, shoot_heavy: 1.7, laser: 1.4 };
  function addFx(events) {
    for (const ev of events) {
      const f = FX_N[ev.type];
      if (f) spawnPart(ev.x, 6, ev.y, ev.team, f[0], f[1]);
      const fl = FLASH_EVENTS[ev.type];
      if (fl) spawnFlash(ev.x, ev.y, ev.team, fl);
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
      p.mesh.scale.setScalar(p.sz * Math.max(0.15, p.ttl / p.life)); // 縮小フェード
    }
    for (const f of flashes) {
      if (!f.mesh.visible) continue;
      f.ttl -= dt;
      if (f.ttl <= 0) { f.mesh.visible = false; continue; }
      f.mesh.scale.multiplyScalar(1 + dt * 14);   // 急速に膨らみながら
      f.mesh.material.opacity = Math.max(0, f.ttl / 0.09 * 0.9); // 消える
    }
  }

  // 自機マーカー
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(17, 21, 28),
    new THREE.MeshBasicMaterial({ color: 0x2a2a35, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  marker.rotation.x = -Math.PI / 2;
  scene.add(marker);

  function reset(state) {
    paint.reset(state);
    buildStageGeometry(); // v5: 選択ステージの台・スポーンを再構築
    tex.needsUpdate = true;
    for (const t2 of pltTexes) t2.needsUpdate = true;
    for (const g of bots.values()) { if (g.userData.shadow) scene.remove(g.userData.shadow); scene.remove(g); }
    bots.clear();
    mixers.clear();
    for (const p of parts) p.mesh.visible = false;
    for (const f of flashes) f.mesh.visible = false;
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
      const u = g.userData;
      if (!g.visible) { if (u.shadow) u.shadow.visible = false; continue; }
      g.position.set(e.x, e.z, e.y);
      g.rotation.y = Math.atan2(e.aimX, e.aimY);

      // 歩行アニメ（移動量ベース）
      const md = Math.hypot(e.x - u.lastX, e.y - u.lastY);
      u.lastX = e.x; u.lastY = e.y;
      if (u.legs) { // 自作キャラ
        if (md > 0.05 && e.grounded) u.phase += md * 0.22; else u.phase *= 0.9;
        const sw = Math.sin(u.phase) * 0.65;
        u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
        u.arms[0].rotation.x = -1.0 - sw * 0.25; u.arms[1].rotation.x = -1.0 + sw * 0.25;
        if (!e.grounded) { u.legs[0].rotation.x = 0.55; u.legs[1].rotation.x = -0.35; }
      }
      const mx = mixers.get(e.id); // モデルキャラ: 状態でアニメ切替
      if (mx) {
        const want = !e.grounded ? 'jump' : md > 0.05 ? 'run' : 'idle';
        if (want !== mx.cur && mx.actions[want]) {
          const prev = mx.actions[mx.cur], next = mx.actions[want];
          next.reset();
          if (prev) next.crossFadeFrom(prev, 0.16, false);
          next.play();
          mx.cur = want;
        }
      }

      // インクタンク残量
      u.ink.scale.y = Math.max(0.06, e.ink / 100);
      u.ink.position.y = (u.inkBaseY || 22) - (1 - u.ink.scale.y) * 5;

      // 落ち影（地面の高さに置き、滞空中は小さく）
      const gH = state.grid.levelAt(e.x, e.y) * PLT_H;
      u.shadow.visible = true;
      u.shadow.position.set(e.x, gH + 0.7, e.y);
      const air = Math.min(1, Math.max(0, (e.z - gH) / 70));
      u.shadow.scale.setScalar(1 - air * 0.45);

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
      // v3.2: 進行方向に伸びるインク弾（しずく感）
      m.rotation.y = Math.atan2(b.vx, b.vy);
      m.scale.set(1, 1, 1.9);
    }
    for (; bi < bulletPool.length; bi++) bulletPool[bi].visible = false;

    updateParts(dt);
    for (const m of mixers.values()) m.mixer.update(dt);

    const p = state.entities.find((e) => e.id === playerId) || state.entities[0];
    marker.position.set(p.x, p.z + 0.6, p.y);
    marker.visible = p.state === 'ALIVE';
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    camera.position.set(p.x - fx * CAM_DIST, p.z + CAM_HEIGHT, p.y - fz * CAM_DIST);
    camera.lookAt(p.x + fx * CAM_LOOK_AHEAD, p.z + CAM_LOOK_UP, p.y + fz * CAM_LOOK_AHEAD);

    renderer.render(scene, camera);
  }

  return { reset, draw, resize, addFx };
}
