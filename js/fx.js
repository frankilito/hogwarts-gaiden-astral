// ============ 魔法特效：弹体/光束/护盾/电弧/火冰/传送门/爆花 ============
import * as THREE from 'three';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class MagicFX {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.live = new Set();
  }
  _add(o, life, update) {
    this.scene.add(o);
    const rec = { o, life, update, t: 0 };
    this.live.add(rec);
    return rec;
  }
  update(dt, t) {
    for (const rec of [...this.live]) {
      rec.t += dt; rec.life -= dt;
      rec.update?.(rec, dt, t);
      if (rec.life <= 0) {
        this.scene.remove(rec.o);
        rec.o.traverse?.(m => { m.geometry?.dispose?.(); });
        this.live.delete(rec);
        rec.onEnd?.();
      }
    }
  }
  clearAll() { for (const rec of [...this.live]) { this.scene.remove(rec.o); this.live.delete(rec); } }

  // ---- 命中爆花 ----
  burst(pos, color = 0xffd27a, n = 22, size = 0.09, spd = 3.2) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) {
      p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      v.push(V3(Math.cos(a) * Math.cos(b), Math.sin(b) + 0.4, Math.sin(a) * Math.cos(b)).multiplyScalar(spd * (0.4 + Math.random() * 0.8)));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    this._add(pts, 0.7, (rec, dt) => {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < n; i++) {
        v[i].y -= dt * 5;
        arr[i * 3] += v[i].x * dt; arr[i * 3 + 1] += v[i].y * dt; arr[i * 3 + 2] += v[i].z * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, rec.life / 0.7);
    });
  }

  // ---- 弹体 ----
  bolt(from, dir, { color = 0xffd27a, speed = 16, r = 0.14, life = 1.6, onStep, onEnd } = {}) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), new THREE.MeshBasicMaterial({ color }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 2.2, 8, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending }));
    const light = new THREE.PointLight(color, 1.4, 6);
    g.add(core, halo, light);
    g.position.copy(from);
    const vel = dir.clone().normalize().multiplyScalar(speed);
    const trailPts = [];
    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 });
    const trail = new THREE.Line(trailGeo, trailMat);
    this.scene.add(trail);
    const rec = this._add(g, life, (rec, dt) => {
      g.position.addScaledVector(vel, dt);
      halo.scale.setScalar(1 + Math.sin(rec.t * 30) * 0.2);
      trailPts.push(g.position.clone());
      if (trailPts.length > 14) trailPts.shift();
      trailGeo.setFromPoints(trailPts);
      const hit = onStep?.(g.position, dt);
      if (hit) rec.life = 0;
    });
    rec.onEnd = () => { this.scene.remove(trail); this.burst(g.position, color, 16); onEnd?.(g.position); };
    return rec;
  }

  // ---- 持续光束 ----
  beam(getFrom, getDir, { color = 0xffeeb0, width = 0.08 } = {}) {
    const geo = new THREE.CylinderGeometry(width, width * 1.7, 1, 8, 1, true);
    geo.translate(0, 0.5, 0); geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    const light = new THREE.PointLight(color, 2, 8);
    m.add(light);
    const rec = this._add(m, 9999, (rec) => {
      const from = getFrom(), dir = getDir();
      const len = rec.beamLen || 14;
      m.position.copy(from);
      m.lookAt(from.clone().add(dir));
      m.scale.set(1 + Math.sin(rec.t * 40) * 0.25, 1 + Math.sin(rec.t * 40) * 0.25, len);
      light.position.z = len;
    });
    rec.stop = () => { rec.life = 0; };
    return rec;
  }

  // ---- 火焰锥 ----
  fireCone(from, dir, { n = 60, life = 0.7 } = {}) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), v = [], seed = [];
    for (let i = 0; i < n; i++) {
      p[i * 3] = from.x; p[i * 3 + 1] = from.y; p[i * 3 + 2] = from.z;
      const spread = 0.35;
      const d = dir.clone().add(V3((Math.random() - .5) * spread, (Math.random() - .5) * spread * 0.7 + 0.08, (Math.random() - .5) * spread)).normalize();
      v.push(d.multiplyScalar(7 + Math.random() * 5));
      seed.push(Math.random());
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({ color: 0xff9040, size: 0.26, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    const light = new THREE.PointLight(0xff7038, 2.5, 9);
    light.position.copy(from);
    pts.add(light);
    this._add(pts, life, (rec, dt) => {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < n; i++) {
        arr[i * 3] += v[i].x * dt; arr[i * 3 + 1] += v[i].y * dt + Math.sin(rec.t * 10 + seed[i] * 9) * dt; arr[i * 3 + 2] += v[i].z * dt;
        v[i].multiplyScalar(1 - dt * 1.8);
      }
      geo.attributes.position.needsUpdate = true;
      mat.color.setHSL(0.06 - rec.t * 0.05, 1, 0.55);
      mat.opacity = Math.max(0, rec.life / life);
    });
  }

  // ---- 冰霜新星 ----
  iceNova(center, { r = 5 } = {}) {
    const ringGeo = new THREE.RingGeometry(0.3, 0.7, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(center).y += 0.1;
    this._add(ring, 0.6, (rec) => {
      const s = 1 + (0.6 - rec.life) / 0.6 * r * 1.6;
      ring.scale.setScalar(s);
      ringMat.opacity = rec.life / 0.6;
    });
    // 冰晶
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7 + Math.random() * 0.5, 5), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.1, transparent: true, opacity: 0.85 }));
      shard.position.set(center.x + Math.cos(a) * (1.2 + Math.random() * 2), 0, center.z + Math.sin(a) * (1.2 + Math.random() * 2));
      shard.rotation.z = (Math.random() - .5) * 0.4;
      this._add(shard, 2.2, (rec) => {
        if (rec.t < 0.15) shard.scale.setScalar(rec.t / 0.15);
        if (rec.life < 0.4) shard.material.opacity = rec.life / 0.4 * 0.85;
      });
    }
  }

  // ---- 雷弧链 ----
  arcChain(points, { color = 0xbfa8ff } = {}) {
    for (let s = 0; s < points.length - 1; s++) {
      const a = points[s], b = points[s + 1];
      const segs = 8, pts = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const p = a.clone().lerp(b, t);
        if (i > 0 && i < segs) { p.x += (Math.random() - .5) * 0.5; p.y += (Math.random() - .5) * 0.5; p.z += (Math.random() - .5) * 0.5; }
        pts.push(p);
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, linewidth: 2 });
      const line = new THREE.Line(geo, mat);
      const light = new THREE.PointLight(color, 2, 7);
      light.position.copy(b);
      line.add(light);
      this._add(line, 0.28, (rec) => {
        mat.opacity = rec.life / 0.28;
        if (Math.random() < 0.4) {
          const arr = geo.attributes.position.array;
          for (let i = 3; i < arr.length - 3; i += 3) { arr[i] += (Math.random() - .5) * 0.15; arr[i + 1] += (Math.random() - .5) * 0.15; arr[i + 2] += (Math.random() - .5) * 0.15; }
          geo.attributes.position.needsUpdate = true;
        }
      });
      this.burst(b, color, 10, 0.07);
    }
  }

  // ---- 护盾 ----
  shieldDome(follow, { color = 0x8ecbff, dur = 5 } = {}) {
    const geo = new THREE.SphereGeometry(1.15, 20, 14);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { c: { value: new THREE.Color(color) }, t: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 c; uniform float t; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.-abs(dot(vN,vV)), 2.2); float hex = 0.75+0.25*sin(t*3.); gl_FragColor = vec4(c, f*0.75*hex + 0.05); }`,
    });
    const m = new THREE.Mesh(geo, mat);
    const rec = this._add(m, dur, (rec, dt, t) => {
      mat.uniforms.t.value = t;
      const p = follow();
      m.position.set(p.x, p.y + 1.1, p.z);
      if (rec.life < 0.5) m.scale.setScalar(rec.life / 0.5);
      else if (rec.t < 0.25) m.scale.setScalar(rec.t / 0.25);
    });
    rec.popNow = () => { rec.life = Math.min(rec.life, 0.18); this.burst(m.position, color, 26, 0.1); };
    return rec;
  }

  // ---- 星门（成对传送门） ----
  portal(pos, color = 0xa78bfa, dur = 6) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { c: { value: new THREE.Color(color) }, t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform vec3 c; uniform float t; varying vec2 vUv;
        void main(){ vec2 p=vUv-0.5; float r=length(p)*2.; float a=atan(p.y,p.x);
          float swirl = sin(a*3. + t*4. - r*9.);
          float glow = smoothstep(1.,0.2,r) * (0.55+0.45*swirl);
          gl_FragColor = vec4(c*(1.2+0.4*swirl), glow); }`,
    }));
    disc.rotation.x = 0;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.05, 8, 30), new THREE.MeshBasicMaterial({ color }));
    const light = new THREE.PointLight(color, 1.6, 7);
    g.add(disc, ring, light);
    g.position.copy(pos); g.position.y += 1.1;
    const rec = this._add(g, dur, (rec, dt, t) => {
      disc.material.uniforms.t.value = t;
      ring.rotation.z = t * 2;
      g.rotation.y += dt * 0.4;
      const s = rec.t < 0.3 ? rec.t / 0.3 : (rec.life < 0.3 ? rec.life / 0.3 : 1);
      g.scale.setScalar(s);
    });
    return rec;
  }

  // ---- 变形术烟雾 ----
  morphPoof(pos) {
    this.burst(pos.clone().add(V3(0, 1, 0)), 0xffb0e0, 34, 0.16, 2.2);
    this.burst(pos.clone().add(V3(0, 0.6, 0)), 0xffffff, 18, 0.1, 1.4);
  }

  // ---- 悬浮辉光 ----
  levitGlow(obj, dur = 3) {
    const light = new THREE.PointLight(0xcfe8ff, 1.2, 5);
    const rec = this._add(light, dur, (rec) => {
      const p = new THREE.Vector3();
      obj.getWorldPosition(p);
      light.position.copy(p);
      light.intensity = 1 + Math.sin(rec.t * 8) * 0.4;
    });
    return rec;
  }

  // ---- 仪式巨柱（结局） ----
  ritualPillar(pos, color = 0x7ea6ff, dur = 5) {
    const geo = new THREE.CylinderGeometry(1.6, 2.6, 30, 20, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos); m.position.y += 15;
    this._add(m, dur, (rec, dt) => {
      m.rotation.y += dt * 2;
      mat.opacity = rec.life > dur - 0.5 ? (dur - rec.life) / 0.5 * 0.35 : (rec.life < 1 ? rec.life * 0.35 : 0.35);
    });
    for (let i = 0; i < 5; i++) setTimeout(() => this.burst(pos.clone().add(V3(0, 1 + i * 2, 0)), color, 30, 0.12, 4), i * 300);
  }

  // ---- 拾取闪光 ----
  sparkleAt(pos) { this.burst(pos, 0xfff2b0, 12, 0.07, 1.6); }
}
