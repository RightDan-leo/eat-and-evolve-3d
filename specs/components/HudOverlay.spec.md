---
target: src/components/HudOverlay.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: view
related: [../milestones/m4-endgame-cta.spec.md]
---

# HudOverlay（表现层 · HUD/结算/CTA 叠层）

## 职责
HTML/CSS 叠层：摇杆提示(DRAG TO MOVE)、等级/进度 HUD、Titan 登场字幕、win/lose 结算屏、「增强战力/养成英雄」CTA 与跳商店。

## 行为
- 顶层 HUD：当前等级、引导文案。
- Titan 登场字幕（Director 触发）。
- **结算**：lose → LOSE 纹章 + 「Promote heroes / Get heroes / Adjust the lineup」养成引导；win → WIN。
- 「Tap to Continue」→ 跳商店（`storeUrl` 可配）。
- 竖屏 9:16 适配，安全区不溢出。

## 参数
| 参数 | 说明 |
|------|------|
| storeUrl | CTA 跳转链接 |
| variant | win/lose 文案分支 |

## 验收
- [ ] 结算屏按 win/lose 正确展示
- [ ] CTA 跳商店可用、链接可配
- [ ] 竖屏适配不溢出
