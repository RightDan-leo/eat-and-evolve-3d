---
target: src/entities/Enemy.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: view
related: [../systems/SpawnSystem.spec.md, ../systems/CombatSystem.spec.md]
---

# Enemy（敌人实体 · 表现层）

## 职责
小怪/中怪的 3D 视图：按等级差缩放体型、relation 颜色轮廓（绿/黄/红）、头顶等级标签；群体用 InstancedMesh 合批。只读逻辑层状态。

## 行为
- 体型 scale 相对玩家按等级差缩放（`scaleByDiff` 表，沿用 2D），高等级显著巨大（压迫感）。
- relation 颜色轮廓随玩家等级动态变化（绿=可吃 / 黄=接近 / 红=危险），轮廓随体型等比缩放不被遮挡。
- 头顶 CSS2D 等级数字。
- 被击败 → 触发 DevourFx，mesh 回收（对象池/Instanced）。
- Titan 登场时其余 Enemy 相对缩小（沿用 2D 共有逻辑）。

## 性能
群怪走 InstancedMesh / 合批，禁止主循环逐个 new Mesh。

## 参数
| 参数 | 说明 |
|------|------|
| scaleByDiff | 等级差→体型 |
| relationColors | 绿/黄/红 |
| outlineScale | 轮廓等比 |

## 验收
- [ ] relation 颜色/体型按等级差正确
- [ ] 群怪 InstancedMesh 合批达帧率
- [ ] 轮廓随体型缩放不被遮挡
