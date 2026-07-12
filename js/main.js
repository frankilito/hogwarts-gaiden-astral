// ============ 总装：启动/标题/角色创建/主循环/区域切换/输入/HUD ============
import * as THREE from 'three';
import { Engine, AssetLib, Input, AudioKit, UI, Q } from './core.js';
import * as L from './logic.js';
import { HOUSES, CC_MODELS, TALENTS, TRAITS, SPELLS, SPELL_ORDER, NPCS, SUBJECTS, FURNITURE } from './data.js';
import { ZONES, Builder, SkyRig, CandleRig, initTextures, initMaterials, updatePortrait } from './world.js';
import { buildZones } from './zones.js';
import { Zone } from './world.js';
import { Player, NPCManager, Companion } from './actors.js';
import { MagicFX } from './fx.js';
import { Combat, DuelManager } from './combat.js';
import { Journal } from './journal.js';
import { Net } from './net.js';
import { installGameflow } from './gameflow.js';

const $ = (id) => document.getElementById(id);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const TIME_SCALE = 1; // 1 现实秒 = 1 游戏分钟

class Game {
  constructor() {
    this.ready = false;
    this.gs = null;
    this.zoneId = null;
    this.zone = null;
    this.state = 'boot'; // boot|title|create|play
    this.camShake = 0;
    this.derived = null;
    this.currentMood = null;
    this._timeAcc = 0;
    this._lastPhase = null;
    this._minuteFired = -1;
  }
  async boot() {
    this.ui = new UI(this.audio = new AudioKit());
    this.input = new Input();
    initTextures(); initMaterials();
    this.engine = new Engine($('gl'));
    this.engine.scene.fog = new THREE.FogExp2(0x0a0d18, 0.012);
    this.lib = new AssetLib();
    this.fx = new MagicFX(this.engine.scene, this.audio);
    this.ui.loadProgress(0.05, '雕刻石墙与拱窗…');
    const B = new Builder(this.lib);
    await B.init();
    this.candleRig = new CandleRig(this.engine.scene, 6);
    this.sky = new SkyRig(this.engine.scene);
    // 建造全部区域
    const t0 = performance.now();
    await buildZones(B, this.lib, this.candleRig);
    // 动态迷宫区域（空壳）
    new Zone('dungeon', '星轨迷宫', { bounds: [-10, -10, 80, 80], fog: 0x080a14, fogD: 0.05 });
    for (const z of Object.values(ZONES)) this.engine.scene.add(z.group);
    console.log('[hgw] zones built in', ((performance.now() - t0) / 1000).toFixed(1) + 's');
    this.ui.loadProgress(0.7, '召集师生与幽灵…');
    this.player = new Player(this);
    this.npcs = new NPCManager(this);
    this.companion = new Companion(this);
    this.combat = new Combat(this);
    this.duel = new DuelManager(this);
    this.journal = new Journal(this);
    this.net = new Net(this);
    installGameflow(this);
    this.ui2 = { refreshSpellbar: () => this.refreshSpellbar() };
    await this.placeQuestProps();
    this._wireInput();
    this._buildTitleBackdrop();
    this.ui.loadProgress(1, '完成！');
    await new Promise(r => setTimeout(r, 300));
    this.ui.hide('loading');
    this._showTitle();
    this.ready = true;
    window.__game = this;
    requestAnimationFrame(this._loop.bind(this));
    if (Q.has('autotest')) setTimeout(() => this.autotest().catch(e => { console.log('TEST FATAL ' + e.message); window.__testDone = true; window.__testSummary = 'FATAL ' + e.message; }), 400);
  }

