// ============ 角色：动画控制/披风布料/表情气泡/玩家/NPC ============
import * as THREE from 'three';
import { HOUSES, NPCS, SPELLS } from './data.js';
import { npcZoneNow, phaseOf, classNow } from './logic.js';
import { ZONES } from './world.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- 披风布料（verlet） ----------
class Cape {
  constructor(colorHex, w = 0.62, h = 0.95, nx = 5, ny = 7) {
    this.nx = nx; this.ny = ny;
    this.geo = new THREE.PlaneGeometry(w, h, nx - 1, ny - 1);
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.85, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    const N = nx * ny;
    this.pos = new Array(N); this.prev = new Array(N);
    for (let i = 0; i < N; i++) { this.pos[i] = new THREE.Vector3(); this.prev[i] = new THREE.Vector3(); }
    this.inited = false;
    this.tmp = new THREE.Vector3();
  }
  // anchorL/R: 世界坐标肩部锚点
  step(dt, anchorL, anchorR, wind = 0) {
    const { nx, ny, pos, prev } = this;
    // 顶行固定
    for (let x = 0; x < nx; x++) {
      const t = x / (nx - 1);
      const p = this.tmp.copy(anchorL).lerp(anchorR, t);
      if (!this.inited) { for (let y = 0; y < ny; y++) { pos[y * nx + x].copy(p).y -= y * 0.12; prev[y * nx + x].copy(pos[y * nx + x]); } }
      pos[x].copy(p);
      prev[x].copy(p);
    }
    this.inited = true;
    const damp = 0.985, grav = -3.6 * dt * dt;
    for (let y = 1; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = y * nx + x, p = pos[i], pv = prev[i];
      const vx = (p.x - pv.x) * damp, vy = (p.y - pv.y) * damp, vz = (p.z - pv.z) * damp;
      pv.copy(p);
      p.x += vx + Math.sin(performance.now() * 0.001 * 1.7 + y) * wind * dt;
      p.y += vy + grav;
      p.z += vz + wind * dt * 0.4;
    }
    // 约束（2 轮）
    const restY = 0.132, restX = 0.62 / (nx - 1);
    for (let iter = 0; iter < 2; iter++) {
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const i = y * nx + x;
        if (x < nx - 1) this._solve(pos[i], pos[i + 1], restX, y === 0);
        if (y < ny - 1) this._solve(pos[i], pos[i + nx], restY, y === 0);
      }
    }
    const arr = this.geo.attributes.position.array;
    // 写回 local（mesh 无变换，直接世界坐标写入）
    for (let i = 0; i < pos.length; i++) { arr[i * 3] = pos[i].x; arr[i * 3 + 1] = pos[i].y; arr[i * 3 + 2] = pos[i].z; }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
  _solve(a, b, rest, pinA) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-5;
    const diff = (d - rest) / d * 0.5;
    if (!pinA) { a.x += dx * diff; a.y += dy * diff; a.z += dz * diff; }
    b.x -= dx * diff; b.y -= dy * diff; b.z -= dz * diff;
  }
}

// ---------- 表情气泡 ----------
function makeEmote() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.setScalar(0.55);
  sp.visible = false;
  sp.userData = { cv, tex, until: 0 };
  return sp;
}
function showEmote(sp, icon, dur = 2) {
  const { cv, tex } = sp.userData;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, 64, 64);
  c.beginPath(); c.arc(32, 32, 26, 0, Math.PI * 2);
  c.fillStyle = 'rgba(12,14,24,.88)'; c.fill();
  c.strokeStyle = '#d8b45a'; c.lineWidth = 2.5; c.stroke();
  c.font = '30px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(icon, 32, 34);
  tex.needsUpdate = true;
  sp.visible = true;
  sp.userData.until = performance.now() / 1000 + dur;
}

