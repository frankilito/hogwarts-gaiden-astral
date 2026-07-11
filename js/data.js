// ============ 《霍格沃茨之遗·星轨篇》内容数据层（纯数据，Node 可测） ============

export const HOUSES = {
  lion:   { id: 'lion',   name: '烈狮学院', color: 0xc0392b, banner: 'red',    motto: '勇气是黑夜里的第一支火把', common: '烈狮塔休息室' },
  raven:  { id: 'raven',  name: '慧鸦学院', color: 0x2e5fa3, banner: 'blue',   motto: '智慧是最锋利的魔杖', common: '慧鸦塔休息室' },
  snake:  { id: 'snake',  name: '翠蛇学院', color: 0x1e8449, banner: 'green',  motto: '野心让星辰俯首', common: '翠蛇地窖休息室' },
  badger: { id: 'badger', name: '忠獾学院', color: 0xb7950b, banner: 'yellow', motto: '忠诚比石墙更坚固', common: '忠獾谷仓休息室' },
};

export const CC_MODELS = [
  { id: 'Mage',        name: '学者装束', desc: '宽袍与尖帽，天生的咒语使。' },
  { id: 'Rogue',       name: '轻装学徒', desc: '灵活的短打装束，行动矫健。' },
  { id: 'Knight',      name: '铠卫学徒', desc: '骑士世家子弟，自带护甲质感。' },
  { id: 'Rogue_Hooded', name: '兜帽行者', desc: '神秘的兜帽，适合夜行者。' },
  { id: 'Barbarian',   name: '蛮荒交换生', desc: '来自北境的交换生，力大无穷。' },
];

export const TALENTS = [
  { id: 'arcane', name: '奥术专精', icon: '✦', desc: '攻击咒语伤害 +15%', mod: { dmg: 1.15 } },
  { id: 'guard',  name: '守护专精', icon: '🛡', desc: '护盾强度 +30%，受伤 -10%', mod: { shield: 1.3, taken: 0.9 } },
  { id: 'alchemy', name: '炼金专精', icon: '⚗', desc: '魔药效果 +40%，采集双倍', mod: { potion: 1.4, gather: 2 } },
  { id: 'astral', name: '星象专精', icon: '☾', desc: '魔力上限 +30，夜晚移动加速', mod: { mp: 30, nightspeed: 1.15 } },
];

export const TRAITS = [
  { id: 'brave', name: '勇敢', desc: '体力上限 +25', mod: { hp: 25 } },
  { id: 'wise',  name: '睿智', desc: '获得经验 +20%', mod: { xp: 1.2 } },
  { id: 'deft',  name: '灵巧', desc: '咒语冷却 -15%', mod: { cd: 0.85 } },
  { id: 'calm',  name: '沉静', desc: '魔力回复 +50%', mod: { mpregen: 1.5 } },
];

// ============ 咒语 ============
export const SPELLS = {
  bolt:   { id: 'bolt',   key: '1', name: '星火弹',   icon: '✨', color: 0xffd27a, mp: 4,  cd: 0.55, dmg: 12, unlock: 'start',   desc: '基础奥术弹，点到成伤。' },
  fire:   { id: 'fire',   key: '2', name: '烈焰冲击', icon: '🔥', color: 0xff7038, mp: 12, cd: 3.2, dmg: 26, unlock: 'charms1', desc: '喷吐扇形烈焰，可点燃蛛网与灯烛。', burn: 3 },
  ice:    { id: 'ice',    key: '3', name: '霜冻新星', icon: '❄️', color: 0x9fdcff, mp: 14, cd: 4.5, dmg: 18, unlock: 'charms2', desc: '冻结身边敌人 2.5 秒，可冻结水面机关。', freeze: 2.5 },
  arc:    { id: 'arc',    key: '4', name: '雷弧链',   icon: '⚡', color: 0xbfa8ff, mp: 16, cd: 5,   dmg: 22, unlock: 'duelclub', desc: '闪电在至多 3 名敌人间跳跃，可充能古代机关。', chain: 3 },
  beam:   { id: 'beam',   key: '5', name: '辉光射线', icon: '🌟', color: 0xffeeb0, mp: 3,  cd: 0,   dmg: 30, unlock: 'm6',      desc: '持续凝聚的光束，每秒灼烧。', channel: true },
  shield: { id: 'shield', key: 'Q', name: '圣盾护体', icon: '🛡️', color: 0x8ecbff, mp: 10, cd: 6,   dmg: 0,  unlock: 'defense1', desc: '展开星辉护盾，抵挡一次重击并反弹弹体。', shield: 40 },
  levit:  { id: 'levit',  key: 'F', name: '悬浮咒',   icon: '🪶', color: 0xcfe8ff, mp: 6,  cd: 1,   dmg: 0,  unlock: 'charms1', desc: '让书本、雕像与轻小敌人浮空。解谜关键。', utility: true },
  morph:  { id: 'morph',  key: 'G', name: '变形术',   icon: '🎃', color: 0xffb0e0, mp: 15, cd: 8,   dmg: 0,  unlock: 'transfig', desc: '把小型敌人变成无害的南瓜 4 秒。', morph: 4 },
  portal: { id: 'portal', key: 'R', name: '星门',     icon: '🌀', color: 0xa78bfa, mp: 20, cd: 10,  dmg: 0,  unlock: 'm5',      desc: '掷出星门锚点并瞬移过去。可穿越栅栏机关。', blink: 14 },
};
export const SPELL_ORDER = ['bolt', 'fire', 'ice', 'arc', 'beam', 'shield', 'levit', 'morph', 'portal'];

