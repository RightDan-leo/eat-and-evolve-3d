---
target: src/systems/DevourFx.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: view
related: [../entities/Dragon.spec.md, CombatSystem.spec.md]
---

# DevourFx（表现层 · 吞噬特效 3D 重做）

## 职责
在击败敌人/打开宝箱时播放"满足感"反馈：肉块/粒子从目标爆出 → 朝玩家吸入 → 玩家吸收脉冲 + 升级金环。**命中/吸收数值在逻辑层；本模块只做表现。**

## 与 2D 差异
2D `DevourSystem` 用 Phaser 图形；本作用 3D 粒子/小 mesh（合批），表现全新写，触发时机由逻辑层事件驱动。

## 行为
- 收到 `defeated` 事件 → 在目标位置爆出 N 块"肉"（小 mesh / 粒子）。
- 肉块朝玩家 home 飞入 → 到达触发玩家 scale punch 脉冲。
- 升级时叠加金色光环 shockwave + 屏幕轻微反馈。
- 性能：粒子/肉块对象池复用，避免每帧 new。

## 参数（config 可调）
| 参数 | 说明 |
|------|------|
| chunkCount | 肉块数量 |
| chunkHomeSpeed | 吸入速度 |
| pulseScale | 吸收脉冲幅度 |
| ringColor | 升级金环颜色 |

## 验收
- [ ] 击败怪有肉块爆出→吸入→脉冲
- [ ] 升级有金环
- [ ] 对象池复用，无明显掉帧
