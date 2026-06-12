---
target: src/components/EvolutionChoicePanel.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: view
related: [../systems/EvolutionSystem.spec.md]
---

# EvolutionChoicePanel（表现层 · 进化分支选择，参考独有新增）

## 职责
在 EvolutionSystem 产出 `branchOffer` 时弹出 HTML/CSS 选择面板（六边形卡片：元素/形态图标），玩家点选后把 `choiceId` 回填逻辑层。

## 行为
- 进入 cinematic 暂停 → 弹面板（半屏卡片 + 元素图标，沿用参考视频样式）。
- 展示每个选项的差异提示（皮 + 数值/形态影响），避免假选择。
- 点选 → 调 `EvolutionSystem.applyBranch(choiceId)` → 关面板 → 恢复推进。
- 触摸/鼠标点击；竖屏适配。

## 参数
| 参数 | 说明 |
|------|------|
| options | 分支选项表（图标/皮/差异） |
| autoPickTimeout | 超时默认选项（可选） |

## 验收
- [ ] branchOffer 时正确弹出并暂停
- [ ] 点选回填并恢复
- [ ] 选项差异清晰、竖屏不溢出