// ============ 技能树（3 系 × 5 节点） ============
export const SKILL_TREE = {
  arcane: { name: '奥术', icon: '✦', nodes: [
    { id: 'a1', name: '聚能指诀', desc: '咒语伤害 +10%', cost: 1, mod: { dmg: 1.10 } },
    { id: 'a2', name: '燃星术', desc: '烈焰点燃时间 +2s', cost: 1, req: 'a1', mod: { burn: 2 } },
    { id: 'a3', name: '穿透咒锋', desc: '星火弹可穿透 1 名敌人', cost: 2, req: 'a2', mod: { pierce: 1 } },
    { id: 'a4', name: '雷暴亲和', desc: '雷弧链可多跳 2 个目标', cost: 2, req: 'a3', mod: { chain: 2 } },
    { id: 'a5', name: '星辉共鸣', desc: '辉光射线伤害 +50%', cost: 3, req: 'a4', mod: { beam: 1.5 } },
  ]},
  guard: { name: '守护', icon: '🛡', nodes: [
    { id: 'g1', name: '韧体咒', desc: '体力上限 +20', cost: 1, mod: { hp: 20 } },
    { id: 'g2', name: '盾墙精研', desc: '护盾强度 +25%', cost: 1, req: 'g1', mod: { shield: 1.25 } },
    { id: 'g3', name: '疾影步', desc: '翻滚闪避距离 +40%', cost: 2, req: 'g2', mod: { dodge: 1.4 } },
    { id: 'g4', name: '荆棘反射', desc: '护盾反弹伤害 x2', cost: 2, req: 'g3', mod: { reflect: 2 } },
    { id: 'g5', name: '不屈意志', desc: '濒死时每场战斗自动满盾一次', cost: 3, req: 'g4', mod: { lastStand: 1 } },
  ]},
  utility: { name: '辅助', icon: '☾', nodes: [
    { id: 'u1', name: '冥想吐纳', desc: '魔力回复 +30%', cost: 1, mod: { mpregen: 1.3 } },
    { id: 'u2', name: '轻身咒', desc: '奔跑速度 +12%', cost: 1, req: 'u1', mod: { speed: 1.12 } },
    { id: 'u3', name: '药理直觉', desc: '魔药与食物效果 +30%', cost: 2, req: 'u2', mod: { potion: 1.3 } },
    { id: 'u4', name: '星门熟稔', desc: '星门冷却 -40%', cost: 2, req: 'u3', mod: { portalcd: 0.6 } },
    { id: 'u5', name: '时之沙', desc: '每天获得一次「重掷时段」机会', cost: 3, req: 'u4', mod: { rewind: 1 } },
  ]},
};

// ============ 物品 ============
export const ITEMS = {
  // 材料
  moonflower: { name: '月光花', icon: '🌸', type: 'mat', desc: '只在夜晚的禁林绽放。' },
  glowcap:    { name: '萤光菇', icon: '🍄', type: 'mat', desc: '地下密室的石缝里常见。' },
  stardust:   { name: '星尘',   icon: '✨', type: 'mat', desc: '天文塔收集的陨星碎屑。' },
  gillyweed:  { name: '鳃草',   icon: '🌿', type: 'mat', desc: '温室水槽栽培的软草。' },
  frogeye:    { name: '蛙眼豆', icon: '🫘', type: 'mat', desc: '魔药课的常用材料。' },
  spidersilk: { name: '蛛丝',   icon: '🕸', type: 'mat', desc: '禁林蛛巢的产物。' },
  boneshard:  { name: '碎骨',   icon: '🦴', type: 'mat', desc: '骷髅卫兵的残骸。' },
  // 魔药
  potion_heal: { name: '活力药剂', icon: '🧪', type: 'potion', heal: 50, desc: '恢复 50 点体力。' },
  potion_mana: { name: '魔力药剂', icon: '💙', type: 'potion', mana: 60, desc: '恢复 60 点魔力。' },
  potion_lucky: { name: '福灵剂',  icon: '🍀', type: 'potion', buff: 'lucky', desc: '10 分钟内考试与采集必得优评。' },
  potion_night: { name: '夜视药剂', icon: '🦉', type: 'potion', buff: 'night', desc: '宵禁潜行时不易被level察觉。' },
  // 任务物品
  old_key:    { name: '锈蚀的钥匙', icon: '🗝', type: 'quest', desc: '血伯爵的遗物，密室之门的钥匙。' },
  torn_page:  { name: '散落的书页', icon: '📜', type: 'quest', desc: '悦读夫人生前挚爱的诗集残页。' },
  star_chart: { name: '星轨图',    icon: '🌌', type: 'quest', desc: '记录着星轨异动的古老图卷。' },
  seal_gem:   { name: '封印辉石',  icon: '💎', type: 'quest', desc: '重铸封印所需的核心宝石。' },
  cat_statue: { name: '猫的雕像',  icon: '🐈', type: 'quest', desc: '小柔丢失的幸运物，被人变形藏起来了。' },
  // 食物
  pumpkin_pie: { name: '南瓜馅饼', icon: '🥧', type: 'food', heal: 25, desc: '大厅晚宴的招牌点心。' },
  roast_leg:  { name: '烤肉腿',   icon: '🍗', type: 'food', heal: 35, desc: '塔格的最爱。' },
};

