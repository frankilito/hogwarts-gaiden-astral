// ============ 世界：城堡区域建造 + 灯光天气 + 装饰生命 ============
import * as THREE from 'three';
import { HOUSES } from './data.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const ZONES = {}; // id -> Zone

// ---------- 程序化石材/木纹贴图 ----------
function canvasTex(draw, w = 256, h = 256, rep = 1) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const TEX = {};
function initTextures() {
  TEX.stone = canvasTex((c, w, h) => {
    c.fillStyle = '#8f8f9c'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const off = (y % 2) * 32;
      const g = 128 + Math.random() * 38;
      c.fillStyle = `rgb(${g},${g},${g + 10})`;
      c.fillRect(x * 64 + off + 2, y * 64 + 2, 60, 60);
      c.fillStyle = 'rgba(0,0,0,.22)';
      c.fillRect(x * 64 + off + 2, y * 64 + 58, 60, 4);
    }
  }, 256, 256, 3);
  TEX.wood = canvasTex((c, w, h) => {
    c.fillStyle = '#4a3220'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 20; i++) {
      c.strokeStyle = `rgba(${30 + Math.random() * 40},${18 + Math.random() * 24},8,.5)`;
      c.lineWidth = 2 + Math.random() * 5;
      c.beginPath(); c.moveTo(0, Math.random() * h);
      c.bezierCurveTo(w / 3, Math.random() * h, w * 2 / 3, Math.random() * h, w, Math.random() * h);
      c.stroke();
    }
  }, 256, 256, 2);
  TEX.parchment = canvasTex((c, w, h) => {
    c.fillStyle = '#e9dcbe'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(120,90,40,${Math.random() * .08})`; c.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  });
}

export const MAT = {};
function initMaterials() {
  MAT.stone = new THREE.MeshStandardMaterial({ map: TEX.stone, roughness: 0.95 });
  MAT.stoneDark = new THREE.MeshStandardMaterial({ map: TEX.stone, color: 0xb0b2c4, roughness: 0.95 });
  MAT.wood = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.8 });
  MAT.glass = new THREE.MeshPhysicalMaterial({ color: 0xbfd8e8, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide });
  MAT.gold = new THREE.MeshStandardMaterial({ color: 0xd8b45a, roughness: 0.3, metalness: 0.85 });
  MAT.iron = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.5, metalness: 0.8 });
}

// ---------- 区域 ----------
export class Zone {
  constructor(id, name, opts = {}) {
    this.id = id; this.name = name;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.bounds = opts.bounds || [-20, -20, 20, 20]; // 可行走矩形 x1,z1,x2,z2
    this.obstacles = [];   // {x,z,r} 圆形阻挡 或 {x1,z1,x2,z2}
    this.portals = [];     // {x,z,r,label,to,spot,cond}
    this.interacts = [];   // {x,z,r,label,action,id}
    this.spots = {};       // name -> V3 NPC/玩家锚点
    this.lights = [];
    this.updaters = [];    // fn(t, dt)
    this.fogColor = opts.fog ?? 0x0a0d18;
    this.fogDensity = opts.fogD ?? 0.012;
    this.indoor = opts.indoor !== false;
    this.floorY = 0;
    ZONES[id] = this;
  }
  add(o) { this.group.add(o); return o; }
  spot(name, x, y, z) { this.spots[name] = V3(x, y, z); }
  portal(x, z, label, to, spot = 'spawn', cond = null, r = 2.2) { this.portals.push({ x, z, r, label, to, spot, cond }); }
  interact(x, z, label, action, id = null, r = 2.0) { this.interacts.push({ x, z, r, label, action, id }); }
  block(x, z, r) { this.obstacles.push({ x, z, r }); }
  blockRect(x1, z1, x2, z2) { this.obstacles.push({ x1, z1, x2, z2 }); }
  update(fn) { this.updaters.push(fn); }
  clampMove(pos, r = 0.5) {
    const [x1, z1, x2, z2] = this.bounds;
    pos.x = Math.max(x1 + r, Math.min(x2 - r, pos.x));
    pos.z = Math.max(z1 + r, Math.min(z2 - r, pos.z));
    for (const o of this.obstacles) {
      if (o.r) {
        const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), m = o.r + r;
        if (d < m && d > 0.001) { pos.x = o.x + dx / d * m; pos.z = o.z + dz / d * m; }
      } else {
        if (pos.x > o.x1 - r && pos.x < o.x2 + r && pos.z > o.z1 - r && pos.z < o.z2 + r) {
          const dl = pos.x - (o.x1 - r), dr = (o.x2 + r) - pos.x, dt = pos.z - (o.z1 - r), db = (o.z2 + r) - pos.z;
          const mn = Math.min(dl, dr, dt, db);
          if (mn === dl) pos.x = o.x1 - r; else if (mn === dr) pos.x = o.x2 + r;
          else if (mn === dt) pos.z = o.z1 - r; else pos.z = o.z2 + r;
        }
      }
    }
  }
}

// ---------- 通用建造件 ----------
async function measure(lib, pack, name) {
  const o = await lib.prop(pack, name);
  const b = new THREE.Box3().setFromObject(o);
  return b.getSize(new THREE.Vector3());
}

export class Builder {
  constructor(lib) { this.lib = lib; this.wallSize = 4; }
  async init() {
    const s = await measure(this.lib, 'dungeon', 'wall');
    this.wallSize = Math.max(1, Math.round(s.x)); // 网格尺寸
    this.wallH = s.y;
  }
  async place(zone, pack, name, x, y, z, ry = 0, scale = 1, opts = {}) {
    const o = await this.lib.prop(pack, name, opts);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    if (scale !== 1) o.scale.setScalar(scale);
    zone.add(o);
    return o;
  }
  // 方形石室：w×d 格墙，带窗/门洞；stack 层数；ceiling: 'stone'|'none'
  async room(zone, gx, gz, w, d, { y = 0, windows = 'wall_archedwindow_open', plain = 'wall', doorSides = [], floorTile = 'floor_tile_large', winEvery = 2, corners = true, stack = 2, ceiling = 'stone' } = {}) {
    const S = this.wallSize;
    const x0 = gx - w * S / 2, z0 = gz - d * S / 2;
    // 地板
    const fl = new THREE.Mesh(new THREE.BoxGeometry(w * S, 0.3, d * S), MAT.stoneDark);
    fl.position.set(gx, y - 0.15, gz); fl.receiveShadow = true;
    zone.add(fl);
    // 墙
    const sides = [
      { dir: 'n', len: w, ox: x0 + S / 2, oz: z0, dx: S, dz: 0, ry: 0 },
      { dir: 's', len: w, ox: x0 + S / 2, oz: z0 + d * S, dx: S, dz: 0, ry: Math.PI },
      { dir: 'w', len: d, ox: x0, oz: z0 + S / 2, dx: 0, dz: S, ry: Math.PI / 2 },
      { dir: 'e', len: d, ox: x0 + w * S, oz: z0 + S / 2, dx: 0, dz: S, ry: -Math.PI / 2 },
    ];
    for (const s of sides) {
      for (let i = 0; i < s.len; i++) {
        const doorHere = doorSides.find(ds => ds.side === s.dir && (ds.at === i || ds.at === undefined && i === Math.floor(s.len / 2)));
        const name = doorHere ? 'wall_doorway' : (i % winEvery === 1 ? windows : plain);
        await this.place(zone, 'dungeon', name, s.ox + s.dx * i, y, s.oz + s.dz * i, s.ry);
        for (let lv = 1; lv < stack; lv++) {
          await this.place(zone, 'dungeon', i % 3 === 2 ? 'wall_cracked' : 'wall', s.ox + s.dx * i, y + this.wallH * lv, s.oz + s.dz * i, s.ry, 1, { shadow: false });
        }
      }
    }
    if (corners) {
      for (let lv = 0; lv < stack; lv++) {
        await this.place(zone, 'dungeon', 'wall_corner', x0, y + this.wallH * lv, z0, 0);
        await this.place(zone, 'dungeon', 'wall_corner', x0 + w * S, y + this.wallH * lv, z0, Math.PI / 2 * 3);
        await this.place(zone, 'dungeon', 'wall_corner', x0, y + this.wallH * lv, z0 + d * S, Math.PI / 2);
        await this.place(zone, 'dungeon', 'wall_corner', x0 + w * S, y + this.wallH * lv, z0 + d * S, Math.PI);
      }
    }
    const topY = y + this.wallH * stack;
    zone.ceilY = Math.min(zone.ceilY ?? Infinity, topY - 0.45);
    if (ceiling === 'stone') {
      const ce = new THREE.Mesh(new THREE.BoxGeometry(w * S + 0.6, 0.3, d * S + 0.6), MAT.stoneDark);
      ce.position.set(gx, topY + 0.15, gz);
      zone.add(ce);
    }
    return { x0, z0, S, topY, wallH: this.wallH };
  }
}

// ---------- 装饰生命：画像/漂浮书/蜡烛/尘埃/雾光 ----------
export function makePortrait(w = 1.4, h = 1.8, seed = 1) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 160;
  const cx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const rng = (() => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const skin = ['#f0c9a0', '#e8b98a', '#d9a878'][Math.floor(rng() * 3)];
  const robe = ['#7a2f2f', '#2f4b7a', '#2f7a44', '#7a682f', '#5c2f7a'][Math.floor(rng() * 5)];
  const hasHat = rng() > 0.4, beard = rng() > 0.6;
  const state = { ex: 0, ey: 0, tx: 0, ty: 0, blink: 0, nextBlink: 2 + rng() * 4 };
  function paint(t) {
    cx.fillStyle = '#1a1408'; cx.fillRect(0, 0, 128, 160);
    const g = cx.createRadialGradient(64, 70, 8, 64, 70, 90);
    g.addColorStop(0, '#3a3322'); g.addColorStop(1, '#14100a');
    cx.fillStyle = g; cx.fillRect(6, 6, 116, 148);
    cx.save(); cx.translate(64, 84);
    cx.fillStyle = robe; cx.beginPath(); cx.moveTo(-34, 70); cx.quadraticCurveTo(0, 26, 34, 70); cx.lineTo(34, 76); cx.lineTo(-34, 76); cx.fill();
    cx.fillStyle = skin; cx.beginPath(); cx.arc(0, -6, 24, 0, Math.PI * 2); cx.fill();
    if (hasHat) { cx.fillStyle = robe; cx.beginPath(); cx.moveTo(-26, -18); cx.lineTo(26, -18); cx.lineTo(4, -58); cx.fill(); }
    if (beard) { cx.fillStyle = '#cfc8bb'; cx.beginPath(); cx.moveTo(-12, 4); cx.quadraticCurveTo(0, 40, 12, 4); cx.fill(); }
    const bl = state.blink > 0;
    cx.fillStyle = '#221a10';
    if (bl) { cx.fillRect(-14, -9, 9, 2); cx.fillRect(5, -9, 9, 2); }
    else {
      cx.beginPath(); cx.arc(-9 + state.ex * 3, -8 + state.ey * 2, 3, 0, Math.PI * 2); cx.fill();
      cx.beginPath(); cx.arc(9 + state.ex * 3, -8 + state.ey * 2, 3, 0, Math.PI * 2); cx.fill();
    }
    cx.strokeStyle = '#4a3220'; cx.lineWidth = 2;
    cx.beginPath(); cx.arc(0, 6, 8, Math.PI * .2, Math.PI * .8); cx.stroke();
    cx.restore();
    tex.needsUpdate = true;
  }
  paint(0);
  const frame = new THREE.Group();
  const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.08), MAT.gold);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  pic.position.z = 0.05;
  frame.add(fr, pic);
  frame.userData.portrait = { state, paint, t: 0 };
  return frame;
}
export function updatePortrait(frame, dt, playerPos) {
  const P = frame.userData.portrait; if (!P) return;
  P.t += dt;
  const st = P.state;
  st.nextBlink -= dt;
  if (st.nextBlink <= 0) { st.blink = 0.13; st.nextBlink = 2 + Math.random() * 5; }
  if (st.blink > 0) st.blink -= dt;
  if (playerPos) {
    const local = frame.worldToLocal(playerPos.clone());
    st.tx = Math.max(-1, Math.min(1, local.x * 0.25));
    st.ty = Math.max(-1, Math.min(1, -local.y * 0.1));
  }
  st.ex += (st.tx - st.ex) * dt * 4; st.ey += (st.ty - st.ey) * dt * 4;
  if ((P.t * 10 | 0) % 2 === 0) P.paint(P.t);
}

export function floatingCandles(count, area, yBase = 6) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.05, 0.06, 0.5, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xf5eeda, roughness: 0.6 });
  const flameGeo = new THREE.SphereGeometry(0.07, 6, 6);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc866 });
  const items = [];
  for (let i = 0; i < count; i++) {
    const c = new THREE.Mesh(geo, mat);
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.y = 0.32;
    c.add(f);
    c.position.set(area[0] + Math.random() * (area[2] - area[0]), yBase + Math.random() * 2.5, area[1] + Math.random() * (area[3] - area[1]));
    c.userData = { ph: Math.random() * 9, spd: 0.5 + Math.random() };
    g.add(c); items.push(c);
  }
  g.userData.update = (t) => {
    for (const c of items) {
      c.position.y += Math.sin(t * c.userData.spd + c.userData.ph) * 0.0022;
      c.children[0].scale.setScalar(0.85 + Math.sin(t * 11 + c.userData.ph) * 0.22);
    }
  };
  return g;
}

export function floatingBooks(count, center, radius, yBase = 2.2) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.34, 0.06, 0.26);
  const cols = [0x8b3a3a, 0x3a5a8b, 0x3a8b52, 0x8b7a3a, 0x5c3a8b];
  const items = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.8 }));
    const a = Math.random() * Math.PI * 2, r = radius * (0.4 + Math.random() * 0.6);
    m.userData = { a, r, y: yBase + Math.random() * 2.2, spd: 0.12 + Math.random() * 0.2, ph: Math.random() * 9, flap: Math.random() > 0.5 };
    g.add(m); items.push(m);
  }
  g.position.copy(center);
  g.userData.update = (t) => {
    for (const m of items) {
      const u = m.userData;
      u.a += u.spd * 0.016;
      m.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.8 + u.ph) * 0.3, Math.sin(u.a) * u.r);
      m.rotation.y = -u.a + Math.PI / 2;
      m.rotation.z = u.flap ? Math.sin(t * 6 + u.ph) * 0.4 : 0.1;
    }
  };
  return g;
}

export function dustMotes(count, area, yRange = [0.4, 6]) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = area[0] + Math.random() * (area[2] - area[0]);
    pos[i * 3 + 1] = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
    pos[i * 3 + 2] = area[1] + Math.random() * (area[3] - area[1]);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffe9b0, size: 0.035, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.userData.update = (t) => { pts.rotation.y = t * 0.01; };
  return pts;
}

// 窗光光柱（体积光近似）
export function godRay(x, y, z, ry, len = 7, hue = 0xfff2cc) {
  const geo = new THREE.CylinderGeometry(0.5, 2.4, len, 8, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { c: { value: new THREE.Color(hue) }, op: { value: 0.16 }, t: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 c; uniform float op; uniform float t; varying vec2 vUv;
      void main(){ float a = op * (1.-vUv.y) * (0.75+0.25*sin(t*0.7+vUv.x*20.)); gl_FragColor = vec4(c, a*smoothstep(0.,.15,vUv.y)*smoothstep(1.,.6,vUv.y)); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.z = 0.5; m.rotation.y = ry;
  m.userData.update = (t) => { mat.uniforms.t.value = t; };
  m.userData.ray = mat;
  return m;
}

// ---------- 天光/天气 ----------
export class SkyRig {
  constructor(scene) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight(0x8899cc, 0x33241a, 0.5);
    this.ambient = new THREE.AmbientLight(0xffe0b8, 0.3);
    this.sun = new THREE.DirectionalLight(0xffe9c4, 1.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -30; this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30; this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.hemi, this.ambient, this.sun, this.sun.target);
    this.weather = 'clear'; // clear|rain
    this.rain = null;
    // 月亮与星空（户外夜晚）
    this.moon = new THREE.Group();
    const moonBall = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 16), new THREE.MeshBasicMaterial({ color: 0xf4f0e0 }));
    const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: (() => {
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
        const c = cv.getContext('2d');
        const g = c.createRadialGradient(64, 64, 8, 64, 64, 64);
        g.addColorStop(0, 'rgba(240,238,220,.9)'); g.addColorStop(0.4, 'rgba(190,200,240,.25)'); g.addColorStop(1, 'rgba(190,200,240,0)');
        c.fillStyle = g; c.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(cv);
      })(), transparent: true, depthWrite: false,
    }));
    moonGlow.scale.setScalar(14);
    this.moon.add(moonBall, moonGlow);
    scene.add(this.moon);
    const starGeo = new THREE.BufferGeometry();
    const N = 500, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 0.5;
      const r = 130;
      sp[i * 3] = Math.cos(a) * Math.cos(b) * r;
      sp[i * 3 + 1] = Math.sin(b) * r * 0.7 + 6;
      sp[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 0.5, transparent: true, opacity: 0, sizeAttenuation: true, depthWrite: false }));
    scene.add(this.stars);
  }
  // hour: 0-24, zone indoor 与否影响强度
  apply(hour, zone, focus) {
    const day = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI)); // 6~18 白天
    const dusk = Math.max(0, 1 - Math.abs(hour - 18.5) / 2.2) + Math.max(0, 1 - Math.abs(hour - 5.5) / 2.2);
    const night = 1 - Math.min(1, day * 1.4 + dusk);
    const rainDim = this.weather === 'rain' ? 0.6 : 1;
    const indoor = zone?.indoor;
    const sunCol = new THREE.Color().setHSL(0.09 + 0.03 * day, 0.6, 0.5 + day * 0.25).lerp(new THREE.Color(0xff8a4a), dusk * 0.7);
    const moonCol = new THREE.Color(0x8fa8e8);
    this.sun.color.copy(sunCol).lerp(moonCol, night);
    this.sun.intensity = (0.3 + day * 1.3) * rainDim * (indoor ? 0.8 : 1) + night * 0.42;
    const ang = ((hour - 6) / 24) * Math.PI * 2;
    this.sun.position.set(Math.cos(ang) * 40, Math.max(8, Math.sin(ang) * 40 + 10), 22);
    if (focus) { this.sun.target.position.copy(focus); this.sun.position.add(focus); }
    this.hemi.intensity = (0.5 + day * 0.5) * rainDim + night * 0.18;
    this.hemi.color.setHSL(0.6, 0.4, 0.55 + day * 0.15);
    // 室内暖色填充：烛火学院永不漆黑
    if (indoor) {
      this.ambient.color.set(0xffd9a8);
      this.ambient.intensity = 0.42 + night * 0.3;
    } else {
      this.ambient.color.set(0x9db0d8);
      this.ambient.intensity = 0.12 + day * 0.16 + night * 0.1;
    }
    const bg = new THREE.Color().setHSL(0.62, 0.5, 0.045 + day * 0.34 * rainDim).lerp(new THREE.Color(0xffb27a), dusk * 0.4);
    this.scene.background = bg;
    if (this.scene.fog) this.scene.fog.color.copy(bg.clone().lerp(new THREE.Color(zone?.fogColor ?? 0x0a0d18), indoor ? 0.85 : 0.4));
    // 月亮星空
    const showNightSky = !indoor && night > 0.25;
    this.moon.visible = showNightSky;
    this.stars.visible = !indoor;
    this.stars.material.opacity = Math.max(0, night - 0.15) * 0.95;
    if (showNightSky) {
      const mang = ang + Math.PI;
      this.moon.position.set(Math.cos(mang) * 90 + (focus?.x || 0), Math.max(14, Math.sin(mang) * 60 + 20), -70 + (focus?.z || 0));
    }
    if (focus) this.stars.position.set(focus.x, 0, focus.z);
    return { day, night, dusk };
  }
  setWeather(w, zone) {
    this.weather = w;
    if (w === 'rain' && !this.rain) {
      const N = 2200;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 80; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 80; }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbdd4ee, size: 0.12, transparent: true, opacity: 0.75 }));
      this.rain.frustumCulled = false;
      this.scene.add(this.rain);
    }
    if (this.rain) this.rain.visible = (w === 'rain') && !(zone?.indoor);
  }
  updateRain(dt, center) {
    if (!this.rain || !this.rain.visible) return;
    const p = this.rain.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - dt * 26;
      if (y < 0) y = 28;
      p.setY(i, y);
    }
    if (center) this.rain.position.set(center.x, 0, center.z);
    p.needsUpdate = true;
  }
}

// 烛光管理：限制实时点光数量，就近激活
export class CandleRig {
  constructor(scene, max = 8) {
    this.scene = scene;
    this.spots = []; // {pos, zone}
    this.lights = [];
    for (let i = 0; i < max; i++) {
      const l = new THREE.PointLight(0xffb066, 0, 13, 1.8);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
  }
  addSpot(zoneId, x, y, z, power = 2.2) { this.spots.push({ zoneId, pos: V3(x, y, z), power }); }
  update(t, zoneId, playerPos, nightBoost = 1) {
    const near = this.spots.filter(s => s.zoneId === zoneId)
      .map(s => ({ s, d: s.pos.distanceToSquared(playerPos) }))
      .sort((a, b) => a.d - b.d).slice(0, this.lights.length);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      if (near[i]) {
        l.position.copy(near[i].s.pos);
        l.intensity = near[i].s.power * nightBoost * (0.85 + Math.sin(t * 9 + i * 1.7) * 0.18 + Math.sin(t * 23 + i) * 0.07);
      } else l.intensity = 0;
    }
  }
}

export { initTextures, initMaterials, V3 };
