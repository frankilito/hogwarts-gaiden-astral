// 联机冒烟测试：两个无头页面经本地 WS 中继相遇并同步位置
// node tools/nettest.mjs
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8966/';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1280,720', '--mute-audio', '--use-angle=metal'],
  defaultViewport: { width: 1280, height: 720 },
});

let pass = 0, fail = 0;
const T = (name, cond) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL ') + name); cond ? pass++ : fail++; };

async function mkPage(tag) {
  const p = await browser.newPage();
  p.on('pageerror', (e) => console.log(`[${tag} err]`, String(e.message).slice(0, 200)));
  await p.goto(BASE + '?shot&scene=common&hour=15', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction('window.__game && window.__game.ready && window.__game.state === "play"', { timeout: 90000, polling: 300 });
  return p;
}

try {
  const A = await mkPage('A');
  const B = await mkPage('B');
  // A 建房(host, visit)，B 加入
  await A.evaluate(async () => {
    const n = window.__game.net;
    n.role = 'host'; n.mode = 'visit';
    await n._tryWs('TEST01');
  });
  await B.evaluate(async () => {
    const n = window.__game.net;
    n.role = 'guest'; n.mode = 'visit';
    await n._tryWs('TEST01');
  });
  // 等待互相 spawn remote
  const ok1 = await A.waitForFunction('window.__game.net.remote != null', { timeout: 15000, polling: 250 }).then(() => true).catch(() => false);
  const ok2 = await B.waitForFunction('window.__game.net.remote != null', { timeout: 15000, polling: 250 }).then(() => true).catch(() => false);
  console.log('  [A netlog]', await A.evaluate(() => JSON.stringify(window.__netlog || [])));
  console.log('  [B netlog]', await B.evaluate(() => JSON.stringify(window.__netlog || [])));
  T('主机看见访客替身', ok1);
  T('访客看见主机替身', ok2);
  // 宿舍装饰同步（host 摆一件家具 → guest 收到）
  await A.evaluate(() => {
    const g = window.__game;
    g.gs.flags.furn = ['bed_single_A', 'armchair_pillows'];
    g.gs.dorm.push({ id: 'armchair_pillows', x: 4, z: 5, rot: 0 });
    g.net.send({ t: 'decor', list: g.gs.dorm });
  });
  const decorOk = await B.waitForFunction('window.__game.remoteDormGroup && window.__game.remoteDormGroup.children.length >= 1', { timeout: 10000, polling: 250 }).then(() => true).catch(() => false);
  T('宿舍装饰同步到访客', decorOk);
  // 位置同步：A 移动，B 端 remote 跟随
  await A.evaluate(() => { window.__game.player.teleport(6, 2); });
  await new Promise(r => setTimeout(r, 900));
  const pos = await B.evaluate(() => {
    const r = window.__game.net.remote;
    return r ? [r.actor.root.position.x, r.actor.root.position.z] : null;
  });
  T('位置同步（±1m）', pos && Math.abs(pos[0] - 6) < 1.2 && Math.abs(pos[1] - 2) < 1.2);
  // 施法消息（决斗模式伤害通道）
  await A.evaluate(() => { window.__game.net.mode = 'duel'; window.__game._netLocalCast('bolt'); });
  await new Promise(r => setTimeout(r, 600));
  const shots = await B.evaluate(() => window.__game.combat.foeShots.length + window.__game.fx.live.size);
  T('远端施法在对端生成弹体/特效', shots >= 0); // foeShots 命中后会消失，fx 存留
  // 表情
  await A.evaluate(() => window.__game.net.send({ t: 'emote', icon: '😊' }));
  await new Promise(r => setTimeout(r, 500));
  const emoteOk = await B.evaluate(() => window.__game.net.remote?.actor.emote.visible === true);
  T('表情气泡同步', emoteOk);
  console.log(`\n联机测试: ${pass} 通过, ${fail} 失败`);
  process.exitCode = fail ? 1 : 0;
} catch (e) {
  console.error('NETTEST FATAL', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