export const RECIPES = [
  { id: 'potion_heal', name: '活力药剂', mats: { frogeye: 2, gillyweed: 1 }, steps: ['grind', 'stir_l', 'heat'], time: '任意' },
  { id: 'potion_mana', name: '魔力药剂', mats: { glowcap: 2, stardust: 1 }, steps: ['grind', 'stir_r', 'stir_l'], time: '任意' },
  { id: 'potion_night', name: '夜视药剂', mats: { glowcap: 1, spidersilk: 2 }, steps: ['heat', 'grind', 'stir_r'], time: '夜晚' },
  { id: 'potion_lucky', name: '福灵剂', mats: { moonflower: 2, stardust: 2 }, steps: ['stir_l', 'stir_l', 'grind', 'heat'], time: '夜晚' },
];
export const POT_STEPS = { grind: '🪨 研磨', stir_l: '↺ 逆时针搅拌', stir_r: '↻ 顺时针搅拌', heat: '🔥 文火加热' };

export const PLANTS = [
  { id: 'gillyweed', name: '鳃草', days: 1, water: 1, yield: 2 },
  { id: 'moonflower', name: '月光花', days: 2, water: 2, yield: 1, night: true },
  { id: 'frogeye', name: '蛙眼豆藤', days: 1, water: 1, yield: 3 },
  { id: 'shriekroot', name: '尖叫根', days: 2, water: 3, yield: 1, fight: true },
];

// 宿舍家具目录（模型引用 furniture/dungeon 包）
export const FURNITURE = [
  { id: 'bed_single_A', name: '单人床', icon: '🛏', cost: 0, cat: 'dorm' },
  { id: 'armchair_pillows', name: '软垫扶手椅', icon: '🪑', cost: 30, cat: 'dorm' },
  { id: 'couch_pillows', name: '长沙发', icon: '🛋', cost: 60, cat: 'dorm' },
  { id: 'table_low', name: '矮桌', icon: '🪵', cost: 20, cat: 'dorm' },
  { id: 'lamp_standing', name: '落地灯', icon: '🕯', cost: 25, cat: 'dorm' },
  { id: 'shelf_A_big', name: '大书架', icon: '📚', cost: 45, cat: 'dorm' },
  { id: 'rug_oval_A', name: '椭圆地毯', icon: '🟠', cost: 15, cat: 'dorm' },
  { id: 'rug_rectangle_stripes_A', name: '条纹地毯', icon: '🟥', cost: 15, cat: 'dorm' },
  { id: 'pictureframe_large_A', name: '大画框', icon: '🖼', cost: 35, cat: 'dorm' },
  { id: 'pictureframe_standing_A', name: '立式画框', icon: '🪞', cost: 30, cat: 'dorm' },
  { id: 'cabinet_medium', name: '中柜', icon: '🗄', cost: 40, cat: 'dorm' },
  { id: 'cactus_medium_A', name: '盆栽仙人掌', icon: '🌵', cost: 18, cat: 'dorm' },
  { id: 'pumpkin_jack', name: '南瓜灯', icon: '🎃', cost: 22, cat: 'dorm', pack: 'halloween', file: 'pumpkin_orange_jackolantern' },
  { id: 'candle_triple', name: '三联烛台', icon: '🕯', cost: 12, cat: 'dorm', pack: 'dungeon', file: 'candle_triple.gltf' },
  { id: 'chest_gold', name: '鎏金宝箱', icon: '🧰', cost: 90, cat: 'dorm', pack: 'dungeon', file: 'chest_gold' },
];

