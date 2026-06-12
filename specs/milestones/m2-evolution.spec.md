---
milestone: M2
title: 进化系统（多阶 morph + 分支选择 + 吞噬特效）
created: 2026-06-12
updated: 2026-06-12
status: done
parent: ../game-design.spec.md
---

# M2：进化系统

## 目标

实现多阶形态进化（幼兽→元素幼龙→巨龙的模型 morph）、**进化分支选择面板**（参考独有新增）、以及把 2D `DevourSystem` 的吞噬反馈（金环 + 肉块爆裂 + 吸入）迁移到 3D。

## 验收标准

- [ ] 到达形态阈值 → 玩家模型切换/morph 到下一阶，伴随金色光环 + 体型 punch
- [ ] 阶段性阈值触发 **EvolutionChoicePanel**：弹出二/多选卡片（元素/形态），点选后结果回填 `EvolutionSystem`
- [ ] 分支选择有**实际差异**（至少换皮 + 一项数值/形态影响），非假选择
- [ ] 击败/吞噬怪时：肉块/粒子从目标爆出 → 朝玩家吸入 → 玩家吸收脉冲（3D `DevourFx`）
- [ ] 进化/选择期间游戏进入短暂 cinematic 暂停，不打断后续流程

## 涉及模块

### 新增模块

| 模块 | Spec | 代码路径 | 说明 |
|------|------|----------|------|
| EvolutionSystem | [spec](../systems/EvolutionSystem.spec.md) | `src/logic/systems/EvolutionSystem.ts` | 阈值推进 + 分支结果应用 |
| EvolutionChoicePanel | [spec](../components/EvolutionChoicePanel.spec.md) | `src/components/EvolutionChoicePanel.ts` | HTML/CSS 分支选择 |
| DevourFx | [spec](../systems/DevourSystem.spec.md) | `src/systems/DevourFx.ts` | 3D 肉块爆裂/吸入 |

### 修改模块

| 模块 | Spec | 变更内容 |
|------|------|----------|
| Dragon | [spec](../entities/Dragon.spec.md) | 多阶模型 morph + 进化光环 |
| GameScene | [spec](../scenes/GameScene.spec.md) | Director 接管进化弹窗时机与 cinematic |

## 开发顺序

1. EvolutionSystem 阈值推进（逻辑层）
2. Dragon 多阶模型 morph + 光环
3. EvolutionChoicePanel + 结果回填
4. DevourFx 3D 特效迁移

## 数值参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 形态阈值 | 沿用 2D evolution.json | 触发 morph |
| 分支触发阈值 | 子集阈值 | 哪些阶段弹选择 |
| 分支选项 | 元素/形态表 | 差异定义（皮+数值） |

## 备注
分支选择是参考视频的差异化爽点；务必明确每个选项的真实影响，避免"假选择"。