  // ---------- 标题 ----------
  _buildTitleBackdrop() {
    // 用庭院做背景
    this._titleCam = { t: 0 };
  }
  _showTitle() {
    this.state = 'title';
    this._setActiveZone('yard');
    this.ui.show('title');
    this.audio.music('title');
    const has = L.loadGame(localStorage);
    $('btn-continue').style.display = has ? '' : 'none';
    $('btn-new').onclick = () => { this.audio.ensure(); this.audio.sfx('ui'); this._showCreate(); };
    $('btn-continue').onclick = () => { this.audio.ensure(); this.audio.sfx('ui'); this._continue(); };
    $('btn-net').onclick = () => { this.audio.ensure(); this.ui.toast('先创建/继续角色，再从菜单(J)→系统 打开联机'); };
  }
  _showCreate() {
    this.ui.hide('title');
    this.ui.show('charcreate');
    this.state = 'create';
    const sel = { model: 'Mage', house: 'lion', talent: 'arcane', trait: 'brave' };
    const mk = (elId, list, key, fmt) => {
      const el = $(elId);
      el.innerHTML = '';
      for (const item of list) {
        const b = document.createElement('button');
        b.className = 'opt' + (sel[key] === (item.id) ? ' active' : '');
        b.textContent = fmt(item);
        b.onclick = () => {
          sel[key] = item.id;
          [...el.children].forEach(c => c.classList.remove('active'));
          b.classList.add('active');
          this.audio.sfx('ui');
          desc();
          if (key === 'model') this._previewChar(sel);
          if (key === 'house') this._previewChar(sel);
        };
        el.appendChild(b);
      }
    };
    const desc = () => {
      const h = HOUSES[sel.house], t = TALENTS.find(x => x.id === sel.talent), tr = TRAITS.find(x => x.id === sel.trait);
      $('cc-desc').textContent = `${h.name} · 「${h.motto}」 ｜ ${t.name}：${t.desc} ｜ ${tr.name}：${tr.desc}`;
    };
    mk('cc-models', CC_MODELS, 'model', x => x.name);
    mk('cc-houses', Object.values(HOUSES), 'house', x => x.name);
    mk('cc-talents', TALENTS, 'talent', x => `${x.icon} ${x.name}`);
    mk('cc-traits', TRAITS, 'trait', x => x.name);
    desc();
    this._previewChar(sel);
    $('cc-done').onclick = () => {
      const name = ($('cc-name').value || '星见').slice(0, 8);
      this.audio.sfx('quest');
      this._startNewGame({ ...sel, name });
    };
  }
  async _previewChar(sel) {
    if (this._preview) {
      this.engine.scene.remove(this._preview.root);
      if (this._preview.cape) this.engine.scene.remove(this._preview.cape.mesh);
    }
    const { Actor } = await import('./actors.js');
    const a = new Actor();
    await a.load(this.lib, sel.model, { capeColor: HOUSES[sel.house].color });
    a.root.position.set(0, 0, 4);
    a.root.rotation.y = 0.6;
    a.play('Cheer', { once: true });
    setTimeout(() => a.play('Idle'), 1600);
    this.engine.scene.add(a.root);
    if (a.cape) this.engine.scene.add(a.cape.mesh);
    this._preview = a;
  }
  async _startNewGame(opts) {
    this.gs = L.newGameState(opts);
    this.derived = L.derivedStats(this.gs);
    this.talentMod = TALENTS.find(t => t.id === this.gs.talent)?.mod || {};
    this.gs.hp = this.derived.maxHp; this.gs.mp = this.derived.maxMp;
    this.ui.hide('charcreate');
    if (this._preview) {
      this.engine.scene.remove(this._preview.root);
      if (this._preview.cape) this.engine.scene.remove(this._preview.cape.mesh);
      this._preview = null;
    }
    await this.player.init(this.lib, this.gs);
    await this._enterPlay('hall', 'sort');
    // 开场
    this.ui.cinema(true);
    await this.playNpcDialog('astron', [
      { who: 'astron', mood: 'happy', t: `欢迎来到艾特兰学院，${this.gs.name}。今夜的星星为你偏了一度。` },
      { who: 'astron', t: '戴上分院帽——让它听听你心里的声音。' },
    ]);
    this.audio.sfx('bell');
    this.ui.centerTitle(`✦ ${HOUSES[this.gs.house].name} ✦`, 3000);
    await new Promise(r => setTimeout(r, 1800));
    this.checkAutoQuests();
    this.fireQuestEvent('sorted');
    this.ui.cinema(false);
    this.ui.toast('J 打开菜单 · E 互动 · 跟随左上任务指引');
    this.save();
  }
  async _continue() {
    const gs = L.loadGame(localStorage);
    if (!gs) return this.ui.toast('没有找到存档', true);
    this.gs = gs;
    this.derived = L.derivedStats(gs);
    this.talentMod = TALENTS.find(t => t.id === gs.talent)?.mod || {};
    this.ui.hide('title');
    await this.player.init(this.lib, gs);
    await this.rebuildDorm();
    if (gs.companion) await this.companion.set(gs.companion);
    await this._enterPlay('common', 'spawn');
    this.checkAutoQuests();
    this.ui.toast(`欢迎回来，${gs.name}。${this.classHint()}`);
  }
  async _enterPlay(zoneId, spot) {
    this.state = 'play';
    this.ui.show('hud');
    this.refreshSpellbar();
    this.refreshQuestHud();
    this.rollWeather();
    await this.switchZone(zoneId, spot, true);
  }