// ============ 课程 ============
export const SUBJECTS = {
  charms:    { id: 'charms', name: '魔咒课', icon: '✨', teacher: 'flora', room: 'stair', minigame: 'aim', desc: '挥杖击中漂浮的靶星' },
  potions:   { id: 'potions', name: '魔药课', icon: '⚗️', teacher: 'severin', room: 'potions', minigame: 'brew', desc: '按配方顺序完成酿造' },
  herbology: { id: 'herbology', name: '草药课', icon: '🌿', teacher: 'pomona', room: 'greenhouse', minigame: 'plant', desc: '栽种与照料魔法植物' },
  astronomy: { id: 'astronomy', name: '天文课', icon: '🌌', teacher: 'stella', room: 'astro', minigame: 'stars', desc: '连出夜空中的星座' },
  defense:   { id: 'defense', name: '防御课', icon: '⚔️', teacher: 'ironward', room: 'yard', minigame: 'duelpractice', desc: '与假人实战演练' },
};

// 每周课表：周一~周日，[上午, 下午]，null 为自由活动
export const CURRICULUM = [
  ['charms', 'potions'], ['herbology', null], ['astronomy', 'defense'],
  ['potions', 'charms'], ['defense', null], [null, 'duelclub_meet'], [null, null],
];
export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const PHASES = [
  { id: 'dawn', name: '清晨', from: 6, to: 8 },
  { id: 'morning', name: '上午', from: 8, to: 12 },
  { id: 'noon', name: '午后', from: 12, to: 14 },
  { id: 'afternoon', name: '下午', from: 14, to: 18 },
  { id: 'evening', name: '黄昏', from: 18, to: 22 },
  { id: 'night', name: '夜晚', from: 22, to: 30 }, // 30 = 次日6点
];

