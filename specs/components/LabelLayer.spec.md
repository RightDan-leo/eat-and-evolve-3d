---
target: src/components/LabelLayer.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: view
related: [../entities/Dragon.spec.md, ../entities/Enemy.spec.md]
---

# LabelLayer（表现层 · CSS2D 头顶标签）

## 职责
用 CSS2DRenderer 渲染始终面向相机、任意分辨率清晰的世界对齐 UI：头顶等级数字、relation 颜色、感叹号(感知提示)、绿色方向引导箭头。

## 行为
- 为玩家/敌人/Titan 绑定头顶 label，跟随其世界坐标。
- 等级数字颜色 = relation（玩家绿；敌人按等级差绿/黄/红）。
- 敌人开始追击/感知 → 显示 `!` 提示（沿用 2D）。
- 目标/躲避方向 → 绿色箭头引导（开场及 Titan 登场后）。
- label 数量大时可按距离/视锥剔除。

## 参数
| 参数 | 说明 |
|------|------|
| labelOffsetY | 头顶偏移 |
| relationColors | 绿/黄/红 |
| cullDistance | 剔除距离 |

## 验收
- [ ] 等级数字清晰跟随、颜色正确
- [ ] 感叹号 + 引导箭头正常
- [ ] 大量 label 不掉帧