// ---------- Actor ----------
export class Actor {
  constructor() {
    this.root = new THREE.Group();
    this.model = null; this.mixer = null;
    this.actions = {}; this.current = null;
    this.speed = 0; this.targetY = 0;
    this.cape = null; this.hairBones = [];
    this.emote = makeEmote();
    this.emote.position.y = 2.15;
    this.root.add(this.emote);
    this.wand = null; this.book = null;
    this.ghost = false;
    this.dead = false;
  }
  async load(lib, modelName, { tint, capeColor, ghost, scale = 1 } = {}) {
    const { obj, anims } = await lib.charInstance(modelName);
    this.model = obj;
    obj.scale.setScalar(scale);
    if (tint) lib.tintChar(obj, tint);
    this.root.add(obj);
    this.mixer = new THREE.AnimationMixer(obj);
    for (const clip of anims) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.play('Idle');
    // 骨骼引用（KayKit 命名：.l/.r 后缀，handslot 挂点）
    this.builtin = {};
    obj.traverse(o => {
      const n = (o.name || '').toLowerCase();
      if (o.isBone) {
        // GLTFLoader 会剥掉命名里的点号：upperarm.l → upperarml
        const side = n.endsWith('l') ? 'l' : (n.endsWith('r') ? 'r' : '');
        if (n.startsWith('handslot')) { if (side === 'r') this.handR = o; else if (side === 'l') this.handL = o; }
        else if (n.startsWith('hand') && side === 'r' && !this.handR) this.handR = o;
        else if (n.startsWith('hand') && side === 'l' && !this.handL) this.handL = o;
        if (n === 'head') this.head = o;
        if (n.startsWith('upperarm') || n.startsWith('shoulder')) { if (side === 'l') this.shL = this.shL || o; else if (side === 'r') this.shR = this.shR || o; }
        if (!this.torso && (n === 'chest' || n === 'spine' || n === 'torso')) this.torso = o;
      } else if (/^(1h_|2h_|spellbook|crossbow|shield|sword|axe|dagger|arrow|quiver|smokebomb|mug|blade|staff)/.test(n) || n.endsWith('_cape')) {
        // 内置手持道具默认隐藏，按需开启
        o.visible = false;
        if (n === 'spellbook_open') this.builtin.book = o;
        if (n === '1h_wand') this.builtin.wand = o;
      }
    });
    if (ghost) this.makeGhost();
    // 头发动态：发尾弹簧摆（挂头骨，惯性滞后）
    if (!ghost && this.head) {
      const hairCol = [0x3a2a1a, 0x5a3a20, 0x1e1a16, 0x6a5535, 0x8a3a2a][Math.abs((tint || 0) % 5)];
      const geo = new THREE.ConeGeometry(0.075, 0.46, 6);
      geo.translate(0, -0.2, 0);
      this.hairTail = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: hairCol, roughness: 0.85 }));
      this.hairTail.position.set(0, 0.14, -0.16);
      this.hairTail.castShadow = false;
      this.head.add(this.hairTail);
      this._hairPrev = new THREE.Vector3();
      this._hairSw = { x: 0, z: 0, vx: 0, vz: 0 };
    }
    if (capeColor != null) {
      this.cape = new Cape(capeColor);
      // 披风加到场景根（世界坐标模拟），由外部 add
    }
    return this;
  }
  makeGhost() {
    this.ghost = true;
    this.model.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.42;
        o.material.emissive = new THREE.Color(0x8fa8e8);
        o.material.emissiveIntensity = 0.5;
        o.castShadow = false;
      }
    });
  }
  attachWand(lib) {
    return lib.prop('items', 'wand.gltf', { shadow: false }).then(w => {
      w.scale.setScalar(1.2);
      this.wand = w;
      (this.handR || this.model).add(w);
      w.position.set(0, 0.02, 0.02);
      w.visible = true;
    });
  }
  attachBook(lib) {
    return lib.prop('items', 'spellbook_open.gltf', { shadow: false }).then(b => {
      this.book = b;
      (this.handL || this.model).add(b);
      b.position.set(0, 0.05, 0);
      b.visible = false;
    });
  }
  play(name, { fade = 0.22, once = false, timeScale = 1 } = {}) {
    const a = this.actions[name];
    if (!a || this.current === name && !once) return;
    const prev = this.actions[this.current];
    a.reset();
    a.timeScale = timeScale;
    if (once) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    else a.setLoop(THREE.LoopRepeat);
    if (prev && prev !== a) { a.crossFadeFrom(prev, fade, false); }
    a.play();
    this.current = name;
    if (once) {
      const dur = a.getClip().duration / Math.abs(timeScale);
      clearTimeout(this._onceT);
      this._onceT = setTimeout(() => { if (this.current === name && !this.dead) this.play(this.base || 'Idle'); }, dur * 1000 - 120);
    }
  }
  setBase(name) { this.base = name; if (!this._onceT || this.current === this.base) this.play(name); }
  update(dt, t) {
    this.mixer?.update(dt);
    if (this.emote.visible && t > this.emote.userData.until) this.emote.visible = false;
    if (this.ghost && this.model) {
      this.model.position.y = 0.35 + Math.sin(t * 1.6 + this.root.position.x) * 0.12;
    }
    // 发尾弹簧
    if (this.hairTail && this.head) {
      const hp = new THREE.Vector3();
      this.head.getWorldPosition(hp);
      const vel = hp.clone().sub(this._hairPrev).divideScalar(Math.max(dt, 0.001));
      this._hairPrev.copy(hp);
      const local = vel.applyQuaternion(this.root.quaternion.clone().invert());
      const S = this._hairSw, k = 26, damp = 7;
      S.vx += (-local.z * 0.16 - S.x * k - S.vx * damp) * dt;
      S.vz += (local.x * 0.16 - S.z * k - S.vz * damp) * dt;
      S.x = Math.max(-0.9, Math.min(0.9, S.x + S.vx * dt));
      S.z = Math.max(-0.9, Math.min(0.9, S.z + S.vz * dt));
      this.hairTail.rotation.x = -0.5 + S.x + Math.sin(t * 1.8 + this.root.position.x) * 0.05;
      this.hairTail.rotation.z = S.z;
    }
    // 披风锚点
    if (this.cape && this.shL && this.shR) {
      const aL = new THREE.Vector3(), aR = new THREE.Vector3();
      this.shL.getWorldPosition(aL); this.shR.getWorldPosition(aR);
      // 后移出体表
      const back = new THREE.Vector3(0, 0, -0.34).applyQuaternion(this.root.quaternion);
      aL.add(back); aR.add(back);
      aL.y += 0.12; aR.y += 0.12;
      this.cape.step(Math.min(dt, 0.033), aL, aR, this.speed * 0.5 + 0.4);
    }
  }
  emoteIcon(icon, dur) { showEmote(this.emote, icon, dur); }
  lookAt(x, z) {
    const dx = x - this.root.position.x, dz = z - this.root.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.001) this.targetRotY = Math.atan2(dx, dz);
  }
  faceUpdate(dt) {
    if (this.targetRotY == null) return;
    let d = this.targetRotY - this.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.root.rotation.y += d * Math.min(1, dt * 10);
  }
}