// ============ NPC 名册 ============
// model: chars 里的 GLB; tint: 袍色; role; zone 日程
export const NPCS = [
  { id: 'astron', name: '阿斯特伦校长', model: 'Mage', tint: 0x7d5fd3, role: '校长', house: null,
    face: { brow: 'kind', beard: true }, home: 'stair',
    sched: { dawn: 'stair', morning: 'stair', noon: 'hall', afternoon: 'stair', evening: 'hall', night: 'astro' },
    lines: ['星辰的轨迹从不说谎，孩子。', '城堡的每一块砖，都记得每一个学徒的名字。'] },
  { id: 'flora', name: '芙罗拉教授', model: 'Mage', tint: 0x4f8de5, role: '魔咒课教师', house: 'raven',
    face: { brow: 'kind' }, home: 'stair',
    sched: { dawn: 'stair', morning: 'stair', noon: 'hall', afternoon: 'stair', evening: 'library', night: 'dorm_t' },
    lines: ['挥杖的弧线要像月亮一样温柔。', '记住：清晰的意念胜过响亮的咒文。'] },
  { id: 'severin', name: '塞维恩教授', model: 'Rogue_Hooded', tint: 0x1e4033, role: '魔药课教师', house: 'snake',
    face: { brow: 'stern' }, home: 'potions',
    sched: { dawn: 'potions', morning: 'potions', noon: 'potions', afternoon: 'potions', evening: 'hall', night: 'dorm_t' },
    lines: ['慢一点。魔药与耐心是同义词。', '搅拌的方向错了，整锅就成了毒药。……重来。'] },
  { id: 'pomona', name: '波姆娜教授', model: 'Barbarian', tint: 0xb7950b, role: '草药课教师', house: 'badger',
    face: { brow: 'kind' }, home: 'greenhouse',
    sched: { dawn: 'greenhouse', morning: 'greenhouse', noon: 'hall', afternoon: 'greenhouse', evening: 'greenhouse', night: 'dorm_t' },
    lines: ['植物听得懂善意，真的。', '尖叫根闹脾气的时候，唱首歌给它听。'] },
  { id: 'stella', name: '星眠教授', model: 'Mage', tint: 0x232d5c, role: '天文课教师', house: 'raven',
    face: { brow: 'dreamy' }, home: 'astro',
    sched: { dawn: 'astro', morning: 'library', noon: 'hall', afternoon: 'astro', evening: 'astro', night: 'astro' },
    lines: ['白天的星星也在天上，只是人们忘了抬头。', '最近的星轨……唔，它们在害怕什么。'] },
  { id: 'ironward', name: '铁卫教授', model: 'Knight', tint: 0xc0392b, role: '防御课教师', house: 'lion',
    face: { brow: 'stern' }, home: 'yard',
    sched: { dawn: 'yard', morning: 'yard', noon: 'hall', afternoon: 'yard', evening: 'yard', night: 'dorm_t' },
    lines: ['盾牌抬高！敌人不会等你准备好。', '疼痛是最好的老师，我只是它的助教。'] },
  { id: 'lila', name: '莉拉', model: 'Mage', tint: 0x2e5fa3, role: '慧鸦学生·可同伴', house: 'raven', companion: true,
    face: { brow: 'kind', hair: 'long' }, home: 'library',
    sched: { dawn: 'library', morning: 'class', noon: 'hall', afternoon: 'library', evening: 'library', night: 'common' },
    lines: ['这本《星轨编年史》第三卷不见了，真奇怪……', '嘘——图书馆的画像会打小报告的。'] },
  { id: 'tag', name: '塔格', model: 'Knight', tint: 0xc0392b, role: '烈狮学生·可同伴', house: 'lion', companion: true,
    face: { brow: 'happy' }, home: 'hall',
    sched: { dawn: 'hall', morning: 'class', noon: 'hall', afternoon: 'yard', evening: 'hall', night: 'common' },
    lines: ['大厅的烤肉腿是我活下去的理由！', '要打架？算我一个。要溜进厨房？更要算我一个！'] },
  { id: 'derek', name: '德里克', model: 'Rogue', tint: 0x1e8449, role: '翠蛇学生·对手', house: 'snake',
    face: { brow: 'smug' }, home: 'common',
    sched: { dawn: 'common', morning: 'class', noon: 'hall', afternoon: 'yard', evening: 'common', night: 'common' },
    lines: ['哦？就凭你也想赢决斗？', '我家族的名字刻在这城堡的奠基石上。' ] },
  { id: 'rou', name: '小柔', model: 'Rogue_Hooded', tint: 0xb7950b, role: '忠獾学生', house: 'badger',
    face: { brow: 'shy' }, home: 'greenhouse',
    sched: { dawn: 'greenhouse', morning: 'class', noon: 'hall', afternoon: 'greenhouse', evening: 'common', night: 'common' },
    lines: ['啊、对不起……我挡到你了吗？', '我的猫雕像……又不见了。呜。'] },
  { id: 'vera', name: '薇拉', model: 'Rogue', tint: 0xa93226, role: '决斗社社长', house: 'lion',
    face: { brow: 'stern', hair: 'pony' }, home: 'yard',
    sched: { dawn: 'yard', morning: 'class', noon: 'hall', afternoon: 'yard', evening: 'yard', night: 'common' },
    lines: ['决斗场上没有学院，只有胜负。', '想挑战我？先赢下三场晋级赛。'] },
  { id: 'orion', name: '奥里恩学长', model: 'Mage', tint: 0x455a8f, role: '神秘学长', house: 'raven',
    face: { brow: 'dreamy' }, home: 'astro',
    sched: { dawn: 'library', morning: 'library', noon: 'library', afternoon: 'astro', evening: 'astro', night: 'chamber' },
    lines: ['你也感觉到了吗？地板下的震颤。', '星轨图从不出错——出错的是读图的人。'] },
  { id: 'bloodcount', name: '血伯爵', model: 'Skeleton_Mage', tint: 0x8b1a2f, role: '幽灵', ghost: true, house: null,
    face: { brow: 'stern' }, home: 'chamber',
    sched: { dawn: 'chamber', morning: 'chamber', noon: 'chamber', afternoon: 'stair', evening: 'stair', night: 'chamber' },
    lines: ['活人的脚步声，总是这么吵。', '五百年了……封印的裂缝越来越大。'] },
  { id: 'ladyread', name: '悦读夫人', model: 'Skeleton_Rogue', tint: 0xcfd8ff, role: '幽灵', ghost: true, house: null,
    face: { brow: 'kind' }, home: 'library',
    sched: { dawn: 'library', morning: 'library', noon: 'library', afternoon: 'library', evening: 'library', night: 'library' },
    lines: ['轻一点翻页，书会疼的。', '我的诗集……散落在风里五百年了。'] },
];

