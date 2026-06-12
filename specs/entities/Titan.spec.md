---
target: src/entities/Titan.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: view
related: [../milestones/m4-endgame-cta.spec.md, ../scenes/GameScene.spec.md]
---

# Titan（双 Boss 实体 · 表现层）

## 职责
终局两只顶级巨怪（紫 / 红）的 3D 视图：体型极大、登场演出、可被吃其一（身份反转）或反杀玩家（按版本）。

## 行为
- 由 SpawnSystem 在阈值生成；Director 编排**登场演出**（相机聚焦→文本→演出→回玩家+箭头）。
- 体型显著大于普通怪；登场时其余怪相对缩小以突出。
- 吃掉紫 Titan → 玩家体型暴涨、相机完全拉远。
- **lose 版**：红 Titan 反杀玩家 → LOSE。**win 版**：可被反杀 → WIN。

## 双 Titan（示例）
| Titan | 颜色 | 等级 | 角色 |
|-------|------|------|------|
| 紫 | 紫 | Lv.100 | 可被吃（身份反转） |
| 红 | 红 | Lv.190 | 终极对手（lose 反杀 / win 被反杀） |

## 参数
| 参数 | 说明 |
|------|------|
| titanScale | Titan 体型 |
| introDelay | 登场延迟（满级触发 1s） |
| othersShrinkRatio | 其余怪缩小比例 |

## 验收
- [ ] 双 Titan 登场演出完整
- [ ] 吃紫 Titan 反转 + 相机全拉远
- [ ] win/lose 结局分支正确
