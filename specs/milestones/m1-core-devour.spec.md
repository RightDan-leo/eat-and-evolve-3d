---
milestone: M1
title: 核心吞噬（大吃小 + 体型/镜头联动）
created: 2026-06-12
updated: 2026-06-12
status: done
parent: ../game-design.spec.md
---

# M1：核心吞噬

## 目标

移植 2D 战斗逻辑（去 Phaser），在 3D 中跑通「自由移动 → 吃 ≤自身等级的小怪秒杀吞噬 → 经验/等级↑ → 体型变大 → 相机联动拉远」的核心闭环，让 3D 吞噬手感成立。

## 验收标准

- [x] `CombatSystem` 作为纯 TS 逻辑层移植完成（`src/logic/`，零 three/Phaser/DOM 依赖；relation/伤害规则与 2D combat.json 一致）
- [x] 玩家碰到等级 ≤ 自己的怪 → 秒杀吞噬 + `+EXP` 跳字 + 该怪移除并补刷（实测自动吃绿怪 Lv1→Lv10）
- [x] 碰到等级远高的怪 → 反伤（relation=红、体型更大、危险；实测红怪把 Lv10 玩家 110HP 打到 0 → 死亡）
- [x] 吃怪累计经验达阈值 → 等级↑，玩家模型 scale 平滑增大（Lv1→Lv10 时 scale 1.0→1.63；升级回满血）
- [x] 玩家变大时 `CameraRig` 同步连续拉远（沿用 M0 曲线，俯角保持 54°）
- [x] 头顶 CSS2D 等级数字（玩家 + 敌人）随等级更新，relation 颜色正确（实测 26 怪 0 色差：高级→红 / 同级或更低→绿）
- [x] 死亡 → 「重玩一次」覆盖层 → 点击重置（Lv1、满血、重刷怪、相机归位）—— 实测通过

## M1 结论

- 核心吞噬闭环成立：移动→吃绿怪→升级变大→相机拉远→躲红怪→死亡重玩，全链路实测通过。
- 逻辑/表现分层落地：`src/logic/`（CombatSystem + combat/progression 配置，纯 TS）与 `src/entities|components|systems`（Three.js 表现）解耦，遵守架构红线。
- 临时刷怪在 `GameScene` 内，**M3 将由 `SpawnSystem` 接管**（分区/距中心难度 + starterPrey）。
- 单文件基线升至 ~627KB（含 CSS2DRenderer），距 5MB 仍充裕。
- 备注：自动化/后台浏览器标签 rAF 被挂起、截图偶发滞后，已用 CDP 直接驱动 tick + 读状态完成验收（FPS 显示 0 为环境假象）。

## 涉及模块

### 新增模块

| 模块 | Spec | 代码路径 | 说明 |
|------|------|----------|------|
| CombatSystem | [spec](../systems/CombatSystem.spec.md) | `src/logic/systems/CombatSystem.ts` | 大吃小/HP/等级压制（移植） |
| Dragon | [spec](../entities/Dragon.spec.md) | `src/entities/Dragon.ts` | 玩家 3D 视图 + 体型 |
| Enemy | [spec](../entities/Enemy.spec.md) | `src/entities/Enemy.ts` | 敌人 3D 视图 + relation |
| LabelLayer | [spec](../components/LabelLayer.spec.md) | `src/components/LabelLayer.ts` | CSS2D 头顶等级 |

### 修改模块

| 模块 | Spec | 变更内容 |
|------|------|----------|
| GameScene | [spec](../scenes/GameScene.spec.md) | 接线逻辑 tick → 表现同步 |
| CameraRig | [spec](../systems/CameraRig.spec.md) | 接入真实玩家体型驱动 |

## 开发顺序

1. 移植 `CombatSystem`（纯逻辑，先单测大吃小/等级压制）
2. Dragon / Enemy 视图 + LabelLayer
3. GameScene 接线：碰撞判定 → 击败/经验事件 → 体型/等级更新
4. CameraRig 接真实体型

## 模块间交互

```
InputController → 玩家位移 → CombatSystem.step(位置/等级) → 命中/击败/经验事件
   → Dragon 升级变大 → CameraRig 拉远；Enemy 移除；LabelLayer 更新
```

## 数值参数

| 参数 | 值 | 说明 |
|------|-----|------|
| relation 阈值 | 绿/黄/红（等级差） | 沿用 2D |
| 经验/升级曲线 | 沿用 2D | evolution/level json |
| sizeByLevel | 沿用/重排 | 玩家体型曲线 |

## 备注
逻辑层移植务必删尽 Phaser 引用；relation 与伤害规则保持与 2D 一致以复用已调好的手感。
