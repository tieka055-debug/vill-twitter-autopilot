// 自动回复：node post_replies.mjs @replies.json [间隔秒]
// replies.json 格式：[{url, reply}]；逐条打开原帖→内联回复框→insertText→校验→发布→验证
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require2 = createRequire(
  process.env.XOPS_NM ?? process.env.HOME + '/.zcode/x-ops/node_modules/',
);
const { chromium } = require2('playwright-core');

const file = process.argv[2];
const gapMin = Number(process.argv[3] ?? 40); // 随机间隔下限（秒）——固定间隔是机器人特征
const gapMax = Number(process.argv[4] ?? 110);
if (!file) {
  console.error('用法：node post_replies.mjs @replies.json [最小间隔秒] [最大间隔秒]');
  process.exit(1);
}
if (gapMax < gapMin) { console.error('最大间隔不能小于最小间隔'); process.exit(1); }
const nextGap = () => Math.round((gapMin + Math.random() * (gapMax - gapMin)) * 10) / 10;
const items = JSON.parse(readFileSync(file.slice(1), 'utf8'));
const flat = (s) => s.replace(/\s+/g, '');

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();
const results = [];

for (let i = 0; i < items.length; i++) {
  const { url, reply } = items[i];
  const r = { n: i + 1, url, ok: false };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 20000 });
    await page.click('[data-testid="tweetTextarea_0"]');
    await page.keyboard.insertText(reply);
    await page.waitForTimeout(500);
    const placed = await page.$eval('[data-testid="tweetTextarea_0"]', (el) =>
      (el.textContent || '').trim(),
    );
    if (flat(placed) !== flat(reply)) {
      r.err = '内容不一致，未发送';
      results.push(r);
      continue;
    }
    await page.evaluate(() =>
      document.querySelector('[data-testid="tweetButtonInline"]').click(),
    );
    await page.waitForTimeout(2500);
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ''));
    r.ok = body.includes(flat(reply).slice(0, 12));
    if (!r.ok) r.err = '已点击发送但未在页面确认到回复';
  } catch (e) {
    r.err = String(e).slice(0, 140);
  }
  results.push(r);
  if (i < items.length - 1) {
    const wait = nextGap();
    r.waitedSec = wait;
    await page.waitForTimeout(wait * 1000);
  }
}

const ok = results.filter((r) => r.ok).length;
console.log(
  JSON.stringify({ total: items.length, ok, fail: items.length - ok, results }, null, 2),
);
await page.close().catch(() => {});
await browser.close().catch(() => {});
