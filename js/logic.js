// ============ 纯逻辑层（无 three 依赖，Node 可单测） ============
import { SPELLS, SKILL_TREE, ITEMS, RECIPES, QUESTS, NPCS, CURRICULUM, PHASES, TALENTS, TRAITS, GRADES, HOUSE_MATES, SEMESTER_DAYS, EXAM_DAYS } from './data.js';

// 可复现随机
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// ============ 游戏状态 ============
export function newGameState(opts = {}) {
  return {
    ver: 1,
    name: opts.name || '星见',
    model: opts.model || 'Mage',
    house: opts.house || 'lion',
    talent: opts.talent || 'arcane',
    trait: opts.trait || 'brave',
    day: 1, hour: 8, minute: 0,
    hp: 100, mp: 60, level: 1, xp: 0, skillPts: 0,
    gold: 30, points: 0,
    knownSpells: ['bolt'],
    skills: [],            // 技能树节点 id
    bag: { pumpkin_pie: 2 },
    affinity: {},          // npcId -> 0..100
    quests: {},            // id -> {step, done}
    grades: {},            // subject -> [score...]
    attend: {},            // subject -> count
    plants: [],            // {id, plantedDay, watered}
    dorm: [],              // {id, x, z, rot}
    flags: {},             // 任意剧情开关
    titles: [],
    housePoints: { ...HOUSE_MATES },
    companion: null,
    stats: { duelsWon: 0, dungeonFloor: 0, potionsBrewed: 0, classesAttended: 0 },
  };
}

export function derivedStats(gs) {
  const talent = TALENTS.find(t => t.id === gs.talent)?.mod || {};
  const trait = TRAITS.find(t => t.id === gs.trait)?.mod || {};
  const sk = (id) => gs.skills.includes(id);
  const skMods = {};
  for (const col of Object.values(SKILL_TREE)) for (const n of col.nodes) if (sk(n.id)) Object.assign(skMods, n.mod);
  const maxHp = Math.round((100 + (trait.hp || 0) + (skMods.hp || 0)) * 1 + (gs.level - 1) * 10);
  const maxMp = Math.round(60 + (talent.mp || 0) + (gs.level - 1) * 6);
  return {
    maxHp, maxMp,
    dmgMul: (talent.dmg || 1) * (skMods.dmg || 1),
    shieldMul: (talent.shield || 1) * (skMods.shield || 1),
    takenMul: (talent.taken || 1),
    cdMul: (trait.cd || 1) * 1,
    xpMul: trait.xp || 1,
    mpRegen: 3 * (trait.mpregen || 1) * (skMods.mpregen || 1),
    potionMul: (talent.potion || 1) * (skMods.potion || 1),
    gatherMul: talent.gather || 1,
    speedMul: skMods.speed || 1,
    dodgeMul: skMods.dodge || 1,
    reflect: skMods.reflect || 1,
    pierce: skMods.pierce || 0,
    chainExtra: skMods.chain || 0,
    beamMul: skMods.beam || 1,
    burnExtra: skMods.burn || 0,
    portalCdMul: skMods.portalcd || 1,
    lastStand: skMods.lastStand || 0,
  };
}

export function xpForLevel(lv) { return 60 + (lv - 1) * 55; }
export function gainXp(gs, amt) {
  const d = derivedStats(gs);
  gs.xp += Math.round(amt * d.xpMul);
  const ups = [];
  while (gs.xp >= xpForLevel(gs.level)) {
    gs.xp -= xpForLevel(gs.level);
    gs.level++; gs.skillPts++;
    ups.push(gs.level);
  }
  return ups;
}

