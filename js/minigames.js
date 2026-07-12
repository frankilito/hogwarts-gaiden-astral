// ============ 课堂/解谜小游戏（DOM 浮层，Promise 返回 0-100 分） ============
import { RECIPES, POT_STEPS, CONSTELLATIONS, RUNE_PUZZLE, SUBJECTS } from './data.js';

const $ = (id) => document.getElementById(id);
const AUTO = new URLSearchParams(location.search).has('autotest');

function host(html) {
  $('minigame').classList.remove('hidden');
  $('mg-body').innerHTML = html;
  return $('mg-body');
}
function close() { $('minigame').classList.add('hidden'); $('mg-body').innerHTML = ''; }

// ---------- 魔咒课：击靶 ----------
export function mgAim(audio, { rounds = 6, title = '魔咒课 · 击靶练习' } = {}) {
  return new Promise(res => {
    const h = host(`<h2>${title}</h2><p class="mg-sub">点击出现的靶星！挥杖要快，意念要准。</p>
      <div class="mg-zone" id="aim-zone"></div><p id="aim-score" style="margin-top:10px;letter-spacing:2px">0 / ${rounds}</p>`);
    const zone = h.querySelector('#aim-zone');
    let hit = 0, shown = 0, sumT = 0;
    function next() {
      if (shown >= rounds) {
        close();
        const score = Math.round(hit / rounds * 70 + Math.max(0, 30 - sumT / Math.max(1, hit) * 18));
        return res(Math.min(100, score));
      }
      shown++;
      const t0 = performance.now();
      const el = document.createElement('div');
      el.className = 'mg-target';
      el.style.left = 8 + Math.random() * 80 + '%';
      el.style.top = 8 + Math.random() * 70 + '%';
      zone.appendChild(el);
      const to = setTimeout(() => { el.remove(); next(); }, AUTO ? 220 : 1400);
      el.onmousedown = () => {
        clearTimeout(to);
        hit++; sumT += (performance.now() - t0) / 1000;
        audio.sfx('cast');
        $('aim-score').textContent = `${hit} / ${rounds}`;
        el.remove();
        setTimeout(next, 240);
      };
      if (AUTO) setTimeout(() => el.onmousedown?.(), 90);
    }
    next();
  });
}

// ---------- 魔药课：按序操作 ----------
export function mgBrew(audio, recipeId = null, { title = '魔药课 · 酿造' } = {}) {
  const r = RECIPES.find(x => x.id === recipeId) || RECIPES[0];
  return new Promise(res => {
    const h = host(`<h2>${title}：${r.name}</h2>
      <p class="mg-sub">配方顺序：${r.steps.map(s => POT_STEPS[s]).join(' → ')}　（记住它！）</p>
      <div class="mg-zone" id="brew-zone" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center"></div>
      <p id="brew-log" style="min-height:22px;color:#8fd"></p>`);
    const zone = h.querySelector('#brew-zone');
    const order = [...r.steps];
    let idx = 0, mistakes = 0;
    setTimeout(() => { h.querySelector('.mg-sub').textContent = '凭记忆完成操作：'; }, AUTO ? 100 : 2600);
    const opts = Object.keys(POT_STEPS).sort(() => Math.random() - 0.5);
    for (const s of opts) {
      const b = document.createElement('button');
      b.className = 'pot-step';
      b.textContent = POT_STEPS[s];
      b.onclick = () => {
        if (s === order[idx]) {
          idx++;
          audio.sfx('bubble');
          $('brew-log').textContent = '咕嘟…颜色变得漂亮了 (' + idx + '/' + order.length + ')';
          if (idx >= order.length) { close(); res({ score: Math.max(40, 100 - mistakes * 20), steps: order }); }
        } else {
          mistakes++;
          audio.sfx('hurt');
          $('brew-log').textContent = '⚠ 锅里冒出可疑的黑烟……（顺序错了）';
        }
      };
      zone.appendChild(b);
    }
    if (AUTO) {
      let i = 0;
      const T = setInterval(() => {
        const want = order[idx];
        const btn = [...zone.children].find(b => b.textContent === POT_STEPS[want]);
        btn?.click();
        if (++i > 8) clearInterval(T);
      }, 150);
    }
  });
}

// ---------- 草药课：照料 ----------
export function mgPlant(audio, { title = '草药课 · 温室实践' } = {}) {
  return new Promise(res => {
    const seq = ['🌱 播种', '💧 浇水', '🎵 哼歌安抚', '✂️ 修剪'];
    const h = host(`<h2>${title}</h2><p class="mg-sub">按照教授口令照料魔法植物！</p>
      <div class="mg-zone" id="plant-zone" style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap"></div>
      <p id="plant-ask" style="font-size:20px;color:#ffe9ad;letter-spacing:3px"></p><p id="plant-log"></p>`);
    const zone = h.querySelector('#plant-zone');
    let round = 0, good = 0;
    const acts = [...seq].sort(() => Math.random() - 0.5);
    for (const a of acts) {
      const b = document.createElement('button');
      b.className = 'pot-step'; b.textContent = a;
      b.onclick = () => {
        if (a === curAsk) { good++; audio.sfx('plant'); $('plant-log').textContent = '植物开心地晃了晃叶子～'; }
        else { audio.sfx('hurt'); $('plant-log').textContent = '尖叫根发出了抗议的吱吱声！'; }
        next();
      };
      zone.appendChild(b);
    }
    let curAsk = null;
    function next() {
      if (round >= 5) { close(); return res(Math.round(good / 5 * 100)); }
      round++;
      curAsk = seq[Math.floor(Math.random() * seq.length)];
      $('plant-ask').textContent = `教授：「现在——${curAsk.slice(2)}！」`;
      if (AUTO) setTimeout(() => [...zone.children].find(b => b.textContent === curAsk)?.click(), 100);
    }
    next();
  });
}