// ---------- 玩家 ----------
export class Player {
  constructor(game) {
    this.g = game;
    this.actor = new Actor();
    this.pos = new THREE.Vector3(0, 0, 8);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.camYaw = 0; this.camPitch = 0.3; this.camDist = 6.6;
    this.moving = false; this.running = false;
    this.dodgeT = 0; this.castLock = 0;
    this.sitting = null;
    this.aimMode = false;
  }
  async init(lib, gs) {
    const house = HOUSES[gs.house];
    await this.actor.load(lib, gs.model, { capeColor: house.color });
    await this.actor.attachWand(lib);
    await this.actor.attachBook(lib);
    this.g.engine.scene.add(this.actor.root);
    if (this.actor.cape) this.g.engine.scene.add(this.actor.cape.mesh);
  }
  teleport(x, z, yaw = null) {
    this.pos.set(x, 0, z);
    if (yaw != null) this.yaw = yaw;
    this.actor.root.position.copy(this.pos);
    if (this.actor.cape) this.actor.cape.inited = false;
  }
  update(dt, t, input, zone) {
    const A = this.actor;
    if (this.sitting) {
      A.root.position.copy(this.pos);
      this._cam(dt, input);
      A.update(dt, t);
      return;
    }
    // 相机相对移动
    let mx = 0, mz = 0;
    if (input.enabled) {
      if (input.down('KeyW')) mz -= 1;
      if (input.down('KeyS')) mz += 1;
      if (input.down('KeyA')) mx -= 1;
      if (input.down('KeyD')) mx += 1;
    }
    const want = (mx || mz) && this.dodgeT <= 0;
    this.running = want && input.down('ShiftLeft');
    const d = this.g.derived;
    let spd = (this.running ? 6.4 : 3.4) * (d?.speedMul || 1);
    if (this.g.gs && phaseOf(this.g.gs.hour).id === 'night' && this.g.talentMod?.nightspeed) spd *= this.g.talentMod.nightspeed;
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      spd = 9.5 * (d?.dodgeMul || 1);
      const dir = this.dodgeDir;
      this.pos.x += dir.x * spd * dt; this.pos.z += dir.z * spd * dt;
    } else if (want) {
      const ang = this.camYaw + Math.atan2(mx, mz);
      this.pos.x += Math.sin(ang) * spd * dt;
      this.pos.z += Math.cos(ang) * spd * dt;
      A.lookAt(this.pos.x + Math.sin(ang), this.pos.z + Math.cos(ang));
      A.speed = spd;
      A.setBase(this.running ? 'Running_A' : 'Walking_A');
    } else {
      A.speed = 0;
      A.setBase('Idle');
    }
    zone?.clampMove(this.pos, 0.45);
    A.root.position.copy(this.pos);
    A.faceUpdate(dt);
    this._cam(dt, input);
    A.update(dt, t);
  }
  dodge(input) {
    if (this.dodgeT > 0 || this.sitting) return false;
    let mx = 0, mz = 0;
    if (input.down('KeyW')) mz -= 1;
    if (input.down('KeyS')) mz += 1;
    if (input.down('KeyA')) mx -= 1;
    if (input.down('KeyD')) mx += 1;
    const ang = this.camYaw + (mx || mz ? Math.atan2(mx, mz) : Math.PI);
    this.dodgeDir = { x: Math.sin(ang), z: Math.cos(ang) };
    this.dodgeT = 0.42;
    this.actor.play(mz > 0 ? 'Dodge_Backward' : 'Dodge_Forward', { once: true, fade: 0.08 });
    return true;
  }
  sit(spotPos, anim = 'Sit_Chair_Idle') {
    this.sitting = { pos: spotPos };
    this.pos.copy(spotPos);
    this.actor.setBase(anim);
    this.actor.play('Sit_Chair_Down', { once: true });
    setTimeout(() => this.actor.play(anim), 700);
  }
  standUp() {
    if (!this.sitting) return;
    this.actor.play('Sit_Chair_StandUp', { once: true });
    this.sitting = null;
    this.actor.setBase('Idle');
  }
  readBook(on) {
    const b = this.actor.builtin?.book || this.actor.book;
    if (b) b.visible = on;
  }
  castAnim(kind = 'shoot') {
    const m = { shoot: 'Spellcast_Shoot', raise: 'Spellcast_Raise', long: 'Spellcast_Long', channel: 'Spellcasting' };
    this.actor.play(m[kind] || 'Spellcast_Shoot', { once: kind !== 'channel', fade: 0.08, timeScale: 1.4 });
  }
  _cam(dt, input) {
    const { dx, dy } = input.consumeMouse();
    if (input.locked || input.mouse.rdown) {
      this.camYaw -= dx * 0.0026;
      this.camPitch = Math.max(-0.2, Math.min(1.1, this.camPitch + dy * 0.002));
    }
    const cam = this.g.engine.camera;
    const target = V3(this.pos.x, this.pos.y + 1.55, this.pos.z);
    const off = new THREE.Vector3(
      Math.sin(this.camYaw + Math.PI) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw + Math.PI) * Math.cos(this.camPitch),
    ).multiplyScalar(this.aimMode ? 2.6 : (this.g.zone?.camDist || this.camDist));
    const goal = target.clone().add(off);
    // 相机不出房间、不穿天花板：沿视线向角色滑入直到合法
    const z = this.g.zone;
    if (z) {
      const [x1, z1, x2, z2] = z.bounds;
      const inside = (p) => p.x > x1 + 0.35 && p.x < x2 - 0.35 && p.z > z1 + 0.35 && p.z < z2 - 0.35 && p.y > 0.5 && (!z.ceilY || p.y < z.ceilY);
      if (!inside(goal)) {
        const seg = goal.clone().sub(target);
        for (let t = 0.94; t >= 0.22; t -= 0.06) {
          const p = target.clone().addScaledVector(seg, t);
          if (inside(p)) { goal.copy(p); break; }
          if (t <= 0.25) goal.copy(target.clone().addScaledVector(seg, 0.25));
        }
      }
    }
    cam.position.lerp(goal, Math.min(1, dt * 9));
    const look = this.aimMode ? target.clone().add(new THREE.Vector3(Math.sin(this.camYaw), 0.1 + (0.5 - this.camPitch) * 0.5, Math.cos(this.camYaw)).multiplyScalar(6)) : target;
    cam.lookAt(look);
  }
  aimDir() {
    return new THREE.Vector3(Math.sin(this.camYaw), Math.max(-0.5, 0.35 - this.camPitch), Math.cos(this.camYaw)).normalize();
  }
}

