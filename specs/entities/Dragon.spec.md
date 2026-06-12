---
target: src/entities/Dragon.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: view
related: [../systems/EvolutionSystem.spec.md, ../systems/CameraRig.spec.md]
---

# Dragon（玩家实体 · 表现层）

## 职责
玩家的 3D 视图：多阶模型（幼兽→元素幼龙→巨龙）、体型随等级平滑变化、进化 morph 与光环、头顶等级标签。只读逻辑层状态。

## 行为
- 位置由编排层（InputController + 逻辑）驱动，平滑插值。
- 体型 scale = `f(等级/形态)`，连续插值（驱动 CameraRig）。
- 收到 `formUp` → 切换/morph 到下一阶模型 + 金色光环 + scale punch。
- 收到分支选择结果 → 换皮（元素/形态）+ 应用差异表现。
- 头顶 CSS2D 等级数字（绿色，玩家自身）。

## 多阶形态
| 阶段 | 形态 | 来源 |
|------|------|------|
| 0.. | 蓝色幼兽 → 元素幼龙 → 巨龙 | 沿用 2D 阈值，3D 模型 |

## 参数
| 参数 | 说明 |
|------|------|
| sizeByLevel | 体型曲线 |
| morphStages | 各阶模型/贴图 |
| punchScale | 进化体型脉冲 |

## 验收
- [ ] 多阶模型按阈值 morph
- [ ] 体型连续变大并驱动相机
- [ ] 进化光环 + punch
