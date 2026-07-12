// ============ 菜单：任务/日程/背包/技能/关系/学业/系统 ============
import { QUESTS, ITEMS, SKILL_TREE, NPCS, SUBJECTS, CURRICULUM, WEEKDAYS, HOUSES, SPELLS, GRADES } from './data.js';
import { affinityLevel, canLearnSkill, learnSkill, useItem, examScore, gradeOf, weekdayOf, phaseOf, derivedStats } from './logic.js';

const $ = (id) => document.getElementById(id);

export class Journal {
  constructor(game) {
    this.g = game;
    this.tab = 'quests';
    document.querySelectorAll('.jt').forEach(b => b.onclick = () => {
      document.querySelectorAll('.jt').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      this.tab = b.dataset.tab;
      this.g.audio.sfx('page');
      this.render();
    });
    $('j-close').onclick = () => this.g.closeJournal();
  }
  render() {
    const gs = this.g.gs;
    const body = $('j-body');
    const R = {
      quests: () => {
        const started = Object.entries(gs.quests);
        if (!started.length) return '<p style="opacity:.6">还没有任务。去和城堡里的人聊聊吧。</p>';
        let html = '';
        const sorted = started.sort((a, b) => (a[1].done ? 1 : 0) - (b[1].done ? 1 : 0));
        for (const [id, st] of sorted) {
          const q = QUESTS.find(x => x.id === id);
          if (!q) continue;
          const giver = NPCS.find(n => n.id === q.giver);
          html += `<div class="q-item ${st.done ? 'done' : ''}">
            <b>${q.main ? '⭐' : '◇'} ${q.name}</b> <span style="font-size:12px;opacity:.6">${giver?.name || ''} ${st.done ? '· 已完成' : ''}</span>
            <div class="steps">${q.steps.map((s, i) => `<div>${i < st.step ? '☑' : (i === st.step ? '▶' : '○')} ${s.text}</div>`).join('')}</div>
          </div>`;
        }
        return html;
      },
      schedule: () => {
        const wd = weekdayOf(gs.day);
        let html = `<p style="margin-bottom:10px">今天是 <b style="color:var(--gold)">第 ${gs.day} 天 ${WEEKDAYS[wd]}</b> · ${phaseOf(gs.hour).name} ${String(gs.hour).padStart(2, '0')}:${String(gs.minute).padStart(2, '0')}</p>
        <table class="sched"><tr><th></th>${WEEKDAYS.map((w, i) => `<th ${i === wd ? 'class="now"' : ''}>${w}</th>`).join('')}</tr>`;
        for (const [ri, rname] of [['0', '上午'], ['1', '下午']]) {
          html += `<tr><th>${rname}</th>`;
          CURRICULUM.forEach((day, di) => {
            const c = day[+ri];
            const nm = c === 'duelclub_meet' ? '⚔ 决斗社' : (c ? SUBJECTS[c]?.icon + ' ' + SUBJECTS[c]?.name : '— 自由 —');
            html += `<td ${di === wd ? 'class="now"' : ''}>${nm}</td>`;
          });
          html += '</tr>';
        }
        html += `</table>
        <p style="margin-top:12px;font-size:13px;opacity:.75;line-height:1.9">☾ 时段规则：上午/下午上课（迟到会扣评分）· 黄昏自由活动与社团 · 夜晚 22:00 宵禁（潜行可溜出，小心巡逻画像）<br>
        ☀ 第 7 / 14 天为期末考试日 · 决斗社：周三/周六下午 · 温室植物每天浇水才会生长</p>`;
        return html;
      },
      bag: () => {
        const entries = Object.entries(gs.bag);
        let html = `<p style="margin-bottom:10px">银月币 <b style="color:var(--gold)">${gs.gold}</b> 🌙 · 点击药剂/食物可使用</p><div class="grid-items">`;
        for (const [id, n] of entries) {
          const it = ITEMS[id]; if (!it) continue;
          html += `<div class="g-item" data-item="${id}" title="${it.desc}"><div class="ic">${it.icon}</div><div class="n">${n}</div><div class="nm">${it.name}</div></div>`;
        }
        html += '</div>';
        if (!entries.length) html += '<p style="opacity:.5">背包空空如也。</p>';
        return html;
      },
      skills: () => {
        let html = `<p style="margin-bottom:10px">可用技能点：<b style="color:var(--gold)">${gs.skillPts}</b>　已习得咒语：${gs.knownSpells.map(s => SPELLS[s].icon + SPELLS[s].name).join('、')}</p><div class="skill-tree">`;
        for (const [colId, col] of Object.entries(SKILL_TREE)) {
          html += `<div class="skill-col"><h4>${col.icon} ${col.name}</h4>`;
          for (const n of col.nodes) {
            const owned = gs.skills.includes(n.id);
            const can = canLearnSkill(gs, n.id).ok;
            html += `<div class="sk-node ${owned ? 'owned' : can ? 'avail' : 'locked'}" data-skill="${n.id}">
              <b>${n.name}</b>${n.desc}<div style="opacity:.6;font-size:11px">${owned ? '已掌握' : `消耗 ${n.cost} 点`}</div></div>`;
          }
          html += '</div>';
        }
        return html + '</div>';
      },
      friends: () => {
        let html = '<p style="margin-bottom:10px">与人相处会累积羁绊。挚友可以成为同伴（对话邀请），同伴在冒险中会协同施法。</p>';
        const known = NPCS.filter(n => (gs.affinity[n.id] || 0) > 0 || ['lila', 'tag'].includes(n.id));
        for (const n of known) {
          const v = gs.affinity[n.id] || 0;
          const lv = affinityLevel(v);
          html += `<div class="fr-row"><span class="who">${n.ghost ? '👻' : ''}${n.name}</span><div class="h-b"><div style="width:${v}%"></div></div><span class="lv">${lv.name} ${v}</span></div>`;
        }
        if (gs.companion) {
          const c = NPCS.find(n => n.id === gs.companion);
          html += `<p style="margin-top:10px">当前同伴：<b style="color:var(--gold)">${c.name}</b>（按 J 关闭菜单后可解散：再次对话）</p>`;
        }
        return html;
      },
      scores: () => {
        let html = `<p style="margin-bottom:10px">学院积分榜 & 学业成绩（出勤和课堂表现会计入期末）</p>`;
        html += '<div style="display:flex;gap:14px;margin-bottom:14px">';
        const sortedH = Object.entries(gs.housePoints).sort((a, b) => b[1] - a[1]);
        for (const [hid, pts] of sortedH) {
          const h = HOUSES[hid];
          html += `<div style="flex:1;text-align:center;padding:10px;border:1px solid ${hid === gs.house ? 'var(--gold)' : '#2a3050'};border-radius:10px">
            <div style="color:#${h.color.toString(16).padStart(6, '0')};letter-spacing:2px">${h.name}</div>
            <div style="font-size:22px;color:var(--gold)">${pts}</div></div>`;
        }
        html += '</div>';
        for (const [sid, s] of Object.entries(SUBJECTS)) {
          const arr = gs.grades[sid] || [];
          const att = gs.attend[sid] || 0;
          const ex = examScore(gs, sid);
          const gr = gradeOf(ex);
          html += `<div class="fr-row"><span class="who">${s.icon} ${s.name}</span>
            <span style="flex:1;font-size:12px;opacity:.8">出勤 ${att} 次 · 平时 ${arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : '—'} 分</span>
            <span class="lv">预估评级 ${gr.g}·${gr.name}</span></div>`;
        }
        html += `<p style="margin-top:8px;font-size:12px;opacity:.6">已获称号：${gs.titles.length ? gs.titles.join('、') : '暂无'}</p>`;
        return html;
      },
      system: () => `
        <div style="display:flex;flex-direction:column;gap:12px;max-width:420px">
          <button class="mg-btn" id="sys-save">✦ 保存进度</button>
          <button class="mg-btn" id="sys-net">✧ 联机大厅（参观宿舍 / 决斗 / 共探副本）</button>
          <button class="mg-btn" id="sys-mute">${this.g.audio.muted ? '🔇 取消静音' : '🔊 静音 (M)'}</button>
          <button class="mg-btn" id="sys-title">☾ 回到标题（自动保存）</button>
          <p style="font-size:12px;opacity:.6;line-height:1.9">操作：WASD 移动 · Shift 奔跑 · 鼠标右键/点击画面转视角 · 1-5/Q/F/G/R 施法 · 左键释放 · 空格 翻滚闪避 · E 互动 · J/Tab 菜单 · M 静音<br>
          《霍格沃茨之遗·星轨篇》同人作品 · KayKit CC0 美术 · WebAudio 合成音乐 · Three.js 渲染</p>
        </div>`,
    };
    body.innerHTML = R[this.tab]();
    // 事件绑定
    body.querySelectorAll('[data-item]').forEach(el => el.onclick = () => {
      const r = useItem(gs, el.dataset.item);
      if (r) {
        this.g.audio.sfx(r.mana ? 'bubble' : 'coin');
        this.g.ui.toast(`使用了 ${r.name}`);
        this.render();
        this.g.refreshHud();
      } else this.g.ui.toast('现在不能使用它', true);
    });
    body.querySelectorAll('[data-skill]').forEach(el => el.onclick = () => {
      const r = learnSkill(gs, el.dataset.skill);
      if (r.ok) {
        this.g.audio.sfx('levelup');
        this.g.ui.toast(`✦ 掌握「${r.node.name}」`);
        this.g.derived = derivedStats(gs);
        this.render();
      } else this.g.ui.toast(r.why, true);
    });
    body.querySelector('#sys-save') && (body.querySelector('#sys-save').onclick = () => { this.g.save(); this.g.ui.toast('☑ 已保存'); });
    body.querySelector('#sys-net') && (body.querySelector('#sys-net').onclick = () => { this.g.closeJournal(); this.g.net.openPanel(); });
    body.querySelector('#sys-mute') && (body.querySelector('#sys-mute').onclick = () => { this.g.audio.toggleMute(); this.render(); });
    body.querySelector('#sys-title') && (body.querySelector('#sys-title').onclick = () => { this.g.save(); location.search = ''; });
  }
}