// ---------- NPC 管理 ----------
export class NPCManager {
  constructor(game) {
    this.g = game;
    this.actors = new Map(); // id -> {actor, npc, spot, act, wanderT}
  }
  async spawnForZone(zoneId) {
    const gs = this.g.gs;
    // 清场
    for (const [id, rec] of this.actors) {
      this.g.engine.scene.remove(rec.actor.root);
      if (rec.actor.cape) this.g.engine.scene.remove(rec.actor.cape.mesh);
    }
    this.actors.clear();
    const zone = ZONES[zoneId];
    if (!zone) return;
    const here = NPCS.filter(n => npcZoneNow(gs, n) === zoneId);
    // 同伴永远跟随（若设置）
    let spotIdx = 1;
    for (const npc of here) {
      if (gs.companion === npc.id) continue;
      const rec = await this._spawn(npc, zone, spotIdx++);
    }
  }
  async _spawn(npc, zone, spotIdx) {
    const actor = new Actor();
    const house = npc.house ? HOUSES[npc.house] : null;
    await actor.load(this.g.lib, npc.model, {
      tint: npc.tint, ghost: npc.ghost,
      capeColor: npc.ghost ? null : (house ? house.color : null),
    });
    if (!npc.ghost && (npc.role.includes('教师') || npc.role === '校长')) await actor.attachWand(this.g.lib);
    // 位置
    const ph = phaseOf(this.g.gs.hour).id;
    const isClassTime = ['morning', 'afternoon'].includes(ph);
    let spotName = 'idle' + (1 + (spotIdx % 4));
    if (npc.ghost && zone.spots.ghost) spotName = 'ghost';
    else if ((npc.role.includes('教师') || npc.role === '校长') && zone.spots.teach && isClassTime) spotName = 'teach';
    else if (npc.sched?.[ph] === 'hall' && zone.id === 'hall' && zone.spots['seat' + (1 + spotIdx % 4)]) spotName = 'seat' + (1 + spotIdx % 4);
    const sp = zone.spots[spotName] || zone.spots.idle1 || zone.spots.spawn || V3(0, 0, 0);
    actor.root.position.set(sp.x + (Math.random() - 0.5), 0, sp.z + (Math.random() - 0.5));
    const sitting = spotName.startsWith('seat');
    if (sitting) actor.setBase('Sit_Chair_Idle');
    this.g.engine.scene.add(actor.root);
    if (actor.cape) this.g.engine.scene.add(actor.cape.mesh);
    const rec = { actor, npc, zone, act: sitting ? 'sit' : 'idle', wanderT: 2 + Math.random() * 6, home: sp.clone() };
    this.actors.set(npc.id, rec);
    return rec;
  }
  update(dt, t, playerPos) {
    for (const rec of this.actors.values()) {
      const { actor, npc, zone } = rec;
      actor.update(dt, t);
      actor.faceUpdate(dt);
      if (rec.act === 'sit') continue;
      // 简单游走/教学行为
      rec.wanderT -= dt;
      if (rec.act === 'idle' && rec.wanderT <= 0) {
        const r = Math.random();
        if ((npc.role.includes('教师') || npc.role === '校长') && r < 0.4) {
          actor.play('Spellcast_Raise', { once: true });
          rec.wanderT = 4 + Math.random() * 5;
        } else if (r < 0.55) {
          actor.play(['Interact', 'Use_Item', 'Cheer'][Math.floor(Math.random() * 3)], { once: true });
          rec.wanderT = 4 + Math.random() * 5;
        } else {
          // 走向新目标
          const keys = Object.keys(zone.spots).filter(k => k.startsWith('idle'));
          const sp = zone.spots[keys[Math.floor(Math.random() * keys.length)]] || rec.home;
          rec.target = V3(sp.x + (Math.random() - 0.5) * 2, 0, sp.z + (Math.random() - 0.5) * 2);
          rec.act = 'walk';
        }
      } else if (rec.act === 'walk' && rec.target) {
        const p = actor.root.position;
        const dx = rec.target.x - p.x, dz = rec.target.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.3) { rec.act = 'idle'; rec.wanderT = 3 + Math.random() * 6; actor.setBase(npc.ghost ? 'Idle' : 'Idle'); actor.speed = 0; }
        else {
          const spd = npc.ghost ? 1.0 : 1.6;
          p.x += dx / dist * spd * dt; p.z += dz / dist * spd * dt;
          zone.clampMove(p, 0.4);
          actor.lookAt(rec.target.x, rec.target.z);
          actor.setBase('Walking_A');
          actor.speed = spd;
        }
      }
      // 玩家靠近: 看向玩家
      if (playerPos && rec.act !== 'walk') {
        const d2 = actor.root.position.distanceToSquared(playerPos);
        if (d2 < 14) actor.lookAt(playerPos.x, playerPos.z);
      }
    }
  }
  near(playerPos, maxD = 2.6) {
    let best = null, bd = maxD * maxD;
    for (const rec of this.actors.values()) {
      const d2 = rec.actor.root.position.distanceToSquared(playerPos);
      if (d2 < bd) { bd = d2; best = rec; }
    }
    return best;
  }
  get(id) { return this.actors.get(id); }
}

