// ============ 联机：PeerJS P2P（线上）+ 本地 WS 中继（局域网） ============
import * as THREE from 'three';
import { Actor } from './actors.js';
import { HOUSES } from './data.js';

const $ = (id) => document.getElementById(id);
const PREFIX = 'hgw-astral-';

export class Net {
  constructor(game) {
    this.g = game;
    this.mode = 'visit';
    this.role = null;      // host | guest
    this.conn = null;      // peerjs DataConnection 或 ws
    this.channel = null;   // 'peer' | 'ws'
    this.remote = null;    // 远端玩家替身
    this.sendT = 0;
    this.connected = false;
    this._bindPanel();
  }
  _bindPanel() {
    document.querySelectorAll('.netmode').forEach(b => b.onclick = () => {
      document.querySelectorAll('.netmode').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      this.mode = b.dataset.m;
    });
    $('net-host').onclick = () => this.start(true);
    $('net-join').onclick = () => this.start(false);
    $('net-close').onclick = () => this.closePanel();
  }
  openPanel() { $('netpanel').classList.remove('hidden'); this.g.input.enabled = false; }
  closePanel() { $('netpanel').classList.add('hidden'); this.g.input.enabled = true; }
  status(s) { $('net-status').textContent = s; }

  async start(asHost) {
    const room = ($('net-room').value || '').trim().toUpperCase() || 'STAR01';
    $('net-room').value = room;
    this.role = asHost ? 'host' : 'guest';
    this.status('连接中……');
    try {
      await this._tryPeer(room, asHost);
    } catch (e) {
      console.warn('[net] peer 失败，尝试本地 WS', e);
      try { await this._tryWs(room); }
      catch (e2) { this.status('✗ 连接失败：' + (e2.message || e2)); return; }
    }
  }
  _loadPeerJs() {
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/peerjs.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  async _tryPeer(room, asHost) {
    await this._loadPeerJs();
    return new Promise((res, rej) => {
      const id = asHost ? PREFIX + room : undefined;
      const peer = new window.Peer(id, { debug: 0 });
      this.peer = peer;
      const to = setTimeout(() => rej(new Error('P2P 超时')), 9000);
      peer.on('error', (e) => { clearTimeout(to); rej(e); });
      peer.on('open', () => {
        if (asHost) {
          clearTimeout(to);
          this.status(`✓ 房间 ${room} 已创建，等待好友加入……（线上可直连）`);
          peer.on('connection', (c) => this._wireConn(c, 'peer'));
          res();
        } else {
          const c = peer.connect(PREFIX + room, { reliable: true });
          c.on('open', () => { clearTimeout(to); this._wireConn(c, 'peer'); res(); });
          c.on('error', (e) => { clearTimeout(to); rej(e); });
        }
      });
    });
  }
  _tryWs(room) {
    return new Promise((res, rej) => {
      const ws = new WebSocket(`ws://${location.host}`);
      const to = setTimeout(() => rej(new Error('WS 超时')), 5000);
      ws.onerror = () => { clearTimeout(to); rej(new Error('本地中继不可用')); };
      ws.onopen = () => {
        ws.send(JSON.stringify({ t: 'join', room }));
        clearTimeout(to);
        this._wireConn(ws, 'ws');
        this.status(`✓ 已通过本地中继进入房间 ${room}`);
        res();
      };
    });
  }
  _wireConn(c, channel) {
    this.conn = c; this.channel = channel;
    this.connected = true;
    // 后台标签页 RAF 停摆时仍保持心跳同步
    clearInterval(this._bgTick);
    this._bgTick = setInterval(() => { if (document.hidden) this.update(0.12, performance.now() / 1000); }, 120);
    const onData = (d) => {
      let msg = d;
      if (typeof d === 'string') { try { msg = JSON.parse(d); } catch { return; } }
      this._onMsg(msg);
    };
    if (channel === 'peer') {
      c.on('data', onData);
      c.on('close', () => this._onLeave());
      this.status('✓ 已连接！');
      this._hello();
    } else {
      c.onmessage = (ev) => onData(ev.data);
      c.onclose = () => this._onLeave();
      // ws 中继需要等 peer_join
      this._wsReady = false;
    }
    setTimeout(() => { this.closePanel(); this.g.ui.toast('✧ 联机已建立'); }, 600);
  }
  send(obj) {
    if (!this.connected) return;
    const s = JSON.stringify(obj);
    try {
      if (this.channel === 'peer') this.conn.send(s);
      else if (this.conn.readyState === 1) this.conn.send(s);
    } catch {}
  }
  _hello() {
    const gs = this.g.gs;
    this.send({ t: 'hello', name: gs.name, model: gs.model, house: gs.house, mode: this.mode, decor: gs.dorm });
  }
  async _onMsg(m) {
    (window.__netlog ||= []).push(m.t);
    const g = this.g;
    switch (m.t) {
      case 'joined': break;
      case 'peer_join': this._hello(); break;
      case 'hello': {
        if (!this.remoteInfo) { this._hello(); }
        this.remoteInfo = m;
        g.ui.toast(`✦ ${m.name} 加入了（${HOUSES[m.house]?.name || ''}）`);
        await this._spawnRemote(m);
        if (this.role === 'host' && this.mode === 'coop') this.send({ t: 'seed', seed: g.coopSeed = (Math.random() * 1e9 | 0) });
        if (this.mode === 'visit' && this.role === 'host') this.send({ t: 'decor', list: g.gs.dorm });
        if (this.mode === 'duel') g.startNetDuel?.();
        break;
      }
      case 'pose': {
        if (this.remote) {
          this.remote.targetPos = { x: m.x, z: m.z, ry: m.ry, anim: m.anim, zone: m.zone };
        }
        break;
      }
      case 'emote': this.remote?.actor.emoteIcon(m.icon, 2); break;
      case 'chatline': g.ui.toast(`${this.remoteInfo?.name || '好友'}：${String(m.text).slice(0, 40)}`); break;
      case 'decor': if (this.mode === 'visit' && this.role === 'guest') g.applyRemoteDecor?.(m.list); break;
      case 'cast': g.onNetCast?.(m); break;
      case 'hp': g.onNetHp?.(m); break;
      case 'seed': g.coopSeed = m.seed; g.ui.toast('副本种子已同步，双人共探开启！'); break;
      case 'epos': g.onNetEnemies?.(m); break;
      case 'gcast': if (this.role === 'host') g.onGuestCast?.(m); break;
      case 'edied': g.onNetEnemyDied?.(m); break;
      case 'zone': this.remote && (this.remote.zoneId = m.zone); break;
    }
  }
  async _spawnRemote(info) {
    if (this.remote) {
      this.g.engine.scene.remove(this.remote.actor.root);
      if (this.remote.actor.cape) this.g.engine.scene.remove(this.remote.actor.cape.mesh);
    }
    const actor = new Actor();
    const house = HOUSES[info.house];
    await actor.load(this.g.lib, info.model || 'Mage', { capeColor: house?.color ?? 0xd8b45a });
    await actor.attachWand(this.g.lib);
    actor.root.position.copy(this.g.player.pos).add(new THREE.Vector3(1.5, 0, 1.5));
    this.g.engine.scene.add(actor.root);
    if (actor.cape) this.g.engine.scene.add(actor.cape.mesh);
    // 名牌
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
    const cx = cv.getContext('2d');
    cx.font = '26px serif'; cx.textAlign = 'center'; cx.fillStyle = '#ffe9ad';
    cx.shadowColor = '#000'; cx.shadowBlur = 6;
    cx.fillText(info.name || '好友', 128, 32);
    const tex = new THREE.CanvasTexture(cv);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    tag.scale.set(1.6, 0.3, 1);
    tag.position.y = 2.35;
    actor.root.add(tag);
    this.remote = { actor, targetPos: null, zoneId: null };
  }
  update(dt, t) {
    if (!this.connected) return;
    // 发送自身姿态 10Hz
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 0.1;
      const p = this.g.player;
      this.send({ t: 'pose', x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), ry: +p.actor.root.rotation.y.toFixed(2), anim: p.actor.current, zone: this.g.zoneId });
    }
    // 插值远端
    const r = this.remote;
    if (r) {
      r.actor.update(dt, t);
      if (r.targetPos) {
        const sameZone = !r.targetPos.zone || r.targetPos.zone === this.g.zoneId;
        r.actor.root.visible = sameZone;
        if (r.actor.cape) r.actor.cape.mesh.visible = sameZone;
        if (sameZone) {
          const p = r.actor.root.position;
          p.x += (r.targetPos.x - p.x) * Math.min(1, dt * 8);
          p.z += (r.targetPos.z - p.z) * Math.min(1, dt * 8);
          r.actor.root.rotation.y += (r.targetPos.ry - r.actor.root.rotation.y) * Math.min(1, dt * 8);
          const anim = r.targetPos.anim;
          if (anim && r.actor.current !== anim && r.actor.actions[anim]) r.actor.setBase(anim);
        }
      }
    }
  }
  _onLeave() {
    this.connected = false;
    this.g.ui.toast('对方离开了联机', true);
    if (this.remote) {
      this.g.engine.scene.remove(this.remote.actor.root);
      if (this.remote.actor.cape) this.g.engine.scene.remove(this.remote.actor.cape.mesh);
      this.remote = null;
    }
  }
}