// ============ 任务 ============
export const QUESTS = [
  { id: 'm1', main: true, name: '入学日', giver: 'astron',
    steps: [
      { id: 's0', text: '在大厅完成分院仪式', ev: 'sorted' },
      { id: 's1', text: '去旋转楼梯厅找芙罗拉教授领取魔杖', ev: 'talk:flora' },
      { id: 's2', text: '在训练场对靶星施放星火弹（左键）', ev: 'cast:bolt' },
      { id: 's3', text: '回大厅向校长复命', ev: 'talk:astron' },
    ], reward: { xp: 40, gold: 20, points: 10 },
    outro: '校长望着大厅穹顶的星光：「今夜的星轨有些吵闹……好好休息，孩子。」' },
  { id: 'm2', main: true, name: '夜半星轨', giver: 'astron', after: 'm1', minDay: 1,
    steps: [
      { id: 's0', text: '夜晚 22 点后登上天文塔', ev: 'reach:astro:night' },
      { id: 's1', text: '和星眠教授一起观测星轨', ev: 'talk:stella' },
      { id: 's2', text: '用望远镜完成观测（连星座）', ev: 'minigame:stars' },
      { id: 's3', text: '把星轨图带给奥里恩学长', ev: 'talk:orion' },
    ], reward: { xp: 60, gold: 25, item: { star_chart: 1 } },
    outro: '奥里恩盯着图卷，指尖发白：「震源在图书馆的禁书区下面。」' },
  { id: 'm3', main: true, name: '禁书区的低语', giver: 'orion', after: 'm2',
    steps: [
      { id: 's0', text: '白天与悦读夫人搭话，打听禁书区', ev: 'talk:ladyread' },
      { id: 's1', text: '夜晚潜入图书馆禁书区（别被巡逻画像发现）', ev: 'sneak:library' },
      { id: 's2', text: '用悬浮咒取下高架上的《星轨编年史·三》', ev: 'levit:book' },
      { id: 's3', text: '躲过守卫，把书带给奥里恩', ev: 'talk:orion' },
    ], reward: { xp: 80, gold: 30, points: -5, skill: 1 },
    outro: '书页里夹着一行血字：「密室之钥，随血伯爵长眠。」' },
  { id: 'm4', main: true, name: '血伯爵的条件', giver: 'bloodcount', after: 'm3',
    steps: [
      { id: 's0', text: '在楼梯厅找到血伯爵', ev: 'talk:bloodcount' },
      { id: 's1', text: '收集 3 朵月光花（夜晚的禁林）', ev: 'collect:moonflower:3' },
      { id: 's2', text: '在魔药教室酿一瓶夜视药剂', ev: 'brew:potion_night' },
      { id: 's3', text: '把祭品献给血伯爵', ev: 'talk:bloodcount' },
    ], reward: { xp: 90, gold: 40, item: { old_key: 1 }, skill: 1 },
    outro: '伯爵的指骨划过你的掌心，冰凉：「钥匙给你。别让那东西醒来。」' },
  { id: 'm5', main: true, name: '密室之门', giver: 'orion', after: 'm4',
    steps: [
      { id: 's0', text: '深夜与奥里恩在地下密室入口会合', ev: 'reach:chamber:night' },
      { id: 's1', text: '解开星辉锁：点亮正确的符文顺序', ev: 'minigame:runes' },
      { id: 's2', text: '用锈蚀的钥匙开启密室之门', ev: 'use:old_key' },
    ], reward: { xp: 100, gold: 40, spell: 'portal' },
    outro: '门后是旋转向下的石阶。奥里恩点亮杖尖：「从这里开始，星图失效了。」' },
  { id: 'm6', main: true, name: '星轨迷宫', giver: 'orion', after: 'm5',
    steps: [
      { id: 's0', text: '探索地下迷宫第一层，找到下行阶梯', ev: 'dungeon:floor:1' },
      { id: 's1', text: '通过第二层的机关长廊', ev: 'dungeon:floor:2' },
      { id: 's2', text: '击败封印厅的骷髅法师王', ev: 'boss:skeleking' },
      { id: 's3', text: '拾取封印辉石', ev: 'collect:seal_gem:1' },
    ], reward: { xp: 200, gold: 100, spell: 'beam', skill: 2 },
    outro: '辉石在你掌心发烫，整座城堡的烛火同时亮了一瞬。' },
  { id: 'm7', main: true, name: '封印修复', giver: 'astron', after: 'm6',
    steps: [
      { id: 's0', text: '把封印辉石带给校长', ev: 'talk:astron' },
      { id: 's1', text: '黄昏时分，在天文塔举行封印仪式', ev: 'reach:astro:evening' },
      { id: 's2', text: '为封印注入魔力（长按施法）', ev: 'ritual:seal' },
    ], reward: { xp: 300, gold: 150, points: 100, title: '星轨守望者' },
    outro: '星轨重新排列成安静的弧线。今晚大厅的晚宴，为你而设。' },
  // ---- 支线 ----
  { id: 'sq_lila', name: '月光下的书签', giver: 'lila', side: true, after: 'm2',
    steps: [
      { id: 's0', text: '听莉拉说完她的研究困境', ev: 'talk:lila' },
      { id: 's1', text: '夜晚陪莉拉去禁林采 2 朵月光花', ev: 'collect:moonflower:2' },
      { id: 's2', text: '回图书馆交给莉拉', ev: 'talk:lila' },
    ], reward: { xp: 50, aff: { lila: 20 }, item: { potion_mana: 1 } },
    outro: '莉拉把一枚压花书签塞给你：「谢谢。这是……友谊的证据。」' },
  { id: 'sq_tag', name: '深夜厨房大作战', giver: 'tag', side: true, after: 'm1',
    steps: [
      { id: 's0', text: '答应塔格的「宵夜计划」', ev: 'talk:tag' },
      { id: 's1', text: '宵禁后潜入大厅后厨（别被画像发现）', ev: 'sneak:hall' },
      { id: 's2', text: '带 2 只烤肉腿回公共休息室', ev: 'collect:roast_leg:2' },
      { id: 's3', text: '和塔格分赃……分享战利品', ev: 'talk:tag' },
    ], reward: { xp: 50, aff: { tag: 20 }, gold: 15 },
    outro: '塔格啃着肉腿宣布：「从今天起，你就是我过命的兄弟！」' },
  { id: 'sq_ghost', name: '散落的诗页', giver: 'ladyread', side: true, after: 'm1',
    steps: [
      { id: 's0', text: '倾听悦读夫人的心愿', ev: 'talk:ladyread' },
      { id: 's1', text: '找回 5 张散落的书页（城堡各处发光的纸页）', ev: 'collect:torn_page:5' },
      { id: 's2', text: '把诗集残页还给悦读夫人', ev: 'talk:ladyread' },
    ], reward: { xp: 70, aff: { ladyread: 30 }, item: { potion_lucky: 1 } },
    outro: '夫人的轮廓亮了一瞬，像被月光重新装订：「谢谢你，孩子。」' },
  { id: 'sq_rou', name: '猫在哪里', giver: 'rou', side: true, after: 'm1', needSpell: 'morph',
    steps: [
      { id: 's0', text: '安慰哭鼻子的小柔', ev: 'talk:rou' },
      { id: 's1', text: '在庭院找到「多出来的南瓜」，用变形术还原', ev: 'morph:cat_statue' },
      { id: 's2', text: '把猫雕像还给小柔', ev: 'talk:rou' },
    ], reward: { xp: 60, aff: { rou: 25 }, gold: 20 },
    outro: '小柔抱着雕像破涕为笑：「德里克那家伙……我、我才不告状呢。」' },
  { id: 'sq_duel', name: '决斗社晋级赛', giver: 'vera', side: true, after: 'm1',
    steps: [
      { id: 's0', text: '报名决斗社（周三/周六下午的庭院）', ev: 'talk:vera' },
      { id: 's1', text: '赢下第一场：对阵忠獾学员', ev: 'duelwin:club1' },
      { id: 's2', text: '赢下第二场：对阵德里克', ev: 'duelwin:derek' },
      { id: 's3', text: '决赛：挑战社长薇拉', ev: 'duelwin:vera' },
    ], reward: { xp: 120, gold: 60, spell: 'arc', title: '决斗新星' },
    outro: '薇拉收杖抱拳：「雷弧链的口诀，配得上你。」' },
  { id: 'sq_green', name: '温室的不速之客', giver: 'pomona', side: true, after: 'm2',
    steps: [
      { id: 's0', text: '波姆娜教授需要帮手', ev: 'talk:pomona' },
      { id: 's1', text: '清理温室里的 4 只蛛巢爬虫', ev: 'kill:spiderling:4' },
      { id: 's2', text: '向教授复命', ev: 'talk:pomona' },
    ], reward: { xp: 60, aff: { pomona: 15 }, item: { gillyweed: 3 } },
    outro: '教授往你兜里塞了把鳃草：「植物们说，要给你的。」' },
];

