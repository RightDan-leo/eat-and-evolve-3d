# Spec 索引

> 自动维护。新 Session 开始时 AI 读取此文件恢复上下文。

## 总览

- **总 spec 数**：21
- **已完成**：0
- **进行中**：0
- **待实现**：21（全部 draft，待 M0 起逐步实现）

## 顶层

| Spec | 状态 | 说明 |
|------|------|------|
| [game-design.spec.md](game-design.spec.md) | draft | 3D 吞噬设计总纲 |
| [architecture.md](architecture.md) | draft | 架构红线（逻辑/表现/编排分层 + 2D 复用映射） |

## 里程碑 (milestones/)

| Spec | 状态 | 说明 |
|------|------|------|
| [m0-spike](milestones/m0-spike.spec.md) | ✅ done | 技术验证（相机动态拉远 + 单文件体积） |
| [m1-core-devour](milestones/m1-core-devour.spec.md) | ✅ done | 核心吞噬（大吃小 + 体型/镜头联动） |
| [m2-evolution](milestones/m2-evolution.spec.md) | draft | 进化系统（多阶 morph + 分支选择 + 特效） |
| [m3-world-enemies](milestones/m3-world-enemies.spec.md) | draft | 世界与敌人（环形岛 + 分区刷怪 + 体型压迫） |
| [m4-endgame-cta](milestones/m4-endgame-cta.spec.md) | draft | 终局与转化（双 Titan + win/lose + CTA） |
| [m5-polish-ship](milestones/m5-polish-ship.spec.md) | draft | 投放打磨（竖屏 + 音效 + 性能 + 单文件 ≤5MB） |

## 场景 (scenes/)

| Spec | 对应代码 | 状态 | 说明 |
|------|---------|------|------|
| [GameScene](scenes/GameScene.spec.md) | `src/scenes/GameScene.ts` | 🚧 M1 | 编排层主场景（含临时刷怪，M3 交 SpawnSystem） |

## 实体 (entities/)

| Spec | 对应代码 | 状态 | 说明 |
|------|---------|------|------|
| [Dragon](entities/Dragon.spec.md) | `src/entities/Dragon.ts` | 🚧 M1 | 玩家：等级/HP/经验/体型（多阶 morph 待 M2） |
| [Enemy](entities/Enemy.spec.md) | `src/entities/Enemy.ts` | 🚧 M1 | 小怪 + relation 轮廓 + 等级差体型 |
| [Titan](entities/Titan.spec.md) | `src/entities/Titan.ts` | draft | 双 Boss |

## 系统 (systems/)

| Spec | 对应代码 | 状态 | 说明 |
|------|---------|------|------|
| [CombatSystem](systems/CombatSystem.spec.md) | `src/logic/systems/CombatSystem.ts` | ✅ done | 逻辑层 · 大吃小（移植，纯 TS） |
| [EvolutionSystem](systems/EvolutionSystem.spec.md) | `src/logic/systems/EvolutionSystem.ts` | draft | 逻辑层 · 形态+分支（扩展） |
| [SpawnSystem](systems/SpawnSystem.spec.md) | `src/logic/systems/SpawnSystem.ts` | draft | 逻辑层 · 刷怪（移植） |
| [CameraRig](systems/CameraRig.spec.md) | `src/systems/CameraRig.ts` | ✅ M0/M1 | 表现层 · 动态拉远 |
| [InputController](systems/InputController.spec.md) | `src/systems/InputController.ts` | ✅ M0/M1 | 编排层 · 摇杆 |
| [DevourFx](systems/DevourSystem.spec.md) | `src/systems/DevourFx.ts` | draft | 表现层 · 吞噬特效 |

## 组件 (components/)

| Spec | 对应代码 | 状态 | 说明 |
|------|---------|------|------|
| [LabelLayer](components/LabelLayer.spec.md) | `src/components/LabelLayer.ts` | 🚧 M1 | CSS2D 头顶等级 + 跳字 |
| [EvolutionChoicePanel](components/EvolutionChoicePanel.spec.md) | `src/components/EvolutionChoicePanel.ts` | draft | 进化分支选择 |
| [HudOverlay](components/HudOverlay.spec.md) | `src/components/HudOverlay.ts` | draft | HUD/结算/CTA |

## 核心框架 (core/) — 脚手架自带

| Spec | 状态 | 说明 |
|------|------|------|
| [ModelUtils](core/ModelUtils.spec.md) | 内置 | GLTF 加载/归一化（M5 加 Draco） |
| [AnimationUtils](core/AnimationUtils.spec.md) | 内置 | 动画工具 |
