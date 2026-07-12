// ============ 具体区域建造：大厅/楼梯厅/图书馆/魔药/休息室/温室/天文塔/庭院/禁林/密室 ============
import * as THREE from 'three';
import { Zone, MAT, TEX, V3, makePortrait, floatingCandles, floatingBooks, dustMotes, godRay } from './world.js';
import { HOUSES, FURNITURE } from './data.js';

const PI = Math.PI;

// ---------- 特色构件 ----------
export function makeCauldron() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, PI * 2, PI * 0.15, PI * 0.7), new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.4, metalness: 0.8, side: THREE.DoubleSide }));
  pot.position.y = 0.55; pot.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 18), pot.material);
  rim.rotation.x = PI / 2; rim.position.y = 0.88;
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.4, 18), new THREE.MeshBasicMaterial({ color: 0x54e0a0 }));
  liquid.rotation.x = -PI / 2; liquid.position.y = 0.82;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.3, 6, 1, true), pot.material);
  legs.position.y = 0.15;
  g.add(pot, rim, liquid, legs);
  g.userData.liquid = liquid;
  g.userData.update = (t) => {
    liquid.material.color.setHSL(0.38 + Math.sin(t * 0.5) * 0.08, 0.75, 0.5 + Math.sin(t * 3) * 0.08);
    liquid.position.y = 0.82 + Math.sin(t * 2.2) * 0.012;
  };
  return g;
}
export function makeTelescope() {
  const g = new THREE.Group();
  const legGeo = new THREE.CylinderGeometry(0.03, 0.04, 1.4, 6);
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(legGeo, MAT.wood);
    l.position.set(Math.cos(i * PI * 2 / 3) * 0.35, 0.7, Math.sin(i * PI * 2 / 3) * 0.35);
    l.rotation.z = Math.cos(i * PI * 2 / 3) * 0.35;
    l.rotation.x = -Math.sin(i * PI * 2 / 3) * 0.35;
    g.add(l);
  }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.3, 12), MAT.gold);
  tube.position.y = 1.5; tube.rotation.x = -PI / 3.2;
  tube.castShadow = true;
  g.add(tube);
  return g;
}
export function makeOrrery() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.25, 10), MAT.gold);
  base.position.y = 0.12; base.castShadow = true;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), MAT.gold);
  pole.position.y = 0.8;
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  sun.position.y = 1.4;
  g.add(base, pole, sun);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Group();
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.35 + i * 0.22, 0.012, 6, 40), MAT.gold);
    orbit.rotation.x = PI / 2;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(0.045 + i * 0.015, 8, 6), new THREE.MeshStandardMaterial({ color: [0x8ecbff, 0xd88a5a, 0xa78bfa][i], emissive: [0x224466, 0x442211, 0x332255][i] }));
    planet.position.x = 0.35 + i * 0.22;
    ring.add(orbit, planet);
    ring.position.y = 1.4;
    ring.rotation.x = (Math.random() - 0.5) * 0.3;
    ring.userData.spd = 0.5 - i * 0.13;
    g.add(ring); rings.push(ring);
  }
  g.userData.update = (t) => { for (const r of rings) r.rotation.y = t * r.userData.spd; };
  return g;
}
export function makeFireplace() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.8), MAT.stone);
  body.position.y = 1.2; body.castShadow = true;
  const hole = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 0.85), new THREE.MeshBasicMaterial({ color: 0x0c0805 }));
  hole.position.set(0, 0.65, 0.01);
  const mantel = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 1), MAT.wood);
  mantel.position.y = 2.5;
  g.add(body, hole, mantel);
  // 火焰粒子
  const N = 40;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const fire = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xff9040, size: 0.16, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  fire.position.set(0, 0.25, 0.25);
  const seeds = Array.from({ length: N }, () => ({ x: (Math.random() - .5) * 1.1, y: Math.random(), z: (Math.random() - .5) * .3, s: .5 + Math.random() }));
  fire.userData.update = (t) => {
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const y = ((t * s.s * 0.5 + s.y) % 1);
      pos[i * 3] = s.x * (1 - y * 0.6); pos[i * 3 + 1] = y * 1.2; pos[i * 3 + 2] = s.z;
    }
    geo.attributes.position.needsUpdate = true;
  };
  g.add(fire);
  g.userData.update = fire.userData.update;
  return g;
}
export function makeMoonflower() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0x2a5a3a }));
  stem.position.y = 0.25;
  const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xbfd8ff }));
  bloom.position.y = 0.55;
  const glow = new THREE.PointLight(0x9db8ff, 0.0, 3);
  glow.position.y = 0.6;
  g.add(stem, bloom, glow);
  g.userData.update = (t) => { bloom.scale.setScalar(1 + Math.sin(t * 2) * 0.15); };
  g.userData.bloom = bloom;
  return g;
}
export function makeSealDoor() {
  const g = new THREE.Group();
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.6, 24, 1, false, 0, PI), MAT.stone);
  arch.rotation.z = PI / 2; arch.rotation.y = PI / 2; arch.position.y = 2.2;
  const door = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.25, 24, 1, false, 0, PI), new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.35, metalness: 0.7 }));
  door.rotation.z = PI / 2; door.rotation.y = PI / 2; door.position.y = 2.2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.2, 0.6), MAT.stone);
  base.position.y = 1.1;
  // 符文环
  const runes = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: 0x7ea6ff }));
  runes.position.set(0, 2.0, 0.35);
  g.add(base, arch, door, runes);
  g.userData.runes = runes;
  g.userData.update = (t) => {
    runes.rotation.z = t * 0.3;
    runes.material.color.setHSL(0.62, 0.8, 0.5 + Math.sin(t * 2) * 0.2);
  };
  return g;
}
function makeDummy() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.5, 6), MAT.wood);
  pole.position.y = 0.75;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.9, 8), new THREE.MeshStandardMaterial({ map: TEX.parchment, color: 0xc8b088 }));
  body.position.y = 1.3; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), body.material);
  head.position.y = 2.0;
  g.add(pole, body, head);
  return g;
}
function glassPanel(w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.glass);
  return m;
}