// ============ 对话树 ============
// 键: npcId 或 npcId@questId:step；VM 按优先级取
export const DIALOGS = {
  'astron@m1:s3': { seq: [
    { who: 'astron', mood: 'happy', t: '第一次施法的感觉如何？杖尖的光，会记住主人的心跳。' },
    { who: 'you', t: '（你如实描述了那阵暖流。）' },
    { who: 'astron', mood: 'calm', t: '很好。从今天起，你就是这座城堡的一部分了。' },
  ]},
  'flora@m1:s1': { seq: [
    { who: 'flora', mood: 'happy', t: '新生？让我看看……嗯，这支「星桦木·凤凰尾羽」在等你。' },
    { who: 'you', t: '（魔杖在你掌心轻轻震颤，洒下一串金色火花。）' },
    { who: 'flora', t: '它选择了你！去训练场试试吧——意念要清晰，手腕要放松。' },
  ]},
  'stella@m2:s1': { seq: [
    { who: 'stella', mood: 'worry', t: '你看，猎户的腰带今晚歪了三度。星星不会无缘无故挪动。' },
    { who: 'stella', t: '用那台望远镜，把你看到的星座描下来给我。' },
  ]},
  'orion@m2:s3': { seq: [
    { who: 'orion', mood: 'worry', t: '（他把星轨图对着烛光）震源……在图书馆禁书区的正下方。' },
    { who: 'orion', t: '禁书区夜里不对学生开放。但「不对学生开放」和「进不去」是两回事，对吧？' },
    { who: 'you', choice: [
      { t: '「我喜欢这个思路。」', eff: 'aff:orion:+5' },
      { t: '「被抓到会扣学院分的……」', eff: 'aff:orion:-2' },
    ]},
  ]},
  'bloodcount@m4:s0': { seq: [
    { who: 'bloodcount', mood: 'stern', t: '钥匙？呵。五百年来第一个敢开口的活人。' },
    { who: 'bloodcount', t: '我要月下之花的香气，和一瓶能看穿黑暗的药。让我确认你不是有勇无谋。' },
  ]},
  'lila@sq_lila:s0': { seq: [
    { who: 'lila', mood: 'worry', t: '我在写《月光植物图鉴》的批注，可月光花的样本三天前枯萎了。' },
    { who: 'lila', mood: 'shy', t: '禁林……我一个人不太敢去。你、你愿意陪我吗？夜里那片林子会发光的。' },
  ]},
  'tag@sq_tag:s0': { seq: [
    { who: 'tag', mood: 'happy', t: '嘘——过来。今晚的大计划：厨房、烤肉腿、两个传奇。' },
    { who: 'you', choice: [
      { t: '「算我一个。」', eff: 'aff:tag:+5' },
      { t: '「宵禁被抓要扣分的！」', eff: 'aff:tag:-2', t2: '塔格捂住你的嘴：「所以才要——不、被、抓、到。」' },
    ]},
  ]},
  'vera@sq_duel:s0': { seq: [
    { who: 'vera', mood: 'stern', t: '决斗社只收两种人：不怕输的，和输不起所以拼命赢的。你是哪种？' },
    { who: 'you', choice: [
      { t: '「我是来赢的。」', eff: 'aff:vera:+5' },
      { t: '「我是来学的。」', eff: 'aff:vera:+3' },
    ]},
  ]},
  'derek@duel': { seq: [
    { who: 'derek', mood: 'smug', t: '决斗台上可没有教授护着你。现在认输还来得及。' },
  ]},
  'ladyread@sq_ghost:s0': { seq: [
    { who: 'ladyread', mood: 'sad', t: '生前我最爱的那册诗集，在一场大风夜散了页。它们还在城堡里飘着……' },
    { who: 'ladyread', t: '五页。只要五页，我就能把整首诗背给你听。' },
  ]},
  'rou@sq_rou:s0': { seq: [
    { who: 'rou', mood: 'sad', t: '呜……我的猫雕像又不见了。奶奶留给我的……' },
    { who: 'rou', t: '德里克说庭院里「多了一个特别丑的南瓜」，还冲我笑……呜呜。' },
  ]},
};

