# 霍格沃茨之遗 · 星轨篇
**Hogwarts Legacy Gaiden: The Astral Chapter** — 3D 魔法学院生活 RPG（同人作品）

> 星轨异动之夜，学院地下密室的封印正在苏醒。以新生学徒的身份入学，上课、交友、酿药、决斗——并在夜色里查明真相。

🎮 **在线游玩**: https://frankilito.github.io/hogwarts-gaiden-astral/

![标题](docs/shots/title.png)

## 玩法

- **角色创建**：4 种外观 × 4 大学院（烈狮/慧鸦/翠蛇/忠獾）× 4 种魔法专长 × 4 种性格，属性各不相同
- **生活节奏**：按日推进的时间系统（清晨/上午/午后/下午/黄昏/夜晚·宵禁），每周课表、第 7/14 天期末考试、学院积分榜
- **五门课程小游戏**：魔咒（击靶）、魔药（配方酿造）、草药（温室种植与收获）、天文（望远镜连星座）、防御（实战演练）
- **主线七章**：入学分院 → 夜半星轨 → 禁书区潜入 → 血伯爵的交易 → 符文锁密室 → 三层星轨迷宫（机关+Boss）→ 封印仪式与结局盛宴
- **支线任务**：同伴任务（莉拉/塔格）、幽灵的诗页、决斗社晋级赛、小柔的猫雕像、温室害虫……
- **实时魔法战斗**：星火弹/烈焰/霜冻/雷弧链/辉光射线/护盾/悬浮/变形术/星门，9 种咒语 + 翻滚闪避 + 冷却管理
- **地下迷宫**：种子化程序生成 3 层迷宫，尖刺陷阱、雷弧充能闸门、宝箱、骷髅军团与法师王 Boss
- **关系系统**：14 名 NPC 好感度，挚友可邀为同伴随行协战
- **成长**：15 节点三系技能树（奥术/守护/辅助）、等级、称号
- **宿舍装饰**：布告栏猫头鹰集市购买家具，自由摆放
- **联机**（PeerJS P2P + 本地 WS 中继）：参观好友宿舍 / 好友决斗 / 共探副本

| 星辉大厅 | 天文塔 | 禁林 |
|---|---|---|
| ![](docs/shots/hall_night.png) | ![](docs/shots/astro_tower.png) | ![](docs/shots/forest_night.png) |

| 星轨迷宫 | 休息室 | 雨天庭院 |
|---|---|---|
| ![](docs/shots/dungeon.png) | ![](docs/shots/common_room.png) | ![](docs/shots/yard_rain.png) |

## 操作

| 按键 | 功能 |
|---|---|
| WASD / Shift | 移动 / 奔跑 |
| 鼠标（点击画面锁定） | 视角 |
| 左键 | 星火弹 |
| 1-5 / Q / F / G / R | 咒语：星火·烈焰·霜冻·雷弧·辉光 / 护盾 / 悬浮 / 变形 / 星门 |
| 空格 | 翻滚闪避（坐下时起身） |
| E | 互动 / 对话 |
| J 或 Tab | 菜单（任务·日程·背包·技能树·关系·学业·系统） |
| M | 静音 |

## 本地运行

```bash
node server/server.js   # http://localhost:8966
# 或双击 启动.command
```

联机：菜单(J) → 系统 → 联机大厅，输入相同房号即可（线上走 PeerJS 云端，本机双开自动用本地中继）。

## 测试

```bash
node tools/logictest.mjs   # 50 项纯逻辑单测
node tools/shoot.mjs test  # 38 项浏览器内全链路（含 m1→m7 主线）
node tools/nettest.mjs     # 6 项双端联机冒烟
```

## 技术

- Three.js（本地 vendored）+ 原生 ES Modules，零构建
- KayKit CC0 美术（Adventurers / Skeletons / Dungeon Remastered / Furniture / Halloween / Restaurant 六个包）：角色含 76 组骨骼动画（施法/坐/读/跑/受击/闪避/欢呼…）
- 自研系统：verlet 布料学院披风、程序化贴图与建筑、会动的画像（视线追踪+眨眼）、漂浮蜡烛/书本、体积光柱、日夜天气循环、烛光池化管理、WebAudio 全合成音乐音效、种子化迷宫生成、对话树 VM、日程驱动 NPC
- 存档：localStorage；联机：PeerJS（云端 P2P）+ ws 房间中继（局域网）

## 声明

本作为非商业同人致敬作品，与《霍格沃茨之遗》及其版权方无关；未使用任何原作资产。美术资源均为 CC0（KayKit by Kay Lousberg），音乐音效为运行时合成。

Made with ♥ by Claude
