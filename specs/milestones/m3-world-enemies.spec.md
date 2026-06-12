---
milestone: M3
title: 世界与敌人（环形岛 + 分区刷怪 + 体型压迫）
created: 2026-06-12
updated: 2026-06-12
status: done
parent: ../game-design.spec.md
---

# M3：世界与敌人

## 目标

构建 3D 环形岛环境（土路三岔、散布小怪、四周环山），移植 2D `SpawnSystem`（分区/等级刷怪、starterPrey），并实现"越靠中心怪越强、体型越大"的压迫感与开场即时正反馈。

## 验收标准

- [ ] EnvBuilder 生成环形岛地形：草地 + 蜿蜒土路 + 环山 + 散布道具（低面数）
- [ ] `SpawnSystem` 移植：按分区/距中心半径决定怪等级（越中心越高）
- [ ] starterPrey：玩家出生点附近刷若干绿怪，开场可秒杀，立即正反馈
- [ ] 高等级怪体型显著巨大（压迫感），relation=红，靠近危险
- [ ] 群怪用 InstancedMesh / 合批渲染，目标帧率达标
- [ ] 头顶绿色方向箭头引导玩家目标/躲避（LabelLayer/Hud）

## 涉及模块

### 新增模块

| 模块 | Spec | 代码路径 | 说明 |
|------|------|----------|------|
| SpawnSystem | [spec](../systems/SpawnSystem.spec.md) | `src/logic/systems/SpawnSystem.ts` | 分区/等级刷怪（移植） |
| EnvBuilder | [spec](../scenes/GameScene.spec.md) | `src/systems/EnvBuilder.ts` | 环形岛 3D 环境 |

### 修改模块

| 模块 | Spec | 变更内容 |
|------|------|----------|
| Enemy | [spec](../entities/Enemy.spec.md) | 体型按等级差缩放 + InstancedMesh 合批 |
| GameScene | [spec](../scenes/GameScene.spec.md) | 接 SpawnSystem 与环境 |

## 开发顺序

1. EnvBuilder 环形岛地形 + 土路 + 环山
2. SpawnSystem 移植（分区/等级/starterPrey）
3. Enemy 体型压迫 + 合批
4. 方向箭头引导

## 数值参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 分区半径→等级 | 沿用/重排 2D | 越中心越高 |
| starterPrey 数量/范围 | 沿用 2D | 出生点附近绿怪 |
| 敌人体型缩放 | scaleByDiff 表 | 等级差→体型 |

## 备注
环形岛坐标需从 2D 像素重排为 3D XZ；体积注意复用模型/共享贴图。
