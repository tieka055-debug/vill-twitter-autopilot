// 用法：node push_draft.mjs "帖子内容" 或 node push_draft.mjs @/path/to/draft.txt
// 前置：专用 Chrome 以 --remote-debugging-port=9222 --user-data-dir=$HOME/.zcode/x-ops-profile 运行且已登录 X
// 链路：打开编辑器 → CDP insertText 写入（中文可靠）→ 回读校验 → 关闭 → confirmationSheetConfirm 保存 → 草稿面板回读验证
// 注意：XHunt 等插件的悬浮层会拦截 Playwright 常规点击，所有关键点击一律用 JS 直派（el.click()）
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require2 = createRequire(
  process.env.XOPS_NM ?? process.env.HOME + '/.zcode/x-ops/node_modules/',
);
const { chromium } = require2('playwright-core');

const arg = process.argv[2];
if (!arg) {
  console.error('用法：node push_draft.mjs "内容" | @文件路径');
  process.exit(1);
}
const text = arg.startsWith('@') ? readFileSync(arg.slice(1), 'utf8').trim() : arg.trim();

const out = { ok: false, step: 'connect' };
const jsClick = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.click();
    return true;
  }, sel);

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();

try {
  await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 20000 });
  out.step = 'editor-open';

  await page.click('[data-testid="tweetTextarea_0"]');
  await page.keyboard.insertText(text);
  await page.waitForTimeout(600);

  const placed = await page.$eval('[data-testid="tweetTextarea_0"]', (el) =>
    (el.textContent || '').trim(),
  );
  out.placedLen = placed.length;
  const flat = (s) => s.replace(/\s+/g, '');
  if (flat(placed) !== flat(text)) {
    out.mismatch = { expectedLen: flat(text).length, placedLen: flat(placed).length, head: placed.slice(0, 24) };
    throw new Error('编辑器内容与预期不一致，中止（不保存）');
  }
  out.step = 'filled-verified';

  if (!(await jsClick(page, '[data-testid="app-bar-close"]'))) throw new Error('找不到关闭按钮');
  await page.waitForSelector('[data-testid="confirmationSheetConfirm"]', { timeout: 8000 });
  await jsClick(page, '[data-testid="confirmationSheetConfirm"]');
  await page.waitForTimeout(1500);
  out.step = 'save-clicked';

  // 回读验证：重开编辑器 → JS 点草稿入口 → 面板全文搜索
  await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 20000 });
  await jsClick(page, '[data-testid="unsentButton"]');
  await page.waitForTimeout(1500);
  const panel = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ''));
  out.draftVisibleInXBox = panel.includes(flat(placed).slice(0, 12));
  out.ok = out.draftVisibleInXBox;
  out.step = out.ok ? 'verified-in-drafts' : 'saved-but-not-verified';
} catch (e) {
  out.error = String(e).slice(0, 300);
}

console.log(JSON.stringify(out, null, 2));
await page.close().catch(() => {});
await browser.close().catch(() => {});
