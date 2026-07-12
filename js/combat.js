// ============ 战斗：施法器 / 敌人AI / 决斗管理 ============
import * as THREE from 'three';
import { SPELLS, DUELISTS } from './data.js';
import { spellDamage, playerHurt, derivedStats } from './logic.js';
import { Actor } from './actors.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- 敌人 ----------
export class Enemy {
  constructor(game, def, pos) {
    this.g = game;
    this.def = def;
    this.hp = def.hp; this.maxHp = def.hp;
    this.actor = new Actor();
    this.pos = pos.clone();
    this.state = 'idle';
    this.atkCd = 1 + Math.random();
    this.frozen = 0; this.morphed = 0; this.levit = 0;
    this.burn = 0; this.dead = false;
    this.pumpkin = null;
    this.speed = def.ai === 'beast' ? 3.2 : 1.9;
  }
  async init() {
    await this.actor.load(this.g.lib, this.def.model, { tint: this.def.tint, scale: this.def.scale || 1 });
    this.actor.root.position.copy(this.pos);
    this.g.engine.scene.add(this.actor.root);
    // 血条
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 8;
    this.hpTex = new THREE.CanvasTexture(cv);
    this.hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.hpTex, depthWrite: false }));
    this.hpBar.scale.set(1.1, 0.14, 1);
    this.hpBar.position.y = (this.def.scale || 1) * 2.3;
    this.actor.root.add(this.hpBar);
    this._hpDraw();
    return this;
  }
  _hpDraw() {
    const c = this.hpTex.image.getContext('2d');
    c.clearRect(0, 0, 64, 8);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, 64, 8);
    c.fillStyle = this.def.ai === 'boss' ? '#d4af37' : '#e5533f';
    c.fillRect(1, 1, 62 * Math.max(0, this.hp / this.maxHp), 6);
    this.hpTex.needsUpdate = true;
  }
  takeDamage(dmg, fromPos) {
    if (this.dead) return { dead: false };
    this.hp -= dmg;
    this._hpDraw();
    this.g.fx.burst(this.actor.root.position.clone().add(V3(0, 1.2, 0)), 0xffd27a, 12);
    this.g.audio.sfx('hit');
    if (this.hp <= 0) { this.die(); return { dead: true }; }
    if (this.morphed <= 0) this.actor.play(Math.random() > 0.5 ? 'Hit_A' : 'Hit_B', { once: true, fade: 0.06 });
    if (fromPos) this.actor.lookAt(fromPos.x, fromPos.z);
    return { dead: false };
  }
  die() {
    this.dead = true;
    this.hpBar.visible = false;
    this.restoreMorph();
    this.actor.play('Death_A', { once: true, fade: 0.1 });
    this.g.audio.sfx('hurt');
    setTimeout(() => {
      let op = 1;
      const T = setInterval(() => {
        op -= 0.08;
        this.actor.model?.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = Math.max(0, op); } });
        if (op <= 0) { clearInterval(T); this.remove(); }
      }, 60);
    }, 1400);
    this.onDeath?.(this);
  }
  remove() {
    this.g.engine.scene.remove(this.actor.root);
    this.removed = true;
  }
  applyFreeze(sec) { if (this.dead) return; this.frozen = sec; this.actor.mixer.timeScale = 0.05; this.actor.model.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.color?.lerp(new THREE.Color(0x9fdcff), 0.5); } }); }
  applyMorph(sec) {
    if (this.dead || this.def.ai === 'boss') return;
    this.morphed = sec;
    this.actor.model.visible = false;
    if (!this.pumpkin) {
      this.g.lib.prop('halloween', 'pumpkin_orange_jackolantern').then(p => {
        this.pumpkin = p; p.scale.setScalar(1.3);
        this.actor.root.add(p);
        if (this.morphed <= 0) p.visible = false;
      });
    } else this.pumpkin.visible = true;
    this.g.fx.morphPoof(this.actor.root.position);
    this.g.audio.sfx('morph');
  }
  restoreMorph() {
    if (this.pumpkin) this.pumpkin.visible = false;
    if (this.actor.model) this.actor.model.visible = true;
  }
  applyLevit(sec) { if (this.dead || this.def.ai === 'boss') return; this.levit = sec; }
  applyBurn(sec) { this.burn = Math.max(this.burn, sec); }
  update(dt, t, playerPos, zone) {
    if (this.dead) { this.actor.update(dt, t); return; }
    if (this.burn > 0) {
      this.burn -= dt;
      this._burnTick = (this._burnTick || 0) - dt;
      if (this._burnTick <= 0) { this._burnTick = 0.5; this.takeDamage(3, null); this.g.fx.burst(this.actor.root.position.clone().add(V3(0, 1, 0)), 0xff7038, 6, 0.08); }
    }
    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0) { this.actor.mixer.timeScale = 1; }
      this.actor.update(0, t);
      return;
    }
    if (this.morphed > 0) {
      this.morphed -= dt;
      if (this.morphed <= 0) this.restoreMorph();
      this.pumpkin && (this.pumpkin.rotation.y += dt * 2);
      return;
    }
    if (this.levit > 0) {
      this.levit -= dt;
      this.actor.root.position.y = Math.min(1.8, this.actor.root.position.y + dt * 3);
      this.actor.update(dt, t);
      if (this.levit <= 0) { this.actor.root.position.y = 0; this.g.fx.burst(this.actor.root.position, 0xcfe8ff, 10); }
      return;
    }
    const p = this.actor.root.position;
    const dist = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
    this.atkCd -= dt;
    const ai = this.def.ai;
    const meleeR = 1.7, rangedR = ai === 'ranged' || ai === 'caster' || ai === 'boss' ? 9 : meleeR;
    if (ai === 'dummy') { this.actor.update(dt, t); return; }
    if (dist > rangedR) {
      // 追击
      const spd = this.speed * (ai === 'boss' ? 1.25 : 1);
      p.x += (playerPos.x - p.x) / dist * spd * dt;
      p.z += (playerPos.z - p.z) / dist * spd * dt;
      zone?.clampMove(p, 0.45);
      this.actor.lookAt(playerPos.x, playerPos.z);
      this.actor.setBase('Running_A');
      this.actor.speed = spd;
    } else {
      this.actor.setBase('Idle');
      this.actor.speed = 0;
      this.actor.lookAt(playerPos.x, playerPos.z);
      if (this.atkCd <= 0) {
        this.atkCd = ai === 'boss' ? 1.6 : 2.2 + Math.random() * 0.8;
        if (dist <= meleeR + 0.4 && ai !== 'caster') {
          this.actor.play(['1H_Melee_Attack_Slice_Diagonal', 'Unarmed_Melee_Attack_Punch_A', '2H_Melee_Attack_Chop'][Math.floor(Math.random() * 3)], { once: true, timeScale: 1.3 });
          setTimeout(() => {
            if (this.dead || this.frozen > 0) return;
            const d2 = Math.hypot(this.g.player.pos.x - p.x, this.g.player.pos.z - p.z);
            if (d2 < meleeR + 0.6) this.g.combat.hurtPlayer(this.def.dmg);
          }, 350);
        } else if (ai === 'ranged' || ai === 'caster' || ai === 'boss') {
          this.actor.play('Spellcast_Shoot', { once: true, timeScale: 1.3 });
          const from = p.clone().add(V3(0, 1.4, 0));
          const target = this.g.player.pos.clone().add(V3(0, 1.2, 0));
          const dir = target.sub(from).normalize();
          const col = ai === 'boss' ? 0xd4af37 : 0x9fe07a;
          setTimeout(() => {
            if (this.dead) return;
            this.g.combat.foeBolt(from, dir, this.def.dmg, col);
            this.g.audio.sfx('cast');
          }, 280);
          // Boss 追加行为
          if (ai === 'boss' && this.hp < this.maxHp * 0.55 && Math.random() < 0.4) {
            setTimeout(() => !this.dead && this.g.combat.bossNova(p.clone()), 700);
          }
        }
      }
    }
    this.actor.update(dt, t);
    this.actor.faceUpdate(dt);
  }
}