// ============ 时间 ============
export function phaseOf(hour) {
  const h = hour < 6 ? hour + 24 : hour;
  return PHASES.find(p => h >= p.from && h < p.to) || PHASES[5];
}
export function advanceMinutes(gs, mins) {
  gs.minute += mins;
  const events = [];
  while (gs.minute >= 60) { gs.minute -= 60; gs.hour++; }
  while (gs.hour >= 24) { gs.hour -= 24; }
  return events;
}
export function sleepToNextDay(gs) {
  gs.day++; gs.hour = 7; gs.minute = 0;
  const d = derivedStats(gs);
  gs.hp = d.maxHp; gs.mp = d.maxMp;
  // 植物生长
  for (const p of gs.plants) if (p.watered >= 1) { p.grown = (p.grown || 0) + 1; p.watered = 0; }
  // 其他学院分数缓涨
  const rng = makeRng(gs.day * 7919);
  for (const h of Object.keys(gs.housePoints)) if (h !== gs.house) gs.housePoints[h] += Math.floor(rng() * 8);
  return { day: gs.day, exam: EXAM_DAYS.includes(gs.day), weekday: weekdayOf(gs.day) };
}
export function weekdayOf(day) { return (day - 1) % 7; }
export function todayClasses(day) { return CURRICULUM[weekdayOf(day)]; }
export function classNow(gs) {
  const ph = phaseOf(gs.hour).id;
  const [am, pm] = todayClasses(gs.day);
  if (ph === 'morning') return am;
  if (ph === 'afternoon') return pm;
  return null;
}
export function isCurfew(gs) { return phaseOf(gs.hour).id === 'night'; }

// ============ 好感 ============
export function addAffinity(gs, npc, amt) {
  gs.affinity[npc] = clamp((gs.affinity[npc] || 0) + amt, 0, 100);
  return gs.affinity[npc];
}
export function affinityLevel(v) {
  if (v >= 80) return { lv: 4, name: '挚友' };
  if (v >= 60) return { lv: 3, name: '好友' };
  if (v >= 35) return { lv: 2, name: '熟识' };
  if (v >= 15) return { lv: 1, name: '面熟' };
  return { lv: 0, name: '陌生' };
}

// ============ 背包 ============
export function addItem(gs, id, n = 1) {
  if (!ITEMS[id]) return false;
  gs.bag[id] = (gs.bag[id] || 0) + n;
  if (gs.bag[id] <= 0) delete gs.bag[id];
  return true;
}
export function hasItem(gs, id, n = 1) { return (gs.bag[id] || 0) >= n; }
export function useItem(gs, id) {
  const it = ITEMS[id];
  if (!it || !hasItem(gs, id)) return null;
  const d = derivedStats(gs);
  const out = { id, name: it.name };
  if (it.heal) { gs.hp = clamp(gs.hp + Math.round(it.heal * (it.type === 'potion' ? d.potionMul : 1)), 0, d.maxHp); out.heal = true; }
  if (it.mana) { gs.mp = clamp(gs.mp + Math.round(it.mana * d.potionMul), 0, d.maxMp); out.mana = true; }
  if (it.buff) { gs.flags['buff_' + it.buff] = (gs.flags['buff_' + it.buff] || 0) + 600; out.buff = it.buff; }
  if (it.heal || it.mana || it.buff) addItem(gs, id, -1);
  return out;
}

// ============ 技能树 ============
export function canLearnSkill(gs, nodeId) {
  for (const col of Object.values(SKILL_TREE)) {
    const n = col.nodes.find(x => x.id === nodeId);
    if (n) {
      if (gs.skills.includes(nodeId)) return { ok: false, why: '已学会' };
      if (n.req && !gs.skills.includes(n.req)) return { ok: false, why: '前置未解锁' };
      if (gs.skillPts < n.cost) return { ok: false, why: '技能点不足' };
      return { ok: true, node: n };
    }
  }
  return { ok: false, why: '未知技能' };
}
export function learnSkill(gs, nodeId) {
  const c = canLearnSkill(gs, nodeId);
  if (!c.ok) return c;
  gs.skillPts -= c.node.cost;
  gs.skills.push(nodeId);
  return { ok: true, node: c.node };
}

// ============ 咒语 ============
export function unlockSpell(gs, id) {
  if (SPELLS[id] && !gs.knownSpells.includes(id)) { gs.knownSpells.push(id); return true; }
  return false;
}
export function spellDamage(gs, id) {
  const sp = SPELLS[id]; if (!sp) return 0;
  const d = derivedStats(gs);
  let dmg = sp.dmg * d.dmgMul;
  if (id === 'beam') dmg *= d.beamMul;
  return Math.round(dmg);
}