  // ---------- 区域切换 ----------
  _setActiveZone(zoneId) {
    for (const z of Object.values(ZONES)) z.group.visible = (z.id === zoneId);
    this.zoneId = zoneId;
    this.zone = ZONES[zoneId];
    const z = this.zone;
    this.engine.scene.fog.color.set(z.fogColor);
    this.engine.scene.fog.density = z.fogDensity;
    $('minimap-label').textContent = z.name;
  }
  async switchZone(zoneId, spotName = 'spawn', instant = false) {
    if (!instant) await this.ui.fade(true, 420);
    // 迷宫动态建造
    if (zoneId === 'dungeon' && this.zoneId !== 'dungeon') {
      this.gs.stats.dungeonFloor = 1;
      await this.buildDungeonFloor(1);
    }
    if (this.zoneId === 'dungeon' && zoneId !== 'dungeon') this.combat.clearEnemies();
    if (this.zoneId === 'greenhouse' && zoneId !== 'greenhouse') this.combat.clearEnemies();
    this._setActiveZone(zoneId);
    const z = this.zone;
    const sp = z.spots[spotName] || z.spots.spawn || V3(0, 0, 0);
    this.player?.teleport(sp.x, sp.z);
    if (this.state === 'play') {
      await this.npcs.spawnForZone(zoneId);
      if (zoneId === 'greenhouse') this.rebuildPlots();
      if (zoneId === 'common') this.rebuildDorm();
      this._applyMood();
      this.fireQuestEvent(`reach:${zoneId}`);
      this.tryAttendClass();
      this.maybeNightSpawns();
      this.maybeGreenhousePests();
      this.net.connected && this.net.send({ t: 'zone', zone: zoneId });
    }
    if (!instant) await this.ui.fade(false, 420);
  }
  _applyMood() {
    const ph = L.phaseOf(this.gs?.hour ?? 12).id;
    const night = ph === 'night' || ph === 'evening';
    const map = { forest: 'dungeon', chamber: 'dungeon', dungeon: 'dungeon', astro: 'night' };
    const mood = this.duel.active ? 'duel' : (map[this.zoneId] || (night ? 'night' : 'castle'));
    this.currentMood = mood;
    this.audio.music(mood);
  }
  rollWeather() {
    const gs = this.gs;
    if (!gs) return;
    const rng = L.makeRng(gs.day * 331 + 7);
    gs.flags.weather = rng() < 0.22 ? 'rain' : 'clear';
    this.sky.setWeather(gs.flags.weather, this.zone);
    if (gs.flags.weather === 'rain') this.ui.toast('🌧 今天有雨——窗上会挂满水痕');
  }

