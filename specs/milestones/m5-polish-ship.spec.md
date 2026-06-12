---
milestone: M5
title: 投放打磨（竖屏 + 音效 + 性能 + 单文件 ≤5MB）
created: 2026-06-12
updated: 2026-06-12
status: done
parent: ../game-design.spec.md
---

# M5：投放打磨

## 目标

把成品打磨为**可投放的买量 Playable 素材**：竖屏适配、音效集成、性能优化、Draco/贴图压缩，并用 `vite-plugin-singlefile` 产出零外部请求的单文件 HTML，体积 ≤5MB。

## 验收标准

- [ ] 竖屏（9:16）与常见手机分辨率自适配，HUD/摇杆/面板不溢出
- [ ] 音效集成（吞噬/升级/进化/Titan/结算），WebAudio 内联，可静音
- [ ] 性能：中端 60 / 低端 ≥30 FPS；`pixelRatio` ≤2；群怪 InstancedMesh 合批
- [ ] 模型 Draco 压缩 + 贴图尺寸/格式优化 + 共享贴图
- [ ] **单文件 HTML 产物 ≤5MB、零外部请求**，可直接投放/广告 SDK 内嵌
- [ ] 首屏 < 3s；CTA 跳转可配置

## 涉及模块

### 修改模块

| 模块 | Spec | 变更内容 |
|------|------|----------|
| ModelUtils | [spec](../core/ModelUtils.spec.md) | 接 Draco 解码器 |
| 全体表现层 | [spec](../game-design.spec.md) | 竖屏适配 + 性能优化 |
| 构建 | [spec](../architecture.md) | vite-plugin-singlefile 内联 |

## 开发顺序

1. 竖屏/分辨率适配
2. 音效集成
3. 性能优化（合批/pixelRatio/裁剪）
4. Draco + 贴图压缩
5. 单文件打包 + 体积/帧率终验

## 数值参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 单文件体积上限 | ≤5MB | 硬约束 |
| pixelRatioCap | 2 | 钳制 |
| 目标帧率 | 60 / ≥30 | 中/低端 |

## 备注
体积是发布门槛：若超标，按 降面 → 共享贴图 → 降贴图尺寸 → Draco 强度 顺序处理。