// ============ 魔药 ============
export function canBrew(gs, recipeId) {
  const r = RECIPES.find(x => x.id === recipeId);
  if (!r) return { ok: false, why: '未知配方' };
  for (const [m, n] of Object.entries(r.mats)) if (!hasItem(gs, m, n)) return { ok: false, why: `缺少 ${ITEMS[m]?.name} ×${n - (gs.bag[m] || 0)}` };
  if (r.time === '夜晚' && !isCurfew(gs) && phaseOf(gs.hour).id !== 'evening') return { ok: false, why: '此药需在黄昏或夜晚酿造' };
  return { ok: true, recipe: r };
}
export function brewPotion(gs, recipeId, stepsPlayer) {
  const c = canBrew(gs, recipeId);
  if (!c.ok) return c;
  const r = c.recipe;
  const correct = stepsPlayer.length === r.steps.length && stepsPlayer.every((s, i) => s === r.steps[i]);
  for (const [m, n] of Object.entries(r.mats)) addItem(gs, m, -n);
  if (correct) { addItem(gs, r.id, 1); gs.stats.potionsBrewed++; return { ok: true, made: r.id }; }
  return { ok: false, why: '步骤出错，药水报废了！', wasted: true };
}

// ============ 考试/学业 ============
export function recordGrade(gs, subject, score) {
  (gs.grades[subject] = gs.grades[subject] || []).push(clamp(Math.round(score), 0, 100));
}
export function gradeOf(score) { return GRADES.find(g => score >= g.min); }
export function examScore(gs, subject) {
  const arr = gs.grades[subject] || [];
  const attend = (gs.attend[subject] || 0);
  const base = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 30;
  const lucky = gs.flags.buff_lucky > 0 ? 15 : 0;
  return clamp(Math.round(base * 0.7 + Math.min(attend, 6) * 5 + lucky), 0, 100);
}

// ============ 任务系统 ============
export function questById(id) { return QUESTS.find(q => q.id === id); }
export function questState(gs, id) { return gs.quests[id]; }
export function availableQuests(gs) {
  return QUESTS.filter(q => {
    if (gs.quests[q.id]) return false;
    if (q.after && !gs.quests[q.after]?.done) return false;
    if (q.minDay && gs.day < q.minDay) return false;
    if (q.needSpell && !gs.knownSpells.includes(q.needSpell)) return false;
    return true;
  });
}
export function startQuest(gs, id) {
  if (gs.quests[id]) return false;
  const q = questById(id); if (!q) return false;
  gs.quests[id] = { step: 0, done: false };
  return true;
}
export function currentStep(gs, id) {
  const st = gs.quests[id]; if (!st || st.done) return null;
  return questById(id).steps[st.step];
}
// 事件推进：ev 形如 "talk:flora" "collect:moonflower:3" "cast:bolt"
export function fireEvent(gs, ev) {
  const fired = [];
  for (const [qid, st] of Object.entries(gs.quests)) {
    if (st.done) continue;
    const q = questById(qid);
    const step = q.steps[st.step];
    if (!step) continue;
    if (matchEvent(gs, step.ev, ev)) {
      st.step++;
      if (st.step >= q.steps.length) {
        st.done = true;
        applyReward(gs, q);
        fired.push({ quest: q, done: true });
      } else {
        fired.push({ quest: q, step: q.steps[st.step] });
      }
    }
  }
  return fired;
}
function matchEvent(gs, stepEv, ev) {
  if (stepEv === ev) return true;
  const [t1, a1, b1] = stepEv.split(':');
  const [t2, a2] = ev.split(':');
  if (t1 === 'collect' && t2 === 'collect' && a1 === a2) return hasItem(gs, a1, parseInt(b1 || '1', 10));
  if (t1 === 'reach' && t2 === 'reach' && a1 === a2) {
    if (!b1) return true;
    const ph = phaseOf(gs.hour).id;
    return b1 === ph || (b1 === 'night' && ph === 'night');
  }
  return false;
}
export function applyReward(gs, q) {
  const r = q.reward || {};
  const out = [];
  if (r.xp) { const ups = gainXp(gs, r.xp); out.push(`经验 +${r.xp}`); if (ups.length) out.push(`升到 Lv.${gs.level}！`); }
  if (r.gold) { gs.gold += r.gold; out.push(`银月币 +${r.gold}`); }
  if (r.points) { gs.housePoints[gs.house] += r.points; gs.points += r.points; out.push(`学院分 ${r.points > 0 ? '+' : ''}${r.points}`); }
  if (r.skill) { gs.skillPts += r.skill; out.push(`技能点 +${r.skill}`); }
  if (r.spell) { unlockSpell(gs, r.spell); out.push(`习得咒语「${SPELLS[r.spell].name}」`); }
  if (r.item) for (const [id, n] of Object.entries(r.item)) { addItem(gs, id, n); out.push(`获得 ${ITEMS[id].name} ×${n}`); }
  if (r.aff) for (const [npc, n] of Object.entries(r.aff)) { addAffinity(gs, npc, n); }
  if (r.title) { gs.titles.push(r.title); out.push(`称号「${r.title}」`); }
  return out;
}

