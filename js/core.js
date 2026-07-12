// ============ 核心：渲染引擎 / 资产库 / 输入 / 音频 / UI ============
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const Q = new URLSearchParams(location.search);

// ---------------- 引擎 ----------------
export class Engine {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d18);
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 300);
    this.camera.position.set(0, 3, 8);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.72, 0.9, 0.72);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
    });
  }
  render() { this.composer.render(); }
}

// ---------------- 资产库 ----------------
const PACK_DIR = { chars: 'assets/chars/', items: 'assets/items/', dungeon: 'assets/dungeon/', furniture: 'assets/furniture/', halloween: 'assets/halloween/', restaurant: 'assets/restaurant/' };

export class AssetLib {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();   // url -> gltf
    this.tintCache = new Map(); // model+color -> texture
  }
  async load(url) {
    if (this.cache.has(url)) return this.cache.get(url);
    const p = new Promise((res, rej) => this.loader.load(url, res, undefined, rej));
    this.cache.set(url, p);
    const gltf = await p;
    this.cache.set(url, gltf);
    return gltf;
  }
  async loadChar(model) { return this.load(PACK_DIR.chars + model + '.glb'); }
  // 场景件：克隆网格，开启阴影（自动解析 .gltf/.glb/.gltf.glb 命名差异）
  async prop(pack, name, { shadow = true, recv = true } = {}) {
    const dir = PACK_DIR[pack];
    let candidates;
    if (name.endsWith('.gltf') && pack === 'dungeon') candidates = [name + '.glb', name];
    else if (name.endsWith('.gltf') || name.endsWith('.glb')) candidates = [name];
    else if (pack === 'dungeon') candidates = [name + '.gltf.glb', name + '.glb', name + '.gltf'];
    else candidates = [name + '.gltf', name + '.glb'];
    let gltf = null, lastErr = null;
    for (const c of candidates) {
      try { gltf = await this.load(dir + c); break; }
      catch (e) { lastErr = e; this.cache.delete(dir + c); }
    }
    if (!gltf) throw lastErr || new Error('prop not found: ' + pack + '/' + name);
    const obj = gltf.scene.clone(true);
    obj.traverse(o => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = recv; } });
    return obj;
  }
  // 角色实例：骨骼克隆 + 独立材质（供染色/表情）
  async charInstance(model) {
    const gltf = await this.loadChar(model);
    const inst = SkeletonUtils.clone(gltf.scene);
    inst.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true; o.receiveShadow = false;
        o.frustumCulled = false;
        if (o.material) { o.material = o.material.clone(); }
      }
    });
    return { obj: inst, anims: gltf.animations };
  }
  // 袍色变体：把主色相簇替换为目标色
  tintChar(inst, colorHex) {
    inst.traverse(o => {
      if ((o.isMesh || o.isSkinnedMesh) && o.material?.map) {
        const key = o.material.map.uuid + '_' + colorHex;
        if (this.tintCache.has(key)) { o.material = o.material.clone(); o.material.map = this.tintCache.get(key); return; }
        const img = o.material.map.image;
        if (!img || !img.width) return;
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height);
        const px = d.data;
        // 找主色相（饱和像素直方图）
        const hist = new Array(36).fill(0);
        for (let i = 0; i < px.length; i += 16) {
          const [h, s, v] = rgb2hsv(px[i], px[i + 1], px[i + 2]);
          if (s > 0.3 && v > 0.25) hist[Math.floor(h / 10)]++;
        }
        const domH = hist.indexOf(Math.max(...hist)) * 10 + 5;
        const tc = new THREE.Color(colorHex);
        const [th] = rgb2hsv(tc.r * 255, tc.g * 255, tc.b * 255);
        for (let i = 0; i < px.length; i += 4) {
          const [h, s, v] = rgb2hsv(px[i], px[i + 1], px[i + 2]);
          let dh = Math.abs(h - domH); if (dh > 180) dh = 360 - dh;
          if (s > 0.25 && v > 0.2 && dh < 42) {
            const [r, g, b] = hsv2rgb(th, s * 0.95, v);
            px[i] = r; px[i + 1] = g; px[i + 2] = b;
          }
        }
        cx.putImageData(d, 0, 0);
        const tex = new THREE.CanvasTexture(cv);
        tex.flipY = o.material.map.flipY; tex.colorSpace = o.material.map.colorSpace;
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
        this.tintCache.set(key, tex);
        o.material = o.material.clone(); o.material.map = tex;
      }
    });
  }
}
function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn;
  let h = 0;
  if (df) {
    if (mx === r) h = ((g - b) / df) % 6; else if (mx === g) h = (b - r) / df + 2; else h = (r - g) / df + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx ? df / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// ---------------- 输入 ----------------
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouse = { dx: 0, dy: 0, down: false, rdown: false };
    this.locked = false;
    this.enabled = true;
    addEventListener('keydown', e => { if (!e.repeat) this.keys.add(e.code); this.onKey?.(e.code, e); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('mousemove', e => {
      if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    addEventListener('mousedown', e => { if (e.button === 0) this.mouse.down = true; if (e.button === 2) this.mouse.rdown = true; this.onClick?.(e); });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.rdown = false; });
    addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement != null; });
    addEventListener('wheel', e => this.onWheel?.(e.deltaY));
  }
  lock(canvas) { if (!this.locked && !Q.has('shot')) canvas.requestPointerLock?.(); }
  unlock() { if (this.locked) document.exitPointerLock?.(); }
  consumeMouse() { const { dx, dy } = this.mouse; this.mouse.dx = 0; this.mouse.dy = 0; return { dx, dy }; }
  down(c) { return this.keys.has(c); }
}