// ---------- 战斗总管 ----------
export class Combat {
  constructor(game) {
    this.g = game;
    this.enemies = [];
    this.foeShots = [];   // {pos, dir, spd, dmg, mesh}
    this.cds = {};        // spellId -> 剩余
    this.shield = null;   // 激活的护盾 rec
    this.shieldHp = 0;
    this.channeling = null;
    this.lastStandUsed = false;
    this.portalAnchor = null;
  }
  async spawnEnemy(defId, x, z, opts = {}) {
    const def = { ...DUELISTS[defId], ...opts };
    const e = new Enemy(this.g, def, V3(x, 0, z));
    await e.init();
    e.defId = defId;
    this.enemies.push(e);
    return e;
  }
  clearEnemies() {
    for (const e of this.enemies) e.remove();
    this.enemies = [];
    for (const s of this.foeShots) this.g.engine.scene.remove(s.mesh);
    this.foeShots = [];
  }
  liveEnemies() { return this.enemies.filter(e => !e.dead); }
  update(dt, t, zone) {
    this.enemies = this.enemies.filter(e => !e.removed);
    for (const e of this.enemies) e.update(dt, t, this.g.player.pos, zone);
    for (const id of Object.keys(this.cds)) { this.cds[id] -= dt; if (this.cds[id] <= 0) delete this.cds[id]; }
    // 敌方弹体
    for (const s of [...this.foeShots]) {
      s.pos.addScaledVector(s.dir, s.spd * dt);
      s.mesh.position.copy(s.pos);
      s.life -= dt;
      const pp = this.g.player.pos;
      const d = Math.hypot(s.pos.x - pp.x, s.pos.y - (pp.y + 1.2), s.pos.z - pp.z);
      if (d < 0.6) {
        if (this.shield && this.shieldHp > 0) {
          this.shieldHp -= s.dmg;
          this.g.audio.sfx('shield');
          const ds = derivedStats(this.g.gs);
          // 反弹
          const near = this._nearestEnemy(pp, 14);
          if (near) {
            const from = s.pos.clone();
            const dir = near.actor.root.position.clone().add(V3(0, 1.2, 0)).sub(from).normalize();
            this.g.fx.bolt(from, dir, {
              color: 0x8ecbff, speed: 18,
              onStep: (bp) => this._hitEnemyAt(bp, Math.round(s.dmg * ds.reflect), 0.8),
            });
          }
          if (this.shieldHp <= 0) { this.shield.popNow(); this.shield = null; }
        } else {
          this.hurtPlayer(s.dmg);
        }
        s.life = 0;
      }
      if (s.life <= 0) { this.g.engine.scene.remove(s.mesh); this.foeShots.splice(this.foeShots.indexOf(s), 1); }
    }
    // 引导光束伤害
    if (this.channeling) {
      const gs = this.g.gs;
      gs.mp -= 9 * dt;
      this.channelTick = (this.channelTick || 0) - dt;
      if (this.channelTick <= 0) {
        this.channelTick = 0.33;
        const from = this._castOrigin();
        const dir = this.g.player.aimDir();
        // 光束命中最近的路径敌人
        let bestD = 15, bestE = null;
        for (const e of this.liveEnemies()) {
          const to = e.actor.root.position.clone().add(V3(0, 1.2, 0)).sub(from);
          const along = to.dot(dir);
          if (along < 0 || along > 15) continue;
          const perp = to.clone().sub(dir.clone().multiplyScalar(along)).length();
          if (perp < 1.0 && along < bestD) { bestD = along; bestE = e; }
        }
        this.channeling.beamLen = bestE ? bestD : 15;
        if (bestE) {
          const dmg = Math.round(spellDamage(gs, 'beam') * 0.33);
          bestE.takeDamage(dmg, this.g.player.pos);
        }
      }
      if (gs.mp <= 0 || !(this.g.input.mouse.down || this.g.input.down('Digit5'))) this.stopChannel();
    }
  }
  foeBolt(from, dir, dmg, color = 0x9fe07a) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(from);
    this.g.engine.scene.add(mesh);
    this.foeShots.push({ pos: from.clone(), dir, spd: 10, dmg, life: 2.4, mesh });
  }
  bossNova(center) {
    this.g.fx.iceNova(center, { r: 6 });
    this.g.audio.sfx('arc');
    setTimeout(() => {
      const pp = this.g.player.pos;
      if (Math.hypot(pp.x - center.x, pp.z - center.z) < 6 && this.g.player.dodgeT <= 0) this.hurtPlayer(16);
    }, 350);
  }
  hurtPlayer(raw) {
    const gs = this.g.gs;
    if (this.g.player.dodgeT > 0) return; // 闪避无敌帧
    const r = playerHurt(gs, raw);
    this.g.audio.sfx('hurt');
    this.g.player.actor.play('Hit_A', { once: true, fade: 0.06 });
    this.g.shakeCam?.(0.25);
    if (r.dead) {
      const d = derivedStats(gs);
      if (d.lastStand && !this.lastStandUsed) {
        this.lastStandUsed = true;
        gs.hp = 1;
        this.shieldOn(true);
        this.g.ui.toast('不屈意志发动！');
      } else this.g.onPlayerDown?.();
    }
  }
  _castOrigin() {
    const p = this.g.player.pos;
    return V3(p.x, p.y + 1.45, p.z).add(this.g.player.aimDir().multiplyScalar(0.5));
  }
  _nearestEnemy(pos, maxD = 12) {
    let best = null, bd = maxD;
    for (const e of this.liveEnemies()) {
      const d = e.actor.root.position.distanceTo(pos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  _hitEnemyAt(point, dmg, r = 0.8, pierceLeft = 0) {
    for (const e of this.liveEnemies()) {
      const ep = e.actor.root.position;
      const d = Math.hypot(point.x - ep.x, point.y - (ep.y + 1.1), point.z - ep.z);
      if (d < r + 0.55) {
        e.takeDamage(dmg, this.g.player.pos);
        this.g.onEnemyHit?.(e);
        return pierceLeft > 0 ? false : true; // 穿透继续飞
      }
    }
    // 训练假人
    const zone = this.g.zone;
    if (zone?.dummies) {
      for (const dm of zone.dummies) {
        const d = Math.hypot(point.x - dm.position.x, point.z - dm.position.z);
        if (d < 0.8 && point.y > 0.4 && point.y < 2.4) {
          this.g.fx.burst(point, 0xffd27a, 14);
          dm.rotation.z = 0.35;
          setTimeout(() => dm.rotation.z = 0, 300);
          this.g.onDummyHit?.();
          return true;
        }
      }
    }
    return false;
  }
  canCast(id) {
    const gs = this.g.gs;
    const sp = SPELLS[id];
    if (!sp || !gs.knownSpells.includes(id)) return { ok: false, why: '未习得' };
    if (this.cds[id] > 0) return { ok: false, why: '冷却中' };
    if (gs.mp < sp.mp) return { ok: false, why: '魔力不足' };
    return { ok: true, sp };
  }
  cast(id) {
    const c = this.canCast(id);
    if (!c.ok) { if (c.why === '魔力不足') this.g.ui.toast('魔力不足…', true); return false; }
    const gs = this.g.gs;
    const d = derivedStats(gs);
    const sp = c.sp;
    gs.mp -= sp.mp;
    let cd = sp.cd * d.cdMul;
    if (id === 'portal') cd *= d.portalCdMul;
    if (cd > 0) this.cds[id] = cd;
    const from = this._castOrigin();
    const dir = this.g.player.aimDir();
    const P = this.g.player;
    switch (id) {
      case 'bolt': {
        P.castAnim('shoot');
        this.g.audio.sfx('cast');
        let pierce = d.pierce;
        this.g.fx.bolt(from, dir, {
          color: sp.color, speed: 20,
          onStep: (bp) => {
            const hit = this._hitEnemyAt(bp, spellDamage(gs, 'bolt'), 0.7, pierce);
            if (hit === false) { pierce--; return false; }
            return hit;
          },
        });
        this.g.fireQuestEvent('cast:bolt');
        break;
      }
      case 'fire': {
        P.castAnim('raise');
        this.g.audio.sfx('fire');
        this.g.fx.fireCone(from, dir);
        const dmg = spellDamage(gs, 'fire');
        for (const e of this.liveEnemies()) {
          const to = e.actor.root.position.clone().add(V3(0, 1, 0)).sub(from);
          const along = to.dot(dir);
          if (along > 0 && along < 7.5) {
            const perp = to.clone().sub(dir.clone().multiplyScalar(along)).length();
            if (perp < 1.6 + along * 0.35) {
              e.takeDamage(dmg, P.pos);
              e.applyBurn(SPELLS.fire.burn + d.burnExtra);
              this.g.onEnemyHit?.(e);
            }
          }
        }
        this.g.fireQuestEvent('cast:fire');
        break;
      }
      case 'ice': {
        P.castAnim('raise');
        this.g.audio.sfx('ice');
        this.g.fx.iceNova(P.pos.clone(), { r: 5 });
        const dmg = spellDamage(gs, 'ice');
        for (const e of this.liveEnemies()) {
          if (e.actor.root.position.distanceTo(P.pos) < 5.5) {
            e.takeDamage(dmg, P.pos);
            e.applyFreeze(SPELLS.ice.freeze);
            this.g.onEnemyHit?.(e);
          }
        }
        this.g.fireQuestEvent('cast:ice');
        break;
      }
      case 'arc': {
        P.castAnim('shoot');
        this.g.audio.sfx('arc');
        const maxJumps = SPELLS.arc.chain + d.chainExtra;
        const pts = [from];
        let cur = from, exclude = new Set();
        for (let i = 0; i < maxJumps; i++) {
          let best = null, bd = 8;
          for (const e of this.liveEnemies()) {
            if (exclude.has(e)) continue;
            const dd = e.actor.root.position.distanceTo(cur);
            if (dd < bd) { bd = dd; best = e; }
          }
          if (!best) break;
          exclude.add(best);
          cur = best.actor.root.position.clone().add(V3(0, 1.2, 0));
          pts.push(cur);
          best.takeDamage(spellDamage(gs, 'arc'), P.pos);
          this.g.onEnemyHit?.(best);
        }
        if (pts.length === 1) pts.push(from.clone().add(dir.clone().multiplyScalar(6)));
        this.g.fx.arcChain(pts);
        this.g.fireQuestEvent('cast:arc');
        this.g.chargeCheck?.(pts);
        break;
      }
      case 'beam': {
        P.castAnim('channel');
        this.g.audio.sfx('cast');
        this.channeling = this.g.fx.beam(() => this._castOrigin(), () => this.g.player.aimDir(), { color: sp.color });
        break;
      }
      case 'shield': {
        this.shieldOn();
        break;
      }
      case 'levit': {
        P.castAnim('raise');
        this.g.audio.sfx('cast');
        const near = this._nearestEnemy(P.pos.clone().add(dir.clone().multiplyScalar(3)), 4);
        if (near && near.def.hp <= 60) { near.applyLevit(2.2); this.g.fx.levitGlow(near.actor.root, 2.2); }
        this.g.fireQuestEvent('cast:levit');
        this.g.onLevit?.();
        break;
      }
      case 'morph': {
        P.castAnim('raise');
        const near = this._nearestEnemy(P.pos.clone().add(dir.clone().multiplyScalar(3)), 4.5);
        if (near) near.applyMorph(SPELLS.morph.morph);
        else this.g.audio.sfx('morph');
        this.g.fireQuestEvent('cast:morph');
        this.g.onMorph?.();
        break;
      }
      case 'portal': {
        P.castAnim('raise');
        this.g.audio.sfx('portal');
        const dist = SPELLS.portal.blink;
        const target = P.pos.clone().add(V3(dir.x, 0, dir.z).normalize().multiplyScalar(dist));
        this.g.zone?.clampMove(target, 0.5);
        this.g.fx.portal(P.pos.clone(), sp.color, 1.2);
        this.g.fx.portal(target.clone(), sp.color, 1.6);
        setTimeout(() => {
          P.teleport(target.x, target.z);
          this.g.audio.sfx('portal');
        }, 260);
        this.g.fireQuestEvent('cast:portal');
        break;
      }
    }
    this.g.ui2?.refreshSpellbar?.();
    return true;
  }
  shieldOn(free = false) {
    const gs = this.g.gs;
    const d = derivedStats(gs);
    this.g.player.castAnim('raise');
    this.g.audio.sfx('shield');
    this.shieldHp = Math.round(SPELLS.shield.shield * d.shieldMul);
    if (this.shield) this.shield.life = 0;
    this.shield = this.g.fx.shieldDome(() => this.g.player.pos, { dur: 6 });
    this.shield.onEnd = () => { this.shield = null; };
  }
  stopChannel() {
    if (this.channeling) { this.channeling.stop(); this.channeling = null; }
    if (this.g.player.actor.current === 'Spellcasting') this.g.player.actor.play('Idle');
  }
}

// ---------- 决斗流程 ----------
export class DuelManager {
  constructor(game) { this.g = game; this.active = null; }
  async start(foeId, { arena, onWin, onLose, intro } = {}) {
    const g = this.g;
    g.audio.music('duel');
    g.ui.cinema(true);
    if (intro) await g.playNpcDialog(intro.npc, intro.dialog);
    g.ui.cinema(false);
    const zone = g.zone;
    const ring = zone.duelRing || { x: 0, z: 0, r: 6 };
    const e = await g.combat.spawnEnemy(foeId, ring.x, ring.z - ring.r * 0.55);
    e.duel = true;
    this.active = { foe: e, onWin, onLose, ring };
    document.getElementById('duel-hud').classList.remove('hidden');
    document.getElementById('foe-name').textContent = e.def.name;
    e.onDeath = () => this._end(true);
    g.ui.centerTitle('⚔ 决斗开始 ⚔', 1800);
    g.audio.sfx('quest');
  }
  update() {
    if (!this.active) return;
    const { foe } = this.active;
    document.getElementById('bar-foe').style.width = Math.max(0, foe.hp / foe.maxHp * 100) + '%';
    if (this.g.gs.hp <= 0) this._end(false);
  }
  _end(won) {
    if (!this.active) return;
    const { onWin, onLose, foe } = this.active;
    this.active = null;
    document.getElementById('duel-hud').classList.add('hidden');
    this.g.audio.music(this.g.currentMood || 'castle');
    if (won) {
      this.g.gs.stats.duelsWon++;
      this.g.ui.centerTitle('✦ 决斗胜利 ✦');
      this.g.audio.sfx('levelup');
      onWin?.();
    } else {
      this.g.ui.centerTitle('决斗失败…');
      onLose?.();
    }
  }
}
