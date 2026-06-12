---
milestone: M0
title: 技术验证 Spike（相机动态拉远 + 单文件体积）
created: 2026-06-12
updated: 2026-06-12
status: done
parent: ../game-design.spec.md
---

# M0：技术验证 Spike

## 目标

在写正式玩法前验证三个"成败前提"：① Three.js 俯视相机 + GLB 幼兽 + 摇杆移动跑通；② **相机随玩家体型平滑动态拉远**手感成立；③ 单文件打包体积可控（≤5MB 是硬约束）。

## 验收标准

- [x] 一个低面数幼兽模型显示在 3/4 俯视相机下（GLB 加载路径已就绪，无资源时回退程序化幼兽；pitch ≈ 54°）
- [x] 摇杆（任意点拖动）控制幼兽在地面 XZ 平面自由移动（`InputController`，含键盘 WASD 备用）
- [x] 把玩家等级 1→405（scale 1→14）时，相机在「高度 + 距离」上**平滑插值拉远**揭示整岛，俯角保持稳定（`CameraRig`）
- [x] 用 `vite-plugin-singlefile` 产出**单文件 HTML**：`npm run build:single` → `dist/index.html` ≈ **600 KB**（gzip ≈ 158 KB），即 Three.js + spike 代码基线，**留给模型/贴图约 4.4 MB**
- [~] 帧率：本地 `npm run dev` 可实测（自动化占位浏览器 rAF 被挂起，FPS 显示 0 为环境假象）；`pixelRatio` 已钳制 ≤2

## M0 结论

- **管线成立**：3/4 俯视相机 + 模型 + 摇杆 + 动态拉远全部跑通（见 spike 截图）。
- **体积可行**：单文件基线仅 ~600 KB，距 5MB 红线有充裕余量；模型/贴图预算约 4.4 MB，需在 M3/M5 用 Draco + 共享贴图控制。
- **下一步**：M1 移植 `CombatSystem`，把"手动调等级"换成"吃怪升级"驱动同一套体型/相机曲线。
- **遗留**：`dist` 仍有 favicon.svg/icons.svg 两个小外链（~14KB），M5 单文件化时一并内联以满足"零外部请求"。

## 涉及模块

### 新增模块

| 模块 | Spec | 代码路径 | 说明 |
|------|------|----------|------|
| CameraRig（验证版） | [spec](../systems/CameraRig.spec.md) | `src/systems/CameraRig.ts` | 体型→距离/高度插值 |
| InputController（验证版） | [spec](../systems/InputController.spec.md) | `src/systems/InputController.ts` | 摇杆 → 方向向量 |

## 开发顺序

1. SceneManager/BaseScene 跑通空场景（脚手架自带）
2. ModelUtils 加载一个 GLB 幼兽并归一化
3. InputController 摇杆移动
4. CameraRig 体型→相机插值（手动滑条调 scale 验证）
5. singlefile 打包 + 体积/帧率量化

## 数值参数

| 参数 | 值 | 说明 |
|------|-----|------|
| cameraPitch | ~50–60° | 俯角 |
| cameraDistanceByLevel | 待定曲线 | M0 用 2-3 个采样点验证插值 |
| pixelRatioCap | 2 | 钳制上限 |

## 备注

- 体积是第一风险：模型/贴图是大头，M0 必须给出量化结论与压缩方向（Draco / 贴图尺寸 / 合并）。
- 若单文件 + 单模型已逼近 5MB，需在 M0 即决定降面/共享贴图策略。