// ---------------- 音频（WebAudio 全合成） ----------------
export class AudioKit {
  constructor() {
    this.ac = null; this.muted = Q.has('shot');
    this.musicGain = null; this.sfxGain = null;
    this.mood = null; this._musicTimer = null; this._step = 0;
  }
  ensure() {
    if (this.ac || this.muted) return;
    this.ac = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ac.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ac.destination);
    this.musicGain = this.ac.createGain(); this.musicGain.gain.value = 0.35; this.musicGain.connect(this.master);
    this.sfxGain = this.ac.createGain(); this.sfxGain.gain.value = 0.8; this.sfxGain.connect(this.master);
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.7; return this.muted; }
  tone({ f = 440, t = 0.2, type = 'sine', v = 0.3, slide = 0, delay = 0, dest }) {
    if (!this.ac || this.muted) return;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    const t0 = this.ac.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + t);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t0); o.stop(t0 + t + 0.05);
  }
  noise({ t = 0.3, v = 0.2, f = 1200, delay = 0 }) {
    if (!this.ac || this.muted) return;
    const t0 = this.ac.currentTime + delay;
    const len = Math.floor(this.ac.sampleRate * t);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ac.createBufferSource(); src.buffer = buf;
    const flt = this.ac.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = f;
    const g = this.ac.createGain(); g.gain.value = v;
    src.connect(flt); flt.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  }
  sfx(name) {
    if (!this.ac || this.muted) return;
    const S = {
      ui: () => this.tone({ f: 660, t: 0.08, type: 'triangle', v: 0.15 }),
      page: () => this.noise({ t: 0.18, f: 3000, v: 0.12 }),
      cast: () => { this.noise({ t: 0.25, f: 2400, v: 0.14 }); this.tone({ f: 880, t: 0.3, type: 'sine', v: 0.2, slide: 660 }); },
      fire: () => { this.noise({ t: 0.5, f: 700, v: 0.3 }); this.tone({ f: 160, t: 0.4, type: 'sawtooth', v: 0.12, slide: -60 }); },
      ice: () => { this.tone({ f: 1500, t: 0.35, type: 'sine', v: 0.18, slide: 800 }); this.noise({ t: 0.3, f: 5000, v: 0.1 }); },
      arc: () => { this.noise({ t: 0.22, f: 3400, v: 0.3 }); this.tone({ f: 220, t: 0.18, type: 'square', v: 0.1 }); },
      shield: () => this.tone({ f: 320, t: 0.6, type: 'sine', v: 0.22, slide: 220 }),
      portal: () => { this.tone({ f: 200, t: 0.7, type: 'sine', v: 0.25, slide: 700 }); this.tone({ f: 400, t: 0.7, type: 'triangle', v: 0.15, slide: 900, delay: 0.05 }); },
      hit: () => { this.noise({ t: 0.15, f: 900, v: 0.3 }); this.tone({ f: 130, t: 0.15, type: 'square', v: 0.15, slide: -40 }); },
      hurt: () => this.tone({ f: 180, t: 0.3, type: 'sawtooth', v: 0.2, slide: -80 }),
      chest: () => { this.tone({ f: 523, t: 0.12, type: 'triangle', v: 0.2 }); this.tone({ f: 784, t: 0.25, type: 'triangle', v: 0.2, delay: 0.1 }); },
      coin: () => { this.tone({ f: 988, t: 0.09, type: 'square', v: 0.12 }); this.tone({ f: 1319, t: 0.15, type: 'square', v: 0.12, delay: 0.07 }); },
      levelup: () => [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, t: 0.22, type: 'triangle', v: 0.22, delay: i * 0.09 })),
      quest: () => [659, 880].forEach((f, i) => this.tone({ f, t: 0.25, type: 'sine', v: 0.2, delay: i * 0.12 })),
      bell: () => [880, 660, 880, 1100].forEach((f, i) => this.tone({ f, t: 0.7, type: 'sine', v: 0.14, delay: i * 0.5 })),
      door: () => this.noise({ t: 0.4, f: 300, v: 0.22 }),
      bubble: () => this.tone({ f: 300 + Math.random() * 200, t: 0.12, type: 'sine', v: 0.1, slide: 150 }),
      ghost: () => this.tone({ f: 500, t: 1.2, type: 'sine', v: 0.1, slide: -200 }),
      sparkle: () => this.tone({ f: 1200 + Math.random() * 800, t: 0.15, type: 'sine', v: 0.08 }),
      morph: () => { this.tone({ f: 700, t: 0.3, type: 'triangle', v: 0.2, slide: -400 }); this.noise({ t: 0.2, f: 2000, v: 0.12, delay: 0.1 }); },
      write: () => this.noise({ t: 0.1, f: 4500, v: 0.06 }),
      plant: () => this.noise({ t: 0.2, f: 800, v: 0.15 }),
    };
    S[name]?.();
  }
  // 环境音乐：按 mood 循环小节
  music(mood) {
    if (this.mood === mood || !this.ac || this.muted) { this.mood = mood; return; }
    this.mood = mood;
    clearInterval(this._musicTimer);
    if (!mood) return;
    const play = () => {
      if (this.muted || document.hidden) return;
      const st = this._step++;
      const bar = st % 8;
      const M = {
        castle: () => { // 温暖学院：竖琴分解 + 长音垫
          const chords = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]];
          const ch = chords[Math.floor(st / 2) % 4];
          if (bar % 2 === 0) ch.forEach((f, i) => this.tone({ f: f * 2, t: 1.6, type: 'sine', v: 0.05, delay: i * 0.22, dest: this.musicGain }));
          this.tone({ f: ch[st % 3] * 4, t: 0.5, type: 'triangle', v: 0.04, delay: 0.5, dest: this.musicGain });
        },
        night: () => {
          const f = [110, 116, 98, 104][Math.floor(st / 2) % 4];
          this.tone({ f, t: 2.2, type: 'sine', v: 0.07, dest: this.musicGain });
          if (bar === 3) this.tone({ f: f * 6, t: 1.4, type: 'sine', v: 0.03, dest: this.musicGain });
        },
        duel: () => {
          const f = [147, 147, 175, 131][bar % 4];
          this.tone({ f, t: 0.24, type: 'sawtooth', v: 0.07, dest: this.musicGain });
          this.noise({ t: 0.08, f: 6000, v: bar % 2 ? 0.05 : 0.1 });
          if (bar % 4 === 2) this.tone({ f: f * 3, t: 0.4, type: 'square', v: 0.03, dest: this.musicGain });
        },
        dungeon: () => {
          this.tone({ f: 55 + (st % 3) * 4, t: 2.4, type: 'sine', v: 0.09, dest: this.musicGain });
          if (bar === 5) this.tone({ f: 1800, t: 0.3, type: 'sine', v: 0.02, slide: -600, dest: this.musicGain });
        },
        title: () => {
          const seq = [330, 392, 494, 392, 330, 494, 587, 494];
          this.tone({ f: seq[bar], t: 0.9, type: 'sine', v: 0.06, dest: this.musicGain });
          this.tone({ f: seq[bar] / 2, t: 1.8, type: 'triangle', v: 0.04, dest: this.musicGain });
        },
        feast: () => {
          const seq = [262, 330, 392, 523, 392, 330, 294, 349];
          this.tone({ f: seq[bar], t: 0.4, type: 'triangle', v: 0.07, dest: this.musicGain });
          if (bar % 2) this.tone({ f: seq[bar] / 2, t: 0.4, type: 'sine', v: 0.05, dest: this.musicGain });
        },
      };
      M[mood]?.();
    };
    this._musicTimer = setInterval(play, 620);
  }
}

