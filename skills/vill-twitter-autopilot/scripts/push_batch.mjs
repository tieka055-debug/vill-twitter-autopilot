// 批量灌草稿：node push_batch.mjs @/path/to/batch.txt
// 文件格式：每条帖子之间用单独一行「===」分隔
// 前置：专用 Chrome（CDP 9222）已登录 X；逐条 写入→回读校验→关闭→保存→下一条
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require2 = createRequire(
  process.env.XOPS_NM ?? process.env.HOME + '/.zcode/x-ops/node_modules/',
);
const { chromium } = require2('playwright-core');

const file = process.argv[2];
if (!file) {
  console.error('用法：node push_batch.mjs @batch.txt（帖子间用 === 行分隔）');
  process.exit(1);
}
const posts = readFileSync(file.slice(1), 'utf8')
  .split(/\n===\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const flat = (s) => s.replace(/\s+/g, '');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();
const results = [];

for (let i = 0; i < posts.length; i++) {
  const r = { n: i + 1, head: posts[i].slice(0, 14), ok: false };
  try {
    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 20000 });
    await page.click('[data-testid="tweetTextarea_0"]');
    await page.keyboard.insertText(posts[i]);
    await page.waitForTimeout(500);
    const placed = await page.$eval('[data-testid="tweetTextarea_0"]', (el) =>
      (el.textContent || '').trim(),
    );
    if (flat(placed) !== flat(posts[i])) {
      r.err = '内容不一致，跳过保存';
      results.push(r);
      continue;
    }
    await page.evaluate(() => document.querySelector('[data-testid="app-bar-close"]').click());
    await page.waitForSelector('[data-testid="confirmationSheetConfirm"]', { timeout: 8000 });
    await page.evaluate(() =>
      document.querySelector('[data-testid="confirmationSheetConfirm"]').click(),
    );
    await page.waitForTimeout(900);
    r.ok = true;
  } catch (e) {
    r.err = String(e).slice(0, 140);
  }
  results.push(r);
}

const ok = results.filter((r) => r.ok).length;
console.log(
  JSON.stringify({ total: posts.length, ok, fail: posts.length - ok, failures: results.filter((r) => !r.ok) }, null, 2),
);
await page.close().catch(() => {});
await browser.close().catch(() => {});