// 决斗对手模板
export const DUELISTS = {
  dummy:   { name: '训练假人', model: 'Skeleton_Minion', hp: 40,  dmg: 0,  ai: 'dummy' },
  club1:   { name: '忠獾学员·邦斯', model: 'Knight', tint: 0xb7950b, hp: 70, dmg: 8, ai: 'basic' },
  derek:   { name: '德里克', model: 'Rogue', tint: 0x1e8449, hp: 100, dmg: 12, ai: 'tricky' },
  vera:    { name: '社长薇拉', model: 'Rogue', tint: 0xa93226, hp: 140, dmg: 15, ai: 'ace' },
  spiderling: { name: '蛛巢爬虫', model: 'Skeleton_Minion', tint: 0x334422, hp: 30, dmg: 6, ai: 'beast' },
  skel_guard: { name: '骷髅卫兵', model: 'Skeleton_Warrior', hp: 60, dmg: 10, ai: 'basic' },
  skel_archer: { name: '骷髅射手', model: 'Skeleton_Rogue', hp: 45, dmg: 9, ai: 'ranged' },
  skel_mage: { name: '骷髅法师', model: 'Skeleton_Mage', hp: 55, dmg: 12, ai: 'caster' },
  skeleking: { name: '骷髅法师王', model: 'Skeleton_Mage', tint: 0xd4af37, hp: 420, dmg: 18, ai: 'boss', scale: 1.6 },
  wolf:     { name: '暗影狼', model: 'Skeleton_Minion', tint: 0x222233, hp: 50, dmg: 10, ai: 'beast' },
};

// 星座（天文课）
export const CONSTELLATIONS = [
  { name: '猎户的腰带', stars: [[0.2,0.3],[0.35,0.42],[0.5,0.5],[0.65,0.58],[0.8,0.7]] },
  { name: '沉睡的巨龙', stars: [[0.15,0.6],[0.3,0.45],[0.45,0.55],[0.6,0.4],[0.72,0.55],[0.85,0.35]] },
  { name: '倒悬的王冠', stars: [[0.25,0.35],[0.4,0.55],[0.55,0.62],[0.7,0.55],[0.82,0.32]] },
];

// 符文锁谜题（M5）
export const RUNE_PUZZLE = { runes: ['☉','☽','✶','♆','🜁','🜃'], answerHint: '星辉锁刻着：「日沉月升，星落于水」', answer: [0,1,2,3] };

export const EXAM_DAYS = [7, 14];
export const SEMESTER_DAYS = 14;

// 学业评分等级
export const GRADES = [
  { min: 95, g: 'O', name: '卓越' }, { min: 80, g: 'E', name: '超出预期' },
  { min: 60, g: 'A', name: '合格' }, { min: 40, g: 'P', name: '勉强' }, { min: 0, g: 'T', name: '巨怪级' },
];

export const HOUSE_MATES = { // 分数榜初始（其他学院 AI 涨分）
  lion: 120, raven: 135, snake: 128, badger: 110,
};