// ---------- 同伴 ----------
export class Companion {
  constructor(game) { this.g = game; this.rec = null; }
  async set(npcId) {
    this.clear();
    if (!npcId) return;
    const npc = NPCS.find(n => n.id === npcId);
    const actor = new Actor();
    const house = npc.house ? HOUSES[npc.house] : null;
    await actor.load(this.g.lib, npc.model, { tint: npc.tint, capeColor: house?.color });
    await actor.attachWand(this.g.lib);
    this.g.engine.scene.add(actor.root);
    if (actor.cape) this.g.engine.scene.add(actor.cape.mesh);
    actor.root.position.copy(this.g.player.pos).add(V3(1, 0, 1));
    this.rec = { actor, npc, cd: 0 };
  }
  clear() {
    if (this.rec) {
      this.g.engine.scene.remove(this.rec.actor.root);
      if (this.rec.actor.cape) this.g.engine.scene.remove(this.rec.actor.cape.mesh);
      this.rec = null;
    }
  }
  update(dt, t, zone) {
    if (!this.rec) return;
    const { actor } = this.rec;
    const pp = this.g.player.pos;
    const p = actor.root.position;
    const dx = pp.x - p.x, dz = pp.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 2.2) {
      const spd = dist > 6 ? 5.6 : 2.6;
      p.x += dx / dist * spd * dt;
      p.z += dz / dist * spd * dt;
      zone?.clampMove(p, 0.4);
      actor.lookAt(pp.x, pp.z);
      actor.setBase(spd > 3 ? 'Running_A' : 'Walking_A');
      actor.speed = spd;
    } else {
      actor.setBase('Idle');
      actor.speed = 0;
      if (Math.random() < dt * 0.1) actor.lookAt(pp.x, pp.z);
    }
    this.rec.cd -= dt;
    actor.update(dt, t);
    actor.faceUpdate(dt);
  }
  // 战斗协助：向目标射一发
  assist(target, fx) {
    if (!this.rec || this.rec.cd > 0 || !target) return null;
    this.rec.cd = 2.2;
    this.rec.actor.play('Spellcast_Shoot', { once: true, timeScale: 1.3 });
    return { from: this.rec.actor.root.position.clone().add(V3(0, 1.4, 0)) };
  }
}