// ============ 决斗数值 ============
export function duelHit(gs, foe, spellId) {
  const dmg = spellDamage(gs, spellId);
  foe.hp -= dmg;
  return { dmg, dead: foe.hp <= 0 };
}
export function playerHurt(gs, raw) {
  const d = derivedStats(gs);
  const dmg = Math.max(1, Math.round(raw * d.takenMul));
  gs.hp = clamp(gs.hp - dmg, 0, d.maxHp);
  return { dmg, dead: gs.hp <= 0 };
}

// ============ 地下迷宫生成（种子化，联机两端一致） ============
export function genDungeon(seed, floor = 1) {
  const rng = makeRng(seed * 131 + floor * 17);
  const W = 9 + floor * 2, H = 9 + floor * 2;
  // 网格迷宫：1=墙 0=通路
  const g = Array.from({ length: H }, () => Array(W).fill(1));
  const stack = [[1, 1]];
  g[1][1] = 0;
  const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = dirs.map(([dx, dy]) => [x + dx, y + dy, x + dx / 2, y + dy / 2])
      .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && g[ny][nx] === 1);
    if (!opts.length) { stack.pop(); continue; }
    const [nx, ny, mx, my] = opts[Math.floor(rng() * opts.length)];
    g[ny][nx] = 0; g[my][mx] = 0;
    stack.push([nx, ny]);
  }
  // 挖几个房间
  const rooms = [];
  for (let i = 0; i < 2 + floor; i++) {
    const rw = 3, rh = 3;
    const rx = 1 + 2 * Math.floor(rng() * ((W - rw - 2) / 2));
    const ry = 1 + 2 * Math.floor(rng() * ((H - rh - 2) / 2));
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) if (y < H - 1 && x < W - 1) g[y][x] = 0;
    rooms.push({ x: rx + 1, y: ry + 1 });
  }
  // 布置：入口/出口/宝箱/敌人/机关/材料
  const cells = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (g[y][x] === 0) cells.push([x, y]);
  const far = cells.slice().sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]));
  const entry = [1, 1];
  const exit = far[0];
  const pick = (n, excl) => {
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < 500) {
      const c = cells[Math.floor(rng() * cells.length)];
      if ((c[0] === entry[0] && c[1] === entry[1]) || (c[0] === exit[0] && c[1] === exit[1])) continue;
      if (out.some(o => o[0] === c[0] && o[1] === c[1]) || (excl || []).some(o => o[0] === c[0] && o[1] === c[1])) continue;
      out.push(c);
    }
    return out;
  };
  const chests = pick(2 + floor);
  const foes = pick(3 + floor * 2, chests);
  const shrooms = pick(3, [...chests, ...foes]);
  const traps = floor >= 2 ? pick(3, [...chests, ...foes, ...shrooms]) : [];
  const gate = floor >= 2 ? [exit[0], exit[1]] : null; // 出口机关门：需雷弧充能
  return { W, H, g, entry, exit, chests, foes, shrooms, traps, gate, floor, boss: floor === 3 };
}

// ============ 存档 ============
export function saveGame(gs, storage) {
  const s = JSON.stringify(gs);
  storage.setItem('hgw_astral_save', s);
  return s.length;
}
export function loadGame(storage) {
  try {
    const s = storage.getItem('hgw_astral_save');
    if (!s) return null;
    const gs = JSON.parse(s);
    if (gs.ver !== 1) return null;
    return gs;
  } catch { return null; }
}

// ============ NPC 位置计划 ============
export function npcZoneNow(gs, npc) {
  const ph = phaseOf(gs.hour).id;
  let z = npc.sched?.[ph] || npc.home;
  if (z === 'class') { // 学生跟课
    const c = classNow(gs);
    if (c && c !== 'duelclub_meet') z = { charms: 'stair', potions: 'potions', herbology: 'greenhouse', astronomy: 'astro', defense: 'yard' }[c] || 'hall';
    else z = ph === 'morning' ? 'library' : 'yard';
  }
  if (z === 'dorm_t') z = 'stair';
  return z;
}
