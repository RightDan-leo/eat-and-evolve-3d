---
target: src/systems/CameraRig.ts
created: 2026-06-12
updated: 2026-06-12
status: draft
layer: view
related: [../entities/Dragon.spec.md]
---

# CameraRig（表现层 · 3D 新增核心手感）

## 职责
3/4 俯视透视相机跟随玩家，并随玩家体型在「距离 + 高度」上**连续平滑插值拉远**，营造"世界越来越小"的核心视觉爽点。

## 与 2D 差异
2D 用 `zoomByLevel` 分级离散缩放；本作改为体型→相机参数的**连续插值**（可配曲线 `cameraDistanceByLevel`）。

## 行为
- 俯角固定 ~50–60°（可配 `cameraPitch`）。
- 相机目标点 = 玩家位置（带平滑 lerp，避免抖动）。
- 相机距离/高度 = `f(玩家体型/等级)`，按曲线插值；玩家变大 → 拉远。
- 终局（吃 Titan / 满级）可触发"完全拉远整岛入画"。
- `pixelRatio` 钳制 ≤2。

## 参数（config 可调）
| 参数 | 说明 |
|------|------|
| cameraPitch | 俯角 |
| cameraDistanceByLevel | 体型/等级→距离曲线 |
| cameraHeightByLevel | 体型/等级→高度曲线 |
| followLerp | 跟随平滑系数 |
| zoomLerp | 拉远平滑系数 |

## 验收
- [ ] 玩家变大相机平滑拉远，不突变不晕
- [ ] 曲线参数全部可在 config 调
- [ ] 终局可完全拉远整岛入画