// ---------- 区域建造总入口 ----------
export async function buildZones(B, lib, candleRig) {
  const Z = {};

  // ============ 大厅 ============
  {
    const z = new Zone('hall', '星辉大厅', { bounds: [-19, -13, 19, 13], fog: 0x141020, fogD: 0.010 });
    const info = await B.room(z, 0, 0, 10, 7, { windows: 'wall_archedwindow_open', doorSides: [{ side: 'n', at: 5 }, { side: 's', at: 5 }], winEvery: 2, ceiling: 'none', stack: 2 });
    // 壁挂火把
    for (const tx of [-10, -2, 6, 14]) {
      await B.place(z, 'dungeon', 'torch_mounted', tx, 2.4, -13.7, 0);
      await B.place(z, 'dungeon', 'torch_mounted', tx - 4, 2.4, 13.7, PI);
      candleRig.addSpot('hall', tx, 2.9, -12.9, 1.8);
      candleRig.addSpot('hall', tx - 4, 2.9, 12.9, 1.8);
    }
    // 两列长桌 + 食物
    for (const [tx, tz] of [[-8, -5], [-8, 5], [8, -5], [8, 5]]) {
      for (let i = 0; i < 3; i++) {
        await B.place(z, 'dungeon', 'table_long_tablecloth', tx + i * 4.1 - 4, 0, tz, 0);
        await B.place(z, 'dungeon', i % 2 ? 'plate_food_A' : 'plate_food_B', tx + i * 4.1 - 4, 1.05, tz + 0.4);
        await B.place(z, 'dungeon', 'candle_triple.gltf', tx + i * 4.1 - 4, 1.05, tz - 0.3);
        await B.place(z, 'dungeon', 'chair', tx + i * 4.1 - 5, 0, tz + 1.4, PI);
        await B.place(z, 'dungeon', 'chair', tx + i * 4.1 - 3, 0, tz - 1.4, 0);
      }
      z.blockRect(tx - 6, tz - 0.9, tx + 4.3, tz + 0.9);
      candleRig.addSpot('hall', tx, 1.6, tz, 1.3);
    }
    // 教师高台
    const dais = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 4), MAT.stoneDark);
    dais.position.set(-15, 0.25, 0); dais.receiveShadow = true;
    z.add(dais);
    await B.place(z, 'dungeon', 'table_long_tablecloth_decorated_A', -15, 0.5, 0, PI / 2);
    await B.place(z, 'dungeon', 'chair', -16.6, 0.5, 0, PI / 2);
    z.blockRect(-17.5, -2.2, -13.2, 2.2);
    // 学院旗帜
    const houseIds = Object.keys(HOUSES);
    for (let i = 0; i < 4; i++) {
      await B.place(z, 'dungeon', `banner_patternA_${HOUSES[houseIds[i]].banner}`, -12 + i * 8, 5.6, -13.4, 0, 1.6);
      await B.place(z, 'dungeon', `banner_patternA_${HOUSES[houseIds[i]].banner}`, -12 + i * 8, 5.6, 13.4, PI, 1.6);
    }
    // 魔法星空顶
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(42, 30), new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true,
      uniforms: { t: { value: 0 }, night: { value: 0.6 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float t; uniform float night; varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
        void main(){
          vec3 dayCol = mix(vec3(.40,.50,.78), vec3(.55,.62,.85), vUv.y);
          vec3 col = mix(dayCol, vec3(.02,.03,.10), night);
          vec2 g = vUv*44.0;
          vec2 id = floor(g);
          float h = hash(id);
          float star = step(.965,h) * (0.5+0.5*sin(t*(1.+h*3.)+h*40.));
          col += star * vec3(1.,.95,.8) * night;
          float neb = hash(floor(vUv*7.0))*0.08*night;
          col += vec3(neb*.4, neb*.3, neb);
          gl_FragColor = vec4(col, .97);
        }`,
    }));
    sky.rotation.x = PI / 2; sky.position.y = info.topY - 0.2;
    z.add(sky);
    z.skyMat = sky.material;
    z.update((t) => { sky.material.uniforms.t.value = t; });
    // 漂浮蜡烛 + 尘埃 + 光柱
    const fc = floatingCandles(26, [-16, -10, 16, 10], info.topY - 2.6); z.add(fc); z.update((t) => fc.userData.update(t));
    const dm = dustMotes(120, [-18, -12, 18, 12]); z.add(dm); z.update((t) => dm.userData.update(t));
    for (const gx of [-10, -2, 6, 14]) { const r = godRay(gx, 4.6, -11, 0); z.add(r); z.update((t) => r.userData.update(t)); }
    // 画像
    for (let i = 0; i < 3; i++) {
      const p = makePortrait(1.4, 1.8, 7 + i);
      p.position.set(-6 + i * 6, 3.4, 13.7); p.rotation.y = PI;
      z.add(p); z.portraitList = z.portraitList || []; z.portraitList.push(p);
    }
    // 后厨（支线潜入）
    await B.place(z, 'restaurant', 'crate_ham', 16.5, 0, -11, 0.4);
    await B.place(z, 'restaurant', 'crate_buns', 15.2, 0, -11.6, -0.2);
    await B.place(z, 'restaurant', 'crate_cheese', 17.4, 0, -9.8, 0.9);
    z.interact(16.3, -10.5, '取用烤肉腿', 'kitchen_grab');
    // 锚点
    z.spot('spawn', 0, 0, 8);
    z.spot('sort', 0, 0, -2);
    z.spot('teach', -15, 0.5, 2.5);
    z.spot('idle1', -8, 0, -6.5); z.spot('idle2', 8, 0, 6.5); z.spot('idle3', 4, 0, -6.5); z.spot('idle4', -4, 0, 6.5);
    z.spot('seat1', -9, 0, -3.6); z.spot('seat2', -5, 0, 6.4); z.spot('seat3', 7, 0, -3.6); z.spot('seat4', 11, 0, 6.4);
    z.spot('feast', 0, 0, 0);
    z.portal(0, -12.6, '前往楼梯厅', 'stair', 'fromHall');
    z.portal(0, 12.6, '前往庭院', 'yard', 'fromHall');
    Z.hall = z;
  }

  // ============ 旋转楼梯厅 ============
  {
    const z = new Zone('stair', '旋转楼梯厅', { bounds: [-13, -13, 13, 13], fog: 0x10121f, fogD: 0.012 });
    await B.room(z, 0, 0, 7, 7, { windows: 'wall_archedwindow_open', doorSides: [{ side: 'n', at: 3 }, { side: 's', at: 3 }, { side: 'w', at: 3 }, { side: 'e', at: 3 }], winEvery: 3, stack: 3 });
    // 中央旋转双梯
    const stairs = [];
    for (let k = 0; k < 2; k++) {
      const holder = new THREE.Group();
      const st = await lib.prop('dungeon', 'stairs_walled');
      st.position.set(3.2, 0, 0);
      holder.add(st);
      holder.position.set(0, k * 0.02, 0);
      holder.userData = { phase: k * PI };
      z.add(holder); stairs.push(holder);
    }
    z.update((t) => {
      for (const h of stairs) {
        h.rotation.y = h.userData.phase + Math.floor(t / 9) * PI / 2 + smoothstep((t % 9) / 9) * 0 + easeRot(t, 9) * PI / 2;
      }
    });
    function easeRot(t, period) { const u = (t % period) / period; return u < 0.85 ? 0 : smoothstep((u - 0.85) / 0.15); }
    function smoothstep(x) { return x * x * (3 - 2 * x); }
    z.block(0, 0, 4.4);
    // 画像墙（一整面会动的画像）
    for (let i = 0; i < 6; i++) {
      const p = makePortrait(1.1, 1.4, 30 + i);
      p.position.set(-13.6, 2.6 + (i % 2) * 2.1, -7 + Math.floor(i / 2) * 5);
      p.rotation.y = PI / 2;
      z.add(p); (z.portraitList = z.portraitList || []).push(p);
    }
    for (const [x, zz] of [[-6, -13.4], [6, -13.4]]) {
      await B.place(z, 'dungeon', 'torch_mounted', x, 2.6, zz, 0);
      candleRig.addSpot('stair', x, 3, zz + 0.5, 1.8);
    }
    const dm = dustMotes(70, [-12, -12, 12, 12], [0.5, 9]); z.add(dm); z.update((t) => dm.userData.update(t));
    const gr = godRay(-9, 5, 0, PI / 2, 9); z.add(gr); z.update((t) => gr.userData.update(t));
    z.spot('spawn', 0, 0, 7);
    z.spot('fromHall', 0, 0, 9);
    z.spot('fromYard', 0, 0, -9);
    z.spot('teach', -6, 0, 5);
    z.spot('idle1', 7, 0, 7); z.spot('idle2', -7, 0, -7); z.spot('idle3', 8, 0, -4); z.spot('idle4', -8, 0, 4);
    z.spot('ghost', -4, 0, -9);
    z.portal(0, 12.6, '前往星辉大厅', 'hall', 'spawn');
    z.portal(0, -12.6, '前往庭院', 'yard', 'spawn');
    z.portal(-12.6, 0, '前往图书馆', 'library', 'spawn');
    z.portal(12.6, 0, '下往魔药教室', 'potions', 'spawn');
    z.portal(9.5, 9.5, '上往休息室', 'common', 'spawn', null, 2.6);
    z.portal(-9.5, -9.5, '登上天文塔', 'astro', 'spawn', null, 2.6);
    z.portal(9.5, -9.5, '密室入口……', 'chamber', 'spawn', (gs) => gs.quests.m4?.done ? null : '一堵冰冷的石墙。似乎藏着什么。', 2.6);
    Z.stair = z;
  }

  // ============ 图书馆 ============
  {
    const z = new Zone('library', '古籍图书馆', { bounds: [-15, -11, 15, 11], fog: 0x120f1e, fogD: 0.016 });
    await B.room(z, 0, 0, 8, 6, { windows: 'wall_window_open', doorSides: [{ side: 'e', at: 3 }], winEvery: 3 });
    // 书架阵列
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 4; i++) {
        await B.place(z, 'dungeon', 'shelf_large', -11 + i * 4.2, 0, -7.5 + r * 5, 0);
        await B.place(z, 'dungeon', 'shelf_large', -11 + i * 4.2, 0, -6 + r * 5, PI);
      }
      z.blockRect(-13, -8 + r * 5, -1, -5.5 + r * 5);
    }
    await B.place(z, 'dungeon', 'wall_shelves', 5, 0, -10.5, 0);
    await B.place(z, 'dungeon', 'shelves', 9, 0, -10.5, 0);
    // 阅读区
    for (let i = 0; i < 2; i++) {
      await B.place(z, 'dungeon', 'table_medium', 7, 0, -2 + i * 5, 0);
      await B.place(z, 'dungeon', 'chair', 5.8, 0, -2 + i * 5, PI / 2);
      await B.place(z, 'dungeon', 'chair', 8.2, 0, -2 + i * 5, -PI / 2);
      await B.place(z, 'items', 'spellbook_open.gltf', 7, 1.05, -2 + i * 5, Math.random());
      z.blockRect(6, -2.8 + i * 5, 8, -1.2 + i * 5);
      candleRig.addSpot('library', 7, 1.5, -2 + i * 5, 1.2);
    }
    // 禁书区（西南角，暗紫光）
    const gate = await B.place(z, 'dungeon', 'wall_gated', -6, 0, 6.2, 0);
    const rl = new THREE.PointLight(0x7a4ae0, 1.1, 12);
    rl.position.set(-10, 3, 9); z.add(rl);
    await B.place(z, 'dungeon', 'shelf_small_candles', -13, 0, 9.5, PI / 2);
    await B.place(z, 'dungeon', 'shelf_large', -9, 0, 10.5, PI);
    await B.place(z, 'dungeon', 'shelf_large', -4, 0, 10.5, PI);
    // 高架禁书（M3 悬浮咒目标）
    const bookTarget = await B.place(z, 'items', 'spellbook_closed.gltf', -9, 3.1, 10.3, 0.4);
    bookTarget.userData.glow = true;
    z.bookTarget = bookTarget;
    z.interact(-9, 9.2, '高架上的《星轨编年史·三》(悬浮咒 F)', 'levit_book', null, 2.6);
    // 漂浮书群
    const fb = floatingBooks(14, V3(1, 0, 2), 5.5, 2.6); z.add(fb); z.update((t) => fb.userData.update(t));
    const dm = dustMotes(90, [-14, -10, 14, 10], [0.5, 5]); z.add(dm); z.update((t) => dm.userData.update(t));
    const gr = godRay(2, 3.8, -9.5, 0, 6); z.add(gr); z.update((t) => gr.userData.update(t));
    // 巡逻画像（潜入玩法的"守卫"）
    for (let i = 0; i < 2; i++) {
      const p = makePortrait(1.2, 1.5, 60 + i);
      p.position.set(-2 + i * 6, 3.2, 11.6); p.rotation.y = PI;
      z.add(p); (z.portraitList = z.portraitList || []).push(p);
    }
    z.spot('spawn', 10, 0, 0);
    z.spot('ghost', 7, 0, 1);
    z.spot('idle1', 7, 0, -2); z.spot('idle2', 7, 0, 3); z.spot('idle3', -2, 0, -4); z.spot('idle4', 1, 0, 1);
    z.spot('teach', 5, 0, -8);
    z.spot('restricted', -9, 0, 8);
    z.portal(14.6, 0, '回楼梯厅', 'stair', 'spawn');
    z.interact(7, -9.8, '静读书架（阅读提升学识）', 'read_shelf');
    Z.library = z;
  }

  // ============ 魔药教室 ============
  {
    const z = new Zone('potions', '地窖魔药教室', { bounds: [-13, -9, 13, 9], fog: 0x0e1410, fogD: 0.02 });
    await B.room(z, 0, 0, 7, 5, { windows: 'wall', doorSides: [{ side: 'n', at: 3 }], winEvery: 99 });
    // 三张操作台+坩埚
    for (let i = 0; i < 3; i++) {
      await B.place(z, 'dungeon', 'table_medium', -7 + i * 7, 0, 0, 0);
      const c = makeCauldron(); c.position.set(-7 + i * 7, 1.0, 0);
      z.add(c); z.update((t) => c.userData.update(t));
      z.blockRect(-8.2 + i * 7, -1, -5.8 + i * 7, 1);
      candleRig.addSpot('potions', -7 + i * 7, 1.8, 0, 1.1);
    }
    z.interact(-7, 2.2, '在坩埚酿造魔药', 'brew', 0);
    z.interact(0, 2.2, '在坩埚酿造魔药', 'brew', 1);
    z.interact(7, 2.2, '在坩埚酿造魔药', 'brew', 2);
    // 材料架
    for (let i = 0; i < 4; i++) {
      await B.place(z, 'dungeon', 'shelf_small_candles', -10 + i * 6.6, 0, -8.6, 0);
      await B.place(z, 'dungeon', ['bottle_A_green', 'bottle_B_brown', 'bottle_C_green', 'bottle_A_labeled_brown'][i], -10 + i * 6.6, 1.62, -8.5, 0);
    }
    z.interact(-10, -7.4, '取一些公用材料', 'take_mats', null, 2.4);
    // 教师讲桌
    await B.place(z, 'dungeon', 'table_medium_decorated_A', 0, 0, 7, PI);
    z.blockRect(-1.4, 6.2, 1.4, 7.8);
    const gl = new THREE.PointLight(0x54e0a0, 0.9, 10); gl.position.set(0, 2.5, 0); z.add(gl);
    const dm = dustMotes(60, [-12, -8, 12, 8], [0.4, 4]); z.add(dm); z.update((t) => dm.userData.update(t));
    z.spot('spawn', 0, 0, -5.2);
    z.spot('teach', 0, 0, 5.8);
    z.spot('idle1', -7, 0, 2.2); z.spot('idle2', 7, 0, 2.2); z.spot('idle3', -7, 0, -2.2); z.spot('idle4', 0, 0, -2.2);
    z.portal(0, -8.6, '回楼梯厅', 'stair', 'spawn');
    Z.potions = z;
  }

  // ============ 公共休息室 + 宿舍 ============
  {
    const z = new Zone('common', '学院休息室', { bounds: [-13, -9, 13, 9], fog: 0x181018, fogD: 0.014 });
    await B.room(z, 0, 0, 7, 5, { windows: 'wall_archedwindow_open', doorSides: [{ side: 's', at: 3 }], winEvery: 2 });
    const fp = makeFireplace(); fp.position.set(0, 0, -8.7);
    z.add(fp); z.update((t) => fp.userData.update(t));
    const fl = new THREE.PointLight(0xff9040, 1.6, 12); fl.position.set(0, 1.6, -7.6); z.add(fl);
    z.update((t) => { fl.intensity = 1.5 + Math.sin(t * 8.5) * 0.3 + Math.sin(t * 19) * 0.15; });
    z.blockRect(-1.5, -9, 1.5, -8);
    await B.place(z, 'furniture', 'couch_pillows', -2.5, 0, -5.5, 0.35);
    await B.place(z, 'furniture', 'armchair_pillows', 2.6, 0, -5.6, -0.5);
    await B.place(z, 'furniture', 'table_low', 0, 0, -4.6, 0);
    await B.place(z, 'furniture', 'rug_oval_A', 0, 0.02, -5, 0, 1.6);
    z.blockRect(-3.4, -6.4, 3.4, -4.2);
    await B.place(z, 'furniture', 'shelf_A_big', -12.5, 0, -3, PI / 2);
    await B.place(z, 'furniture', 'cabinet_medium', -12.5, 0, 2, PI / 2);
    // 公告板（社团/集市）
    await B.place(z, 'dungeon', 'sword_shield', 12.6, 1.6, -3, -PI / 2);
    z.interact(11.6, -3, '布告栏（社团·集市）', 'board', null, 2.2);
    // 宿舍角（玩家的床 + 装饰区）
    await B.place(z, 'furniture', 'bed_single_A', 10.5, 0, 6.5, -PI / 2);
    z.blockRect(9, 5.4, 12.4, 7.6);
    await B.place(z, 'furniture', 'lamp_table', 8.3, 0, 7.4, 0);
    z.interact(9.5, 4.8, '睡觉（进入下一天）', 'sleep', null, 2.4);
    z.interact(5.5, 6.5, '布置宿舍（装饰模式）', 'decor', null, 2.6);
    z.decorAnchor = V3(2, 0, 4); // 摆放家具的原点
    z.spot('spawn', 0, 0, 5.2);
    z.spot('idle1', -2.5, 0, -4.8); z.spot('idle2', 2.6, 0, -5); z.spot('idle3', -8, 0, 0); z.spot('idle4', 6, 0, -2);
    z.spot('seat1', -2.5, 0, -5.3); z.spot('seat2', 2.6, 0, -5.4);
    z.portal(0, 8.6, '回楼梯厅', 'stair', 'spawn');
    Z.common = z;
  }

  // ============ 温室 ============
  {
    const z = new Zone('greenhouse', '三号温室', { bounds: [-12, -9, 12, 9], fog: 0x12200f, fogD: 0.014, indoor: true });
    // 玻璃屋：石基座 + 玻璃墙/顶
    const base = new THREE.Mesh(new THREE.BoxGeometry(25, 0.4, 19), MAT.stoneDark);
    base.position.y = -0.2; base.receiveShadow = true; z.add(base);
    for (let i = 0; i < 2; i++) {
      const wall = glassPanel(25, 3.6); wall.position.set(0, 1.8, i ? 9.4 : -9.4); if (!i) wall.rotation.y = PI; z.add(wall);
      const wall2 = glassPanel(19, 3.6); wall2.position.set(i ? 12.4 : -12.4, 1.8, 0); wall2.rotation.y = i ? -PI / 2 : PI / 2; z.add(wall2);
    }
    const roof1 = glassPanel(25, 10.2); roof1.position.set(0, 5.2, -4.8); roof1.rotation.x = PI / 2 - 0.6; z.add(roof1);
    const roof2 = glassPanel(25, 10.2); roof2.position.set(0, 5.2, 4.8); roof2.rotation.x = -(PI / 2 - 0.6); z.add(roof2);
    // 铁框
    for (let x = -12; x <= 12; x += 4) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.6, 0.12), MAT.iron);
      beam.position.set(x, 1.8, -9.4); z.add(beam);
      const beam2 = beam.clone(); beam2.position.z = 9.4; z.add(beam2);
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 19.5), MAT.iron);
      rafter.position.set(x, 5.15, 0); rafter.rotation.x = 0; z.add(rafter);
    }
    // 种植槽 6 格
    z.plots = [];
    for (let i = 0; i < 6; i++) {
      const px = -8 + (i % 3) * 8, pz = -3.5 + Math.floor(i / 3) * 7;
      const box = await B.place(z, 'restaurant', 'crate', px, 0, pz, 0, 1.4);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 1.7), new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 1 }));
      soil.position.set(px, 0.75, pz); z.add(soil);
      z.blockRect(px - 1, pz - 1, px + 1, pz + 1);
      z.interact(px, pz + 1.8, `种植槽 ${i + 1}`, 'plot', i);
      z.plots.push({ x: px, z: pz, mesh: null });
    }
    // 装饰植物
    await B.place(z, 'furniture', 'cactus_medium_A', -11, 0, -8, 0);
    await B.place(z, 'furniture', 'cactus_medium_B', 11, 0, -8, 0);
    await B.place(z, 'restaurant', 'crate_carrots', 11, 0, 8, 0.5);
    await B.place(z, 'restaurant', 'crate_tomatoes', -11, 0, 8, -0.4);
    // 水槽
    const trough = new THREE.Mesh(new THREE.BoxGeometry(3, 0.7, 1.2), MAT.stone);
    trough.position.set(0, 0.35, 8.2); z.add(trough);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1), new THREE.MeshStandardMaterial({ color: 0x3a6a8a, roughness: 0.1, metalness: 0.3 }));
    water.rotation.x = -PI / 2; water.position.set(0, 0.62, 8.2); z.add(water);
    z.blockRect(-1.6, 7.6, 1.6, 8.8);
    z.interact(0, 6.9, '打水（浇灌植物）', 'water');
    const dm = dustMotes(50, [-11, -8, 11, 8], [0.5, 4]); z.add(dm); z.update((t) => dm.userData.update(t));
    z.spot('spawn', 0, 0, -5.5);
    z.spot('teach', 0, 0, 0);
    z.spot('idle1', -8, 0, 0); z.spot('idle2', 8, 0, 0); z.spot('idle3', -4, 0, 5); z.spot('idle4', 4, 0, -5);
    z.portal(0, -8.8, '出温室（往庭院）', 'yard', 'fromGreen');
    Z.greenhouse = z;
  }

  // ============ 天文塔 ============
  {
    const z = new Zone('astro', '天文塔顶', { bounds: [-9, -9, 9, 9], fog: 0x060814, fogD: 0.008, indoor: false });
    // 圆形平台
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 1.2, 24), MAT.stone);
    plat.position.y = -0.6; plat.receiveShadow = true; z.add(plat);
    // 围栏立柱
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * PI * 2;
      const c = await B.place(z, 'dungeon', 'barrier_column', Math.cos(a) * 9.4, 0, Math.sin(a) * 9.4, -a);
    }
    // 中央浑天仪
    const or = makeOrrery(); or.position.set(0, 0, 0); or.scale.setScalar(2.2);
    z.add(or); z.update((t) => or.userData.update(t));
    z.block(0, 0, 1.8);
    // 望远镜
    const tel = makeTelescope(); tel.position.set(5.5, 0, -4); tel.rotation.y = -0.8; z.add(tel);
    z.interact(5.5, -2.8, '使用望远镜观星', 'stargaze', null, 2.2);
    z.block(5.5, -4, 0.8);
    // 蜡烛圈
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * PI * 2 + 0.3;
      await B.place(z, 'dungeon', 'candle_lit.gltf', Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4, 0, 1.4);
      candleRig.addSpot('astro', Math.cos(a) * 3.4, 0.7, Math.sin(a) * 3.4, 1.0);
    }
    // 封印仪式阵（M7）
    const circle = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.7, 40), new THREE.MeshBasicMaterial({ color: 0x7ea6ff, transparent: true, opacity: 0.0, side: THREE.DoubleSide }));
    circle.rotation.x = -PI / 2; circle.position.y = 0.03; z.add(circle);
    z.sealCircle = circle;
    z.interact(0, -3.4, '封印仪式', 'ritual', null, 2.4);
    z.spot('spawn', -5.5, 0, 4.5);
    z.spot('teach', 3, 0, 2.5);
    z.spot('idle1', -4, 0, -4); z.spot('idle2', 4, 0, 4); z.spot('idle3', -5, 0, 2); z.spot('idle4', 0, 0, -5);
    z.spot('ghost', 6, 0, 3);
    z.portal(-8.2, 6.8, '下楼（楼梯厅）', 'stair', 'spawn', null, 2.4);
    Z.astro = z;
  }

  // ============ 庭院 ============
  {
    const z = new Zone('yard', '钟楼庭院', { bounds: [-17, -14, 17, 14], fog: 0x0d1220, fogD: 0.008, indoor: false });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 34), new THREE.MeshStandardMaterial({ color: 0x4a5a3f, roughness: 1 }));
    ground.rotation.x = -PI / 2; ground.receiveShadow = true; z.add(ground);
    // 城堡外墙背景
    for (let i = 0; i < 9; i++) await B.place(z, 'dungeon', i % 3 === 1 ? 'wall_archedwindow_gated' : 'wall', -16 + i * 4, 0, -14.5, 0);
    for (let i = 0; i < 8; i++) { await B.place(z, 'dungeon', 'wall', -17, 0, -14 + i * 4, PI / 2); await B.place(z, 'dungeon', 'wall', 17, 0, -14 + i * 4, -PI / 2); }
    // 远景塔楼剪影
    for (const [tx, tz, h] of [[-24, -22, 18], [24, -20, 22], [0, -30, 26]]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, h, 8), MAT.stoneDark);
      tower.position.set(tx, h / 2 - 1, tz); z.add(tower);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.6, 5, 8), new THREE.MeshStandardMaterial({ color: 0x2a3550 }));
      cone.position.set(tx, h + 1.5, tz); z.add(cone);
      for (let w = 0; w < 4; w++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
        win.position.set(tx + Math.cos(w * 1.7) * 3.05, h * (0.3 + w * 0.16), tz + Math.sin(w * 1.7) * 3.05);
        win.lookAt(tx + Math.cos(w * 1.7) * 9, win.position.y, tz + Math.sin(w * 1.7) * 9);
        z.add(win); (z.towerWins = z.towerWins || []).push(win.material);
      }
    }
    // 决斗台
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.7, 0.5, 20), MAT.stone);
    ring.position.set(7, 0.25, 5); ring.receiveShadow = true; ring.castShadow = true; z.add(ring);
    const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: 0xd8b45a }));
    ringGlow.rotation.x = PI / 2; ringGlow.position.set(7, 0.52, 5); z.add(ringGlow);
    z.duelRing = { x: 7, z: 5, r: 5 };
    z.interact(7, -0.2, '决斗台（挑战/社团）', 'duel_ring', null, 2.6);
    // 训练假人×3
    z.dummies = [];
    for (let i = 0; i < 3; i++) {
      const d = makeDummy(); d.position.set(-8 + i * 3.4, 0, -9.5); d.rotation.y = 0.3 - i * 0.3;
      z.add(d); z.block(-8 + i * 3.4, -9.5, 0.6);
      z.dummies.push(d);
    }
    z.interact(-4.8, -7.8, '对假人练习施法（左键）', 'practice', null, 3.4);
    // 树 + 长凳 + 灯
    for (const [tx, tz] of [[-12, 8], [-13, -3], [13, -8]]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.2, 7), MAT.wood);
      trunk.position.set(tx, 1.6, tz); trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3f6a35, roughness: 1 }));
      crown.position.set(tx, 4.4, tz); crown.castShadow = true;
      crown.userData.sway = Math.random() * 9;
      z.add(trunk, crown); z.block(tx, tz, 0.8);
      z.update((t) => { crown.position.x = tx + Math.sin(t * 0.7 + crown.userData.sway) * 0.12; });
    }
    await B.place(z, 'halloween', 'bench', -11, 0, 5, PI / 2);
    await B.place(z, 'halloween', 'post_lantern', 0, 0, -6, 0);
    await B.place(z, 'halloween', 'post_lantern', -6, 0, 6, 0);
    candleRig.addSpot('yard', 0, 2.6, -6, 1.6);
    candleRig.addSpot('yard', -6, 2.6, 6, 1.6);
    // 井
    const well = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 1, 10, 1, true), MAT.stone);
    well.position.set(-2, 0.5, 10); z.add(well); z.block(-2, 10, 1.4);
    z.spot('spawn', 0, 0, 0);
    z.spot('fromHall', 0, 0, -10.5);
    z.spot('fromGreen', -13, 0, 10);
    z.spot('teach', -5, 0, -7);
    z.spot('idle1', 7, 0, 5); z.spot('idle2', -10, 0, 5); z.spot('idle3', 3, 0, 10); z.spot('idle4', 10, 0, -5);
    z.portal(0, -13.6, '回星辉大厅', 'hall', 'spawn');
    z.portal(-16.5, 11, '进入温室', 'greenhouse', 'spawn', null, 2.4);
    z.portal(14, 13.4, '禁林小径（黄昏后）', 'forest', 'spawn', (gs) => {
      const ph = gs.hour >= 18 || gs.hour < 6;
      return ph ? null : '禁林白天有巡查，等黄昏之后再来。';
    }, 2.8);
    Z.yard = z;
  }

  // ============ 禁林 ============
  {
    const z = new Zone('forest', '禁林边缘', { bounds: [-19, -17, 19, 17], fog: 0x05070c, fogD: 0.05, indoor: false });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 40), new THREE.MeshStandardMaterial({ color: 0x1c2418, roughness: 1 }));
    ground.rotation.x = -PI / 2; ground.receiveShadow = true; z.add(ground);
    const rng = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < 26; i++) {
      const tx = -18 + rng() * 36, tz = -16 + rng() * 32;
      if (Math.abs(tx) < 3 && Math.abs(tz) < 8) continue;
      const kind = ['tree_dead_large', 'tree_dead_medium', 'tree_pine_orange_large', 'tree_dead_small'][Math.floor(rng() * 4)];
      await B.place(z, 'halloween', kind, tx, 0, tz, rng() * PI * 2, 1.2 + rng() * 0.9);
      z.block(tx, tz, 0.7);
    }
    // 小径灯
    for (let i = 0; i < 4; i++) {
      await B.place(z, 'halloween', 'lantern_standing', -1.5 + (i % 2) * 3, 0, 14 - i * 7, 0);
      candleRig.addSpot('forest', -1.5 + (i % 2) * 3, 1.4, 14 - i * 7, 1.4);
    }
    // 蛛网 + 蛛巢
    for (const [wx, wz] of [[-12, -10], [13, -6], [-8, 8]]) {
      const web = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
      web.position.set(wx, 1.4, wz); web.rotation.y = rng() * 2; z.add(web);
    }
    // 月光花丛（夜间采集）
    z.flowers = [];
    for (const [fx, fz] of [[-14, -13], [10, -12], [-6, -2], [15, 6], [-15, 10], [6, 12]]) {
      const f = makeMoonflower(); f.position.set(fx, 0, fz);
      z.add(f); z.update((t) => f.userData.update(t));
      z.interact(fx, fz, '采集月光花', 'pick_flower', z.flowers.length, 1.6);
      z.flowers.push({ mesh: f, x: fx, z: fz, taken: false });
    }
    // 地宫（宝箱彩蛋）
    await B.place(z, 'halloween', 'crypt', 0, 0, -14, 0, 1.4);
    const chest = await B.place(z, 'dungeon', 'chest', 0, 0, -11.6, PI);
    z.interact(0, -10.8, '苔痕斑斑的宝箱', 'forest_chest', null, 2);
    z.blockRect(-3, -16, 3, -12.4);
    // 萤火虫
    const ffGeo = new THREE.BufferGeometry();
    const N = 60; const fpos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { fpos[i * 3] = -18 + Math.random() * 36; fpos[i * 3 + 1] = 0.5 + Math.random() * 2.5; fpos[i * 3 + 2] = -16 + Math.random() * 32; }
    ffGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
    const ff = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xaaffcc, size: 0.09, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    z.add(ff);
    z.update((t) => {
      for (let i = 0; i < N; i++) {
        fpos[i * 3] += Math.sin(t * 0.8 + i) * 0.008;
        fpos[i * 3 + 1] += Math.cos(t * 1.1 + i * 2) * 0.006;
      }
      ffGeo.attributes.position.needsUpdate = true;
      ff.material.opacity = 0.5 + Math.sin(t * 2) * 0.35;
    });
    const moonlight = new THREE.SpotLight(0x8fa8e8, 2.2, 40, 0.5, 0.6);
    moonlight.position.set(6, 18, 2); moonlight.target.position.set(0, 0, 0);
    z.add(moonlight, moonlight.target);
    z.spot('spawn', 0, 0, 12.5);
    z.spot('idle1', -4, 0, 4);
    z.portal(0, 16.4, '返回庭院', 'yard', 'spawn', null, 2.6);
    Z.forest = z;
  }

  // ============ 密室入口 ============
  {
    const z = new Zone('chamber', '密室入口', { bounds: [-11, -13, 11, 9], fog: 0x080a14, fogD: 0.035 });
    await B.room(z, 0, -2, 6, 6, { windows: 'wall_cracked', doorSides: [{ side: 's', at: 3 }], winEvery: 3, floorTile: 'floor_dirt_large' });
    // 符文封印门（北面）
    const door = makeSealDoor(); door.position.set(0, 0, -13.2);
    z.add(door); z.update((t) => door.userData.update(t));
    z.sealDoor = door;
    z.interact(0, -10.8, '星辉锁（符文谜题）', 'rune_lock', null, 2.6);
    // 石棺与蜡烛
    await B.place(z, 'halloween', 'coffin_decorated', -7, 0, -8, 0.3);
    await B.place(z, 'halloween', 'shrine_candles', 7, 0, -8, -0.4);
    await B.place(z, 'halloween', 'skull_candle', -6, 0, 2, 0.9);
    await B.place(z, 'halloween', 'plaque_candles', 6, 0, 3, -0.6);
    candleRig.addSpot('chamber', 7, 1.2, -8, 1.5);
    candleRig.addSpot('chamber', -6, 0.6, 2, 1.2);
    // 萤光菇
    for (const [mx, mz] of [[-8, -3], [8, -1], [3, 5]]) {
      const shroom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0x54e0a0 }));
      shroom.position.set(mx, 0.16, mz); z.add(shroom);
      z.interact(mx, mz, '采集萤光菇', 'pick_shroom', null, 1.4);
    }
    const gl = new THREE.PointLight(0x54e0a0, 0.7, 14); gl.position.set(0, 2, -6); z.add(gl);
    const dm = dustMotes(80, [-10, -12, 10, 8], [0.3, 4]); z.add(dm); z.update((t) => dm.userData.update(t));
    z.spot('spawn', 0, 0, 5);
    z.spot('ghost', -5, 0, -6);
    z.spot('idle1', 4, 0, -4);
    z.portal(0, 8.6, '回楼梯厅', 'stair', 'spawn');
    // 迷宫入口（M5 开门后）
    z.portal(0, -12.4, '进入星轨迷宫', 'dungeon', 'spawn', (gs) => gs.flags.chamberOpen ? null : '巨门紧闭。符文锁泛着微光。', 2.4);
    Z.chamber = z;
  }

  return Z;
}