// ---------- 天文课：连星座 ----------
export function mgStars(audio, { title = '天文课 · 描绘星座' } = {}) {
  const C = CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
  return new Promise(res => {
    const h = host(`<h2>${title}</h2><p class="mg-sub">按顺序点亮「${C.name}」的星辰（从最亮的开始，依次相连）</p>
      <div class="mg-zone" id="star-zone" style="background:radial-gradient(ellipse at 50% 40%, #101830, #05060a); border-radius:10px; overflow:hidden"></div>`);
    const zone = h.querySelector('#star-zone');
    let idx = 0, wrong = 0;
    const t0 = performance.now();
    C.stars.forEach(([x, y], i) => {
      const el = document.createElement('div');
      el.className = 'star-dot';
      el.style.left = (x * 92 + 2) + '%';
      el.style.top = (y * 82 + 4) + '%';
      el.style.transform = `scale(${1.4 - i * 0.12})`;
      el.onclick = () => {
        if (i === idx) {
          el.classList.add('linked');
          audio.sfx('sparkle');
          idx++;
          if (idx >= C.stars.length) {
            const dt = (performance.now() - t0) / 1000;
            close();
            res(Math.min(100, Math.round(100 - wrong * 15 - Math.max(0, dt - 10) * 2)));
          }
        } else { wrong++; audio.sfx('hurt'); }
      };
      zone.appendChild(el);
    });
    if (AUTO) {
      const T = setInterval(() => {
        const el = zone.children[idx];
        if (!el) { clearInterval(T); return; }
        el.click();
      }, 120);
    }
  });
}

// ---------- 符文锁（M5） ----------
export function mgRunes(audio) {
  return new Promise(res => {
    const { runes, answer, answerHint } = RUNE_PUZZLE;
    const h = host(`<h2>星辉锁</h2><p class="mg-sub">${answerHint}<br>☉=日 ☽=月 ✶=星 ♆=水 —— 按谜语顺序点亮四枚符文</p>
      <div class="mg-zone" style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap" id="rune-zone"></div>`);
    const zone = h.querySelector('#rune-zone');
    let seq = [];
    runes.forEach((r, i) => {
      const b = document.createElement('div');
      b.className = 'rune-cell';
      b.textContent = r;
      b.onclick = () => {
        b.classList.add('lit');
        audio.sfx('sparkle');
        seq.push(i);
        if (seq.length >= answer.length) {
          const ok = answer.every((a, k) => seq[k] === a);
          if (ok) { close(); res(true); }
          else {
            audio.sfx('hurt');
            seq = [];
            [...zone.children].forEach(c => c.classList.remove('lit'));
            h.querySelector('.mg-sub').innerHTML = '符文黯淡了下去……再试一次。<br>「日沉(☉)月升(☽)，星(✶)落于水(♆)」';
          }
        }
      };
      zone.appendChild(b);
    });
    if (AUTO) {
      let k = 0;
      const T = setInterval(() => {
        if (k >= answer.length) { clearInterval(T); return; }
        zone.children[answer[k++]].click();
      }, 130);
    }
  });
}

// ---------- 考试（综合问答） ----------
const EXAM_QA = [
  { q: '让物体浮空的咒语是？', a: ['悬浮咒', '星火弹', '变形术'], c: 0 },
  { q: '活力药剂的第一步是？', a: ['文火加热', '研磨', '顺时针搅拌'], c: 1 },
  { q: '月光花只在什么时候绽放？', a: ['正午', '雨天', '夜晚'], c: 2 },
  { q: '尖叫根闹脾气时应该？', a: ['浇冰水', '唱歌安抚', '拔出来'], c: 1 },
  { q: '雷弧链最适合对付？', a: ['成群的敌人', '单个巨怪', '幽灵'], c: 0 },
  { q: '禁书区在图书馆的哪个方位？', a: ['西南角', '东北角', '正中央'], c: 0 },
  { q: '护盾被击破时会发生什么？', a: ['什么也没有', '反弹弹体', '使用者昏迷'], c: 1 },
  { q: '星轨异动的震源位于？', a: ['天文塔', '禁书区正下方', '温室'], c: 1 },
];
export function mgExam(audio, subjectName) {
  const qs = [...EXAM_QA].sort(() => Math.random() - 0.5).slice(0, 5);
  return new Promise(res => {
    let idx = 0, good = 0;
    function ask() {
      if (idx >= qs.length) { close(); return res(Math.round(good / qs.length * 100)); }
      const cur = qs[idx];
      const h = host(`<h2>期末考试 · ${subjectName}</h2><p class="mg-sub">第 ${idx + 1}/${qs.length} 题</p>
        <p style="font-size:18px;letter-spacing:2px;margin:16px 0">${cur.q}</p>
        <div class="mg-zone" style="min-height:auto" id="exam-zone"></div>`);
      const zone = h.querySelector('#exam-zone');
      cur.a.forEach((ans, i) => {
        const b = document.createElement('button');
        b.className = 'mg-btn'; b.textContent = ans;
        b.onclick = () => {
          if (i === cur.c) { good++; audio.sfx('sparkle'); } else audio.sfx('hurt');
          idx++; ask();
        };
        zone.appendChild(b);
      });
      if (AUTO) setTimeout(() => zone.children[cur.c]?.click(), 90);
    }
    ask();
  });
}

// ---------- 防御课：假人快打 ----------
export function mgDefense(audio) {
  return mgAim(audio, { rounds: 8, title: '防御课 · 快速反应' });
}

export function closeMg() { close(); }
export const MG_BY_SUBJECT = { aim: mgAim, brew: mgBrew, plant: mgPlant, stars: mgStars, duelpractice: mgDefense };