// ---------------- UI ----------------
const $ = (id) => document.getElementById(id);
export class UI {
  constructor(audio) {
    this.audio = audio;
    this.dlgQueue = null; this.dlgResolve = null; this.typing = null;
    this.el = {
      loading: $('loading'), loadbar: $('loadbar'), loadtext: $('loadtext'),
      title: $('title'), charcreate: $('charcreate'), hud: $('hud'), dialog: $('dialog'),
      journal: $('journal'), minigame: $('minigame'), netpanel: $('netpanel'),
      toasts: $('toasts'), fader: $('fader'), bars: $('cinematic-bars'), ctitle: $('center-title'),
      tip: $('interact-tip'), tipText: $('tip-text'), crosshair: $('crosshair'),
    };
  }
  loadProgress(p, text) { this.el.loadbar.style.width = (p * 100).toFixed(0) + '%'; if (text) this.el.loadtext.textContent = text; }
  show(name) { this.el[name]?.classList.remove('hidden'); }
  hide(name) { this.el[name]?.classList.add('hidden'); }
  toast(msg, warn = false) {
    const d = document.createElement('div');
    d.className = 'toast' + (warn ? ' warn' : '');
    d.textContent = msg;
    this.el.toasts.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .5s'; setTimeout(() => d.remove(), 500); }, 3200);
  }
  async fade(showBlack, ms = 600) {
    this.el.fader.style.transition = `opacity ${ms}ms`;
    this.el.fader.style.opacity = showBlack ? '1' : '0';
    await new Promise(r => setTimeout(r, ms));
  }
  centerTitle(text, ms = 2600) {
    this.el.ctitle.textContent = text;
    this.el.ctitle.classList.remove('hidden');
    clearTimeout(this._ctT);
    this._ctT = setTimeout(() => this.el.ctitle.classList.add('hidden'), ms);
  }
  cinema(on) {
    this.el.bars.classList.remove('hidden');
    this.el.bars.querySelector('.top').style.transform = on ? 'translateY(0)' : 'translateY(-100%)';
    this.el.bars.querySelector('.bot').style.transform = on ? 'translateY(0)' : 'translateY(100%)';
  }
  tip(text) {
    if (text) { this.el.tip.classList.remove('hidden'); this.el.tipText.textContent = text; }
    else this.el.tip.classList.add('hidden');
  }
  hud(gs, d) {
    $('clock-day').textContent = `第${gs.day}天 ${['周一','周二','周三','周四','周五','周六','周日'][(gs.day - 1) % 7]}`;
    $('clock-time').textContent = `${String(gs.hour).padStart(2, '0')}:${String(gs.minute).padStart(2, '0')}`;
    $('bar-hp').style.width = (gs.hp / d.maxHp * 100) + '%';
    $('bar-mp').style.width = (gs.mp / d.maxMp * 100) + '%';
    $('gold').textContent = gs.gold;
    $('house-points').textContent = gs.housePoints[gs.house];
  }
  // 对话人像：程序化画脸
  paintFace(cv, npc, mood = 'calm', talk = 0) {
    const cx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    cx.clearRect(0, 0, w, h);
    const tint = npc?.tint ?? 0xd8b45a;
    const col = '#' + tint.toString(16).padStart(6, '0');
    // 背景
    const grad = cx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
    grad.addColorStop(0, '#1c2136'); grad.addColorStop(1, '#0b0e18');
    cx.fillStyle = grad; cx.fillRect(0, 0, w, h);
    const ghost = npc?.ghost;
    cx.save();
    cx.translate(w / 2, h / 2 + 8);
    // 兜帽/头发
    cx.fillStyle = ghost ? 'rgba(190,205,255,.4)' : col;
    cx.beginPath(); cx.arc(0, -14, 46, Math.PI * 0.95, Math.PI * 2.05); cx.fill();
    // 脸
    cx.fillStyle = ghost ? 'rgba(220,230,255,.85)' : '#f0c9a0';
    cx.beginPath(); cx.arc(0, 0, 34, 0, Math.PI * 2); cx.fill();
    // 眉眼
    cx.strokeStyle = '#2a1e12'; cx.lineWidth = 3; cx.lineCap = 'round';
    const brow = { kind: [[-20, -14, -8, -16], [8, -16, 20, -14]], stern: [[-20, -18, -8, -12], [8, -12, 20, -18]], happy: [[-20, -15, -8, -18], [8, -18, 20, -15]], dreamy: [[-20, -16, -8, -16], [8, -16, 20, -16]], smug: [[-20, -13, -8, -17], [8, -19, 20, -12]], shy: [[-18, -13, -8, -15], [8, -15, 18, -13]], sad: [[-20, -12, -8, -16], [8, -16, 20, -12]], worry: [[-20, -12, -8, -17], [8, -17, 20, -12]] }[mood] || [[-20, -15, -8, -16], [8, -16, 20, -15]];
    for (const [x1, y1, x2, y2] of brow) { cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); }
    // 眼睛（眨眼）
    const blink = (Date.now() % 3400) < 120;
    cx.fillStyle = '#1b1610';
    if (blink) { cx.fillRect(-19, -5, 10, 2.5); cx.fillRect(9, -5, 10, 2.5); }
    else {
      cx.beginPath(); cx.arc(-14, -4, mood === 'shy' ? 3.4 : 4.2, 0, Math.PI * 2); cx.fill();
      cx.beginPath(); cx.arc(14, -4, mood === 'shy' ? 3.4 : 4.2, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(-12.5, -5.5, 1.3, 0, Math.PI * 2); cx.fill();
      cx.beginPath(); cx.arc(15.5, -5.5, 1.3, 0, Math.PI * 2); cx.fill();
    }
    // 腮红/胡子
    if (mood === 'shy' || mood === 'happy') { cx.fillStyle = 'rgba(255,120,120,.25)'; cx.beginPath(); cx.arc(-22, 8, 6, 0, Math.PI * 2); cx.arc(22, 8, 6, 0, Math.PI * 2); cx.fill(); }
    if (npc?.face?.beard) { cx.fillStyle = '#d8d2c8'; cx.beginPath(); cx.moveTo(-16, 12); cx.quadraticCurveTo(0, 52, 16, 12); cx.quadraticCurveTo(0, 26, -16, 12); cx.fill(); }
    // 嘴（说话动画）
    cx.strokeStyle = '#5a3324'; cx.lineWidth = 2.6;
    const open = talk > 0 ? (Math.sin(Date.now() * 0.02) * 0.5 + 0.5) * talk : 0;
    cx.beginPath();
    if (mood === 'sad' || mood === 'worry') cx.arc(0, 22, 8, Math.PI * 1.15, Math.PI * 1.85);
    else if (open > 0.15) { cx.ellipse(0, 17, 6, 3 + open * 5, 0, 0, Math.PI * 2); cx.fillStyle = '#5a3324'; cx.fill(); }
    else cx.arc(0, 12, 9, Math.PI * 0.18, Math.PI * 0.82);
    cx.stroke();
    cx.restore();
  }
  // 对话流程：seq = [{who, t, mood, choice:[{t, eff}]}]
  async playDialog(seq, resolveNpc, onEffect) {
    this.show('dialog');
    const faceCv = $('dlg-face');
    for (const node of seq) {
      const npc = node.who === 'you' ? null : resolveNpc(node.who);
      $('dlg-name').textContent = npc ? npc.name : '你';
      let faceTimer = null;
      const mood = node.mood || 'calm';
      if (npc) { faceTimer = setInterval(() => this.paintFace(faceCv, npc, mood, this._talking ? 1 : 0), 100); }
      else this.paintFace(faceCv, { tint: 0xd8b45a }, 'calm', 1);
      // 打字机
      const txt = $('dlg-text'); txt.textContent = '';
      $('dlg-choices').innerHTML = '';
      $('dlg-next').style.visibility = 'hidden';
      this._talking = true;
      await new Promise(res => {
        let i = 0;
        const T = setInterval(() => {
          txt.textContent = node.t.slice(0, ++i);
          if (i % 3 === 0) this.audio.sfx('write');
          if (i >= node.t.length) { clearInterval(T); res(); }
        }, 26);
        this._skipType = () => { clearInterval(T); txt.textContent = node.t; res(); };
      });
      this._talking = false;
      if (node.choice) {
        const sel = await new Promise(res => {
          for (const c of node.choice) {
            const b = document.createElement('button');
            b.textContent = c.t;
            b.onclick = () => { this.audio.sfx('ui'); res(c); };
            $('dlg-choices').appendChild(b);
          }
        });
        $('dlg-choices').innerHTML = '';
        if (sel.eff) onEffect?.(sel.eff);
        if (sel.t2) { $('dlg-text').textContent = sel.t2; await this._waitAdvance(); }
      } else {
        $('dlg-next').style.visibility = 'visible';
        await this._waitAdvance();
      }
      if (faceTimer) clearInterval(faceTimer);
    }
    this.hide('dialog');
  }
  _waitAdvance() {
    return new Promise(res => {
      const h = (e) => {
        if (e.type === 'keydown' && !['Space', 'Enter', 'KeyE'].includes(e.code)) return;
        removeEventListener('keydown', h); removeEventListener('mousedown', h);
        this.audio.sfx('page'); res();
      };
      addEventListener('keydown', h); addEventListener('mousedown', h);
      if (Q.has('autotest')) setTimeout(() => { removeEventListener('keydown', h); removeEventListener('mousedown', h); res(); }, 120);
    });
  }
}
