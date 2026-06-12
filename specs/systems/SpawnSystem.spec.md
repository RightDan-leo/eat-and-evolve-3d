---
target: src/logic/systems/SpawnSystem.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: logic
related: [../entities/Enemy.spec.md, ../entities/Titan.spec.md]
---

# SpawnSystem（逻辑层 · 移植自 2D）

## 职责
按分区/距中心半径生成敌人并定其等级；开场在玩家出生点附近刷 starterPrey；终局生成双 Titan。输出刷怪/移除事件。**纯 TS。**

## 输入
- 玩家位置(XZ)、当前等级
- 地图分区/半径→等级规则（`config/data`，环形岛 XZ）
- starterPrey 配置、Titan 配置

## 核心规则（与 2D 一致）
- **越靠环形岛中心，怪等级越高、体型越大**（压迫感）。
- **starterPrey**：出生点附近刷若干绿怪，开场即可秒杀。
- 维持目标密度，远离玩家的怪可回收。
- 玩家达阈值 → 生成**双 Titan**（紫 Lv.100 / 红 Lv.190 示例），其余怪相对缩小。

## 输出
- `spawn{ enemy }`、`despawn{ enemyId }`、`spawnTitan{ titans }`

## 接口（示意）
```ts
step(playerPos, playerLv): SpawnEvents
```

## 移植注意
坐标由 2D 像素改为 3D XZ；分区/等级/starterPrey/Titan 缩放规则保留。

## 验收
- [ ] 越中心怪越强；starterPrey 出生点附近可秒杀
- [ ] 双 Titan 在阈值正确生成
- [ ] 无 three/Phaser/DOM import
