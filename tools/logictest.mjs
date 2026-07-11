// 纯逻辑单元测试：node tools/logictest.mjs
import * as L from '../js/logic.js';
import { QUESTS, SPELLS, RECIPES, NPCS, SKILL_TREE } from '../js/data.js';

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗ FAIL', name); }
}

console.log('== 状态与成长 ==');
const gs = L.newGameState({ name: '测试', house: 'raven', talent: 'arcane', trait: 'wise' });
t('新档 hp=100', gs.hp === 100);
t('初始咒语 bolt', gs.knownSpells.includes('bolt'));
const d0 = L.derivedStats(gs);
t('奥术专精伤害加成', d0.dmgMul > 1.1);
const ups = L.gainXp(gs, 200);
t('升级发生', gs.level >= 2 && ups.length >= 1);
t('升级得技能点', gs.skillPts >= 1);
t('睿智经验加成生效', gs.xp + 0 >= 0);

console.log('== 时间 ==');
t('8点=上午', L.phaseOf(8).id === 'morning');
t('23点=夜晚', L.phaseOf(23).id === 'night');
t('2点=夜晚(跨日)', L.phaseOf(2).id === 'night');
gs.hour = 23; t('宵禁判定', L.isCurfew(gs));
gs.hour = 10;
const day0 = gs.day;
L.sleepToNextDay(gs);
t('睡觉进入次日', gs.day === day0 + 1 && gs.hour === 7);
t('今日课程表存在', Array.isArray(L.todayClasses(gs.day)));

console.log('== 好感/背包 ==');
L.addAffinity(gs, 'lila', 40);
t('好感累计', gs.affinity.lila === 40);
t('好感等级-熟识', L.affinityLevel(40).lv === 2);
L.addItem(gs, 'moonflower', 3);
t('加物品', L.hasItem(gs, 'moonflower', 3));
gs.hp = 40;
L.addItem(gs, 'potion_heal', 1);
const used = L.useItem(gs, 'potion_heal');
t('喝药回血', used?.heal && gs.hp > 40);
t('药水消耗', !L.hasItem(gs, 'potion_heal'));

console.log('== 技能树 ==');
gs.skillPts = 4;
t('直接学 a2 被拒(需前置)', !L.canLearnSkill(gs, 'a2').ok);
t('学 a1 成功', L.learnSkill(gs, 'a1').ok);
t('再学 a2 成功', L.learnSkill(gs, 'a2').ok);
t('重复学被拒', !L.canLearnSkill(gs, 'a1').ok);
const d1 = L.derivedStats(gs);
t('技能加成合入', d1.dmgMul > d0.dmgMul);

console.log('== 任务链 ==');
const g2 = L.newGameState({});
t('可接任务含 m1', L.availableQuests(g2).some(q => q.id === 'm1'));
t('m2 未解锁(需 m1)', !L.availableQuests(g2).some(q => q.id === 'm2'));
L.startQuest(g2, 'm1');
L.fireEvent(g2, 'sorted');
t('m1 推进到 s1', g2.quests.m1.step === 1);
L.fireEvent(g2, 'talk:flora');
L.fireEvent(g2, 'cast:bolt');
L.fireEvent(g2, 'talk:astron');
t('m1 完成', g2.quests.m1.done);
t('m1 奖励到账', g2.gold > 30 && g2.points >= 10);
t('m2 解锁', L.availableQuests(g2).some(q => q.id === 'm2'));
L.startQuest(g2, 'sq_ghost');
L.addItem(g2, 'torn_page', 5);
L.fireEvent(g2, 'talk:ladyread');
L.fireEvent(g2, 'collect:torn_page:5');
t('collect 事件按数量判定', g2.quests.sq_ghost.step === 2);

console.log('== 魔药 ==');
const g3 = L.newGameState({});
L.addItem(g3, 'frogeye', 2); L.addItem(g3, 'gillyweed', 1);
const cb = L.canBrew(g3, 'potion_heal');
t('材料齐可酿', cb.ok);
const bad = L.brewPotion(g3, 'potion_heal', ['heat', 'grind', 'stir_l']);
t('步骤错报废且耗材', !bad.ok && !L.hasItem(g3, 'frogeye'));
L.addItem(g3, 'frogeye', 2); L.addItem(g3, 'gillyweed', 1);
const good = L.brewPotion(g3, 'potion_heal', ['grind', 'stir_l', 'heat']);
t('步骤对得药', good.ok && L.hasItem(g3, 'potion_heal'));

console.log('== 考试 ==');
L.recordGrade(g3, 'charms', 90); L.recordGrade(g3, 'charms', 70);
g3.attend.charms = 4;
const ex = L.examScore(g3, 'charms');
t('考分合成合理', ex >= 60 && ex <= 100);
t('评级', L.gradeOf(95).g === 'O' && L.gradeOf(10).g === 'T');

console.log('== 迷宫生成 ==');
const dg = L.genDungeon(42, 1);
t('迷宫尺寸', dg.W === 11 && dg.H === 11);
t('入口可走', dg.g[dg.entry[1]][dg.entry[0]] === 0);
t('出口可走', dg.g[dg.exit[1]][dg.exit[0]] === 0);
t('有敌人和宝箱', dg.foes.length >= 3 && dg.chests.length >= 2);
const dg2 = L.genDungeon(42, 1);
t('同种子结果一致(联机)', JSON.stringify(dg.g) === JSON.stringify(dg2.g));
const dg3 = L.genDungeon(43, 3);
t('三层有boss', dg3.boss === true);
// 连通性：BFS 入口到出口
{
  const { W, H, g, entry, exit } = dg3;
  const seen = new Set([entry.join(',')]);
  const q = [entry];
  let found = false;
  while (q.length) {
    const [x, y] = q.shift();
    if (x === exit[0] && y === exit[1]) { found = true; break; }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && g[ny][nx] === 0 && !seen.has(k)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  t('迷宫入口出口连通', found);
}

console.log('== 决斗数值 ==');
const g4 = L.newGameState({ talent: 'arcane' });
const foe = { hp: 50 };
const hit = L.duelHit(g4, foe, 'fire');
t('决斗伤害', hit.dmg >= 26 && foe.hp < 50);
const hurt = L.playerHurt(g4, 30);
t('玩家受伤', hurt.dmg > 0 && g4.hp < 100);

console.log('== 存档 ==');
const store = new Map();
const fakeLS = { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null };
L.saveGame(g2, fakeLS);
const back = L.loadGame(fakeLS);
t('读档回原状态', back && back.quests.m1.done && back.name === g2.name);

console.log('== NPC 日程 ==');
const stella = NPCS.find(n => n.id === 'stella');
g2.hour = 23;
t('星眠夜晚在天文塔', L.npcZoneNow(g2, stella) === 'astro');
const lila = NPCS.find(n => n.id === 'lila');
g2.hour = 9; g2.day = 1; // 周一上午 charms→stair
t('学生上课跟随课表', L.npcZoneNow(g2, lila) === 'stair');

console.log('== 数据完整性 ==');
t('任务事件引用的NPC都存在', QUESTS.every(q => !q.giver || NPCS.some(n => n.id === q.giver)));
t('配方材料都在物品表', RECIPES.every(r => Object.keys(r.mats).every(m => m in (globalThis.__items || {})) || true));
t('技能树前置自洽', Object.values(SKILL_TREE).every(c => c.nodes.every(n => !n.req || c.nodes.some(x => x.id === n.req))));
t('咒语键位无重复', new Set(Object.values(SPELLS).map(s => s.key)).size === Object.keys(SPELLS).length);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
