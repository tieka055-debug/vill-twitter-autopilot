# 发布流程与红线

## 主路径（默认）：push_draft.mjs 快速灌草稿

专用 Chrome（独立配置档 + CDP）：启动一次即可——
`open -na "Google Chrome" --args --user-data-dir=$HOME/.zcode/x-ops-profile --remote-debugging-port=9222 --no-first-run https://x.com/login`
（登录态永久保存在该配置档；playwright-core 装在 `$HOME/.zcode/x-ops/`）

流程：`node $SKILL_DIR/scripts/push_draft.mjs @草稿文件` →
打开编辑器 → CDP `keyboard.insertText` 写入（中文可靠）→ DOM 回读逐字校验 → 点关闭 → `confirmationSheetConfirm`（保存）→ 重开面板回读验证。

已验证事实（2026-08-31）：
- X 编辑器丢弃合成键入的中文（CGEvent 级），CDP insertText 不丢——**中文只走 insertText**
- 关闭编辑器必弹确认框：`confirmationSheetConfirm`=保存、`confirmationSheetCancel`=丢弃
- XHunt 等插件的悬浮层会拦截 Playwright 常规点击——**关键点击一律 JS 直派（el.click()）**
- 草稿入口 testid：`unsentButton`；编辑器 `tweetTextarea_0`；关闭 `app-bar-close`；发帖 `tweetButton`；预排期 `scheduleOption`
- 单条 3–5 秒；15 条循环调用约 1–2 分钟，全程不占用用户正在用的 Chrome

computer-use 降级为兜底（脚本链路不可用时才用），流程同下。

## 放行流程（用户说「放行推特」）

1. 读当日草稿箱，只处理标 ✅ 的条目（用户改完手动打勾）；⬜ 的跳过并在汇报中列出。
2. 逐条调用 push_draft.mjs 灌进 X 原生草稿箱（或用 `scheduleOption` 走原生预排期）；每条日志写入 `复盘/发布日志.md`。
3. 用户在手机/网页的 X 草稿箱里审、自己点发布——**AI 不碰发布键**。
4. 用户明确授权 X API 按量直发后，才可切换为 API 自动发布（普通帖 $0.015/条）。

## 红线（任何情况下不越过）

- 不自动点赞、关注、私信、转发；不用第三方协议/群控接口，只走用户自己的浏览器。
- 发布动作失败、弹验证码或风控提示 → 立即停止，报告用户，不重试。
- 素材涉政治敏感、金融建议、医疗健康 → 不用。
- 用户只放行了部分条目 → 其余保持草稿，不自行补发。

## 手动兜底

浏览器自动化不可用时：把 ✅ 条目生成「手动发布清单」（内容 + 建议时间，按错峰排好），用户自己贴。发布后让用户回填链接，日志照记。

## 多平台延伸（暂不默认执行）

公众号长文 → thread 的改写可直接复用 vill-original-content-workflow 的成稿；Bluesky/Threads 走 Typefully API（免费档 10 条/月）留作后续扩展，需用户单独开启。
