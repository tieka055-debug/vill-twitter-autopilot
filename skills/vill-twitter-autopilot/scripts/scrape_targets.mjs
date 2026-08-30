// 抓回复目标：node scrape_targets.mjs "搜索词" [数量] [输出文件]
// 输出 JSON：[{url, author, text}]，供生成回复用（先读全文再回复）
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require2 = createRequire(
  process.env.XOPS_NM ?? process.env.HOME + '/.zcode/x-ops/node_modules/',
);
const { chromium } = require2('playwright-core');

const query = process.argv[2] ?? '(AI OR agent OR 工作流 OR Claude) lang:zh min_faves:5';
const want = Number(process.argv[3] ?? 10);
const outFile = process.argv[4] ?? '/tmp/reply_targets.json';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();

await page.goto(
  'https://x.com/search?q=' + encodeURIComponent(query) + '&f=live',
  { waitUntil: 'domcontentloaded' },
);
await page.waitForSelector('article', { timeout: 20000 });
await page.waitForTimeout(2000);

const posts = await page.$$eval('article', (arts) =>
  arts.map((a) => {
    const links = [...a.querySelectorAll('a[href*="/status/"]')];
    const t = links.find((l) => l.querySelector('time'));
    const href = t ? t.getAttribute('href') : links[0]?.getAttribute('href') ?? null;
    const text = (a.querySelector('[data-testid="tweetText"]')?.innerText ?? '').trim();
    const author = a.querySelector('a[href^="/"] span')?.textContent ?? '';
    return { href, text, author };
  }).filter((p) => p.href && p.text && !p.text.startsWith('回复')),
);

const seen = new Set();
const out = [];
for (const p of posts) {
  const id = p.href.split('?')[0];
  if (seen.has(id)) continue;
  seen.add(id);
  out.push({ url: 'https://x.com' + id, author: p.author, text: p.text.slice(0, 800) });
  if (out.length >= want) break;
}
writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ count: out.length, file: outFile }, null, 2));
await page.close().catch(() => {});
await browser.close().catch(() => {});
