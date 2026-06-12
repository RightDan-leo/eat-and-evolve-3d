---
target: src/systems/InputController.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: orchestration
related: [../scenes/GameScene.spec.md]
---

# InputController（编排层 · 摇杆）

## 职责
把触摸/鼠标拖动转为地面 XZ 平面的移动方向向量，喂给 GameScene 驱动玩家位移；PC 兼容 WASD。

## 行为
- 屏幕**任意位置**按下 → 出现摇杆基点（DRAG TO MOVE）。
- 拖动 → 方向向量（基点→当前点），长度钳制为最大值，归一化为移动方向。
- 松开 → 停止（或保留惯性，沿用 2D 手感参数）。
- WASD 备用（PC）。
- 仅产出意图（方向/强度），不直接改渲染对象。

## 参数（config 可调）
| 参数 | 说明 |
|------|------|
| joystickRadius | 摇杆半径 |
| moveSpeedByLevel | 速度曲线（沿用 2D） |
| deadZone | 死区 |

## 验收
- [ ] 任意点拖动出现摇杆并控制方向
- [ ] 速度/手感与 2D 一致
- [ ] 仅输出方向意图，无渲染耦合