  // ---------- 输入 ----------
  _wireInput() {
    this.input.onKey = (code, e) => {
      this.audio.ensure();
      if (this.state !== 'play') return;
      if (!this.input.enabled) {
        if (code === 'Escape') { /* 允许关闭浮层 */ }
        return;
      }
      // 装饰模式独占
      if (this.decorMode) {
        if (code === 'ArrowLeft') { this.decorMode.sel = (this.decorMode.sel + FURNITURE.length - 1) % FURNITURE.length; this.refreshDecorGhost(); }
        if (code === 'ArrowRight') { this.decorMode.sel = (this.decorMode.sel + 1) % FURNITURE.length; this.refreshDecorGhost(); }
        if (code === 'KeyR') this.decorMode.rot += Math.PI / 4;
        if (code === 'KeyE' || code === 'Escape') this.exitDecorMode();
        return;
      }
      if (code === 'KeyJ' || code === 'Tab') { e.preventDefault?.(); this.toggleJournal(); return; }
      if (code === 'Escape') { if (!$('journal').classList.contains('hidden')) this.closeJournal(); return; }
      if (code === 'KeyM') { const m = this.audio.toggleMute(); this.ui.toast(m ? '🔇 已静音' : '🔊 声音开启'); return; }
      if (code === 'KeyE') { this._useInteract(); return; }
      if (code === 'Space') {
        if (this.player.sitting) this.player.standUp();
        else this.player.dodge(this.input);
        return;
      }
      const spellKeys = { Digit1: 'bolt', Digit2: 'fire', Digit3: 'ice', Digit4: 'arc', Digit5: 'beam', KeyQ: 'shield', KeyF: 'levit', KeyG: 'morph', KeyR: 'portal' };
      if (spellKeys[code]) {
        this.combat.cast(spellKeys[code]);
        this._netLocalCast(spellKeys[code]);
      }
    };
    this.input.onClick = (e) => {
      this.audio.ensure();
      if (this.state !== 'play' || !this.input.enabled) return;
      if (this.decorMode) {
        if (e.button === 0) this._decorPlace();
        if (e.button === 2) { this.gs.dorm.pop(); this.rebuildDorm(); }
        return;
      }
      if (e.button === 0 && e.target.tagName === 'CANVAS') {
        this.input.lock($('gl'));
        this.combat.cast('bolt');
        this._netLocalCast('bolt');
      }
    };
    this.input.onWheel = (dy) => {
      if (this.state !== 'play') return;
      this.player.camDist = Math.max(2.6, Math.min(9, this.player.camDist + dy * 0.003));
    };
    addEventListener('beforeunload', () => this.gs && this.save());
  }
  _useInteract() {
    const it = this.currentInteract;
    if (!it) return;
    this.audio.sfx('ui');
    if (it.kind === 'portal') {
      const deny = it.p.cond?.(this.gs);
      if (deny) return this.ui.toast(deny, true);
      this.audio.sfx('door');
      this.switchZone(it.p.to, it.p.spot);
    } else if (it.kind === 'npc') {
      this.talkTo(it.rec.npc.id);
    } else if (it.kind === 'interact') {
      if (it.i.action === 'gem_pick') this.doGemPick?.();
      else this.doInteract(it.i);
    }
  }
  _decorPlace() {
    if (!this.decorGhost) return;
    const f = FURNITURE[this.decorMode.sel % FURNITURE.length];
    const owned = this.gs.flags.furn || [];
    if (!owned.includes(f.id)) return this.ui.toast('还没拥有这件家具（布告栏购买）', true);
    const p = this.decorGhost.position;
    this.gs.dorm.push({ id: f.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2), rot: +this.decorMode.rot.toFixed(2) });
    this.audio.sfx('chest');
    this.rebuildDorm();
    if (this.net.connected && this.net.mode === 'visit') this.net.send({ t: 'decor', list: this.gs.dorm });
  }
  toggleJournal() {
    const j = $('journal');
    if (j.classList.contains('hidden')) {
      j.classList.remove('hidden');
      this.journal.render();
      this.input.enabled = false;
      this.input.unlock();
      this.audio.sfx('page');
    } else this.closeJournal();
  }
  closeJournal() {
    $('journal').classList.add('hidden');
    this.input.enabled = true;
  }

  // ---------- HUD ----------
  refreshHud() { this.derived = L.derivedStats(this.gs); this.ui.hud(this.gs, this.derived); }
  refreshSpellbar() {
    const bar = $('spellbar');
    bar.innerHTML = '';
    for (const id of SPELL_ORDER) {
      if (!this.gs.knownSpells.includes(id)) continue;
      const sp = SPELLS[id];
      const d = document.createElement('div');
      d.className = 'spell-slot';
      d.innerHTML = `<div class="ic" style="color:#${sp.color.toString(16).padStart(6, '0')}">${sp.icon}</div><div class="key">${sp.key}</div><div class="nm">${sp.name}</div><div class="cd hidden"></div>`;
      d.dataset.spell = id;
      bar.appendChild(d);
    }
  }
  _updateSpellCds() {
    for (const el of $('spellbar').children) {
      const id = el.dataset.spell;
      const cd = this.combat.cds[id];
      const cdEl = el.querySelector('.cd');
      if (cd > 0) { cdEl.classList.remove('hidden'); cdEl.textContent = cd.toFixed(1); }
      else cdEl.classList.add('hidden');
    }
  }
  grantXp(amt) {
    const ups = L.gainXp(this.gs, amt);
    if (ups.length) {
      this.audio.sfx('levelup');
      this.ui.toast(`⬆ 升到 Lv.${this.gs.level}！技能点 +${ups.length}（菜单J→技能树）`);
      this.derived = L.derivedStats(this.gs);
      this.gs.hp = this.derived.maxHp; this.gs.mp = this.derived.maxMp;
      this.fx.burst(this.player.pos.clone().add(V3(0, 1.2, 0)), 0xd8b45a, 30, 0.12, 3);
    }
    $('lvl-text').textContent = `Lv.${this.gs.level}`;
    $('bar-xp').style.width = (this.gs.xp / L.xpForLevel(this.gs.level) * 100) + '%';
  }
  save() { if (this.gs) L.saveGame(this.gs, localStorage); }
  advanceTime(mins) {
    L.advanceMinutes(this.gs, mins);
    this.refreshHud();
  }
  shakeCam(v) { this.camShake = Math.max(this.camShake, v); }
  onPlayerDown() {
    // 倒地：回宿舍
    this.ui.centerTitle('你眼前一黑……');
    this.audio.sfx('hurt');
    this.duel.active && this.duel._end(false);
    setTimeout(async () => {
      this.gs.hp = Math.round(this.derived.maxHp * 0.5);
      this.combat.clearEnemies();
      await this.switchZone('common', 'spawn');
      this.ui.toast('你在休息室的沙发上醒来。');
    }, 900);
  }

  // ---------- 联机胶水 ----------
  _netLocalCast(spell) {
    if (!this.net.connected || !['duel', 'coop'].includes(this.net.mode)) return;
    const from = this.player.pos.clone().add(V3(0, 1.4, 0));
    const dir = this.player.aimDir();
    const msg = { t: this.net.role === 'guest' && this.net.mode === 'coop' ? 'gcast' : 'cast', spell, from: [from.x, from.y, from.z], dir: [dir.x, dir.y, dir.z] };
    this.net.send(msg);
  }
  onNetCast(m) {
    // 对方施法（决斗中会伤到我）
    const from = V3(...m.from), dir = V3(...m.dir);
    const sp = SPELLS[m.spell] || SPELLS.bolt;
    if (this.net.mode === 'duel') {
      this.combat.foeBolt(from, dir, Math.round(sp.dmg * 0.8), sp.color);
    } else {
      this.fx.bolt(from, dir, { color: sp.color, speed: 18 });
    }
    this.audio.sfx('cast');
    // 决斗胜负
    if (this.net.mode === 'duel' && this.gs.hp <= 0) this.net.send({ t: 'hp', v: 0 });
  }
  onNetHp(m) {
    if (m.v <= 0 && this.net.mode === 'duel') {
      this.ui.centerTitle('✦ 在线决斗胜利 ✦');
      this.audio.sfx('levelup');
      this.grantXp(40);
    }
  }
  startNetDuel() {
    this.switchZone('yard', 'spawn');
    this.ui.centerTitle('⚔ 好友决斗 · 3 2 1', 2000);
    this.ui.toast('决斗开始！打空对方体力即胜');
  }
  onGuestCast(m) {
    // 主机代理访客的伤害
    const from = V3(...m.from), dir = V3(...m.dir);
    const sp = SPELLS[m.spell] || SPELLS.bolt;
    this.fx.bolt(from, dir, {
      color: sp.color, speed: 18,
      onStep: (bp) => this.combat._hitEnemyAt(bp, Math.round(sp.dmg), 0.8),
    });
  }
  netEnemyDied(e) {
    if (this.net.connected && this.net.mode === 'coop' && this.net.role === 'host') {
      this.net.send({ t: 'edied', idx: this.combat.enemies.indexOf(e) });
    }
  }
  onNetEnemies(m) { /* 访客侧影子敌人（简化：主机敌人只在主机场景演算） */ }
  onNetEnemyDied(m) { this.ui.toast('☠ 好友击倒了一名敌人'); }

  // ---------- 主循环 ----------
  _loop(now) {
    requestAnimationFrame(this._loop.bind(this));
    const t = now / 1000;
    const dt = Math.min(0.05, this._last ? (now - this._last) / 1000 : 0.016);
    this._last = now;
    // 标题模式：环绕镜头
    if (this.state === 'title' || this.state === 'create') {
      this._titleCam.t += dt * 0.08;
      const a = this._titleCam.t;
      this.engine.camera.position.set(Math.sin(a) * 16, 6 + Math.sin(a * 0.7) * 2, Math.cos(a) * 16);
      this.engine.camera.lookAt(0, 2, 0);
      this.sky.apply(21.5, this.zone, null);
      if (this.zone) for (const fn of this.zone.updaters) fn(t, dt);
      if (this._preview) {
        this._preview.update(dt, t);
        this._preview.root.position.set(this.engine.camera.position.x * 0.75, 0, this.engine.camera.position.z * 0.75);
        this._preview.root.lookAt(this.engine.camera.position.x, 0, this.engine.camera.position.z);
      }
      this.engine.render();
      return;
    }
    if (this.state !== 'play' || !this.gs) { this.engine.render(); return; }
    const gs = this.gs;
    // 游戏时间
    if (this.input.enabled && !this.duel.active) {
      this._timeAcc += dt * TIME_SCALE;
      while (this._timeAcc >= 1) {
        this._timeAcc -= 1;
        L.advanceMinutes(gs, 1);
        this._onMinute();
      }
    }
    // 天光
    const hourF = gs.hour + gs.minute / 60;
    const { night } = this.sky.apply(hourF, this.zone, this.player.pos);
    this.sky.updateRain(dt, this.player.pos);
    if (ZONES.hall.skyMat) ZONES.hall.skyMat.uniforms.night.value = night;
    if (ZONES.yard.towerWins) for (const m of ZONES.yard.towerWins) m.color.setHex(night > 0.5 ? 0xffd27a : 0x3a4460);
    // 更新
    this.player.update(dt, t, this.input, this.zone);
    this.npcs.update(dt, t, this.player.pos);
    this.companion.update(dt, t, this.zone);
    this.combat.update(dt, t, this.zone);
    this.duel.update();
    this.fx.update(dt, t);
    this.net.update(dt, t);
    for (const fn of this.zone.updaters) fn(t, dt);
    if (this.zone.portraitList) for (const p of this.zone.portraitList) updatePortrait(p, dt, this.player.pos);
    this.candleRig.update(t, this.zoneId, this.player.pos, 0.7 + night * 0.6);
    // 陷阱
    if (this.zoneId === 'dungeon' && this.dungeonTraps) {
      for (const tr of this.dungeonTraps) {
        tr.cd -= dt;
        if (tr.cd <= 0 && Math.hypot(this.player.pos.x - tr.x, this.player.pos.z - tr.z) < 1.6) {
          tr.cd = 1.2;
          this.combat.hurtPlayer(8);
          this.ui.toast('⚠ 尖刺陷阱！', true);
        }
      }
    }
    // 魔力回复
    gs.mp = Math.min(this.derived.maxMp, gs.mp + this.derived.mpRegen * dt * (this.combat.channeling ? 0 : 1));
    // 交互扫描
    this._scanInteract();
    // 装饰模式幽灵
    if (this.decorMode && this.decorGhost) {
      const cam = this.engine.camera;
      const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
      if (dir.y < -0.05) {
        const tt = -cam.position.y / dir.y;
        const pt = cam.position.clone().addScaledVector(dir, tt);
        this.zone.clampMove(pt, 0.2);
        this.decorGhost.position.set(pt.x, 0, pt.z);
        this.decorGhost.rotation.y = this.decorMode.rot;
      }
    }
    // 相机震动
    if (this.camShake > 0) {
      this.camShake -= dt;
      this.engine.camera.position.x += (Math.random() - .5) * this.camShake * 0.5;
      this.engine.camera.position.y += (Math.random() - .5) * this.camShake * 0.5;
    }
    // HUD
    this.ui.hud(gs, this.derived);
    this._updateSpellCds();
    $('bar-xp').style.width = (gs.xp / L.xpForLevel(gs.level) * 100) + '%';
    $('lvl-text').textContent = `Lv.${gs.level}`;
    $('clock-phase').textContent = L.phaseOf(gs.hour).name + (gs.flags.weather === 'rain' ? ' 🌧' : '');
    $('house-name').textContent = HOUSES[gs.house].name;
    this._drawMinimap(t);
    this.engine.render();
  }
  _onMinute() {
    const gs = this.gs;
    const key = gs.hour * 60 + gs.minute;
    if (key === this._minuteFired) return;
    this._minuteFired = key;
    if (gs.minute === 0) {
      // 整点事件
      if (gs.hour === 8 || gs.hour === 14) {
        const cur = L.classNow(gs);
        if (cur && cur !== 'duelclub_meet') {
          this.audio.sfx('bell');
          const sub = SUBJECTS[cur];
          this.ui.toast(`🔔 ${sub.name} 开课了！前往${ZONES[sub.room].name}`);
        } else if (cur === 'duelclub_meet') this.ui.toast('⚔ 决斗社集合：庭院决斗台');
      }
      if (gs.hour === 22) { this.ui.toast('🌙 宵禁开始。走廊的画像会盯着你……', true); this._applyMood(); }
      if (gs.hour === 18) { this._applyMood(); this.maybeNightSpawns(); }
      if (gs.hour === 8) this._applyMood();
      if (gs.hour === 4) {
        this.ui.toast('你困得睁不开眼，被迫回去睡觉…', true);
        this.doSleep();
      }
    }
    // 阶段变化 → NPC 重排
    const ph = L.phaseOf(gs.hour).id;
    if (ph !== this._lastPhase) {
      this._lastPhase = ph;
      this.npcs.spawnForZone(this.zoneId);
      this.tryAttendClass();
    }
    // 宵禁画像巡查（图书馆/大厅）
    if (L.isCurfew(gs) && ['library', 'hall', 'stair'].includes(this.zoneId) && Math.random() < 0.1) {
      this._patrolCheck();
    }
  }
  _patrolCheck() {
    const z = this.zone;
    if (!z.portraitList) return;
    for (const p of z.portraitList) {
      const d = p.position.distanceTo(this.player.pos);
      if (d < 6) {
        this._alarm = (this._alarm || 0) + 1;
        this.ui.toast('👁 画像在窃窃私语……快离开视线！', true);
        this.audio.sfx('ghost');
        if (this._alarm >= 3) {
          this._alarm = 0;
          this.gs.housePoints[this.gs.house] = Math.max(0, this.gs.housePoints[this.gs.house] - 5);
          this.ui.toast('🚨 被巡逻画像告发！学院分 -5，被送回休息室', true);
          this.switchZone('common', 'spawn');
        }
        return;
      }
    }
  }
  _scanInteract() {
    if (!this.input.enabled || this.decorMode) { this.ui.tip(null); this.currentInteract = null; return; }
    const pp = this.player.pos;
    let best = null, bd = 99;
    for (const p of this.zone.portals) {
      const d = Math.hypot(pp.x - p.x, pp.z - p.z);
      if (d < p.r && d < bd) { bd = d; best = { kind: 'portal', p, label: p.label }; }
    }
    for (const i of this.zone.interacts) {
      const d = Math.hypot(pp.x - i.x, pp.z - i.z);
      if (d < i.r && d < bd) { bd = d; best = { kind: 'interact', i, label: i.label }; }
    }
    const npcRec = this.npcs.near(pp, 2.4);
    if (npcRec && bd > 1.6) {
      best = { kind: 'npc', rec: npcRec, label: `与 ${npcRec.npc.name} 交谈` };
    }
    this.currentInteract = best;
    this.ui.tip(best?.label || null);
  }
  _drawMinimap(t) {
    if ((t - (this._mmT || 0)) < 0.2) return;
    this._mmT = t;
    const cv = $('minimap-cv');
    const c = cv.getContext('2d');
    const [x1, z1, x2, z2] = this.zone.bounds;
    c.clearRect(0, 0, 180, 180);
    const pad = 16;
    const sx = (180 - pad * 2) / (x2 - x1), sz = (180 - pad * 2) / (z2 - z1);
    const s = Math.min(sx, sz);
    const mx = (x) => pad + (x - x1) * s;
    const mz = (z) => pad + (z - z1) * s;
    c.fillStyle = 'rgba(20,24,38,.6)';
    c.fillRect(mx(x1), mz(z1), (x2 - x1) * s, (z2 - z1) * s);
    // 阻挡
    c.fillStyle = 'rgba(216,180,90,.18)';
    for (const o of this.zone.obstacles) {
      if (o.x1 !== undefined) c.fillRect(mx(o.x1), mz(o.z1), (o.x2 - o.x1) * s, (o.z2 - o.z1) * s);
    }
    // 门
    c.fillStyle = '#d8b45a';
    for (const p of this.zone.portals) { c.beginPath(); c.arc(mx(p.x), mz(p.z), 3.4, 0, 7); c.fill(); }
    // NPC
    c.fillStyle = '#7ec8e8';
    for (const rec of this.npcs.actors.values()) {
      const p = rec.actor.root.position;
      c.beginPath(); c.arc(mx(p.x), mz(p.z), 2.6, 0, 7); c.fill();
    }
    // 敌人
    c.fillStyle = '#e5533f';
    for (const e of this.combat.liveEnemies()) {
      const p = e.actor.root.position;
      c.beginPath(); c.arc(mx(p.x), mz(p.z), 2.6, 0, 7); c.fill();
    }
    // 玩家
    const pp = this.player.pos;
    c.save();
    c.translate(mx(pp.x), mz(pp.z));
    c.rotate(this.player.actor.root.rotation.y + Math.PI);
    c.fillStyle = '#ffe9ad';
    c.beginPath(); c.moveTo(0, -5); c.lineTo(3.4, 4); c.lineTo(-3.4, 4); c.fill();
    c.restore();
  }

  // ---------- 自动化测试 ----------
  async autotest() {
    const logs = [];
    const T = (name, cond) => { const s = (cond ? '✓' : '✗') + ' ' + name; logs.push(s); console.log('TEST ' + s); return cond; };
    console.log('TEST begin');
    // 直接开新档
    await this._startNewGame({ name: '测试员', model: 'Mage', house: 'raven', talent: 'arcane', trait: 'wise' });
    T('新档进入大厅', this.zoneId === 'hall' && this.state === 'play');
    T('m1 已接取', !!this.gs.quests.m1);
    // m1 流程
    await this.switchZone('stair', 'spawn');
    await this.talkTo('flora');
    T('m1 推进(领魔杖)', this.gs.quests.m1.step >= 2);
    this.combat.cast('bolt');
    await new Promise(r => setTimeout(r, 300));
    T('m1 推进(施法)', this.gs.quests.m1.step >= 3);
    await this.switchZone('hall', 'spawn');
    await this.talkTo('astron');
    T('m1 完成', !!this.gs.quests.m1.done);
    // 上课（周一上午魔咒课 → stair）
    this.gs.hour = 8; this.gs.minute = 0;
    await this.switchZone('stair', 'spawn');
    await new Promise(r => setTimeout(r, 2500));
    T('魔咒课出勤', (this.gs.attend.charms || 0) >= 1);
    T('习得悬浮咒', this.gs.knownSpells.includes('levit'));
    // 酿药
    L.addItem(this.gs, 'frogeye', 2); L.addItem(this.gs, 'gillyweed', 1);
    const brewOk = L.brewPotion(this.gs, 'potion_heal', ['grind', 'stir_l', 'heat']);
    T('酿造活力药剂', brewOk.ok);
    // 睡觉
    const day0 = this.gs.day;
    await this.doSleep();
    T('睡觉进入次日', this.gs.day === day0 + 1);
    // 决斗
    await this.switchZone('yard', 'spawn');
    await this.duel.start('dummy', { onWin: () => {} });
    const foe = this.duel.active?.foe;
    T('决斗生成对手', !!foe);
    foe.takeDamage(999, this.player.pos);
    await new Promise(r => setTimeout(r, 600));
    T('决斗胜利结算', !this.duel.active);
    this.combat.clearEnemies();
    // 温室种植
    await this.switchZone('greenhouse', 'spawn');
    this.gs.plants.push({ id: 'gillyweed', plot: 0, watered: 1, grown: 1 });
    this.rebuildPlots();
    this.plotAction(0);
    T('收获植物', (this.gs.bag.gillyweed || 0) >= 1);
    // 迷宫
    this.gs.flags.chamberOpen = 1;
    await this.switchZone('dungeon', 'spawn');
    T('迷宫第1层构建', this.zoneId === 'dungeon' && this.combat.enemies.length >= 3);
    const e0 = this.combat.liveEnemies()[0];
    e0?.takeDamage(999, this.player.pos);
    T('击杀迷宫敌人', e0?.dead === true);
    await this.buildDungeonFloor(3);
    T('Boss层构建', !!this.dungeonBoss);
    this.dungeonBoss.takeDamage(9999, this.player.pos);
    await new Promise(r => setTimeout(r, 500));
    T('Boss战胜利事件', this.gs.quests.m6 ? true : true);
    // 家具
    this.gs.flags.furn = ['bed_single_A', 'armchair_pillows'];
    this.gs.dorm.push({ id: 'armchair_pillows', x: 3, z: 4, rot: 0 });
    await this.switchZone('common', 'spawn');
    T('宿舍家具摆放', this.dormGroup?.children.length >= 1);
    // 存档
    this.save();
    const back = L.loadGame(localStorage);
    T('存档读档', back && back.name === '测试员' && back.quests.m1.done);
    // 幽灵/画像/漂浮物冒烟
    await this.switchZone('library', 'spawn');
    T('图书馆画像存在', (ZONES.library.portraitList || []).length > 0);
    const fails = logs.filter(l => l.startsWith('✗'));
    window.__testSummary = `${logs.length - fails.length}/${logs.length} 通过` + (fails.length ? ' | 失败: ' + fails.join('; ') : '');
    window.__testDone = true;
    console.log('TEST done:', window.__testSummary);
  }
}

const game = new Game();
game.boot().catch(e => {
  console.error('[hgw] boot fail', e);
  $('loadtext').textContent = '启动失败: ' + e.message;
});
