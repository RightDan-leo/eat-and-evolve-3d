---
target: src/scenes/GameScene.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: orchestration
related: [../architecture.md]
---

# GameScene（编排层 · 主场景）

## 职责
组装逻辑层与表现层：每帧跑逻辑 tick（Combat/Evolution/Spawn）→ 同步表现（实体 mesh / 体型 / 标签 / 相机 / 特效）→ 由内置 Director 编排进化弹窗、Titan 登场、结算与 CTA 流程。**不写玩法数值规则**（在逻辑层），**不反向污染逻辑层**。

## 主循环
```
update(dt):
  dir = InputController.read()
  movePlayer(dir)
  ev1 = CombatSystem.step(playerState, enemies)
  ev2 = EvolutionSystem.step(exp)
  ev3 = SpawnSystem.step(playerPos, playerLv)
  applyEvents(ev1, ev2, ev3):
     - defeated → DevourFx + Enemy 回收 + expGain
     - levelUp/formUp → Dragon morph/光环 + 体型
     - branchOffer → 暂停 + EvolutionChoicePanel
     - spawn/spawnTitan → Enemy/Titan 视图创建
  Dragon/Enemy/Titan 同步位置&体型（插值）
  LabelLayer.update()
  CameraRig.follow(player.size)
  Director.step()   # Titan 登场 / 结算 / CTA
```

## Director（内置编排）
- 玩家达阈值 → 双 Titan 登场演出（相机聚焦→字幕→回玩家+箭头），满级触发延迟 1s。
- 吃紫 Titan → 体型暴涨 + 相机全拉远。
- win/lose 判定 → HudOverlay 结算 → CTA 跳商店。

## 状态
`playing | cinematic（进化选择/Titan 登场/结算）`，cinematic 暂停玩法 tick。

## 验收
- [ ] 逻辑 tick → 表现同步链路完整
- [ ] 进化弹窗/Titan 登场/结算 cinematic 正确暂停与恢复
- [ ] 逻辑层零被反向依赖（架构红线）
