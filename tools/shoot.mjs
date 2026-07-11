// 用系统 Chrome 驱动游戏：自动测试 / 定点截图 / 执行JS后截图
// 用法:
//   node tools/shoot.mjs test [extraQuery]
//   node tools/shoot.mjs shot out.png [extraQuery] [waitMs]
//   node tools/shoot.mjs eval out.png "JS代码" [waitMs] [extraQuery]
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8966/';
const mode = process.argv[2] || 'test';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1600,900', '--hide-scrollbars', '--mute-audio', '--use-angle=metal'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('TEST') || t.startsWith('[hgw]') || t.toLowerCase().includes('error')) console.log('[console]', t.slice(0, 500));
});
page.on('pageerror', (e) => console.log('[pageerror]', String(e.message).slice(0, 800)));

async function waitLoaded(timeout = 90000) {
  await page.waitForFunction('window.__game && window.__game.ready', { timeout });
  await new Promise((r) => setTimeout(r, 600));
}

try {
  if (mode === 'test') {
    const extra = process.argv[3] ? `&${process.argv[3]}` : '';
    await page.goto(BASE + '?shot&autotest' + extra, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__testDone === true, { timeout: 180000 }).catch(() => console.log('[warn] test timeout'));
    const summary = await page.evaluate(() => window.__testSummary || 'no summary');
    console.log('SUMMARY:', summary);
    await page.screenshot({ path: '/tmp/hgw_test_end.png' });
    console.log('shot → /tmp/hgw_test_end.png');
  } else if (mode === 'shot') {
    const out = process.argv[3] || '/tmp/hgw.png';
    const extra = process.argv[4] ? `&${process.argv[4]}` : '';
    const wait = parseInt(process.argv[5] || '1500', 10);
    await page.goto(BASE + '?shot' + extra, { waitUntil: 'domcontentloaded' });
    await waitLoaded();
    await new Promise((r) => setTimeout(r, wait));
    await page.screenshot({ path: out });
    console.log('shot →', out);
  } else if (mode === 'eval') {
    const out = process.argv[3] || '/tmp/hgw_eval.png';
    const code = process.argv[4] || '1';
    const wait = parseInt(process.argv[5] || '1200', 10);
    const extra = process.argv[6] ? `&${process.argv[6]}` : '';
    await page.goto(BASE + '?shot' + extra, { waitUntil: 'domcontentloaded' });
    await waitLoaded();
    const ret = await page.evaluate(code);
    if (ret !== undefined) console.log('eval →', JSON.stringify(ret)?.slice(0, 1200));
    await new Promise((r) => setTimeout(r, wait));
    await page.screenshot({ path: out });
    console.log('shot →', out);
  }
} catch (e) {
  console.error('FAIL', e.message);
  try { await page.screenshot({ path: '/tmp/hgw_fail.png' }); console.log('failshot → /tmp/hgw_fail.png'); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
}
