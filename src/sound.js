// サウンド: WebAudio生成のSE+BGM（外部ファイル・外部API一切なし＝¥0）— v3 FR-SND-001
export function createSound() {
  let ac = null;
  let muted = false;
  let bgmTimer = null;
  let master = null;

  function ensure() { // モバイルの自動再生制限: ユーザー操作後に初期化
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    return true;
  }

  function tone(freq, dur, type = 'square', vol = 0.15, slide = 0) {
    if (!ensure() || muted) return;
    const t = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur);
  }

  function noise(dur, vol = 0.12, lpFreq = 2200) {
    if (!ensure() || muted) return;
    const t = ac.currentTime;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) { v = v * 0.6 + (((i * 1103515245 + 12345) >>> 16) % 2000 / 1000 - 1) * 0.4; d[i] = v; }
    const src = ac.createBufferSource(); src.buffer = buf;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lpFreq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t);
  }

  // ゲームイベント→SE
  const SE = {
    shoot: () => { tone(820, 0.07, 'square', 0.06, -300); noise(0.05, 0.05, 3200); },
    shoot_heavy: () => { tone(300, 0.16, 'square', 0.12, -140); noise(0.1, 0.1, 1500); },
    laser: () => tone(1400, 0.22, 'sawtooth', 0.1, -900),
    swing: () => { noise(0.14, 0.14, 1100); tone(180, 0.12, 'sine', 0.1, -60); },
    land: () => noise(0.06, 0.05, 900),
    explode: () => { noise(0.3, 0.2, 700); tone(110, 0.3, 'sine', 0.16, -60); },
    splat: () => { tone(560, 0.32, 'sawtooth', 0.16, -440); noise(0.25, 0.14, 900); },
    jump: () => tone(330, 0.12, 'sine', 0.1, 240),
    special: () => { tone(440, 0.4, 'sawtooth', 0.14, 660); noise(0.35, 0.1, 2600); },
    start: () => { tone(520, 0.12, 'square', 0.12); setTimeout(() => tone(660, 0.12, 'square', 0.12), 130); setTimeout(() => tone(880, 0.2, 'square', 0.14), 260); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'square', 0.13), i * 140)),
    lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.13), i * 200)),
  };

  function play(type) { (SE[type] || (() => {}))(); }

  // BGM: 8ステップのチップチューンループ（生成・著作権フリー）
  const BASS = [98, 98, 131, 131, 110, 110, 147, 165];
  const LEAD = [392, 0, 523, 587, 659, 0, 587, 523];
  let step = 0;
  function startBGM() {
    if (!ensure() || bgmTimer) return;
    bgmTimer = setInterval(() => {
      if (muted) return;
      tone(BASS[step], 0.22, 'triangle', 0.10);
      if (LEAD[step]) tone(LEAD[step], 0.14, 'square', 0.035);
      if (step % 2 === 0) noise(0.03, 0.025, 6000); // ハイハット
      step = (step + 1) % 8;
    }, 240);
  }
  function stopBGM() { clearInterval(bgmTimer); bgmTimer = null; }
  function toggleMute() { muted = !muted; return muted; }

  return { play, startBGM, stopBGM, toggleMute, get muted() { return muted; } };
}
