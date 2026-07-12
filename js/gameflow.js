// ============ 游戏流程：交互调度/对话/课堂/考试/迷宫/装饰/结局 ============
import * as THREE from 'three';
import { NPCS, QUESTS, DIALOGS, SPELLS, ITEMS, RECIPES, PLANTS, FURNITURE, SUBJECTS, EXAM_DAYS, HOUSES } from './data.js';
import * as L from './logic.js';
import { ZONES, MAT, updatePortrait } from './world.js';
import { mgAim, mgBrew, mgPlant, mgStars, mgRunes, mgExam, MG_BY_SUBJECT } from './minigames.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const $ = (id) => document.getElementById(id);

export function installGameflow(g) {
  // ---------- 任务事件 ----------
  g.fireQuestEvent = (ev) => {
    const fired = L.fireEvent(g.gs, ev);
    for (const f of fired) {
      if (f.done) {
        g.audio.sfx('levelup');
        g.ui.toast(`✅ 任务完成「${f.quest.name}」`);
        const rewards = [];
        if (f.quest.reward?.xp) rewards.push(`+${f.quest.reward.xp}xp`);
        if (f.quest.reward?.gold) rewards.push(`+${f.quest.reward.gold}🌙`);
        if (rewards.length) g.ui.toast(rewards.join(' '));
        if (f.quest.reward?.spell) g.ui.toast(`✦ 习得「${SPELLS[f.quest.reward.spell].name}」！`);
        if (f.quest.outro) setTimeout(() => g.ui.toast(f.quest.outro.slice(0, 46) + '…'), 1200);
        g.refreshSpellbar();
        g.checkAutoQuests();
      } else {
        g.audio.sfx('quest');
        g.ui.toast(`📜 ${f.quest.name}：${f.step.text}`);
      }
    }
    g.refreshQuestHud();
    if (fired.length) g.save();
    return fired;
  };
  g.checkAutoQuests = () => {
    // 主线自动接取
    for (const q of L.availableQuests(g.gs)) {
      if (q.main) {
        L.startQuest(g.gs, q.id);
        g.audio.sfx('quest');
        g.ui.toast(`⭐ 新的主线「${q.name}」`);
      }
    }
    g.refreshQuestHud();
  };
  g.refreshQuestHud = () => {
    const act = Object.entries(g.gs.quests).filter(([, st]) => !st.done);
    const main = act.find(([id]) => L.questById(id)?.main) || act[0];
    if (main) {
      const q = L.questById(main[0]);
      const step = q.steps[main[1].step];
      $('q-title').textContent = (q.main ? '⭐ ' : '◇ ') + q.name;
      $('q-step').textContent = step?.text || '';
    } else {
      $('q-title').textContent = '自由活动';
      $('q-step').textContent = '探索城堡，或与人交谈。';
    }
  };

  // ---------- 对话 ----------
  g.resolveNpc = (id) => NPCS.find(n => n.id === id);
  g.playNpcDialog = (npcId, seq) => g.ui.playDialog(seq, g.resolveNpc, (eff) => g.applyEffect(eff));
  g.applyEffect = (eff) => {
    const [kind, a, b] = eff.split(':');
    if (kind === 'aff') { L.addAffinity(g.gs, a, parseInt(b, 10)); }
    if (kind === 'item') { L.addItem(g.gs, a, parseInt(b || '1', 10)); }
    if (kind === 'gold') { g.gs.gold += parseInt(a, 10); }
  };
  g.talkTo = async (npcId) => {
    const npc = g.resolveNpc(npcId);
    if (!npc) return;
    g.input.enabled = false;
    const npcRec = g.npcs.get(npcId);
    npcRec?.actor.lookAt(g.player.pos.x, g.player.pos.z);
    npcRec?.actor.play('Interact', { once: true });
    // 选对话：任务阶段对话 > 待接任务开场 > 通用台词
    let seq = null;
    for (const [qid, st] of Object.entries(g.gs.quests)) {
      if (st.done) continue;
      const q = L.questById(qid);
      const step = q.steps[st.step];
      const key = `${npcId}@${qid}:${step?.id}`;
      if (DIALOGS[key] && step?.ev === `talk:${npcId}`) { seq = DIALOGS[key].seq; break; }
    }
    let startQuestId = null;
    if (!seq) {
      const avail = L.availableQuests(g.gs).find(q => q.giver === npcId && !q.main);
      if (avail) {
        startQuestId = avail.id;
        const key = `${npcId}@${avail.id}:s0`;
        seq = DIALOGS[key]?.seq || [{ who: npcId, t: npc.lines[0] }];
      }
    }
    if (!seq) {
      const aff = g.gs.affinity[npcId] || 0;
      const line = npc.lines[Math.floor(Math.random() * npc.lines.length)];
      seq = [{ who: npcId, mood: aff >= 60 ? 'happy' : 'calm', t: line }];
      // 好感闲聊选项
      if (!npc.ghost) {
        seq.push({
          who: 'you', choice: [
            { t: '「聊聊今天的课吧。」', eff: `aff:${npcId}:+3` },
            { t: '「回见！」', eff: `aff:${npcId}:+1` },
          ],
        });
      }
      // 同伴邀请
      if (npc.companion && aff >= 60 && g.gs.companion !== npcId) {
        seq[seq.length - 1].choice.unshift({ t: `「${npc.name}，一起行动吧！」(同伴)`, eff: `companion:${npcId}` });
      } else if (g.gs.companion === npcId) {
        seq[seq.length - 1].choice.unshift({ t: '「今天先到这里，谢谢你。」(解散同伴)', eff: 'companion:none' });
      }
    }
    // companion 效果拦截
    const applyEff = (eff) => {
      const [kind, a] = eff.split(':');
      if (kind === 'companion') {
        if (a === 'none') { g.gs.companion = null; g.companion.clear(); g.ui.toast('同伴已解散'); }
        else { g.gs.companion = a; g.companion.set(a); g.ui.toast(`✦ ${npc.name} 加入了队伍！`); }
        return;
      }
      g.applyEffect(eff);
    };
    await g.ui.playDialog(seq, g.resolveNpc, applyEff);
    if (startQuestId) {
      L.startQuest(g.gs, startQuestId);
      g.audio.sfx('quest');
      g.ui.toast(`◇ 接受任务「${L.questById(startQuestId).name}」`);
    }
    L.addAffinity(g.gs, npcId, 1);
    g.fireQuestEvent(`talk:${npcId}`);
    g.input.enabled = true;
  };

  // ---------- 交互调度 ----------
  g.doInteract = async (it) => {
    const gs = g.gs;
    const A = {
      sleep: () => g.doSleep(),
      decor: () => g.enterDecorMode(),
      board: () => g.openBoard(),
      brew: () => g.openBrewMenu(),
      take_mats: () => {
        if (gs.flags['mats_' + gs.day]) return g.ui.toast('今天的公用材料已经取过了', true);
        gs.flags['mats_' + gs.day] = 1;
        L.addItem(gs, 'frogeye', 2); L.addItem(gs, 'gillyweed', 1); L.addItem(gs, 'glowcap', 1);
        g.audio.sfx('coin');
        g.ui.toast('取得 蛙眼豆×2 鳃草×1 萤光菇×1');
      },
      plot: (idx) => g.plotAction(idx),
      water: () => {
        let n = 0;
        for (const p of gs.plants) if (p.watered < 9) { p.watered++; n++; }
        g.audio.sfx('plant');
        g.ui.toast(n ? `浇灌了 ${n} 株植物` : '没有需要浇水的植物', !n);
      },
      stargaze: async () => {
        g.input.enabled = false;
        const score = await mgStars(g.audio);
        g.input.enabled = true;
        L.recordGrade(gs, 'astronomy', score);
        g.grantXp(15 + Math.round(score / 5));
        g.ui.toast(`观测完成！记录了星轨（${score}分）`);
        if (score >= 60) g.fireQuestEvent('minigame:stars');
        L.addItem(gs, 'stardust', 1);
      },
      read_shelf: async () => {
        g.player.readBook(true);
        g.player.actor.play('Sit_Floor_Idle');
        g.ui.toast('你静静读了一会儿书……');
        g.advanceTime(40);
        g.grantXp(10);
        L.recordGrade(gs, 'charms', 60 + Math.random() * 30);
        setTimeout(() => { g.player.readBook(false); g.player.actor.play('Idle'); }, 2200);
      },
      duel_ring: () => g.duelRingMenu(),
      practice: () => g.ui.toast('对着假人施法吧！左键 星火弹'),
      kitchen_grab: () => {
        if (!L.isCurfew(gs) && L.phaseOf(gs.hour).id !== 'evening') return g.ui.toast('白天厨房有人盯着，晚上再来……', true);
        if ((gs.bag.roast_leg || 0) >= 2) return g.ui.toast('已经拿够了，快回去找塔格！');
        L.addItem(gs, 'roast_leg', 1);
        g.audio.sfx('chest');
        g.ui.toast(`顺走一只烤肉腿（${gs.bag.roast_leg || 0}/2）`);
        g.fireQuestEvent('collect:roast_leg:2');
        g.fireQuestEvent('sneak:hall');
      },
      pick_flower: (idx) => {
        const f = ZONES.forest.flowers[idx];
        if (!f || f.taken) return;
        if (!L.isCurfew(gs) && g.gs.hour < 20) return g.ui.toast('月光花只在深夜盛开。现在花苞紧闭。', true);
        f.taken = true;
        f.mesh.visible = false;
        const d = L.derivedStats(gs);
        L.addItem(gs, 'moonflower', 1 * (d.gatherMul || 1));
        g.fx.sparkleAt(V3(f.x, 0.6, f.z));
        g.audio.sfx('sparkle');
        g.ui.toast(`✿ 月光花 ×${d.gatherMul || 1}`);
        g.fireQuestEvent('collect:moonflower:3');
        g.fireQuestEvent('collect:moonflower:2');
      },
      pick_shroom: () => {
        L.addItem(gs, 'glowcap', 1);
        g.audio.sfx('sparkle');
        g.ui.toast('🍄 萤光菇 +1');
      },
      forest_chest: () => {
        if (gs.flags.forestChest) return g.ui.toast('箱子已经空了');
        gs.flags.forestChest = 1;
        gs.gold += 40; L.addItem(gs, 'potion_heal', 1); L.addItem(gs, 'spidersilk', 2);
        g.audio.sfx('chest');
        g.ui.toast('🧰 银月币+40 活力药剂×1 蛛丝×2');
      },
      levit_book: () => {
        if (!gs.knownSpells.includes('levit')) return g.ui.toast('书太高了。也许悬浮咒能帮上忙（上魔咒课学习）', true);
        const st = gs.quests.m3;
        if (!st || st.done || L.questById('m3').steps[st.step]?.ev !== 'levit:book') {
          return g.ui.toast('一本厚重的古书。现在不需要它。');
        }
        if (!L.isCurfew(gs) && L.phaseOf(gs.hour).id !== 'evening') return g.ui.toast('白天禁书区有管理员盯着……夜里再来。', true);
        const book = ZONES.library.bookTarget;
        g.player.castAnim('raise');
        g.audio.sfx('cast');
        g.fx.levitGlow(book, 2.4);
        const startY = book.position.y;
        let t = 0;
        const T = setInterval(() => {
          t += 0.05;
          book.position.y = startY - t * 1.4;
          book.rotation.y += 0.1;
          if (t >= 1) {
            clearInterval(T);
            book.visible = false;
            g.ui.toast('📖 取得《星轨编年史·三》');
            g.fireQuestEvent('levit:book');
            g.fireQuestEvent('sneak:library');
          }
        }, 50);
      },
      rune_lock: async () => {
        const st = gs.quests.m5;
        if (!st || st.done) return g.ui.toast('符文静静旋转着。');
        const step = L.questById('m5').steps[st.step];
        if (step?.ev === 'minigame:runes') {
          g.input.enabled = false;
          const ok = await mgRunes(g.audio);
          g.input.enabled = true;
          if (ok) {
            g.audio.sfx('quest');
            g.ui.toast('✦ 符文依次亮起——锁开了一半！');
            g.fireQuestEvent('minigame:runes');
          }
        }
        const st2 = gs.quests.m5;
        const step2 = L.questById('m5').steps[st2.step];
        if (!st2.done && step2?.ev === 'use:old_key' && L.hasItem(gs, 'old_key')) {
          L.addItem(gs, 'old_key', -1);
          g.audio.sfx('door');
          g.fireQuestEvent('use:old_key');
          gs.flags.chamberOpen = 1;
          const door = ZONES.chamber.sealDoor;
          g.fx.burst(door.position.clone().add(V3(0, 2, 0.5)), 0x7ea6ff, 40, 0.14, 4);
          let y = 0;
          const T = setInterval(() => {
            y += 0.06;
            door.position.y = -y * 3.4;
            if (y >= 1) clearInterval(T);
          }, 40);
          g.ui.toast('⛩ 密室之门缓缓沉入地下……');
        }
      },
      ritual: () => g.runRitual(),
      dungeon_chest: (idx) => g.lootDungeonChest(idx),
      dungeon_down: () => g.dungeonDescend(),
      page_pick: (pid) => {
        if (gs.flags['page_' + pid]) return;
        gs.flags['page_' + pid] = 1;
        L.addItem(gs, 'torn_page', 1);
        g.audio.sfx('page');
        g.ui.toast(`📜 散落的书页 (${gs.bag.torn_page || 0}/5)`);
        g.fireQuestEvent('collect:torn_page:5');
        g.pageMeshes?.[pid] && (g.pageMeshes[pid].visible = false);
      },
      cat_pumpkin: () => {
        const st = gs.quests.sq_rou;
        if (!st || st.done) return g.ui.toast('一个安静的南瓜。');
        if (!gs.knownSpells.includes('morph')) return g.ui.toast('这南瓜……看起来很可疑，但你还不会变形术。', true);
        g.player.castAnim('raise');
        g.fx.morphPoof(V3(10, 0, 10));
        g.audio.sfx('morph');
        L.addItem(gs, 'cat_statue', 1);
        g.catPumpkin && (g.catPumpkin.visible = false);
        g.ui.toast('🐈 南瓜变回了猫雕像！');
        g.fireQuestEvent('morph:cat_statue');
      },
    };
    const fn = A[it.action];
    if (fn) await fn(it.id);
  };

  // ---------- 睡觉 ----------
  g.doSleep = async () => {
    g.input.enabled = false;
    await g.ui.fade(true, 700);
    const info = L.sleepToNextDay(g.gs);
    g.combat.lastStandUsed = false;
    // 采集点刷新
    for (const f of ZONES.forest.flowers) { f.taken = false; f.mesh.visible = true; }
    // 天气
    g.rollWeather();
    g.refreshHud();
    g.ui.centerTitle(`第 ${info.day} 天 · ${['周一', '周二', '周三', '周四', '周五', '周六', '周日'][info.weekday]}`);
    await g.ui.fade(false, 700);
    g.input.enabled = true;
    g.audio.sfx('bell');
    g.save();
    if (info.exam) setTimeout(() => g.runExamDay(), 1500);
    else g.ui.toast(g.classHint());
    // 植物成熟提示
    const ready = g.gs.plants.filter(p => (p.grown || 0) >= (PLANTS.find(x => x.id === p.id)?.days || 1));
    if (ready.length) g.ui.toast(`🌱 温室里有 ${ready.length} 株植物成熟了！`);
    g.checkAutoQuests();
  };
  g.classHint = () => {
    const [am, pm] = L.todayClasses(g.gs.day);
    const nm = (c) => c === 'duelclub_meet' ? '决斗社' : (c ? SUBJECTS[c].name : '自由活动');
    return `今日安排：上午 ${nm(am)} · 下午 ${nm(pm)}`;
  };

  // ---------- 上课 ----------
  g.tryAttendClass = async () => {
    const gs = g.gs;
    const cur = L.classNow(gs);
    if (!cur || cur === 'duelclub_meet') return false;
    const sub = SUBJECTS[cur];
    if (!sub || sub.room !== g.zoneId) return false;
    const key = `class_${gs.day}_${L.phaseOf(gs.hour).id}`;
    if (gs.flags[key]) return false;
    gs.flags[key] = 1;
    g.input.enabled = false;
    g.ui.cinema(true);
    const teacher = g.resolveNpc(sub.teacher);
    await g.playNpcDialog(sub.teacher, [{ who: sub.teacher, t: `${teacher.name}：「都到齐了？今天我们练习——${sub.desc}！」` }]);
    const mg = MG_BY_SUBJECT[sub.minigame];
    const raw = await mg(g.audio, cur === 'potions' ? RECIPES[Math.floor(Math.random() * 2)].id : undefined);
    const score = typeof raw === 'object' ? raw.score : raw;
    g.ui.cinema(false);
    g.input.enabled = true;
    gs.attend[cur] = (gs.attend[cur] || 0) + 1;
    gs.stats.classesAttended++;
    L.recordGrade(gs, cur, score);
    g.grantXp(20 + Math.round(score / 4));
    let msg = `${sub.name} 表现 ${score} 分`;
    if (score >= 80) { gs.housePoints[gs.house] += 5; gs.points += 5; msg += ' · 学院分 +5！'; }
    g.ui.toast(msg);
    g.audio.sfx(score >= 80 ? 'levelup' : 'quest');
    // 课程解锁咒语
    const unlockMap = { charms: ['levit', 'fire'], defense: ['shield'], potions: [], astronomy: [], herbology: [] };
    for (const spid of unlockMap[cur] || []) {
      if (!gs.knownSpells.includes(spid) && (gs.attend[cur] || 0) >= (spid === 'fire' ? 2 : 1)) {
        L.unlockSpell(gs, spid);
        g.ui.toast(`✦ 习得咒语「${SPELLS[spid].name}」(${SPELLS[spid].key})`);
        g.audio.sfx('levelup');
        g.refreshSpellbar();
      }
    }
    // 变形术：魔咒课上满3次
    if (cur === 'charms' && (gs.attend.charms || 0) >= 3 && !gs.knownSpells.includes('morph')) {
      L.unlockSpell(gs, 'morph');
      g.ui.toast(`✦ 习得咒语「变形术」(G)`);
      g.refreshSpellbar();
    }
    g.fireQuestEvent(`class:${cur}`);
    g.advanceTime(120);
    g.save();
    return true;
  };

  // ---------- 考试日 ----------
  g.runExamDay = async () => {
    const gs = g.gs;
    g.input.enabled = false;
    g.ui.cinema(true);
    g.ui.centerTitle('📝 期末考试周');
    await g.playNpcDialog('astron', [{ who: 'astron', t: '考试的意义不是分数，是让你知道自己已经走了多远。开始吧。' }]);
    let total = 0;
    const subjects = ['charms', 'potions', 'astronomy'];
    for (const sid of subjects) {
      const score = await mgExam(g.audio, SUBJECTS[sid].name);
      const final = Math.round(score * 0.6 + L.examScore(gs, sid) * 0.4);
      L.recordGrade(gs, sid, final);
      total += final;
      const gr = L.gradeOf(final);
      g.ui.toast(`${SUBJECTS[sid].name}：${final} 分 · 评级 ${gr.g}（${gr.name}）`);
      await new Promise(r => setTimeout(r, 600));
    }
    const avg = Math.round(total / subjects.length);
    const pts = avg >= 90 ? 30 : avg >= 75 ? 20 : avg >= 60 ? 10 : 0;
    gs.housePoints[gs.house] += pts; gs.points += pts;
    g.grantXp(60);
    g.audio.sfx('levelup');
    g.ui.centerTitle(`考试结束 · 平均 ${avg} 分 · 学院分 +${pts}`);
    g.ui.cinema(false);
    g.input.enabled = true;
    g.save();
  };

  // ---------- 魔药酿造菜单 ----------
  g.openBrewMenu = () => {
    g.input.enabled = false;
    const host = $('mg-body');
    $('minigame').classList.remove('hidden');
    let html = '<h2>坩埚酿造</h2><p class="mg-sub">选择配方（需要材料齐全）</p><div class="mg-zone" style="min-height:auto">';
    for (const r of RECIPES) {
      const c = L.canBrew(g.gs, r.id);
      const mats = Object.entries(r.mats).map(([m, n]) => `${ITEMS[m].icon}×${n}`).join(' ');
      html += `<button class="mg-btn" data-recipe="${r.id}" ${c.ok ? '' : 'disabled style="opacity:.4"'}>${ITEMS[r.id].icon} ${r.name}<br><span style="font-size:12px;opacity:.7">${mats} ${c.ok ? '' : '· ' + c.why}</span></button>`;
    }
    html += '</div><button class="mg-btn" id="brew-cancel">离开</button>';
    host.innerHTML = html;
    host.querySelector('#brew-cancel').onclick = () => { $('minigame').classList.add('hidden'); g.input.enabled = true; };
    host.querySelectorAll('[data-recipe]').forEach(b => b.onclick = async () => {
      const rid = b.dataset.recipe;
      const raw = await mgBrew(g.audio, rid);
      const result = L.brewPotion(g.gs, rid, raw.steps ? (raw.score >= 60 ? RECIPES.find(x => x.id === rid).steps : ['bad']) : ['bad']);
      if (result.ok) {
        g.audio.sfx('bubble');
        g.ui.toast(`⚗️ 酿成 ${ITEMS[rid].name}！`);
        g.grantXp(18);
        L.recordGrade(g.gs, 'potions', raw.score || 70);
        g.fireQuestEvent(`brew:${rid}`);
      } else {
        g.ui.toast(result.why, true);
      }
      g.input.enabled = true;
      g.save();
    });
  };

  // ---------- 温室种植 ----------
  g.plotAction = (idx) => {
    const gs = g.gs;
    const plot = gs.plants.find(p => p.plot === idx);
    if (plot) {
      const def = PLANTS.find(x => x.id === plot.id);
      if ((plot.grown || 0) >= def.days) {
        // 收获
        gs.plants = gs.plants.filter(p => p !== plot);
        const d = L.derivedStats(gs);
        const n = def.yield * (d.gatherMul || 1);
        L.addItem(gs, plot.id === 'shriekroot' ? 'frogeye' : plot.id, n);
        g.audio.sfx('plant');
        g.ui.toast(`🌾 收获 ${ITEMS[plot.id === 'shriekroot' ? 'frogeye' : plot.id]?.name || plot.id} ×${n}`);
        g.grantXp(12);
        L.recordGrade(gs, 'herbology', 75 + Math.random() * 20);
        g.rebuildPlots();
      } else {
        g.ui.toast(`${PLANTS.find(x => x.id === plot.id).name}：还需 ${def.days - (plot.grown || 0)} 天（今日${plot.watered ? '已' : '未'}浇水）`);
      }
      return;
    }
    // 种植菜单
    g.input.enabled = false;
    $('minigame').classList.remove('hidden');
    const host = $('mg-body');
    let html = '<h2>种植</h2><p class="mg-sub">选择要栽种的魔法植物</p><div class="mg-zone" style="min-height:auto">';
    for (const p of PLANTS) {
      html += `<button class="mg-btn" data-plant="${p.id}">${p.name}<br><span style="font-size:12px;opacity:.7">${p.days}天成熟 · 产量${p.yield}${p.night ? ' · 夜采' : ''}</span></button>`;
    }
    html += '</div><button class="mg-btn" id="plant-cancel">先不种</button>';
    host.innerHTML = html;
    host.querySelector('#plant-cancel').onclick = () => { $('minigame').classList.add('hidden'); g.input.enabled = true; };
    host.querySelectorAll('[data-plant]').forEach(b => b.onclick = () => {
      g.gs.plants.push({ id: b.dataset.plant, plot: idx, watered: 0, grown: 0 });
      $('minigame').classList.add('hidden');
      g.input.enabled = true;
      g.audio.sfx('plant');
      g.ui.toast(`🌱 种下了 ${PLANTS.find(x => x.id === b.dataset.plant).name}`);
      g.rebuildPlots();
      g.save();
    });
  };
  g.rebuildPlots = () => {
    const z = ZONES.greenhouse;
    for (let i = 0; i < z.plots.length; i++) {
      const slot = z.plots[i];
      if (slot.mesh) { z.group.remove(slot.mesh); slot.mesh = null; }
      const plant = g.gs.plants.find(p => p.plot === i);
      if (plant) {
        const def = PLANTS.find(x => x.id === plant.id);
        const mature = (plant.grown || 0) >= def.days;
        const grp = new THREE.Group();
        const h = mature ? 0.9 : 0.4;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, h, 5), new THREE.MeshStandardMaterial({ color: 0x2f6a3f }));
        stem.position.y = h / 2;
        grp.add(stem);
        const top = new THREE.Mesh(new THREE.SphereGeometry(mature ? 0.3 : 0.12, 8, 6),
          new THREE.MeshStandardMaterial({ color: plant.id === 'moonflower' ? 0xbfd8ff : plant.id === 'shriekroot' ? 0xc06a4a : 0x54c06a, emissive: mature ? 0x224422 : 0x000000 }));
        top.position.y = h + 0.1;
        grp.add(top);
        grp.position.set(slot.x, 0.85, slot.z);
        z.group.add(grp);
        slot.mesh = grp;
      }
    }
  };

  // ---------- 布告栏（社团+集市） ----------
  g.openBoard = () => {
    g.input.enabled = false;
    $('minigame').classList.remove('hidden');
    const host = $('mg-body');
    const owned = g.gs.flags.furn || (g.gs.flags.furn = ['bed_single_A']);
    let html = `<h2>学院布告栏</h2>
      <p class="mg-sub">⚔ 决斗社：周三/周六下午，庭院决斗台（找薇拉报名晋级赛）<br>🌌 观星社：每晚天文塔（用望远镜观星可得星尘）</p>
      <h2 style="font-size:18px;margin-top:8px">🦉 猫头鹰集市 · 家具邮购（余额 ${g.gs.gold}🌙）</h2><div class="mg-zone" style="min-height:auto">`;
    for (const f of FURNITURE) {
      const has = owned.includes(f.id);
      html += `<button class="mg-btn" data-furn="${f.id}" ${has || g.gs.gold < f.cost ? 'disabled style="opacity:.45"' : ''}>${f.icon} ${f.name}<br><span style="font-size:12px;opacity:.7">${has ? '已拥有' : f.cost + '🌙'}</span></button>`;
    }
    html += '</div><button class="mg-btn" id="board-close">关闭</button>';
    host.innerHTML = html;
    host.querySelector('#board-close').onclick = () => { $('minigame').classList.add('hidden'); g.input.enabled = true; };
    host.querySelectorAll('[data-furn]').forEach(b => b.onclick = () => {
      const f = FURNITURE.find(x => x.id === b.dataset.furn);
      if (g.gs.gold < f.cost) return;
      g.gs.gold -= f.cost;
      owned.push(f.id);
      g.audio.sfx('coin');
      g.ui.toast(`🦉 猫头鹰送来了 ${f.name}！（宿舍装饰模式可摆放）`);
      g.openBoard();
      g.save();
    });
  };

  // ---------- 宿舍装饰模式 ----------
  g.enterDecorMode = () => {
    const gs = g.gs;
    const owned = gs.flags.furn || (gs.flags.furn = ['bed_single_A']);
    g.decorMode = { sel: 0, rot: 0 };
    g.input.enabled = true;
    g.ui.toast('🏠 装饰模式：←→选家具 · 左键摆放 · R旋转 · 右键撤回最后一件 · E/Esc 退出');
    g.decorGhost = null;
    g.refreshDecorGhost = async () => {
      if (g.decorGhost) { g.engine.scene.remove(g.decorGhost); g.decorGhost = null; }
      const f = FURNITURE[g.decorMode.sel % FURNITURE.length];
      if (!owned.includes(f.id)) return;
      const obj = await g.lib.prop(f.pack || 'furniture', f.file || f.id, { shadow: false });
      obj.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.6; } });
      g.decorGhost = obj;
      g.engine.scene.add(obj);
    };
    g.refreshDecorGhost();
    g.ui.el.crosshair.classList.remove('hidden');
  };
  g.exitDecorMode = () => {
    if (g.decorGhost) g.engine.scene.remove(g.decorGhost);
    g.decorGhost = null;
    g.decorMode = null;
    g.ui.el.crosshair.classList.add('hidden');
    g.ui.toast('装饰完成 ✓');
    g.rebuildDorm();
    g.save();
  };
  g.rebuildDorm = async () => {
    const z = ZONES.common;
    if (g.dormGroup) { z.group.remove(g.dormGroup); }
    g.dormGroup = new THREE.Group();
    z.group.add(g.dormGroup);
    for (const d of g.gs.dorm) {
      const f = FURNITURE.find(x => x.id === d.id);
      if (!f) continue;
      const obj = await g.lib.prop(f.pack || 'furniture', f.file || f.id);
      obj.position.set(d.x, 0, d.z);
      obj.rotation.y = d.rot;
      g.dormGroup.add(obj);
    }
  };
  g.applyRemoteDecor = async (list) => {
    const z = ZONES.common;
    if (g.remoteDormGroup) z.group.remove(g.remoteDormGroup);
    g.remoteDormGroup = new THREE.Group();
    z.group.add(g.remoteDormGroup);
    for (const d of (list || [])) {
      const f = FURNITURE.find(x => x.id === d.id);
      if (!f) continue;
      const obj = await g.lib.prop(f.pack || 'furniture', f.file || f.id);
      obj.position.set(d.x, 0, d.z);
      obj.rotation.y = d.rot;
      g.remoteDormGroup.add(obj);
    }
    g.ui.toast('✧ 这是好友布置的宿舍！');
  };

  // ---------- 决斗台菜单 ----------
  g.duelRingMenu = () => {
    const gs = g.gs;
    g.input.enabled = false;
    $('minigame').classList.remove('hidden');
    const host = $('mg-body');
    const sq = gs.quests.sq_duel;
    const stepEv = sq && !sq.done ? L.questById('sq_duel').steps[sq.step]?.ev : null;
    let html = '<h2>决斗台</h2><p class="mg-sub">决斗规则：把对手打倒，注意闪避(空格)和护盾(Q)</p><div class="mg-zone" style="min-height:auto">';
    html += `<button class="mg-btn" data-duel="dummy">🎯 热身：训练假人</button>`;
    if (stepEv === 'duelwin:club1') html += `<button class="mg-btn" data-duel="club1">⚔ 晋级赛①：忠獾学员邦斯</button>`;
    if (stepEv === 'duelwin:derek') html += `<button class="mg-btn" data-duel="derek">⚔ 晋级赛②：德里克</button>`;
    if (stepEv === 'duelwin:vera') html += `<button class="mg-btn" data-duel="vera">⚔ 决赛：社长薇拉</button>`;
    if (!stepEv) html += `<button class="mg-btn" data-duel="club1">⚔ 友谊赛：邦斯</button>`;
    html += '</div><button class="mg-btn" id="duel-cancel">离开</button>';
    host.innerHTML = html;
    host.querySelector('#duel-cancel').onclick = () => { $('minigame').classList.add('hidden'); g.input.enabled = true; };
    host.querySelectorAll('[data-duel]').forEach(b => b.onclick = async () => {
      $('minigame').classList.add('hidden');
      g.input.enabled = true;
      const foeId = b.dataset.duel;
      const intro = foeId === 'derek' ? { npc: 'derek', dialog: DIALOGS['derek@duel'].seq } : null;
      await g.duel.start(foeId, {
        intro,
        onWin: () => {
          if (stepEv === `duelwin:${foeId}`) g.fireQuestEvent(`duelwin:${foeId}`);
          g.grantXp(30);
          g.gs.gold += 10;
          g.combat.clearEnemies();
          g.save();
        },
        onLose: () => {
          g.gs.hp = 30;
          g.combat.clearEnemies();
          g.refreshHud();
        },
      });
    });
  };

  // ---------- 地下迷宫 ----------
  g.dungeonSeed = () => g.coopSeed || (g.gs.flags.dgseed || (g.gs.flags.dgseed = (Math.random() * 1e9) | 0));
  g.buildDungeonFloor = async (floor) => {
    const z = ZONES.dungeon;
    // 清空
    while (z.group.children.length) z.group.remove(z.group.children[0]);
    z.obstacles.length = 0; z.interacts.length = 0; z.portals.length = 0; z.updaters.length = 0;
    g.combat.clearEnemies();
    const D = L.genDungeon(g.dungeonSeed(), floor);
    g.dungeon = D;
    const S = 4, S2 = S / 2;
    const W = D.W * S, H = D.H * S;
    z.bounds = [-S2, -S2, W - S2, H - S2];
    // 地面
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(W + 4, 0.3, H + 4), MAT.stoneDark);
    floorMesh.position.set(W / 2 - S2, -0.15, H / 2 - S2);
    floorMesh.receiveShadow = true;
    z.group.add(floorMesh);
    // 墙体（instanced 方块 + 石纹）
    const wallGeo = new THREE.BoxGeometry(S, 4.2, S);
    const count = D.g.flat().filter(v => v === 1).length;
    const inst = new THREE.InstancedMesh(wallGeo, MAT.stone, count);
    let k = 0;
    const m4 = new THREE.Matrix4();
    for (let y = 0; y < D.H; y++) for (let x = 0; x < D.W; x++) {
      if (D.g[y][x] === 1) {
        m4.setPosition(x * S, 2.1, y * S);
        inst.setMatrixAt(k++, m4);
        z.blockRect(x * S - S2, y * S - S2, x * S + S2, y * S + S2);
      }
    }
    inst.castShadow = true; inst.receiveShadow = true;
    z.group.add(inst);
    // 火把
    let ti = 0;
    for (let y = 1; y < D.H - 1; y++) for (let x = 1; x < D.W - 1; x++) {
      if (D.g[y][x] === 0 && D.g[y - 1][x] === 1 && ((x * 7 + y * 13) % 5 === 0)) {
        const torch = await g.lib.prop('dungeon', 'torch_mounted');
        torch.position.set(x * S, 1.8, y * S - S2 + 0.1);
        z.group.add(torch);
        if (ti++ < 14) g.candleRig.addSpot('dungeon', x * S, 2.2, y * S - S2 + 0.5, 1.5);
      }
    }
    // 宝箱
    D.chests.forEach(([cx, cy], i) => {
      g.lib.prop('dungeon', i === 0 ? 'chest_gold' : 'chest').then(c => {
        c.position.set(cx * S, 0, cy * S);
        z.group.add(c);
      });
      z.interact(cx * S, cy * S, '开启宝箱', 'dungeon_chest', i, 2);
    });
    // 萤光菇
    for (const [sx, sy] of D.shrooms) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0x54e0a0 }));
      m.position.set(sx * S, 0.16, sy * S);
      z.group.add(m);
      z.interact(sx * S, sy * S, '采集萤光菇', 'pick_shroom', null, 1.5);
    }
    // 尖刺陷阱
    g.dungeonTraps = [];
    for (const [tx, ty] of D.traps) {
      const spikes = await g.lib.prop('dungeon', 'floor_tile_big_spikes');
      spikes.position.set(tx * S, 0.02, ty * S);
      z.group.add(spikes);
      g.dungeonTraps.push({ x: tx * S, z: ty * S, cd: 0 });
    }
    // 敌人
    const foeTypes = floor === 1 ? ['skel_guard', 'skel_guard', 'skel_archer'] : floor === 2 ? ['skel_guard', 'skel_archer', 'skel_mage'] : ['skel_guard', 'skel_mage', 'skel_mage'];
    for (const [fx, fy] of D.foes) {
      const t = foeTypes[Math.floor((fx + fy) % foeTypes.length)];
      const e = await g.combat.spawnEnemy(t, fx * S, fy * S);
      e.onDeath = (en) => {
        L.addItem(g.gs, 'boneshard', 1);
        g.grantXp(14);
        if (Math.random() < 0.4) { g.gs.gold += 5; g.audio.sfx('coin'); }
        g.netEnemyDied?.(en);
      };
    }
    // 出口
    if (D.boss) {
      // Boss 房：出口位置放王座 + Boss
      const boss = await g.combat.spawnEnemy('skeleking', D.exit[0] * S, D.exit[1] * S);
      g.dungeonBoss = boss;
      const throne = await g.lib.prop('dungeon', 'sword_shield_gold');
      throne.position.set(D.exit[0] * S, 0, D.exit[1] * S - 2);
      z.group.add(throne);
      boss.onDeath = () => {
        g.fireQuestEvent('boss:skeleking');
        g.audio.sfx('levelup');
        g.ui.centerTitle('☠ 骷髅法师王 陨落 ☠');
        // 掉落封印辉石
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0x7ea6ff }));
        gem.position.set(D.exit[0] * S, 1, D.exit[1] * S);
        z.group.add(gem);
        z.updaters.push((t) => { gem.rotation.y = t * 2; gem.position.y = 1 + Math.sin(t * 3) * 0.2; });
        z.interact(D.exit[0] * S, D.exit[1] * S, '拾取封印辉石', 'gem_pick', null, 2);
        g.doGemPick = () => {
          L.addItem(g.gs, 'seal_gem', 1);
          gem.visible = false;
          g.audio.sfx('chest');
          g.ui.toast('💎 封印辉石到手！回去找校长吧。');
          g.fireQuestEvent('collect:seal_gem:1');
          g.grantXp(80);
        };
      };
    } else {
      const st = await g.lib.prop('dungeon', 'stairs_wide');
      st.position.set(D.exit[0] * S, 0, D.exit[1] * S);
      z.group.add(st);
      z.interact(D.exit[0] * S, D.exit[1] * S, `下往第 ${floor + 1} 层`, 'dungeon_down', null, 2.4);
      if (D.gate) {
        // 机关门：需雷弧充能
        const gm = new THREE.Mesh(new THREE.BoxGeometry(S, 3.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x2a3550, metalness: 0.8, roughness: 0.3, emissive: 0x111133 }));
        gm.position.set(D.exit[0] * S, 1.8, D.exit[1] * S + S2);
        z.group.add(gm);
        g.dungeonGate = { mesh: gm, open: false, x: D.exit[0] * S, z: D.exit[1] * S };
        z.blockRect(gm.position.x - S2, gm.position.z - 0.4, gm.position.x + S2, gm.position.z + 0.4);
        g.ui.toast('⚡ 前方有符文闸门——也许雷弧链能给它充能');
      }
    }
    // 返回入口
    z.spot('spawn', D.entry[0] * S, 0, D.entry[1] * S);
    z.portal(D.entry[0] * S, D.entry[1] * S - 3, '返回密室入口', 'chamber', 'spawn', null, 2);
    z.fogColor = 0x080a14;
    z.fogDensity = 0.05;
    g.ui.toast(`🗝 星轨迷宫 · 第 ${floor} 层${D.boss ? '（封印厅）' : ''}`);
    g.fireQuestEvent(`dungeon:floor:${floor}`);
  };
  g.lootDungeonChest = (idx) => {
    const key = `dg_${g.gs.stats.dungeonFloor}_${idx}`;
    if (g.gs.flags[key]) return g.ui.toast('箱子空了');
    g.gs.flags[key] = 1;
    const roll = Math.random();
    if (roll < 0.4) { g.gs.gold += 20 + Math.floor(Math.random() * 20); g.ui.toast('🧰 一把银月币！'); g.audio.sfx('coin'); }
    else if (roll < 0.7) { L.addItem(g.gs, 'potion_heal', 1); g.ui.toast('🧰 活力药剂 ×1'); g.audio.sfx('chest'); }
    else { L.addItem(g.gs, 'stardust', 2); g.ui.toast('🧰 星尘 ×2'); g.audio.sfx('chest'); }
  };
  g.dungeonDescend = async () => {
    if (g.dungeonGate && !g.dungeonGate.open) return g.ui.toast('闸门紧锁。符文槽似乎渴望着电流……(雷弧链)', true);
    const next = (g.gs.stats.dungeonFloor || 1) + 1;
    g.gs.stats.dungeonFloor = next;
    await g.ui.fade(true, 500);
    await g.buildDungeonFloor(next);
    g.player.teleport(ZONES.dungeon.spots.spawn.x, ZONES.dungeon.spots.spawn.z);
    await g.ui.fade(false, 500);
  };
  g.chargeCheck = (pts) => {
    // 雷弧充能闸门
    if (g.zoneId !== 'dungeon' || !g.dungeonGate || g.dungeonGate.open) return;
    for (const p of pts) {
      if (Math.hypot(p.x - g.dungeonGate.x, p.z - (g.dungeonGate.z + 2)) < 4) {
        g.dungeonGate.open = true;
        g.dungeonGate.mesh.material.emissive = new THREE.Color(0x44ffee);
        g.audio.sfx('arc');
        setTimeout(() => {
          g.dungeonGate.mesh.visible = false;
          ZONES.dungeon.obstacles = ZONES.dungeon.obstacles.filter(o => !(o.x1 && Math.abs((o.x1 + o.x2) / 2 - g.dungeonGate.x) < 3 && Math.abs((o.z1 + o.z2) / 2 - g.dungeonGate.z - 2) < 3));
          g.ui.toast('⚡ 闸门升起！');
          g.audio.sfx('door');
        }, 500);
        break;
      }
    }
  };

  // ---------- 封印仪式（结局） ----------
  g.runRitual = async () => {
    const gs = g.gs;
    const st = gs.quests.m7;
    if (!st || st.done) return g.ui.toast('星轨安静地流转着。');
    const step = L.questById('m7').steps[st.step];
    if (step?.ev !== 'ritual:seal') return g.ui.toast('还不是举行仪式的时候（黄昏时分再来）。');
    if (!L.hasItem(gs, 'seal_gem')) return g.ui.toast('需要封印辉石。', true);
    g.input.enabled = false;
    g.ui.cinema(true);
    const z = ZONES.astro;
    z.sealCircle.material.opacity = 0.9;
    g.player.teleport(0, -3.4);
    g.player.castAnim('channel');
    g.audio.music('night');
    g.fx.ritualPillar(V3(0, 0, 0), 0x7ea6ff, 6);
    g.audio.sfx('portal');
    await new Promise(r => setTimeout(r, 3200));
    L.addItem(gs, 'seal_gem', -1);
    g.fireQuestEvent('ritual:seal');
    g.ui.centerTitle('✨ 封印重铸 · 星轨归位 ✨', 3600);
    g.audio.sfx('levelup');
    await new Promise(r => setTimeout(r, 2500));
    // 结局盛宴
    await g.ui.fade(true, 800);
    await g.switchZone('hall', 'feast');
    g.gs.hour = 19; g.gs.minute = 0;
    g.audio.music('feast');
    await g.ui.fade(false, 800);
    g.ui.cinema(false);
    for (let i = 0; i < 6; i++) setTimeout(() => {
      g.fx.burst(V3((Math.random() - .5) * 20, 5 + Math.random() * 2, (Math.random() - .5) * 10), [0xc0392b, 0x2e5fa3, 0x1e8449, 0xb7950b][i % 4], 40, 0.12, 5);
      g.audio.sfx('levelup');
    }, i * 700);
    await g.playNpcDialog('astron', [
      { who: 'astron', mood: 'happy', t: '举杯——敬星轨的守望者！敬这个学年最勇敢的学徒！' },
      { who: 'astron', t: `${HOUSES[gs.house].name}获得 100 点学院分！今晚的宴席，不散！` },
    ]);
    g.ui.centerTitle('🏆 主线完成 · 学年物语仍在继续', 4000);
    g.input.enabled = true;
    g.save();
  };

  // ---------- 幽灵书页 & 猫南瓜 布点 ----------
  g.placeQuestProps = async () => {
    // 5 张书页
    const spots = [
      ['library', 12, 8], ['hall', 14, 10], ['stair', -10, 10], ['astro', -5, -6], ['yard', 12, 10],
    ];
    g.pageMeshes = [];
    spots.forEach(([zid, x, zpos], i) => {
      const z = ZONES[zid];
      const page = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.42), new THREE.MeshBasicMaterial({ color: 0xfff2cc, side: THREE.DoubleSide }));
      page.position.set(x, 0.5, zpos);
      page.rotation.x = -Math.PI / 3;
      z.group.add(page);
      z.updaters.push((t) => { page.position.y = 0.5 + Math.sin(t * 2 + i) * 0.15; page.rotation.z = Math.sin(t + i) * 0.3; page.visible = !!(g.gs && g.gs.quests.sq_ghost && !g.gs.quests.sq_ghost.done && !g.gs.flags['page_' + i]); });
      z.interact(x, zpos, '拾起发光的书页', 'page_pick', i, 1.8);
      g.pageMeshes.push(page);
    });
    // 庭院的可疑南瓜（sq_rou）
    const p = await g.lib.prop('halloween', 'pumpkin_orange');
    p.position.set(10, 0, 10);
    ZONES.yard.group.add(p);
    g.catPumpkin = p;
    ZONES.yard.updaters.push(() => { p.visible = !!(g.gs && g.gs.quests.sq_rou && !g.gs.quests.sq_rou.done); });
    ZONES.yard.interact(10, 10, '一个格外可疑的南瓜（变形术 G）', 'cat_pumpkin', null, 2);
  };

  // ---------- 夜巡骷髅（M2 后夜晚氛围） ----------
  g.maybeNightSpawns = async () => {
    const gs = g.gs;
    if (!gs.quests.m2?.done || gs.quests.m7?.done) return;
    if (!L.isCurfew(gs)) return;
    if (!['yard', 'stair'].includes(g.zoneId)) return;
    if (g.combat.liveEnemies().length) return;
    const e = await g.combat.spawnEnemy('skel_guard', g.player.pos.x + 6, g.player.pos.z + 6);
    e.onDeath = () => { L.addItem(gs, 'boneshard', 1); g.grantXp(12); };
    g.ui.toast('☠ 封印的裂隙渗出了幽影骷髅！', true);
    g.audio.sfx('ghost');
  };

  // ---------- 温室害虫（sq_green） ----------
  g.maybeGreenhousePests = async () => {
    const gs = g.gs;
    const st = gs.quests.sq_green;
    if (!st || st.done) return;
    const step = L.questById('sq_green').steps[st.step];
    if (step?.ev !== 'kill:spiderling:4') return;
    if (g.zoneId !== 'greenhouse' || g.combat.liveEnemies().length) return;
    for (let i = 0; i < 4; i++) {
      const e = await g.combat.spawnEnemy('spiderling', -8 + i * 5, (i % 2 ? 5 : -5));
      e.onDeath = () => {
        gs.flags.kills_spider = (gs.flags.kills_spider || 0) + 1;
        L.addItem(gs, 'spidersilk', 1);
        g.grantXp(10);
        if (gs.flags.kills_spider >= 4) g.fireQuestEvent('kill:spiderling:4');
      };
    }
    g.ui.toast('🕷 蛛巢爬虫在啃食幼苗！消灭它们！', true);
  };
}
